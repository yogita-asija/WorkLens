/**
 * HOD · Leave Management endpoints (everything the "Leave Management" page calls).
 *
 *   GET   /api/hod/leaves/overview            stat cards
 *   GET   /api/hod/leaves/history             filter + search + paginate
 *   GET   /api/hod/leaves/export              same filters, CSV download
 *   GET   /api/hod/leaves/calendar?month=     who is away (month grid) + public holidays
 *   GET   /api/hod/leaves/balances?year=      allocation vs used per faculty
 *   GET   /api/hod/leaves/insights?year=      patterns across the year
 *   GET   /api/hod/leaves/:id/impact          impact assistant for one pending leave
 *   POST  /api/hod/leaves/:id/approve-with-cover   approve + assign substitutes in one step
 */
const mongoose = require("mongoose")
const Notification = require("../../models/Notification")
const Assignment = require("../../models/Assignment")
const OnlineClass = require("../../models/OnlineClass")
const DutyAllocation = require("../../models/HOD/DutyAllocation")
const { Leave, LeaveBalance, Holiday } = require("../../models/Leave")
const { HodTask, QuestionPaper, Substitution, Deadline, FacultyStatus } = require("../../models/HOD/HodModels")
const H = require("../../utils/hodHelpers")

const wrap = H.wrap("hodLeave")

const DEFAULT_ALLOCATION = 12
const MAX_WINDOW_DAYS = 31
const LEAVE_TYPES = ["Sick", "Casual", "Earned"]
const LEAVE_STATUSES = ["Pending", "Approved", "Rejected"]
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/* ───────────────────────── small helpers ───────────────────────── */

// Leaves approved/rejected before the `decidedAt` field existed fall back to `updatedAt`.
const decidedOf = (l) => l.decidedAt || (l.status !== "Pending" ? l.updatedAt : null)
const plural = (n, one, many) => (n === 1 ? one : many)

async function notify(userId, title, message) {
  try { await Notification.create({ userId, type: "system", title, message }) } catch { /* best-effort */ }
}

/** Every day key from `fromKey` to `toKey` inclusive (hard-capped so a bad date can't loop forever). */
function eachKey(fromKey, toKey, cap = 400) {
  const out = []
  for (let k = fromKey, i = 0; k <= toKey && i < cap; k = H.addKeyDays(k, 1), i++) out.push(k)
  return out
}

/** Scheduled classes of one faculty member (main-teacher courses) that fall in [fromKey, toKey]. */
function classSlots(courses, facultyId, fromKey, toKey, skipKeys = new Set(), notBeforeKey = null) {
  const mine = courses.filter((c) => H.teacherOf(c) === facultyId)
  const out = []
  for (const k of eachKey(fromKey, toKey, MAX_WINDOW_DAYS)) {
    if (notBeforeKey && k < notBeforeKey) continue
    if (skipKeys.has(k)) continue
    const weekday = H.weekdayOf(k)
    for (const c of mine) {
      if (!H.parseDays(c.schedule && c.schedule.days).includes(weekday)) continue
      const time = (c.schedule && c.schedule.time) || ""
      out.push({
        courseId: String(c._id), courseName: c.courseName, courseCode: c.courseCode || c.courseId || "",
        dateKey: k, weekday, time, room: (c.schedule && c.schedule.room) || "", range: H.parseRange(time),
      })
    }
  }
  return out
}

const holidayKeysBetween = async (fromKey, toKey) => {
  const rows = await Holiday.find({ date: { $gte: H.keyToUTC(fromKey), $lte: H.keyToUTC(toKey) } }).lean()
  return new Set(rows.map((h) => H.utcKey(h.date)))
}

const yearBounds = (year) => ({ start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year + 1, 0, 1)) })
const parseYear = (v) => {
  const y = Number(v)
  return Number.isInteger(y) && y >= 2000 && y <= 2100 ? y : new Date().getFullYear()
}

/* ═══════════════════════════ OVERVIEW ═══════════════════════════ */

