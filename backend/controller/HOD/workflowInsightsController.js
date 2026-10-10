const ActivityLog    = require("../../models/ActivityLog")
const User           = require("../../models/User")
const Notification   = require("../../models/Notification")
const WorkflowAction = require("../../models/HOD/WorkflowAction")

/* ═══════════════════════════════════════════════════════════════════════════
   WORKFLOW INSIGHTS  (HOD side of the faculty "Workflow Review" page)

   PRIVACY RULES THIS FILE ENFORCES — the HOD must never be able to tell who said what:
   • No response ever contains a report's text, timestamp, or any respondent identifier.
     Only counts, percentages and fixed theme labels leave this file.
   • Details (themes, percentages, trend, impact) are shown only when a category has at
     least MIN_REPORTS reports; percentages also need MIN_RESPONDENTS different respondents.
   • Percentages are rounded to the nearest 5%.
   ═══════════════════════════════════════════════════════════════════════════ */

const MIN_REPORTS      = 3     // below this a category shows only its count — no themes/trend/impact
const MIN_RESPONDENTS  = 5     // below this no "% of respondents" is shown
const PERIODS          = [30, 90, 180, 365]
const DEFAULT_DAYS     = 90
const CHANGE_THRESHOLD = 20    // % change needed before an action is called improved / worse
const MIN_MEASURE_DAYS = 14    // days of feedback needed after a change before it is judged
const MAX_MEASURE_DAYS = 30    // before/after windows are capped at this length
const PERSIST_WEEKS    = 3     // "reported repeatedly" = reports in at least this many of the last 6 weeks
const WIDESPREAD_PCT   = 40    // "raised by many" = at least this share of respondents

// Feedback submitted before departments were recorded has no department. true = show it to every HOD.
const INCLUDE_UNASSIGNED_FEEDBACK = true
// Tell all department faculty when an improvement action starts / is completed (no names involved).
const NOTIFY_FACULTY = true

const DAY = 864e5
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const iso = (d) => (d ? new Date(d).toISOString() : null)

const wrap = (fn) => async (req, res) => {
  try { await fn(req, res) }
  catch (err) {
    console.error("Workflow insights error:", err)
    res.status(500).json({ success: false, message: err.message })
  }
}

/* ═══════════════════ themes & suggestions (edit freely) ═══════════════════
   A theme matches a report when EVERY regex in `all` matches its text.
   Themes are only used to count; the report text itself is never returned. */
const T = (label, ...all) => ({ label, all })

