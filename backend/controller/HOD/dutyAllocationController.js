const User            = require("../../models/User")
const Course          = require("../../models/course")
const Notification    = require("../../models/Notification")
const { Leave, Holiday } = require("../../models/Leave")
const { Substitution, FacultyStatus } = require("../../models/HOD/HodModels")
const DutyAllocation  = require("../../models/HOD/DutyAllocation")

/* ═══════════════════════════ policy numbers ═══════════════════════════
   WorkLens has no field for a faculty member's weekly capacity, so it is one
   department-wide number. Change here (or via .env) to match your university. */
const WEEKLY_CAPACITY_HOURS = Number(process.env.DUTY_WEEKLY_CAPACITY_HOURS) || 40
const MAX_HOURS_PER_DAY     = Number(process.env.DUTY_MAX_HOURS_PER_DAY) || 10
const HIGH_BELOW            = 70   // current workload %  < 70  → High availability
const MEDIUM_UP_TO          = 85   //                     ≤ 85  → Medium, above → Low

/* ═══════════════════════════ helpers (same conventions as hodController) ═══════════════════════════ */

const WEEKDAYS      = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const SCHEDULE_DAYS = WEEKDAYS.slice(1, 7)

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const pad      = (n) => String(n).padStart(2, "0")
const dateKey  = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const leaveKey = (d) => new Date(d).toISOString().slice(0, 10)         // leaves are stored as UTC-midnight dates
const round1   = (n) => Math.round(n * 10) / 10

const keyToUTC    = (k) => new Date(`${k}T00:00:00.000Z`)
const addKeyDays  = (k, n) => { const d = keyToUTC(k); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const weekdayOf   = (k) => WEEKDAYS[keyToUTC(k).getUTCDay()]
const mondayOf    = (k) => addKeyDays(k, -((keyToUTC(k).getUTCDay() + 6) % 7))
const fmtDate     = (k) => keyToUTC(k).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })

function parseDays(str) {
  if (!str || str === "Not set" || !str.trim()) return []
  const abbr = {
    mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday",
    m: "Monday", t: "Tuesday", w: "Wednesday", th: "Thursday", f: "Friday", s: "Saturday",
  }
  const out = []
  for (const raw of str.split(/[,\s\/\-]+/).map((p) => p.trim().toLowerCase()).filter(Boolean)) {
    const full = SCHEDULE_DAYS.find((d) => d.toLowerCase() === raw)
    if (full) { out.push(full); continue }
    if (abbr[raw]) { out.push(abbr[raw]); continue }
    const prefix = SCHEDULE_DAYS.find((d) => d.toLowerCase().startsWith(raw))
    if (prefix) out.push(prefix)
  }
  return [...new Set(out)]
}

function toMin(t) {
  const m = String(t).match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const mi = parseInt(m[2], 10)
  const p = (m[3] || "").toUpperCase()
  if (p === "PM" && h !== 12) h += 12
  if (p === "AM" && h === 12) h = 0
  return h * 60 + mi
}

// "09:00 AM - 10:00 AM" → { start, end } in minutes, or null
function parseRange(str) {
  if (!str) return null
  const m = String(str).match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*(?:-|–|—|to)\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i)
  if (!m) return null
  const start = toMin(m[1]); const end = toMin(m[2])
  if (start == null || end == null || end <= start) return null
  return { start, end }
}

const notify = async (userId, title, message) => {
  try { await Notification.create({ userId, type: "system", title, message }) } catch {}
}

const wrap = (fn) => async (req, res) => {
  try { await fn(req, res) }
  catch (err) {
    console.error("Duty allocation error:", err)
    res.status(500).json({ success: false, message: err.message })
  }
}

const isSimilar = (a, b) =>
  !!a && !!b && (a === b || (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a))))

/* ═══════════════════════════ workload engine ═══════════════════════════ */

const AVAIL_ORDER = { High: 0, Medium: 1, Low: 2, Unavailable: 3 }