exports.getOverview = wrap(async (req, res) => {
  const ctx = await H.loadDept(req)
  const today = H.localKey()
  const in14 = H.addKeyDays(today, 14)
  const in7 = H.addKeyDays(today, 7)
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))

  const leaves = await Leave.find({
    facultyId: { $in: ctx.idStrs },
    $or: [
      { status: "Pending" },
      { status: "Approved", toDate: { $gte: H.keyToUTC(today) } },
      { status: { $in: ["Approved", "Rejected"] }, decidedAt: { $gte: monthStart } },
      { status: { $in: ["Approved", "Rejected"] }, decidedAt: { $exists: false }, updatedAt: { $gte: monthStart } },
    ],
  }).sort({ appliedAt: 1 }).lean()

  const brief = (l) => ({ _id: l._id, facultyId: l.facultyId, facultyName: l.facultyName, type: l.type, fromDate: l.fromDate, toDate: l.toDate })

  const pending = leaves.filter((l) => l.status === "Pending")
  const waited = (l) => Math.floor((now - new Date(l.appliedAt)) / 864e5)
  const oldest = pending[0] // sorted by appliedAt asc

  const approved = leaves.filter((l) => l.status === "Approved")
  const awayToday = approved.filter((l) => H.utcKey(l.fromDate) <= today && H.utcKey(l.toDate) >= today).map(brief)
  const upcoming = approved
    .filter((l) => H.utcKey(l.fromDate) > today && H.utcKey(l.fromDate) <= in14)
    .sort((a, b) => new Date(a.fromDate) - new Date(b.fromDate)).map(brief)

  const decidedThisMonth = leaves.filter((l) => l.status !== "Pending" && decidedOf(l) && new Date(decidedOf(l)) >= monthStart)

  // classes in the next 7 days that belong to an approved leave and still have no substitute
  const relevant = approved.filter((l) => H.utcKey(l.fromDate) <= in7 && H.utcKey(l.toDate) >= today)
  let uncoveredClasses = 0
  if (relevant.length) {
    const holidays = await holidayKeysBetween(today, in7)
    const subs = await Substitution.find({ leaveId: { $in: relevant.map((l) => String(l._id)) }, dateKey: { $gte: today, $lte: in7 } }).lean()
    const covered = new Set(subs.map((s) => `${s.leaveId}|${s.courseId}|${s.dateKey}`))
    for (const l of relevant) {
      const from = H.utcKey(l.fromDate) > today ? H.utcKey(l.fromDate) : today
      const to = H.utcKey(l.toDate) < in7 ? H.utcKey(l.toDate) : in7
      for (const s of classSlots(ctx.courses, l.facultyId, from, to, holidays)) {
        if (!covered.has(`${l._id}|${s.courseId}|${s.dateKey}`)) uncoveredClasses++
      }
    }
  }

  const waitingOver3Days = pending.filter((l) => waited(l) > 3).length
  res.json({
    success: true,
    data: {
      counts: {
        pending: pending.length,
        onLeaveToday: awayToday.length,
        upcoming: upcoming.length,
        approvedThisMonth: decidedThisMonth.filter((l) => l.status === "Approved").length,
        rejectedThisMonth: decidedThisMonth.filter((l) => l.status === "Rejected").length,
        uncoveredClasses,
        totalFaculty: ctx.faculty.length,
      },
      oldestPending: oldest ? { facultyName: oldest.facultyName, daysWaiting: waited(oldest) } : null,
      waitingOver3Days,
      awayToday,
      upcoming,
    },
  })
})

/* ═══════════════════════════ HISTORY + CSV ═══════════════════════════ */

/** Builds the Mongo filter from the query string. Returns null when the filter can never match (faculty outside dept). */
function historyFilter(req, ctx) {
  const { status, type, facultyId, from, to, q } = req.query
  const filter = { facultyId: { $in: ctx.idStrs } }
  if (facultyId) {
    if (!ctx.idStrs.includes(String(facultyId))) return null
    filter.facultyId = String(facultyId)
  }
  if (LEAVE_STATUSES.includes(status)) filter.status = status
  if (LEAVE_TYPES.includes(type)) filter.type = type
  // a leave matches the date range when it overlaps it
  if (DATE_RE.test(from || "")) filter.toDate = { $gte: H.keyToUTC(from) }
  if (DATE_RE.test(to || "")) filter.fromDate = { $lte: H.keyToUTC(to) }
  const text = String(q || "").trim().slice(0, 80)
  if (text) {
    const re = new RegExp(H.escapeRe(text), "i")
    filter.$or = [{ facultyName: re }, { reason: re }]
  }
  return filter
}