const APPROVAL_THEMES = [
  T("Leave approval takes too long", /\bleaves?\b/, /\b(delay\w*|slow\w*|long|late|pending|wait\w*|stuck|weeks?|days|took|taking|takes?)\b/),
  T("Extra-duty approval process is unclear", /\b(extra[\s-]?dut\w*|duty|duties)\b/, /\b(unclear|confus\w*|not clear|unsure|not sure|no idea|vague|no clarity|do not know|don'?t know)\b/),
  T("Requests require multiple follow-ups", /\b(follow[\s-]?ups?|follow(ing)? up|remind\w*|chas(e|ed|ing)|again and again|multiple times|several times|many times|repeated\w*|keep (asking|calling))\b/),
  T("No status updates on pending requests", /\b(no (status|update|updates|response|reply|feedback)|not (been )?informed|never (heard|informed|told)|unresponsive|status)\b/),
]
const RESOURCE_THEMES = [
  T("Rooms or labs are not available when needed", /\b(room|rooms|classroom|classrooms|lab|labs|hall|venue|seminar)\b/, /\b(not available|unavailable|clash\w*|double[\s-]?book\w*|shortage|occupied|booked|no (room|lab))\b/),
  T("Equipment or software is missing or outdated", /\b(equipment|projector|computers?|pcs?|systems?|software|licen[cs]es?|hardware|printers?|wi-?fi|internet|network)\b/, /\b(broken|not working|outdated|old|missing|lack\w*|shortage|slow|unavailable|down|faulty)\b/),
  T("Teaching materials or supplies are hard to get", /\b(materials?|books?|supplies|stationery|journals?|consumables?|kits?)\b/, /\b(not available|lack\w*|shortage|delay\w*|unable|can'?t get|cannot get)\b/),
]
const COMMUNICATION_THEMES = [
  T("Information reaches faculty too late", /\b(late|last[\s-]?minute|short notice|delayed|sudden\w*|too late)\b/, /\b(inform\w*|notif\w*|circulars?|announce\w*|notices?|messages?|e-?mails?|updates?|schedules?|meetings?)\b/),
  T("Unclear who to contact", /\b(who (to|should)|whom (to|should)|point of contact|which (person|office|department)|no one (knows|to ask))\b/),
  T("Decisions are not communicated", /\b(decisions?|outcomes?|results?)\b/, /\b(not (been )?(communicated|shared|informed|told)|never|no (communication|information|update))\b/),
  T("Conflicting instructions or too many channels", /\b(conflict\w*|contradict\w*|different (instructions?|information|messages?)|mixed messages?|multiple (channels|groups)|whatsapp|too many (e-?mails|messages|groups))\b/),
]
const POLICY_THEMES = [
  T("Rules or procedures are unclear", /\b(unclear|confus\w*|not clear|vague|ambiguous|no clarity|do not understand|don'?t understand|not sure)\b/, /\b(polic\w*|rules?|procedures?|guidelines?|process\w*|criteria|regulations?)\b/),
  T("Policies change without notice", /\b(chang\w*|updat\w*|revis\w*|new rules?)\b/, /\b(without|no notice|suddenly|sudden|not informed|unannounced|frequent\w*)\b/),
  T("Rules are applied inconsistently", /\b(inconsisten\w*|unfair\w*|favou?rit\w*|biased|partial|not applied|not followed)\b/),
]
const WORKLOAD_THEMES = [
  T("Duties are not shared evenly", /\b(dut(y|ies)|tasks?|work|load|assignments?)\b/, /\b(uneven\w*|unequal\w*|unfair\w*|not (shared|distributed|equal)|too (many|much)|overload\w*|burden\w*)\b/),
  T("Too much paperwork or administration", /\b(paper ?work|admin\w*|reports?|forms?|documentation|data entry|records?|portal)\b/, /\b(too (many|much)|excess\w*|repetit\w*|duplicate\w*|burden\w*|time[\s-]?consuming)\b/),
  T("Deadlines are too short", /\b(deadlines?|due dates?|submit\w*)\b/, /\b(short|tight|last[\s-]?minute|too (soon|early)|unrealistic|sudden\w*)\b/),
]
const ALL_THEMES = [...APPROVAL_THEMES, ...RESOURCE_THEMES, ...COMMUNICATION_THEMES, ...POLICY_THEMES, ...WORKLOAD_THEMES]

const GENERIC_SUGGESTION = {
  headline: "Review the workflow behind these reports.",
  why: "Multiple anonymous reports point to a recurring workflow problem.",
  options: [
    "Map the current process and find where it breaks down",
    "Agree one owner and a clear timeline for fixing it",
    "Share an update with the department on what will change",
  ],
}

const CATEGORY_CONFIG = {
  "Approval Delays": {
    themes: APPROVAL_THEMES,
    suggestion: {
      headline: "Review the current approval workflow.",
      why: "Multiple anonymous reports indicate delays in the approval process.",
      options: [
        "Set and publish a standard response time for approvals",
        "Send reminders for requests pending more than 2 working days",
        "Appoint a backup approver for when you are unavailable",
        "Give requesters a status update at each approval stage",
      ],
    },
  },
  "Resource Availability Issues": {
    themes: RESOURCE_THEMES,
    suggestion: {
      headline: "Review how rooms, labs and equipment are allocated.",
      why: "Multiple anonymous reports indicate resources are not available when faculty need them.",
      options: [
        "Audit rooms, labs and equipment against what the timetable needs",
        "Create a simple resource request process with a response time",
        "Share a resource availability calendar with the department",
        "Escalate recurring shortages with a budget request",
      ],
    },
  },
  "Communication Gaps": {
    themes: COMMUNICATION_THEMES,
    suggestion: {
      headline: "Review how information reaches the department.",
      why: "Multiple anonymous reports indicate gaps in how information is shared.",
      options: [
        "Fix one channel and cadence for department announcements",
        "Hold a short monthly department sync",
        "Summarise decisions in writing after every meeting",
        "Ask for confirmation of receipt on important circulars",
      ],
    },
  },
  "Policy or Procedure Clarity Issues": {
    themes: POLICY_THEMES,
    suggestion: {
      headline: "Clarify the policies and procedures people are unsure about.",
      why: "Multiple anonymous reports indicate policies or procedures are not clear.",
      options: [
        "Publish a one-page guide for the unclear procedures",
        "Add an FAQ for the questions faculty ask most",
        "Brief the department whenever a policy changes",
        "Name a point of contact for policy questions",
      ],
    },
  },
  "Workload Distribution Issues": {
    themes: WORKLOAD_THEMES,
    suggestion: {
      headline: "Review how work is distributed across the department.",
      why: "Multiple anonymous reports indicate workload is not distributed evenly.",
      options: [
        "Use Smart Duty Allocation to spread duties by current workload",
        "Review administrative tasks that can be simplified or removed",
        "Give more notice before deadlines and duties",
      ],
    },
  },
  "Other": { themes: ALL_THEMES, suggestion: GENERIC_SUGGESTION },
}
const configFor = (name) => CATEGORY_CONFIG[name] || { themes: ALL_THEMES, suggestion: GENERIC_SUGGESTION }

/* ═══════════════════ data loading ═══════════════════ */

function deptFilter(dept) {
  if (!dept) return {}
  const re = new RegExp(`^${escapeRe(dept)}$`, "i")
  return { department: re }
}

async function loadRows(dept) {
  const filter = { type: "workflow" }
  if (dept) {
    const or = [deptFilter(dept)]
    if (INCLUDE_UNASSIGNED_FEEDBACK) or.push({ department: { $in: [null, ""] } })
    filter.$or = or
  }
  // respondentKey is select:false in the model; it is read here only to count DISTINCT respondents.
  const docs = await ActivityLog.find(filter).select("subject detail timestamp createdAt +respondentKey").lean()
  return docs
    .map((d) => ({
      category: String(d.subject || "").trim() || "Other",
      text: String(d.detail || "").toLowerCase(),
      at: new Date(d.timestamp || d.createdAt).getTime(),
      who: d.respondentKey || null,
    }))
    .filter((r) => !isNaN(r.at))
}

const loadActions = (dept) => WorkflowAction.find(deptFilter(dept)).sort({ startedAt: -1 }).lean()

/* ═══════════════════ aggregation ═══════════════════ */

const inRange = (rows, from, to) => rows.filter((r) => r.at >= from && r.at < to)

function trendOf(cur, prev) {
  if (prev === 0 && cur === 0) return { direction: null, pct: null }
  if (prev === 0) return { direction: "new", pct: null }
  const pct = Math.round(((cur - prev) / prev) * 100)
  return { direction: pct > 0 ? "up" : pct < 0 ? "down" : "flat", pct: Math.abs(pct) }
}

function themeCounts(rows, category) {
  const themes = configFor(category).themes
  const counts = new Map()
  for (const r of rows) {
    for (const th of themes) {
      if (th.all.every((re) => re.test(r.text))) counts.set(th.label, (counts.get(th.label) || 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .filter((t) => t.count >= MIN_REPORTS)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

// "About 40%" — rounded to the nearest 5, never exact, and only with enough respondents.
function respondentShare(catRows, totalRespondents) {
  if (totalRespondents < MIN_RESPONDENTS) return { available: false, reason: "few-respondents" }
  const keyed = new Set(catRows.filter((r) => r.who).map((r) => r.who)).size
  const raw = (keyed / totalRespondents) * 100
  if (raw < 5) return { available: true, percent: 0, label: "Fewer than 5%" }
  const percent = Math.min(100, Math.round(raw / 5) * 5)
  return { available: true, percent, label: `About ${percent}%` }
}

function impactOf({ count, prev, themes, sharePct, weeksPresent }) {
  const reasons = []
  if (count > prev && (prev === 0 || ((count - prev) / prev) * 100 >= CHANGE_THRESHOLD)) reasons.push("Increasing frequency")
  if (themes.length >= 2) reasons.push("Multiple workflow areas affected")
  if (weeksPresent >= PERSIST_WEEKS) reasons.push("Reported repeatedly over time")
  if (sharePct != null && sharePct >= WIDESPREAD_PCT) reasons.push("Raised by a large share of respondents")
  const level = reasons.length >= 3 ? "High" : reasons.length === 2 ? "Medium" : "Low"
  return { level, reasons }
}

/* Did an improvement action work?  Compare equal-length windows:
     before = the W days before the action started
     after  = the first W days after it was marked resolved   (W = days since resolved, max 30, min 14) */
function measure(action, catRows, now) {
  const started = new Date(action.startedAt).getTime()
  if (action.status !== "Resolved" || !action.resolvedAt) {
    return { state: "in-progress", reportsSinceStart: catRows.filter((r) => r.at >= started && r.at <= now).length }
  }
  const resolved = new Date(action.resolvedAt).getTime()
  const sinceDays = Math.floor((now - resolved) / DAY)
  if (sinceDays < MIN_MEASURE_DAYS) {
    return { state: "measuring", daysElapsed: sinceDays, daysNeeded: MIN_MEASURE_DAYS - sinceDays }
  }
  const W = Math.min(sinceDays, MAX_MEASURE_DAYS)
  const before = inRange(catRows, started - W * DAY, started).length
  const after  = inRange(catRows, resolved, resolved + W * DAY).length
  if (before < 1) return { state: "insufficient", before, after, windowDays: W }
  const changePct = Math.round(((after - before) / before) * 100)
  const state = changePct <= -CHANGE_THRESHOLD ? "improved" : changePct >= CHANGE_THRESHOLD ? "worse" : "no-change"
  return { state, before, after, windowDays: W, changePct }
}

const shapeAction = (a, catRows, now) => ({
  id: String(a._id),
  category: a.category,
  steps: a.steps || [],
  note: a.note || "",
  targetDate: a.targetDate || "",
  status: a.status,
  startedAt: iso(a.startedAt),
  resolvedAt: iso(a.resolvedAt),
  outcomeNote: a.outcomeNote || "",
  result: measure(a, catRows, now),
})

function buildInsights({ rows, actionDocs, days, now, dept }) {
  const curFrom = now - days * DAY
  const prevFrom = now - 2 * days * DAY
  const cur = inRange(rows, curFrom, now + 1)
  const prev = inRange(rows, prevFrom, curFrom)
  const totalRespondents = new Set(cur.filter((r) => r.who).map((r) => r.who)).size

  const byCat = (list) => list.reduce((m, r) => ((m[r.category] = m[r.category] || []).push(r), m), {})
  const curBy = byCat(cur)
  const prevBy = byCat(prev)
  const allBy = byCat(rows)
  const actionsBy = [...actionDocs]
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))          // newest first
    .reduce((m, a) => ((m[a.category] = m[a.category] || []).push(a), m), {})

  const names = [...new Set([...Object.keys(curBy), ...Object.keys(actionsBy)])]
  const categories = names.map((name) => {
    const catRows = curBy[name] || []
    const count = catRows.length
    const previous = (prevBy[name] || []).length
    const identified = count >= MIN_REPORTS
    const actions = (actionsBy[name] || []).map((a) => shapeAction(a, allBy[name] || [], now))   // newest first
    const canAct = count > 0 || actions.length > 0       // any report, even one, can be acted on

    let details = null
    let suggestion = null
    if (identified) {
      const themes = themeCounts(catRows, name)
      const share = respondentShare(catRows, totalRespondents)
      const weeksPresent = new Set(
        (allBy[name] || []).filter((r) => r.at >= now - 6 * 7 * DAY && r.at <= now).map((r) => Math.floor((now - r.at) / (7 * DAY)))
      ).size
      details = {
        respondentShare: share,
        trend: trendOf(count, previous),
        impact: impactOf({ count, prev: previous, themes, sharePct: share.available ? share.percent : null, weeksPresent }),
        themes,
        themesNote: themes.length ? "" : `No single concern was raised in ${MIN_REPORTS} or more reports, so none is shown.`,
      }
    }
    if (canAct) suggestion = configFor(name).suggestion
    return { name, count, previous, identified, details, suggestion, actions }
  }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

  const resolvedIssues = categories.filter((c) => c.actions[0] && c.actions[0].status === "Resolved").length
  const issuesIdentified = categories.filter((c) => c.count > 0 || c.actions.length).length

  return {
    department: dept,
    days,
    privacy: {
      minReports: MIN_REPORTS,
      minRespondents: MIN_RESPONDENTS,
      respondentTracking: !!process.env.WORKFLOW_ANON_SECRET,
    },
    summary: {
      totalFeedback: cur.length,
      trend: trendOf(cur.length, prev.length),
      issuesIdentified,
      resolvedIssues,
    },
    categories,
    actions: categories.flatMap((c) => c.actions).sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt)),
  }
}

/* ═══════════════════ notifications (broadcast to the whole department — no names) ═══════════════════ */

async function notifyDepartment(dept, title, message) {
  if (!NOTIFY_FACULTY) return
  try {
    const filter = { role: "teaching", ...deptFilter(dept) }
    const faculty = await User.find(filter).select("_id").lean()
    await Promise.all(faculty.map((f) =>
      Notification.create({ userId: f._id, type: "system", title, message, link: "/workflow" }).catch(() => {})))
  } catch {}
}

/* ═══════════════════ handlers ═══════════════════ */

// GET /api/hod/workflow-insights?days=90
exports.getInsights = wrap(async (req, res) => {
  const days = PERIODS.includes(Number(req.query.days)) ? Number(req.query.days) : DEFAULT_DAYS
  const [rows, actionDocs] = await Promise.all([loadRows(req.dept), loadActions(req.dept)])
  res.json({ success: true, data: buildInsights({ rows, actionDocs, days, now: Date.now(), dept: req.dept }) })
})

const cleanText = (v, max) => String(v || "").trim().slice(0, max)

// POST /api/hod/workflow-insights/actions   { category, steps[], customStep?, note?, targetDate? }
exports.createAction = wrap(async (req, res) => {
  const category = cleanText(req.body.category, 100)
  if (!category) return res.status(400).json({ success: false, message: "Category is required" })

  const steps = (Array.isArray(req.body.steps) ? req.body.steps : [])
    .map((s) => cleanText(s, 200)).filter(Boolean).slice(0, 8)
  const custom = cleanText(req.body.customStep, 200)
  if (custom) steps.push(custom)
  if (!steps.length) return res.status(400).json({ success: false, message: "Choose at least one step or write your own" })

  const targetDate = cleanText(req.body.targetDate, 10)
  if (targetDate) {
    const today = new Date().toISOString().slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate) || isNaN(new Date(`${targetDate}T00:00:00Z`).getTime())) {
      return res.status(400).json({ success: false, message: "Review date is not valid" })
    }
    if (targetDate < today) return res.status(400).json({ success: false, message: "Review date cannot be in the past" })
  }

  const rows = await loadRows(req.dept)
  if (!rows.some((r) => r.category === category)) {
    return res.status(404).json({ success: false, message: "No feedback exists for that category" })
  }
  const open = await WorkflowAction.findOne({ ...deptFilter(req.dept), category, status: "In Progress" }).lean()
  if (open) return res.status(409).json({ success: false, message: "An improvement action is already in progress for this issue" })

  const action = await WorkflowAction.create({
    department: req.dept, category, steps, targetDate,
    status: "In Progress", startedAt: new Date(),
    note: cleanText(req.body.note, 500),
    createdById: String(req.user._id),
  })
  await notifyDepartment(req.dept, "Your feedback is being acted on",
    `The department has started an improvement action for "${category}", based on anonymous workflow feedback.`)
  res.status(201).json({ success: true, data: shapeAction(action.toObject ? action.toObject() : action, rows.filter((r) => r.category === category), Date.now()) })
})

// PATCH /api/hod/workflow-insights/actions/:id/resolve   { outcomeNote? }
exports.resolveAction = wrap(async (req, res) => {
  const action = await WorkflowAction.findById(req.params.id)
  if (!action || action.department !== req.dept) return res.status(404).json({ success: false, message: "Action not found" })
  if (action.status === "Resolved") return res.status(400).json({ success: false, message: "This action is already resolved" })
  action.status = "Resolved"
  action.resolvedAt = new Date()
  action.outcomeNote = cleanText(req.body.outcomeNote, 500)
  await action.save()
  await notifyDepartment(req.dept, "Workflow improvement made",
    `Changes have been made for "${action.category}". If you notice a difference — or not — please share it in Workflow Review so we can check whether it helped.`)
  const rows = (await loadRows(req.dept)).filter((r) => r.category === action.category)
  res.json({ success: true, data: shapeAction(action.toObject ? action.toObject() : action, rows, Date.now()) })
})

// DELETE /api/hod/workflow-insights/actions/:id
exports.deleteAction = wrap(async (req, res) => {
  const action = await WorkflowAction.findById(req.params.id)
  if (!action || action.department !== req.dept) return res.status(404).json({ success: false, message: "Action not found" })
  await action.deleteOne()
  res.json({ success: true })
})