async function computeCandidates(req, { title, dateKey: dk, durationHours, excludeId }) {
  const dept = req.dept || ""
  const facFilter = { role: "teaching" }
  if (dept) facFilter.department = new RegExp(`^${escapeRe(dept)}$`, "i")
  const faculty = await User.find(facFilter).select("name email").lean()

  const warnings = []
  const dayStart = keyToUTC(dk)
  const dayEnd   = new Date(dayStart.getTime() + 864e5)
  const holiday  = await Holiday.findOne({ date: { $gte: dayStart, $lt: dayEnd } }).lean()
  if (holiday) warnings.push(`${fmtDate(dk)} is a holiday (${holiday.name}).`)
  if (!faculty.length) return { candidates: [], warnings }

  const idObjs = faculty.map((f) => f._id)
  const ids    = idObjs.map(String)
  const mon    = mondayOf(dk)
  const sun    = addKeyDays(mon, 6)
  const dutyQuery = { "assignees.facultyId": { $in: ids }, dateKey: { $gte: mon, $lte: sun } }
  if (excludeId) dutyQuery._id = { $ne: excludeId }

  const [courses, leaves, overrides, subs, weekDuties, history] = await Promise.all([
    Course.find({
      status: "active",
      $or: [{ "teacher.id": { $in: idObjs } }, { "batches.teacher.id": { $in: idObjs } }],
    }).lean(),
    Leave.find({ status: "Approved", facultyId: { $in: ids }, fromDate: { $lte: dayEnd }, toDate: { $gte: dayStart } }).lean(),
    FacultyStatus.find({ facultyId: { $in: ids }, dateKey: dk }).lean(),
    Substitution.find({ substituteId: { $in: ids }, dateKey: { $gte: mon, $lte: sun } }).lean(),
    DutyAllocation.find(dutyQuery).lean(),
    DutyAllocation.find({
      "assignees.facultyId": { $in: ids }, dateKey: { $lt: dk },
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    }).select("title similarityKey dateKey durationHours assignees").lean(),
  ])

  const targetDay = weekdayOf(dk)
  const S = Object.fromEntries(ids.map((id) => [id, {
    teachWeek: 0, teachTargetDay: 0, estimated: false,
    dutyWeek: 0, dutyTargetDay: 0, subWeek: 0, subTargetDay: 0,
    similar: 0, recent: 0,
  }]))

  // Teaching load: sessions per week × length of each session, for the main teacher and for batch teachers
  const addSchedule = (id, schedule, credits) => {
    const s = S[id]
    if (!s) return
    const days  = parseDays(schedule?.days)
    const range = parseRange(schedule?.time)
    if (days.length && range) {
      const h = (range.end - range.start) / 60
      days.forEach((d) => { s.teachWeek += h; if (d === targetDay) s.teachTargetDay += h })
    } else if (credits > 0) {
      s.teachWeek += credits          // no usable timetable on the course → credits ≈ contact hours per week
      s.estimated = true
    }
  }
  for (const c of courses) {
    if (c.teacher?.id) addSchedule(String(c.teacher.id), c.schedule, c.credits)
    for (const b of c.batches || []) {
      if (b.teacher?.id) addSchedule(String(b.teacher.id), b.schedule, c.credits)
    }
  }

  // Classes the faculty is covering for colleagues this week
  for (const sub of subs) {
    const range = parseRange(sub.time)
    if (!range || !S[sub.substituteId]) continue
    const h = (range.end - range.start) / 60
    S[sub.substituteId].subWeek += h
    if (sub.dateKey === dk) S[sub.substituteId].subTargetDay += h
  }

  // Duties already assigned this week
  for (const d of weekDuties) {
    for (const a of d.assignees) {
      const s = S[a.facultyId]
      if (!s) continue
      s.dutyWeek += d.durationHours
      if (d.dateKey === dk) s.dutyTargetDay += d.durationHours
    }
  }

  // Previous similar duties + duty hours in the 90 days before this duty
  const since = addKeyDays(dk, -90)
  const key = DutyAllocation.similarityKeyOf(title)
  for (const d of history) {
    const similar = isSimilar(key, d.similarityKey)
    for (const a of d.assignees) {
      const s = S[a.facultyId]
      if (!s) continue
      if (similar) s.similar += 1
      if (d.dateKey >= since) s.recent += d.durationHours
    }
  }

  const leaveBy = {}
  leaves.forEach((l) => {
    if (leaveKey(l.fromDate) <= dk && leaveKey(l.toDate) >= dk) leaveBy[l.facultyId] = l
  })
  const overBy = Object.fromEntries(overrides.map((o) => [o.facultyId, o]))
  const pct = (h) => Math.round((h / WEEKLY_CAPACITY_HOURS) * 100)

  const candidates = faculty.map((f) => {
    const id = String(f._id)
    const s = S[id]
    const weekHours = s.teachWeek + s.subWeek + s.dutyWeek
    const current   = pct(weekHours)
    const projected = pct(weekHours + durationHours)
    const dayHours  = s.teachTargetDay + s.subTargetDay + s.dutyTargetDay + durationHours

    let availability = current < HIGH_BELOW ? "High" : current <= MEDIUM_UP_TO ? "Medium" : "Low"
    let warning = ""
    if (leaveBy[id]) {
      availability = "Unavailable"; warning = `On approved ${leaveBy[id].type.toLowerCase()} leave on this date`
    } else if (overBy[id]) {
      availability = "Unavailable"; warning = `Marked "${overBy[id].status}"${overBy[id].note ? ` — ${overBy[id].note}` : ""} on this date`
    } else if (dayHours > MAX_HOURS_PER_DAY) {
      availability = "Unavailable"
      warning = `Would have ${round1(dayHours)}h of work on ${fmtDate(dk)} (classes ${round1(s.teachTargetDay + s.subTargetDay)}h + duties ${round1(s.dutyTargetDay)}h + this duty ${durationHours}h; limit ${MAX_HOURS_PER_DAY}h)`
    } else if (projected > 100) {
      warning = `Would reach ${projected}% of weekly capacity`
    }

    return {
      facultyId: id,
      name: f.name,
      email: f.email,
      capacityHours: WEEKLY_CAPACITY_HOURS,
      teachingHours: round1(s.teachWeek),
      teachingEstimated: s.estimated,
      substitutionHours: round1(s.subWeek),
      dutyHoursThisWeek: round1(s.dutyWeek),
      classHoursThatDay: round1(s.teachTargetDay + s.subTargetDay),
      currentWorkload: current,
      projectedWorkload: projected,
      availability,
      warning,
      similarDuties: s.similar,
      recentDutyHours90d: round1(s.recent),
    }
  })

  candidates.sort((a, b) =>
    AVAIL_ORDER[a.availability] - AVAIL_ORDER[b.availability] ||
    a.projectedWorkload - b.projectedWorkload ||
    b.similarDuties - a.similarDuties ||
    a.name.localeCompare(b.name))

  return { candidates, warnings }
}