exports.getHistory = wrap(async (req, res) => {
  const ctx = await H.loadDept(req)
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 15))
  const filter = historyFilter(req, ctx)
  if (!filter) return res.json({ success: true, data: [], total: 0, page: 1, pages: 1 })

  const total = await Leave.countDocuments(filter)
  const pages = Math.max(1, Math.ceil(total / limit))
  const page = Math.min(pages, Math.max(1, parseInt(req.query.page, 10) || 1))
  const rows = await Leave.find(filter).sort({ appliedAt: -1 }).skip((page - 1) * limit).limit(limit).lean()

  const approvedIds = rows.filter((l) => l.status === "Approved").map((l) => String(l._id))
  const subs = approvedIds.length ? await Substitution.find({ leaveId: { $in: approvedIds } }).sort({ dateKey: 1 }).lean() : []
  const byLeave = {}
  for (const s of subs) (byLeave[s.leaveId] = byLeave[s.leaveId] || []).push({
    _id: s._id, courseName: s.courseName, dateKey: s.dateKey, time: s.time, substituteName: s.substituteName,
  })

  const data = rows.map((l) => ({ ...l, decidedAt: decidedOf(l), substitutions: byLeave[String(l._id)] || [] }))
  res.json({ success: true, data, total, page, pages })
})

// Spreadsheet apps run text starting with = + - @ as a formula; neutralise that for user-entered text.
const csvCell = (v) => {
  let s = v == null ? "" : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

exports.exportCsv = wrap(async (req, res) => {
  const ctx = await H.loadDept(req)
  const filter = historyFilter(req, ctx)
  const rows = filter ? await Leave.find(filter).sort({ appliedAt: -1 }).limit(5000).lean() : []
  const day = (d) => (d ? H.utcKey(d) : "")
  const head = ["Faculty", "Type", "From", "To", "Days", "Status", "Reason", "Applied", "Decided", "HOD note"]
  const lines = [head.map(csvCell).join(",")]
  for (const l of rows) {
    lines.push([
      l.facultyName, l.type, day(l.fromDate), day(l.toDate), l.duration, l.status, l.reason,
      day(l.appliedAt), day(decidedOf(l)), l.adminNote,
    ].map(csvCell).join(","))
  }
  res.setHeader("Content-Type", "text/csv; charset=utf-8")
  res.setHeader("Content-Disposition", `attachment; filename="leaves-${H.localKey()}.csv"`)
  res.send("\uFEFF" + lines.join("\r\n")) // BOM so Excel reads UTF-8 names correctly
})

/* ═══════════════════════════ CALENDAR ═══════════════════════════ */

exports.getCalendar = wrap(async (req, res) => {
  const month = req.query.month || H.localKey().slice(0, 7)
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return res.status(400).json({ success: false, message: "month must look like 2026-03" })
  }
  const [y, m] = month.split("-").map(Number)
  const start = new Date(Date.UTC(y, m - 1, 1))
  const end = new Date(Date.UTC(y, m, 1))
  const ctx = await H.loadDept(req)

  const [leaves, holidays] = await Promise.all([
    Leave.find({
      facultyId: { $in: ctx.idStrs }, status: { $in: ["Approved", "Pending"] },
      fromDate: { $lt: end }, toDate: { $gte: start },
    }).sort({ fromDate: 1 }).lean(),
    Holiday.find({ date: { $gte: start, $lt: end } }).sort({ date: 1 }).lean(),
  ])

  res.json({
    success: true,
    data: {
      month,
      totalFaculty: ctx.faculty.length,
      leaves: leaves.map((l) => ({ _id: l._id, facultyId: l.facultyId, facultyName: l.facultyName, type: l.type, status: l.status, fromDate: l.fromDate, toDate: l.toDate })),
      holidays: holidays.map((h) => ({ name: h.name, date: h.date, type: h.type })),
    },
  })
})

/* ═══════════════════════════ BALANCES ═══════════════════════════ */

exports.getBalances = wrap(async (req, res) => {
  const year = parseYear(req.query.year)
  const { start, end } = yearBounds(year)
  const ctx = await H.loadDept(req)

  const [leaves, balances] = await Promise.all([
    Leave.find({ facultyId: { $in: ctx.idStrs }, fromDate: { $gte: start, $lt: end } }).lean(),
    LeaveBalance.find({ facultyId: { $in: ctx.idStrs }, year }).lean(),
  ])
  const allocOf = Object.fromEntries(balances.map((b) => [b.facultyId, b.totalLeaves]))

  const rows = ctx.faculty.map((f) => {
    const id = String(f._id)
    const mine = leaves.filter((l) => l.facultyId === id)
    const byType = { Sick: 0, Casual: 0, Earned: 0 }
    let used = 0, pending = 0
    for (const l of mine) {
      if (l.status === "Approved") { used += l.duration; byType[l.type] = (byType[l.type] || 0) + l.duration }
      else if (l.status === "Pending") pending += l.duration
    }
    const allocated = allocOf[id] != null ? allocOf[id] : DEFAULT_ALLOCATION
    return { facultyId: id, name: f.name, allocated, used, remaining: allocated - used, pending, requests: mine.length, byType }
  }).sort((a, b) => a.remaining - b.remaining || a.name.localeCompare(b.name)) // least balance first

  const totals = rows.reduce((t, r) => ({ allocated: t.allocated + r.allocated, used: t.used + r.used, pending: t.pending + r.pending }), { allocated: 0, used: 0, pending: 0 })
  res.json({ success: true, data: { year, rows, totals } })
})

/* ═══════════════════════════ INSIGHTS ═══════════════════════════ */

exports.getInsights = wrap(async (req, res) => {
  const year = parseYear(req.query.year)
  const { start, end } = yearBounds(year)
  const ctx = await H.loadDept(req)
  const leaves = await Leave.find({ facultyId: { $in: ctx.idStrs }, fromDate: { $gte: start, $lt: end } }).lean()

  const approved = leaves.filter((l) => l.status === "Approved")
  const rejected = leaves.filter((l) => l.status === "Rejected")
  const pending = leaves.filter((l) => l.status === "Pending")

  // spread every approved leave over the calendar days it covers (days that spill into another year are ignored)
  const byMonth = new Array(12).fill(0)
  const dayCount = Object.fromEntries(H.WEEKDAYS.map((d) => [d, 0]))
  for (const l of approved) {
    for (const k of eachKey(H.utcKey(l.fromDate), H.utcKey(l.toDate), 366)) {
      if (!k.startsWith(String(year))) continue
      byMonth[Number(k.slice(5, 7)) - 1]++
      dayCount[H.weekdayOf(k)]++
    }
  }
  const byWeekday = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => ({ day, days: dayCount[day] }))
  const totalDays = byWeekday.reduce((s, d) => s + d.days, 0)
  const monFriShare = totalDays ? Math.round(((dayCount.Monday + dayCount.Friday) / totalDays) * 100) : null

  const decided = approved.length + rejected.length
  const waits = [...approved, ...rejected]
    .map((l) => (decidedOf(l) ? Math.max(0, (new Date(decidedOf(l)) - new Date(l.appliedAt)) / 36e5) : null))
    .filter((h) => h != null)

  const byType = LEAVE_TYPES.map((type) => {
    const mine = approved.filter((l) => l.type === type)
    return { type, count: mine.length, days: mine.reduce((s, l) => s + l.duration, 0) }
  }).filter((t) => t.count > 0)

  const perFaculty = {}
  for (const l of approved) {
    const p = (perFaculty[l.facultyId] = perFaculty[l.facultyId] || { facultyId: l.facultyId, name: l.facultyName, days: 0, requests: 0 })
    p.days += l.duration
    p.requests++
  }
  const topAbsentees = Object.values(perFaculty).sort((a, b) => b.days - a.days).slice(0, 5)

  res.json({
    success: true,
    data: {
      year,
      totals: {
        applications: leaves.length,
        approved: approved.length, rejected: rejected.length, pending: pending.length,
        approvalRate: decided ? Math.round((approved.length / decided) * 100) : null,
        avgDecisionHours: waits.length ? H.round1(waits.reduce((s, h) => s + h, 0) / waits.length) : null,
        avgDuration: approved.length ? H.round1(approved.reduce((s, l) => s + l.duration, 0) / approved.length) : null,
      },
      byMonth, byWeekday, monFriShare, byType, topAbsentees,
    },
  })
})