/* ═══════════════════════════ validation ═══════════════════════════ */

function parseInput(body) {
  const errors = []
  const title         = String(body.title || "").trim()
  const description   = String(body.description || "").trim()
  const dk            = String(body.date || "").trim()
  const durationHours = Number(body.durationHours)
  const requiredCount = parseInt(body.requiredCount, 10)

  if (!title) errors.push("Duty name is required")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dk) || isNaN(keyToUTC(dk).getTime())) errors.push("A valid date is required")
  else if (dk < dateKey(new Date())) errors.push("Date cannot be in the past")
  if (!(durationHours >= 0.5 && durationHours <= 24)) errors.push("Duration must be between 0.5 and 24 hours")
  if (!(requiredCount >= 1 && requiredCount <= 50)) errors.push("Required faculty must be between 1 and 50")
  return { errors, value: { title, description, dateKey: dk, durationHours, requiredCount } }
}

const uniqueIds = (raw) => [...new Set((Array.isArray(raw) ? raw : []).map(String))]

// Recomputed on the server so a stale or tampered request can never assign someone who is blocked.
async function checkAssignable(req, ids, input, excludeId) {
  const { candidates } = await computeCandidates(req, { ...input, excludeId })
  const byId = new Map(candidates.map((c) => [c.facultyId, c]))
  for (const id of ids) {
    const c = byId.get(id)
    if (!c) return { status: 400, message: "Assignee must be teaching faculty in your department" }
    if (c.availability === "Unavailable") return { status: 409, message: `${c.name}: ${c.warning}` }
  }
  return null
}

const shape = (d) => ({
  id: String(d._id),
  title: d.title,
  description: d.description,
  dateKey: d.dateKey,
  durationHours: d.durationHours,
  requiredCount: d.requiredCount,
  assignees: d.assignees.map((a) => ({ facultyId: a.facultyId, name: a.facultyName })),
  missing: Math.max(0, d.requiredCount - d.assignees.length),
  upcoming: d.dateKey >= dateKey(new Date()),
})

/* ═══════════════════════════ handlers ═══════════════════════════ */

// POST /api/hod/duty-allocation/candidates
//   new duty:      { title, date, durationHours, requiredCount }
//   existing duty: { dutyId }  → ranks faculty who are NOT yet on that duty, to fill the open slots
exports.previewCandidates = wrap(async (req, res) => {
  let value, excludeId, taken = []

  if (req.body.dutyId) {
    if (!/^[a-f\d]{24}$/i.test(String(req.body.dutyId))) {
      return res.status(400).json({ success: false, message: "Invalid duty id" })
    }
    const duty = await DutyAllocation.findById(req.body.dutyId)
    if (!duty || duty.department !== req.dept) return res.status(404).json({ success: false, message: "Duty not found" })
    if (duty.dateKey < dateKey(new Date())) {
      return res.status(400).json({ success: false, message: "This duty's date has already passed" })
    }
    value = { title: duty.title, dateKey: duty.dateKey, durationHours: duty.durationHours, requiredCount: duty.requiredCount }
    excludeId = duty._id
    taken = duty.assignees.map((a) => a.facultyId)
  } else {
    const parsed = parseInput(req.body)
    if (parsed.errors.length) return res.status(400).json({ success: false, message: parsed.errors.join(". ") })
    value = parsed.value
  }

  const out = await computeCandidates(req, { ...value, excludeId })
  res.json({
    success: true,
    data: {
      candidates: out.candidates.filter((c) => !taken.includes(c.facultyId)),
      warnings: out.warnings,
      requiredCount: value.requiredCount,
      needed: Math.max(0, value.requiredCount - taken.length),
      capacityHours: WEEKLY_CAPACITY_HOURS,
    },
  })
})