/* ═══════════════════════════ IMPACT ASSISTANT ═══════════════════════════ */

const weekStartKey = (k) => H.addKeyDays(k, -((H.keyToUTC(k).getUTCDay() + 6) % 7)) // Monday of that week
const subHours = (s) => { const r = H.parseRange(s.time); return r ? (r.end - r.start) / 60 : 1 }

/**
 * Works out everything the HOD needs to decide on one pending leave:
 * classes that need cover (with ranked, conflict-free substitutes), who else is away, and what else falls in the window.
 * Returns { impact, slots } – `slots` lines up 1:1 with impact.classes and keeps the parsed time range for conflict checks.
 */
async function analyzeLeave(ctx, leave) {
  const fromKey = H.utcKey(leave.fromDate)
  const toKey = H.utcKey(leave.toDate)
  const endKey = toKey < H.addKeyDays(fromKey, MAX_WINDOW_DAYS - 1) ? toKey : H.addKeyDays(fromKey, MAX_WINDOW_DAYS - 1)
  const today = H.localKey()
  const windowDays = H.diffDays(fromKey, endKey) + 1
  const winStart = H.keyToUTC(fromKey)
  const winEnd = H.keyToUTC(H.addKeyDays(endKey, 1)) // exclusive

  const holidays = await holidayKeysBetween(fromKey, endKey)
  const slots = classSlots(ctx.courses, leave.facultyId, fromKey, endKey, holidays, today)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey) || ((a.range && a.range.start) || 0) - ((b.range && b.range.start) || 0))

  // ── who else is away in the window (approved blocks cover; pending is only shown)
  const others = await Leave.find({
    _id: { $ne: leave._id },
    facultyId: { $in: ctx.idStrs.filter((id) => id !== leave.facultyId) },
    status: { $in: ["Approved", "Pending"] },
    fromDate: { $lt: winEnd }, toDate: { $gte: winStart },
  }).lean()
  const approvedOthers = others.filter((l) => l.status === "Approved")
  const awayOn = (facultyId, k) => approvedOthers.some((l) => l.facultyId === facultyId && H.utcKey(l.fromDate) <= k && H.utcKey(l.toDate) >= k)

  // ── data used to rank substitutes (a week of padding on each side for "load that week")
  const padFrom = H.addKeyDays(fromKey, -7)
  const padTo = H.addKeyDays(endKey, 7)
  const [statuses, existingSubs, duties] = await Promise.all([
    FacultyStatus.find({ facultyId: { $in: ctx.idStrs }, dateKey: { $gte: fromKey, $lte: endKey } }).lean(),
    Substitution.find({ dateKey: { $gte: padFrom, $lte: padTo } }).lean(),
    DutyAllocation.find({ department: ctx.dept, dateKey: { $gte: padFrom, $lte: padTo } }).lean(),
  ])
  const blocked = new Set(statuses.map((s) => `${s.facultyId}|${s.dateKey}`))
  const sessionsOf = Object.fromEntries(ctx.idStrs.map((id) => [id, H.weeklySessions(ctx.courses, id)]))
  const capacity = H.WEEKLY_CAPACITY_HOURS

  const candidatesFor = (slot) => {
    const wk0 = weekStartKey(slot.dateKey)
    const wk1 = H.addKeyDays(wk0, 6)
    const list = []
    for (const f of ctx.faculty) {
      const id = String(f._id)
      if (id === leave.facultyId) continue
      if (awayOn(id, slot.dateKey) || blocked.has(`${id}|${slot.dateKey}`)) continue
      const mine = sessionsOf[id]
      if (mine.sessions.some((s) => s.day === slot.weekday && H.overlaps(s, slot))) continue // teaching then
      if (existingSubs.some((s) => s.substituteId === id && s.dateKey === slot.dateKey && H.overlaps({ range: H.parseRange(s.time), time: s.time }, slot))) continue // already covering then

      const subsThatWeek = existingSubs.filter((s) => s.substituteId === id && s.dateKey >= wk0 && s.dateKey <= wk1)
      const dutyThatWeek = duties.filter((d) => d.dateKey >= wk0 && d.dateKey <= wk1 && d.assignees.some((a) => a.facultyId === id))
      const weekHours = mine.hours + subsThatWeek.reduce((s, x) => s + subHours(x), 0) + dutyThatWeek.reduce((s, d) => s + d.durationHours, 0)
      const loadPct = weekHours / capacity
      const nearSubs = existingSubs.filter((s) => s.substituteId === id && Math.abs(H.diffDays(slot.dateKey, s.dateKey)) <= 7).length
      const onCampus = mine.sessions.some((s) => s.day === slot.weekday)

      let score = 100 - Math.min(70, loadPct * 70) - Math.min(20, nearSubs * 5) + (onCampus ? 5 : 0)
      score = Math.max(5, Math.min(99, Math.round(score)))
      list.push({
        _id: id, name: f.name, score,
        reasons: [
          `Free ${slot.time ? `at ${slot.time}` : "at this time"}`,
          `${H.round1(weekHours)} h of work that week (${Math.round(loadPct * 100)}% of capacity)`,
          nearSubs ? `${nearSubs} substitute ${plural(nearSubs, "class", "classes")} within a week` : "No recent substitute duty",
          ...(onCampus ? ["Already on campus that day"] : []),
        ],
      })
    }
    return list.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
  }

  // suggest greedily so the same person isn't proposed for two clashing classes
  const suggested = []
  const classes = slots.map((slot) => {
    const candidates = candidatesFor(slot)
    const pick = candidates.find((c) => !suggested.some((s) => s.id === c._id && s.dateKey === slot.dateKey && H.overlaps(s.slot, slot)))
    if (pick) suggested.push({ id: pick._id, dateKey: slot.dateKey, slot })
    return {
      courseId: slot.courseId, courseName: slot.courseName, courseCode: slot.courseCode, dateKey: slot.dateKey,
      weekday: slot.weekday, time: slot.time, room: slot.room, suggestedId: pick ? pick._id : "", candidates,
    }
  })

  // ── staffing: how many people are away on the worst day (this leave + approved others)
  let peak = 0, peakKey = ""
  for (const k of eachKey(fromKey, endKey, MAX_WINDOW_DAYS)) {
    const n = 1 + approvedOthers.filter((l) => H.utcKey(l.fromDate) <= k && H.utcKey(l.toDate) >= k).length
    if (n > peak) { peak = n; peakKey = k }
  }
  const totalFaculty = ctx.faculty.length
  const staffing = { peakOnLeave: peak, peakDateKey: peakKey, totalFaculty, percent: totalFaculty ? Math.round((peak / totalFaculty) * 100) : 0 }

  // ── other things happening in the window
  const myCourseIds = ctx.courses.filter((c) => H.teacherOf(c) === leave.facultyId).map((c) => c._id)
  const [deadlines, papers, assignments, tasks, onlineClasses] = await Promise.all([
    Deadline.find({ department: ctx.dept, completed: false, dueDate: { $gte: winStart, $lt: winEnd } }).sort({ dueDate: 1 }).lean(),
    QuestionPaper.find({ department: ctx.dept, status: { $in: ["Pending", "Changes Requested"] }, dueDate: { $gte: winStart, $lt: winEnd } }).sort({ dueDate: 1 }).lean(),
    myCourseIds.length ? Assignment.find({ courseId: { $in: myCourseIds }, type: { $in: ["QUIZ", "EXAM"] }, completed: false }).select("title course type deadline").lean() : [],
    HodTask.find({ assignedToId: leave.facultyId, status: { $ne: "Completed" }, dueDate: { $gte: winStart, $lt: winEnd } }).sort({ dueDate: 1 }).lean(),
    OnlineClass.find({ teacherId: leave.facultyId, status: "scheduled", scheduledAt: { $gte: winStart, $lt: winEnd } }).sort({ scheduledAt: 1 }).lean(),
  ])
  const exams = assignments.map((a) => {
    if (!a.deadline) return null
    const key = DATE_RE.test(String(a.deadline).slice(0, 10)) ? String(a.deadline).slice(0, 10) : (isNaN(new Date(a.deadline)) ? null : H.localKey(new Date(a.deadline)))
    return key && key >= fromKey && key <= endKey ? { id: String(a._id), title: a.title, type: a.type, course: a.course, dateKey: key } : null
  }).filter(Boolean).sort((a, b) => a.dateKey.localeCompare(b.dateKey))

  const events = {
    deadlines: deadlines.map((d) => ({ id: String(d._id), title: d.title, dueDate: d.dueDate })),
    papers: papers.map((p) => ({ id: String(p._id), courseName: p.courseName, examType: p.examType, facultyName: p.facultyName, status: p.status, dueDate: p.dueDate, isApplicant: p.facultyId === leave.facultyId })),
    exams,
    tasks: tasks.map((t) => ({ id: String(t._id), title: t.title, dueDate: t.dueDate })),
    onlineClasses: onlineClasses.map((o) => ({ id: String(o._id), title: o.title, courseName: o.courseName, scheduledAt: o.scheduledAt })),
  }

  // ── leave allowance check (same calendar year as the leave starts)
  const year = Number(fromKey.slice(0, 4))
  const { start, end } = yearBounds(year)
  const [bal, usedLeaves] = await Promise.all([
    LeaveBalance.findOne({ facultyId: leave.facultyId, year }).lean(),
    Leave.find({ facultyId: leave.facultyId, status: "Approved", fromDate: { $gte: start, $lt: end } }).select("duration").lean(),
  ])
  const allocated = bal ? bal.totalLeaves : DEFAULT_ALLOCATION
  const used = usedLeaves.reduce((s, l) => s + l.duration, 0)

  // ── verdict
  const flags = []
  const uncovered = classes.filter((c) => c.candidates.length === 0).length
  if (uncovered) flags.push({ level: "high", text: `${uncovered} ${plural(uncovered, "class has", "classes have")} no free substitute — everyone is teaching, away or unavailable.` })
  if (staffing.percent >= 30) flags.push({ level: "high", text: `${peak} of ${totalFaculty} faculty would be away on ${H.fmtShort(peakKey)} (${staffing.percent}%).` })
  else if (approvedOthers.length) flags.push({ level: "medium", text: `${approvedOthers.length} other ${plural(approvedOthers.length, "faculty member is", "faculty members are")} already on approved leave in this window.` })
  const mine = events.papers.filter((p) => p.isApplicant)
  if (mine.length) flags.push({ level: "high", text: `${mine.length} of ${leave.facultyName}'s question ${plural(mine.length, "paper falls", "papers fall")} due while they are away.` })
  if (events.exams.length || events.deadlines.length) flags.push({ level: "medium", text: `${events.exams.length + events.deadlines.length} exam/deadline ${plural(events.exams.length + events.deadlines.length, "date falls", "dates fall")} in this window.` })
  if (used + leave.duration > allocated) flags.push({ level: "medium", text: `Approving would put ${leave.facultyName} ${used + leave.duration - allocated} ${plural(used + leave.duration - allocated, "day", "days")} over their ${allocated}-day allocation for ${year}.` })
  if (fromKey < today) flags.push({ level: "info", text: `This leave started ${H.diffDays(fromKey, today)} ${plural(H.diffDays(fromKey, today), "day", "days")} ago — classes before today can't be covered.` })
  if (toKey > endKey) flags.push({ level: "info", text: `Only the first ${MAX_WINDOW_DAYS} days of this leave are analysed.` })

  const level = flags.some((f) => f.level === "high") ? "high"
    : (flags.some((f) => f.level === "medium") || classes.length >= 3) ? "medium" : "low"

  const impact = {
    leave: { _id: leave._id, facultyId: leave.facultyId, facultyName: leave.facultyName, type: leave.type, fromDate: leave.fromDate, toDate: leave.toDate, duration: leave.duration },
    window: { days: windowDays, from: fromKey, to: endKey },
    level, flags, classes,
    overlappingLeaves: others.map((l) => ({ leaveId: String(l._id), facultyName: l.facultyName, type: l.type, fromDate: l.fromDate, toDate: l.toDate, status: l.status })),
    staffing, events,
  }
  return { impact, slots }
}

const loadPendingLeave = async (req, res, ctx) => {
  const leave = mongoose.isValidObjectId(req.params.id) ? await Leave.findById(req.params.id) : null
  if (!leave || !ctx.idStrs.includes(leave.facultyId)) {
    res.status(404).json({ success: false, message: "Leave not found in your department" })
    return null
  }
  return leave
}

exports.getImpact = wrap(async (req, res) => {
  const ctx = await H.loadDept(req)
  const leave = await loadPendingLeave(req, res, ctx)
  if (!leave) return
  if (leave.status !== "Pending") {
    return res.status(400).json({ success: false, message: `Leave is already ${leave.status.toLowerCase()}` })
  }
  const { impact } = await analyzeLeave(ctx, leave)
  res.json({ success: true, data: impact })
})

/* ═══════════════════════════ APPROVE + COVER ═══════════════════════════ */

exports.approveWithCover = wrap(async (req, res) => {
  const { note = "", assignments = [] } = req.body || {}
  if (!Array.isArray(assignments)) {
    return res.status(400).json({ success: false, message: "assignments must be a list" })
  }
  const ctx = await H.loadDept(req)
  const leave = await loadPendingLeave(req, res, ctx)
  if (!leave) return
  if (leave.status !== "Pending") {
    return res.status(400).json({ success: false, message: `Leave is already ${leave.status.toLowerCase()}` })
  }

  // Re-run the analysis now – never trust the browser's idea of who is free.
  const { impact, slots } = await analyzeLeave(ctx, leave)
  const picks = []
  const seen = new Set()
  for (const a of assignments) {
    const key = `${a.courseId}|${a.dateKey}`
    const i = impact.classes.findIndex((c) => `${c.courseId}|${c.dateKey}` === key)
    if (i < 0) return res.status(400).json({ success: false, message: "One of the selected classes no longer needs cover. Reload and try again." })
    if (seen.has(key)) return res.status(400).json({ success: false, message: "A class was assigned twice." })
    seen.add(key)
    const cls = impact.classes[i]
    const cand = cls.candidates.find((c) => c._id === String(a.substituteId))
    if (!cand) return res.status(400).json({ success: false, message: `That substitute is no longer free for ${cls.courseName} on ${H.fmtShort(cls.dateKey)}. Reload and pick again.` })
    const clash = picks.find((p) => p.substituteId === cand._id && p.dateKey === cls.dateKey && H.overlaps(p.slot, slots[i]))
    if (clash) return res.status(400).json({ success: false, message: `${cand.name} can't cover two classes at the same time on ${H.fmtShort(cls.dateKey)}.` })
    picks.push({ substituteId: cand._id, substituteName: cand.name, dateKey: cls.dateKey, courseId: cls.courseId, courseName: cls.courseName, time: cls.time, slot: slots[i] })
  }

  // The status filter makes this safe against two HODs (or two tabs) approving at once.
  const approved = await Leave.findOneAndUpdate(
    { _id: leave._id, status: "Pending" },
    { $set: { status: "Approved", adminNote: String(note).slice(0, 500), decidedAt: new Date(), updatedAt: new Date() } },
    { new: true }
  )
  if (!approved) return res.status(409).json({ success: false, message: "This leave was just decided by someone else." })

  for (const p of picks) {
    await Substitution.findOneAndUpdate(
      { leaveId: String(leave._id), courseId: p.courseId, dateKey: p.dateKey },
      { $set: {
        department: ctx.dept, courseName: p.courseName, time: p.time,
        originalFacultyId: leave.facultyId, originalFacultyName: leave.facultyName,
        substituteId: p.substituteId, substituteName: p.substituteName, status: "Assigned",
      } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
  }

  await notify(leave.facultyId, "Leave Approved",
    `Your ${leave.type} leave (${H.fmtShort(H.utcKey(leave.fromDate))} – ${H.fmtShort(H.utcKey(leave.toDate))}) was approved by ${req.user.name}.${picks.length ? ` ${picks.length} ${plural(picks.length, "class is", "classes are")} covered.` : ""}${note ? ` Note: ${note}` : ""}`)
  for (const p of picks) {
    await notify(p.substituteId, "Substitute class assigned",
      `You are covering ${p.courseName} for ${leave.facultyName} on ${H.fmtShort(p.dateKey)}${p.time ? ` (${p.time})` : ""}.`)
  }

  res.json({ success: true, data: { leave: approved, assigned: picks.length } })
})