// GET /api/hod/duty-allocation
exports.listDuties = wrap(async (req, res) => {
  const duties = await DutyAllocation.find({ department: req.dept }).sort({ dateKey: -1, createdAt: -1 }).limit(200).lean()
  res.json({ success: true, data: duties.map(shape) })
})

// POST /api/hod/duty-allocation   { title, date, durationHours, requiredCount, description?, facultyIds[] }
exports.createDuty = wrap(async (req, res) => {
  const { errors, value } = parseInput(req.body)
  if (errors.length) return res.status(400).json({ success: false, message: errors.join(". ") })
  const ids = uniqueIds(req.body.facultyIds)
  if (!ids.length) return res.status(400).json({ success: false, message: "Select at least one faculty member" })
  if (ids.length > value.requiredCount) {
    return res.status(400).json({ success: false, message: `Only ${value.requiredCount} faculty are required` })
  }
  const problem = await checkAssignable(req, ids, value)
  if (problem) return res.status(problem.status).json({ success: false, message: problem.message })

  const users = await User.find({ _id: { $in: ids } }).select("name").lean()
  const nameOf = Object.fromEntries(users.map((u) => [String(u._id), u.name]))
  const duty = await DutyAllocation.create({
    ...value,
    department: req.dept,
    createdById: String(req.user._id),
    assignees: ids.map((facultyId) => ({ facultyId, facultyName: nameOf[facultyId] || "" })),
  })
  await Promise.all(ids.map((id) => notify(id, "New Duty Assigned",
    `You have been assigned "${duty.title}" on ${fmtDate(duty.dateKey)} (${duty.durationHours}h) by ${req.user.name}.`)))
  res.status(201).json({ success: true, data: shape(duty.toObject()) })
})

// PUT /api/hod/duty-allocation/:id/assignees   { facultyIds[] }
exports.updateAssignees = wrap(async (req, res) => {
  const duty = await DutyAllocation.findById(req.params.id)
  if (!duty || duty.department !== req.dept) return res.status(404).json({ success: false, message: "Duty not found" })
  const ids = uniqueIds(req.body.facultyIds)
  if (ids.length > duty.requiredCount) {
    return res.status(400).json({ success: false, message: `Only ${duty.requiredCount} faculty are required` })
  }
  const before  = duty.assignees.map((a) => a.facultyId)
  const added   = ids.filter((id) => !before.includes(id))
  const removed = before.filter((id) => !ids.includes(id))

  if (added.length) {
    const problem = await checkAssignable(
      req, added,
      { title: duty.title, dateKey: duty.dateKey, durationHours: duty.durationHours },
      duty._id,
    )
    if (problem) return res.status(problem.status).json({ success: false, message: problem.message })
  }
  const users = added.length ? await User.find({ _id: { $in: added } }).select("name").lean() : []
  const nameOf = Object.fromEntries(users.map((u) => [String(u._id), u.name]))
  duty.assignees = ids.map((id) => {
    const prev = duty.assignees.find((a) => a.facultyId === id)
    return prev ? prev : { facultyId: id, facultyName: nameOf[id] || "" }
  })
  await duty.save()

  await Promise.all([
    ...added.map((id) => notify(id, "New Duty Assigned",
      `You have been assigned "${duty.title}" on ${fmtDate(duty.dateKey)} (${duty.durationHours}h) by ${req.user.name}.`)),
    ...removed.map((id) => notify(id, "Duty Assignment Removed",
      `You are no longer assigned to "${duty.title}" on ${fmtDate(duty.dateKey)}.`)),
  ])
  res.json({ success: true, data: shape(duty.toObject()) })
})

// DELETE /api/hod/duty-allocation/:id
exports.deleteDuty = wrap(async (req, res) => {
  const duty = await DutyAllocation.findById(req.params.id)
  if (!duty || duty.department !== req.dept) return res.status(404).json({ success: false, message: "Duty not found" })
  await duty.deleteOne()
  await Promise.all(duty.assignees.map((a) => notify(a.facultyId, "Duty Cancelled",
    `"${duty.title}" on ${fmtDate(duty.dateKey)} has been cancelled.`)))
  res.json({ success: true })
})
