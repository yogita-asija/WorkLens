const User         = require("../../models/User")
const Course       = require("../../models/course")
const Attendance   = require("../../models/Attendance")
const Notification = require("../../models/Notification")
const Assignment   = require("../../models/Assignment")
const OnlineClass  = require("../../models/OnlineClass")
const { Leave, LeaveBalance, Holiday } = require("../../models/Leave")
const {
  HodTask, QuestionPaper, Escalation, Substitution, Deadline, FacultyStatus,
} = require("../../models/HOD/HodModels")

/* ═══════════════════════════ helpers ═══════════════════════════ */

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const SCHEDULE_DAYS = WEEKDAYS.slice(1, 7) // Mon–Sat, matches faculty timetable parser

const escapeRe   = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const pad        = (n) => String(n).padStart(2, "0")
const dateKey    = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const leaveKey   = (d) => new Date(d).toISOString().slice(0, 10)   // leaves are stored as UTC-midnight dates
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const addDays    = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const plural     = (n, one, many) => (n === 1 ? one : many)

// "Mon,Wed,Fri" | "Monday Wednesday" → ["Monday","Wednesday","Friday"]
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

function overlaps(a, b) {
  if (a.range && b.range) return a.range.start < b.range.end && b.range.start < a.range.end
  return !!a.time && a.time.trim().toLowerCase() === (b.time || "").trim().toLowerCase()
}

const cleanRoom = (r) => {
  const x = (r || "").trim().toLowerCase()
  return !x || x === "tbd" || x === "not set" ? "" : x
}

function relLabel(daysLeft) {
  if (daysLeft < 0)  return `${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? "" : "s"} overdue`
  if (daysLeft === 0) return "Today"
  if (daysLeft === 1) return "Tomorrow"
  return `${daysLeft} days`
}

const notify = async (userId, title, message) => {
  try { await Notification.create({ userId, type: "system", title, message }) } catch {}
}

const fmtDate = (d) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" })

const wrap = (fn) => async (req, res) => {
  try { await fn(req, res) }
  catch (err) {
    if (err.name === "CastError") return res.status(404).json({ success: false, message: "Not found" })   // malformed id
    console.error("HOD error:", err)
    res.status(500).json({ success: false, message: err.message })
  }
}

/* Department context: faculty of the HOD's department + their courses */
async function getCtx(req) {
  const dept = req.dept || ""
  const facFilter = { role: "teaching" }
  if (dept) facFilter.department = new RegExp(`^${escapeRe(dept)}$`, "i")
  const faculty = await User.find(facFilter).select("name email department").lean()
  const ids     = faculty.map((f) => f._id)
  const idStrs  = ids.map(String)
  const courses = await Course.find({ "teacher.id": { $in: ids }, status: { $ne: "archived" } }).lean()
  const nameOf  = Object.fromEntries(faculty.map((f) => [String(f._id), f.name]))
  return { dept, faculty, ids, idStrs, courses, nameOf }
}

const teacherOf = (c) => (c.teacher && c.teacher.id ? String(c.teacher.id) : "")

async function approvedLeaves(ctx) {
  const from = addDays(new Date(), -2)
  return Leave.find({ status: "Approved", facultyId: { $in: ctx.idStrs }, toDate: { $gte: from } }).lean()
}

/* ═══════════════════ computations (shared by summary + lists) ═══════════════════ */

async function computeAvailability(ctx) {
  const now = new Date()
  const key = dateKey(now)
  const wd  = WEEKDAYS[now.getDay()]
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const todayKey = leaveKey(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())))

  const [leaves, overrides] = await Promise.all([
    approvedLeaves(ctx),
    FacultyStatus.find({ dateKey: key, facultyId: { $in: ctx.idStrs } }).lean(),
  ])
  const leaveBy = {}
  leaves.forEach((l) => {
    if (leaveKey(l.fromDate) <= todayKey && leaveKey(l.toDate) >= todayKey) leaveBy[l.facultyId] = l
  })
  const overBy = Object.fromEntries(overrides.map((o) => [o.facultyId, o]))

  const counts = { available: 0, teaching: 0, onLeave: 0, otherDuty: 0, unavailable: 0 }
  const list = ctx.faculty.map((f) => {
    const id = String(f._id)
    const classes = ctx.courses
      .filter((c) => teacherOf(c) === id && parseDays(c.schedule?.days).includes(wd))
      .map((c) => ({ courseName: c.courseName, courseCode: c.courseCode || c.courseId, time: c.schedule?.time || "", room: c.schedule?.room || "", range: parseRange(c.schedule?.time) }))
      .sort((a, b) => (a.range?.start ?? 9999) - (b.range?.start ?? 9999))
    const inClass = classes.find((c) => c.range && c.range.start <= nowMin && nowMin < c.range.end)

    let status = "Available", note = ""
    if (leaveBy[id])      { status = "On Leave";    note = `${leaveBy[id].type} leave` }
    else if (overBy[id])  { status = overBy[id].status; note = overBy[id].note }
    else if (inClass)     { status = "Teaching";    note = `${inClass.courseName} · ${inClass.time}` }

    const k = { "Available": "available", "Teaching": "teaching", "On Leave": "onLeave", "Other Duty": "otherDuty", "Unavailable": "unavailable" }[status]
    counts[k]++
    return {
      _id: id, name: f.name, email: f.email, status, note,
      overridden: !!overBy[id],
      classesToday: classes.map(({ range, ...rest }) => rest),
    }
  })
  return { counts, total: ctx.faculty.length, faculty: list }
}

async function computeSubstitutions(ctx) {
  const now = new Date()
  const today = startOfDay(now)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const leaves = await approvedLeaves(ctx)
  const leaveIds = leaves.map((l) => String(l._id))
  const existing = await Substitution.find({ leaveId: { $in: leaveIds } }).lean()
  const exKey = (leaveId, courseId, dk) => `${leaveId}|${courseId}|${dk}`
  const exMap = Object.fromEntries(existing.map((s) => [exKey(s.leaveId, s.courseId, s.dateKey), s]))

  const slots = []
  for (let i = 0; i < 7; i++) {
    const d = addDays(today, i)
    const dk = dateKey(d)
    const lk = leaveKey(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())))
    const wd = WEEKDAYS[d.getDay()]
    for (const leave of leaves) {
      if (!(leaveKey(leave.fromDate) <= lk && leaveKey(leave.toDate) >= lk)) continue
      for (const c of ctx.courses) {
        if (teacherOf(c) !== leave.facultyId) continue
        if (!parseDays(c.schedule?.days).includes(wd)) continue
        const range = parseRange(c.schedule?.time)
        if (i === 0 && range && range.end <= nowMin) continue // class already over today
        const sub = exMap[exKey(String(leave._id), String(c._id), dk)]
        slots.push({
          key: exKey(leave._id, c._id, dk),
          leaveId: String(leave._id), courseId: String(c._id),
          courseName: c.courseName, courseCode: c.courseCode || c.courseId || "",
          dateKey: dk, weekday: wd, time: c.schedule?.time || "", room: c.schedule?.room || "",
          range, originalFacultyId: leave.facultyId, originalFacultyName: leave.facultyName,
          leaveType: leave.type,
          substitute: sub ? { id: sub.substituteId, name: sub.substituteName, _id: String(sub._id) } : null,
        })
      }
    }
  }
  slots.sort((a, b) => a.dateKey.localeCompare(b.dateKey) || (a.range?.start ?? 9999) - (b.range?.start ?? 9999))
  return { slots, leaves }
}

async function computeConflicts(ctx) {
  const items = []
  ctx.courses.forEach((c) => {
    const days = parseDays(c.schedule?.days)
    days.forEach((day) => items.push({
      courseId: String(c._id), courseName: c.courseName, courseCode: c.courseCode || c.courseId || "",
      day, time: c.schedule?.time || "", range: parseRange(c.schedule?.time), room: c.schedule?.room || "",
      teacherId: teacherOf(c), teacherName: c.teacher?.name || "",
    }))
  })
  const out = []
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j]
      if (a.day !== b.day || a.courseId === b.courseId) continue
      if (!overlaps(a, b)) continue
      const sameRoom = cleanRoom(a.room) && cleanRoom(a.room) === cleanRoom(b.room)
      const sameTeacher = a.teacherId && a.teacherId === b.teacherId
      if (!sameRoom && !sameTeacher) continue
      const strip = ({ range, ...rest }) => rest
      out.push({
        id: `${a.courseId}-${b.courseId}-${a.day}`,
        day: a.day,
        type: sameTeacher ? "Faculty clash" : "Room clash",
        reason: sameTeacher
          ? `${a.teacherName} is scheduled for two classes at the same time`
          : `Room ${a.room} is booked for two classes at the same time`,
        a: strip(a), b: strip(b),
      })
    }
  }
  return out
}

async function computeDeadlines(ctx, limit = 8) {
  const today = startOfDay(new Date())
  const [dls, tasks] = await Promise.all([
    Deadline.find({ department: ctx.dept, completed: false }).lean(),
    HodTask.find({ department: ctx.dept, status: { $ne: "Completed" } }).lean(),
  ])
  const items = [
    ...dls.map((d) => ({ id: String(d._id), kind: "deadline", type: d.type, title: d.title, dueDate: d.dueDate })),
    ...tasks.map((t) => ({ id: String(t._id), kind: "task", type: "task", title: `Faculty task — ${t.title}`, sub: t.assignedToName, dueDate: t.dueDate })),
  ].map((it) => {
    const daysLeft = Math.round((startOfDay(it.dueDate) - today) / 864e5)
    return { ...it, daysLeft, overdue: daysLeft < 0, label: relLabel(daysLeft) }
  })
  items.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
  return { items: items.slice(0, limit), overdueCount: items.filter((i) => i.overdue).length, total: items.length }
}

/* ═══════════════════ GET /api/hod/dashboard ═══════════════════ */

exports.getDashboard = wrap(async (req, res) => {
  const ctx = await getCtx(req)
  const today = startOfDay(new Date())
  const soon = addDays(today, 3)

  const [avail, subs, conflicts, pendingLeaves, overdueTasks, papers, escalations, deadlines] = await Promise.all([
    computeAvailability(ctx),
    computeSubstitutions(ctx),
    computeConflicts(ctx),
    Leave.find({ status: "Pending", facultyId: { $in: ctx.idStrs } }).sort({ fromDate: 1 }).lean(),
    HodTask.find({ department: ctx.dept, status: { $ne: "Completed" }, dueDate: { $lt: today } }).lean(),
    QuestionPaper.find({ department: ctx.dept, status: "Submitted" }).lean(),
    Escalation.find({ department: ctx.dept, status: "Open" }).lean(),
    computeDeadlines(ctx),
  ])

  // snapshot
  const studentSet = new Set()
  ctx.courses.forEach((c) => {
    ;(c.students || []).forEach((s) => studentSet.add(s.id || s.name))
    ;(c.batches || []).forEach((b) => (b.students || []).forEach((s) => studentSet.add(s.id || s.name)))
  })
  const codes = ctx.courses.flatMap((c) => [c.courseId, c.courseCode]).filter(Boolean)
  let avgAttendance = null
  if (codes.length) {
    const since = dateKey(addDays(today, -30))
    const recs = await Attendance.find({ date: { $gte: since }, courseId: { $in: codes } }, "students.status").lean()
    let total = 0, present = 0
    recs.forEach((r) => (r.students || []).forEach((s) => { total++; if (s.status === "present" || s.status === "late") present++ }))
    if (total) avgAttendance = Math.round((present / total) * 100)
  }

  const pendingSubs = subs.slots.filter((s) => !s.substitute)
  const names = (arr, f) => {
    const u = [...new Set(arr.map(f))]
    return u.slice(0, 2).join(", ") + (u.length > 2 ? ` +${u.length - 2}` : "")
  }
  const todayKey = dateKey(new Date())

  const actions = [
    {
      key: "leaves", count: pendingLeaves.length,
      label: plural(pendingLeaves.length, "leave request awaiting approval", "leave requests awaiting approval"),
      hint: names(pendingLeaves, (l) => l.facultyName),
      urgent: pendingLeaves.some((l) => new Date(l.fromDate) <= soon),
    },
    {
      key: "substitutions", count: pendingSubs.length,
      label: plural(pendingSubs.length, "faculty substitution required", "faculty substitutions required"),
      hint: names(pendingSubs, (s) => s.originalFacultyName),
      urgent: pendingSubs.some((s) => s.dateKey === todayKey),
    },
    {
      key: "conflicts", count: conflicts.length,
      label: plural(conflicts.length, "timetable conflict", "timetable conflicts"),
      hint: conflicts[0] ? `${conflicts[0].type} · ${conflicts[0].day}` : "",
      urgent: conflicts.length > 0,
    },
    {
      key: "tasks", count: overdueTasks.length,
      label: plural(overdueTasks.length, "faculty task overdue", "faculty tasks overdue"),
      hint: names(overdueTasks, (t) => t.assignedToName),
      urgent: overdueTasks.length > 0,
    },
    {
      key: "papers", count: papers.length,
      label: plural(papers.length, "question paper awaiting review", "question papers awaiting review"),
      hint: names(papers, (p) => p.courseName),
      urgent: papers.some((p) => p.dueDate && new Date(p.dueDate) <= soon),
    },
    {
      key: "escalations", count: escalations.length,
      label: plural(escalations.length, "unresolved student escalation", "unresolved student escalations"),
      hint: names(escalations, (e) => e.studentName),
      urgent: escalations.some((e) => e.priority === "High"),
    },
  ]

  res.json({
    success: true,
    data: {
      department: ctx.dept,
      snapshot: {
        totalFaculty:     ctx.faculty.length,
        totalStudents:    studentSet.size,
        activeCourses:    ctx.courses.filter((c) => c.status === "active").length,
        pendingApprovals: pendingLeaves.length + papers.length,
        overdueTasks:     overdueTasks.length,
        avgAttendance,
      },
      actions,
      availability: { counts: avail.counts, total: avail.total },
      deadlines,
    },
  })
})

/* ═══════════════════ Leaves ═══════════════════ */

exports.getPendingLeaves = wrap(async (req, res) => {
  const ctx = await getCtx(req)
  const leaves = await Leave.find({ status: "Pending", facultyId: { $in: ctx.idStrs } }).sort({ fromDate: 1 }).lean()
  res.json({ success: true, data: leaves })
})

exports.reviewLeave = wrap(async (req, res) => {
  const { status, note = "" } = req.body
  if (!["Approved", "Rejected"].includes(status)) {
    return res.status(400).json({ success: false, message: "status must be Approved or Rejected" })
  }
  const ctx = await getCtx(req)
  const leave = await Leave.findById(req.params.id)
  if (!leave || !ctx.idStrs.includes(leave.facultyId)) {
    return res.status(404).json({ success: false, message: "Leave not found in your department" })
  }
  if (leave.status !== "Pending") {
    return res.status(400).json({ success: false, message: `Leave is already ${leave.status.toLowerCase()}` })
  }
  leave.status = status
  leave.adminNote = note
  leave.updatedAt = new Date()
  await leave.save()
  await notify(
    leave.facultyId,
    `Leave ${status}`,
    `Your ${leave.type} leave (${fmtDate(leave.fromDate)} – ${fmtDate(leave.toDate)}) was ${status.toLowerCase()} by ${req.user.name}.${note ? ` Note: ${note}` : ""}`
  )
  res.json({ success: true, data: leave })
})

/* ═══════════════════ Availability ═══════════════════ */

exports.getAvailability = wrap(async (req, res) => {
  const ctx = await getCtx(req)
  res.json({ success: true, data: await computeAvailability(ctx) })
})

exports.setFacultyStatus = wrap(async (req, res) => {
  const { facultyId, status, note = "" } = req.body
  const ctx = await getCtx(req)
  if (!ctx.idStrs.includes(String(facultyId))) {
    return res.status(404).json({ success: false, message: "Faculty not in your department" })
  }
  const key = dateKey(new Date())
  if (status === "Available") {
    await FacultyStatus.deleteOne({ facultyId, dateKey: key })
  } else if (["Other Duty", "Unavailable"].includes(status)) {
    await FacultyStatus.findOneAndUpdate({ facultyId, dateKey: key }, { status, note }, { upsert: true, new: true })
  } else {
    return res.status(400).json({ success: false, message: "Invalid status" })
  }
  res.json({ success: true })
})

/* ═══════════════════ Substitutions ═══════════════════ */

async function candidatesFor(ctx, slot, leaves, allSlotsAssigned, overridesByDate) {
  const wd = slot.weekday
  const probe = { range: slot.range, time: slot.time }
  return ctx.faculty.filter((f) => {
    const id = String(f._id)
    if (id === slot.originalFacultyId) return false
    // on leave that date
    const lk = slot.dateKey
    if (leaves.some((l) => l.facultyId === id && leaveKey(l.fromDate) <= lk && leaveKey(l.toDate) >= lk)) return false
    // marked unavailable / other duty that date
    if ((overridesByDate[slot.dateKey] || new Set()).has(id)) return false
    // own class at the same time
    const busy = ctx.courses.some((c) =>
      teacherOf(c) === id && parseDays(c.schedule?.days).includes(wd) &&
      overlaps(probe, { range: parseRange(c.schedule?.time), time: c.schedule?.time || "" }))
    if (busy) return false
    // already covering another class at that time
    const covering = allSlotsAssigned.some((s) =>
      s.dateKey === slot.dateKey && s.substitute?.id === id && overlaps(probe, s))
    return !covering
  }).map((f) => ({ _id: String(f._id), name: f.name }))
}

exports.getSubstitutions = wrap(async (req, res) => {
  const ctx = await getCtx(req)
  const { slots, leaves } = await computeSubstitutions(ctx)
  const keys = [...new Set(slots.map((s) => s.dateKey))]
  const ov = await FacultyStatus.find({ dateKey: { $in: keys }, facultyId: { $in: ctx.idStrs } }).lean()
  const overridesByDate = {}
  ov.forEach((o) => { (overridesByDate[o.dateKey] = overridesByDate[o.dateKey] || new Set()).add(o.facultyId) })
  const assigned = slots.filter((s) => s.substitute)
  const data = []
  for (const s of slots) {
    const { range, ...rest } = s
    data.push({ ...rest, candidates: s.substitute ? [] : await candidatesFor(ctx, s, leaves, assigned, overridesByDate) })
  }
  res.json({ success: true, data })
})

exports.assignSubstitute = wrap(async (req, res) => {
  const { leaveId, courseId, dateKey: dk, substituteId } = req.body
  if (!leaveId || !courseId || !dk || !substituteId) {
    return res.status(400).json({ success: false, message: "leaveId, courseId, dateKey and substituteId are required" })
  }
  const ctx = await getCtx(req)
  const { slots, leaves } = await computeSubstitutions(ctx)
  const slot = slots.find((s) => s.leaveId === leaveId && s.courseId === courseId && s.dateKey === dk)
  if (!slot) return res.status(404).json({ success: false, message: "That class no longer needs a substitute" })

  const ov = await FacultyStatus.find({ dateKey: dk, facultyId: { $in: ctx.idStrs } }).lean()
  const overridesByDate = { [dk]: new Set(ov.map((o) => o.facultyId)) }
  const cands = await candidatesFor(ctx, slot, leaves, slots.filter((s) => s.substitute), overridesByDate)
  const sub = cands.find((c) => c._id === substituteId)
  if (!sub) return res.status(400).json({ success: false, message: "That faculty member is not free for this class" })

  const doc = await Substitution.findOneAndUpdate(
    { leaveId, courseId, dateKey: dk },
    {
      department: ctx.dept, courseName: slot.courseName, time: slot.time,
      originalFacultyId: slot.originalFacultyId, originalFacultyName: slot.originalFacultyName,
      substituteId: sub._id, substituteName: sub.name, status: "Assigned",
    },
    { upsert: true, new: true }
  )
  await notify(sub._id, "Substitution Assigned",
    `You are covering ${slot.courseName} on ${slot.weekday}, ${fmtDate(dk)} (${slot.time || "time TBD"}) for ${slot.originalFacultyName}.`)
  await notify(slot.originalFacultyId, "Substitute Arranged",
    `${sub.name} will cover ${slot.courseName} on ${fmtDate(dk)}.`)
  res.json({ success: true, data: doc })
})

exports.removeSubstitution = wrap(async (req, res) => {
  const doc = await Substitution.findById(req.params.id)
  if (!doc || doc.department !== req.dept) return res.status(404).json({ success: false, message: "Not found" })
  await doc.deleteOne()
  res.json({ success: true })
})

/* ═══════════════════ Leave impact assistant ═══════════════════
   For a PENDING leave: which classes lose their teacher, who else is away, what falls in the
   window, and who could cover each class. Everything is computed on the server from the
   database - the browser only ever sends back "which substitute for which class". */

const MAX_IMPACT_DAYS = 45
const DAY_MS    = 864e5
const utcMs     = (k) => Date.parse(`${k}T00:00:00Z`)
const weekdayOf = (k) => WEEKDAYS[new Date(utcMs(k)).getUTCDay()]
// Assignment.deadline is a free-text string ("2026-03-20", "20 Mar 2026" ...)
const looseKey  = (s) => (/^\d{4}-\d{2}-\d{2}/.test(s || "") ? String(s).slice(0, 10) : (s && !isNaN(Date.parse(s)) ? dateKey(new Date(s)) : ""))

async function computeLeaveImpact(ctx, leave) {
  const fromKey = leaveKey(leave.fromDate)
  const toKey   = leaveKey(leave.toDate)
  const dayKeys = []
  for (let t = utcMs(fromKey); t <= utcMs(toKey) && dayKeys.length < MAX_IMPACT_DAYS; t += DAY_MS) {
    dayKeys.push(new Date(t).toISOString().slice(0, 10))
  }
  const lastKey   = dayKeys[dayKeys.length - 1]
  const truncated = lastKey !== toKey
  const rangeStart = new Date(utcMs(fromKey))
  const rangeEnd   = new Date(utcMs(lastKey) + DAY_MS)          // exclusive
  const inWindow   = (k) => !!k && k >= fromKey && k <= lastKey

  const myCourses = ctx.courses.filter((c) => teacherOf(c) === leave.facultyId)
  const courseIds = myCourses.map((c) => c._id)
  const since     = dateKey(addDays(new Date(), -30))
  const overlapQ  = { fromDate: { $lte: rangeEnd }, toDate: { $gte: rangeStart } }

  const [approved, pendingOthers, existing, overrides, recent, deadlines, tasks, papers, examRows, classRows] = await Promise.all([
    Leave.find({ status: "Approved", facultyId: { $in: ctx.idStrs }, ...overlapQ }).lean(),
    Leave.find({ status: "Pending", _id: { $ne: leave._id }, facultyId: { $in: ctx.idStrs }, ...overlapQ }).lean(),
    Substitution.find({ substituteId: { $in: ctx.idStrs }, dateKey: { $in: dayKeys } }).lean(),
    FacultyStatus.find({ dateKey: { $in: dayKeys }, facultyId: { $in: ctx.idStrs } }).lean(),
    Substitution.find({ substituteId: { $in: ctx.idStrs }, dateKey: { $gte: since } }, "substituteId").lean(),
    Deadline.find({ department: ctx.dept, completed: false, dueDate: { $gte: rangeStart, $lt: rangeEnd } }).lean(),
    HodTask.find({ department: ctx.dept, status: { $ne: "Completed" }, assignedToId: leave.facultyId, dueDate: { $gte: rangeStart, $lt: rangeEnd } }).lean(),
    QuestionPaper.find({ department: ctx.dept, status: { $in: ["Pending", "Submitted", "Changes Requested"] }, dueDate: { $gte: rangeStart, $lt: rangeEnd } }).lean(),
    courseIds.length ? Assignment.find({ courseId: { $in: courseIds }, type: { $in: ["EXAM", "QUIZ"] } }, "title type deadline courseId course").lean() : [],
    courseIds.length ? OnlineClass.find({ courseId: { $in: courseIds }, status: "scheduled", scheduledAt: { $gte: rangeStart, $lt: rangeEnd } }).lean() : [],
  ])

  const overridesByDate = {}
  overrides.forEach((o) => { (overridesByDate[o.dateKey] = overridesByDate[o.dateKey] || new Set()).add(o.facultyId) })
  const existingSlots = existing.map((e) => ({ dateKey: e.dateKey, substitute: { id: e.substituteId }, range: parseRange(e.time), time: e.time }))
  const recentCount = {}
  recent.forEach((r) => { recentCount[r.substituteId] = (recentCount[r.substituteId] || 0) + 1 })
  const hasPendingLeave = (id, k) => pendingOthers.some((l) => l.facultyId === id && leaveKey(l.fromDate) <= k && leaveKey(l.toDate) >= k)

  /* classes that lose their teacher, one entry per class per day */
  const slots = []
  for (const k of dayKeys) {
    const wd = weekdayOf(k)
    for (const c of myCourses) {
      if (!parseDays(c.schedule?.days).includes(wd)) continue
      slots.push({
        courseId: String(c._id), courseName: c.courseName, courseCode: c.courseCode || c.courseId || "",
        dateKey: k, weekday: wd, time: c.schedule?.time || "", room: c.schedule?.room || "",
        range: parseRange(c.schedule?.time), _course: c,
      })
    }
  }
  slots.sort((a, b) => a.dateKey.localeCompare(b.dateKey) || (a.range?.start ?? 9999) - (b.range?.start ?? 9999))

  /* ranked substitutes for every class; a greedy pass picks one suggestion per class without double-booking anyone */
  const classesOnDay = (id, wd) => ctx.courses.filter((c) => teacherOf(c) === id && parseDays(c.schedule?.days).includes(wd)).length
  const teachesCourse = (id, course) => ctx.courses.some((c) =>
    (teacherOf(c) === id && c.courseName === course.courseName) ||
    (String(c._id) === String(course._id) && (c.batches || []).some((b) => String(b.teacher?.id) === id)))
  const sameSem = (id, course) => !!course.sem && course.sem !== "N/A" && ctx.courses.some((c) => teacherOf(c) === id && c.sem === course.sem)

  const wl = await computeWorkload(ctx, { withStatus: false })      // same score as the Faculty page
  const planned = [], planLoad = {}, lastFor = {}
  for (const s of slots) {
    const probe = { weekday: s.weekday, dateKey: s.dateKey, range: s.range, time: s.time, originalFacultyId: leave.facultyId }
    const cands = await candidatesFor(ctx, probe, approved, existingSlots, overridesByDate)
    const scored = cands.map((c) => {
      let pts = 50
      const why = []
      if (teachesCourse(c._id, s._course)) { pts += 25; why.push("Already teaches this course") }
      else if (sameSem(c._id, s._course))   { pts += 8;  why.push(`Teaches semester ${s._course.sem}`) }
      if (lastFor[s.courseId] === c._id)    { pts += 10; why.push("Already covering this course on another day") }
      const rc = recentCount[c._id] || 0
      pts -= Math.min(rc, 6) * 3                                 // (cover is also part of the workload score below, so weigh it lightly here)
      why.push(rc === 0 ? "No substitutions in the last 30 days" : `Covered ${rc} class${rc === 1 ? "" : "es"} in the last 30 days`)
      const pl = planLoad[c._id] || 0
      if (pl) { pts -= pl * 8; why.push(`Already suggested for ${pl} other class${pl === 1 ? "" : "es"} in this leave`) }
      const dc = classesOnDay(c._id, s.weekday)
      pts -= Math.min(dc, 4) * 2
      why.push(dc === 0 ? "No classes of their own that day" : `${dc} class${dc === 1 ? "" : "es"} of their own that day`)
      const w = wl.byId[c._id]
      if (w && wl.dept.mean > 0) {
        pts -= Math.max(-10, Math.min(20, (w.ratio / 100 - 1) * 20))      // overloaded: up to -20, light: up to +10
        if (w.band === "overloaded")    why.push(`Heavy workload (${w.ratio}% of the department average)`)
        else if (w.band === "capacity") why.push(`Light workload (${w.ratio}% of the department average)`)
      }
      if (hasPendingLeave(c._id, s.dateKey)) { pts -= 15; why.push("Has a pending leave request that day") }
      return { _id: c._id, name: c.name, score: Math.max(0, Math.min(100, Math.round(pts))), reasons: why }
    }).sort((a, b) => b.score - a.score)

    const pick = scored.find((c) => !planned.some((p) => p.dateKey === s.dateKey && p.substitute.id === c._id && overlaps(probe, p)))
    if (pick) {
      planned.push({ dateKey: s.dateKey, substitute: { id: pick._id }, range: s.range, time: s.time })
      planLoad[pick._id] = (planLoad[pick._id] || 0) + 1
      lastFor[s.courseId] = pick._id
    }
    s.candidates  = scored
    s.suggestedId = pick ? pick._id : null
  }

  /* other people away in the same window */
  const daysIn = (l) => dayKeys.filter((k) => leaveKey(l.fromDate) <= k && leaveKey(l.toDate) >= k)
  const overlappingLeaves = [
    ...approved.map((l) => ({ l, status: "Approved" })),
    ...pendingOthers.map((l) => ({ l, status: "Pending" })),
  ].filter(({ l }) => l.facultyId !== leave.facultyId).map(({ l, status }) => ({
    leaveId: String(l._id), facultyId: l.facultyId, facultyName: l.facultyName || ctx.nameOf[l.facultyId] || "",
    type: l.type, status, fromDate: l.fromDate, toDate: l.toDate, overlapDays: daysIn(l).length,
  }))

  const teachingDays = dayKeys.filter((k) => weekdayOf(k) !== "Sunday")
  let peak = { count: 0, dateKey: "" }
  teachingDays.forEach((k) => {
    const away = 1 + approved.filter((l) => l.facultyId !== leave.facultyId && leaveKey(l.fromDate) <= k && leaveKey(l.toDate) >= k).length
    if (away > peak.count) peak = { count: away, dateKey: k }
  })
  const total   = ctx.faculty.length
  const staffing = { totalFaculty: total, peakOnLeave: peak.count, peakDateKey: peak.dateKey, percent: total ? Math.round((peak.count / total) * 100) : 0 }

  /* things happening in the window */
  const events = {
    deadlines: deadlines.map((d) => ({ id: String(d._id), title: d.title, type: d.type, dueDate: d.dueDate })),
    papers: papers.map((p) => ({ id: String(p._id), courseName: p.courseName, examType: p.examType, facultyName: p.facultyName, status: p.status, dueDate: p.dueDate, isApplicant: p.facultyId === leave.facultyId })),
    tasks: tasks.map((t) => ({ id: String(t._id), title: t.title, dueDate: t.dueDate, priority: t.priority })),
    exams: examRows.map((a) => ({ id: String(a._id), title: a.title, type: a.type, course: a.course || "", dateKey: looseKey(a.deadline) })).filter((a) => inWindow(a.dateKey)),
    onlineClasses: classRows.map((o) => ({ id: String(o._id), title: o.title, courseName: o.courseName, scheduledAt: o.scheduledAt })),
  }

  /* verdict */
  const noCover = slots.filter((s) => !s.suggestedId).length
  const flags = []
  if (noCover) flags.push({ level: "high", text: `${noCover} class${noCover === 1 ? " has" : "es have"} no free faculty to cover ${noCover === 1 ? "it" : "them"}` })
  if (staffing.percent >= 30 && peak.count > 1) flags.push({ level: "high", text: `${peak.count} of ${total} faculty would be away on ${fmtDate(peak.dateKey)}` })
  else if (peak.count > 1) flags.push({ level: "medium", text: `${peak.count} of ${total} faculty would be away on ${fmtDate(peak.dateKey)}` })
  if (events.papers.some((p) => p.isApplicant)) flags.push({ level: "medium", text: `${leave.facultyName} has a question paper due during this leave` })
  if (events.exams.length) flags.push({ level: "medium", text: `${events.exams.length} exam/quiz scheduled for ${leave.facultyName}'s courses` })
  if (events.deadlines.length) flags.push({ level: "medium", text: `${events.deadlines.length} department deadline${events.deadlines.length === 1 ? " falls" : "s fall"} in this window` })
  if (events.tasks.length) flags.push({ level: "medium", text: `${events.tasks.length} task${events.tasks.length === 1 ? " assigned" : "s assigned"} to ${leave.facultyName} ${events.tasks.length === 1 ? "falls" : "fall"} due` })
  if (events.onlineClasses.length) flags.push({ level: "medium", text: `${events.onlineClasses.length} online class${events.onlineClasses.length === 1 ? " is" : "es are"} scheduled` })
  if (!slots.length) flags.push({ level: "info", text: "No scheduled classes are affected" })
  if (truncated) flags.push({ level: "info", text: `Only the first ${MAX_IMPACT_DAYS} days are analysed` })
  const level = flags.some((f) => f.level === "high") ? "high" : flags.some((f) => f.level === "medium") ? "medium" : "low"

  return {
    leave: { _id: String(leave._id), facultyId: leave.facultyId, facultyName: leave.facultyName, type: leave.type, fromDate: leave.fromDate, toDate: leave.toDate, duration: leave.duration, reason: leave.reason },
    window: { from: fromKey, to: lastKey, days: dayKeys.length, truncated },
    level, flags,
    classes: slots.map(({ _course, ...rest }) => rest),     // keeps `range` for server-side checks; the GET handler strips it
    overlappingLeaves, staffing, events,
  }
}

// GET /api/hod/leaves/:id/impact
exports.getLeaveImpact = wrap(async (req, res) => {
  const ctx = await getCtx(req)
  const leave = await Leave.findById(req.params.id).lean()
  if (!leave || !ctx.idStrs.includes(leave.facultyId)) {
    return res.status(404).json({ success: false, message: "Leave not found in your department" })
  }
  if (leave.status !== "Pending") {
    return res.status(400).json({ success: false, message: `Leave is already ${leave.status.toLowerCase()}` })
  }
  const impact = await computeLeaveImpact(ctx, leave)
  impact.classes = impact.classes.map(({ range, ...rest }) => rest)
  res.json({ success: true, data: impact })
})

// POST /api/hod/leaves/:id/approve-with-cover   Body: { note?, assignments: [{ courseId, dateKey, substituteId }] }
// Approves the leave AND records the chosen substitutes in one step. The server re-checks that every
// chosen substitute is really free - the client's list is never trusted.
exports.approveLeaveWithCover = wrap(async (req, res) => {
  const { note = "", assignments = [] } = req.body
  if (!Array.isArray(assignments) || assignments.length > 300) {
    return res.status(400).json({ success: false, message: "assignments must be a list" })
  }
  const ctx = await getCtx(req)
  const leave = await Leave.findById(req.params.id)
  if (!leave || !ctx.idStrs.includes(leave.facultyId)) {
    return res.status(404).json({ success: false, message: "Leave not found in your department" })
  }
  if (leave.status !== "Pending") {
    return res.status(400).json({ success: false, message: `Leave is already ${leave.status.toLowerCase()}` })
  }

  const impact = await computeLeaveImpact(ctx, leave)
  const slotOf = Object.fromEntries(impact.classes.map((s) => [`${s.courseId}|${s.dateKey}`, s]))
  const chosen = []
  for (const a of assignments) {
    const slot = slotOf[`${a?.courseId}|${a?.dateKey}`]
    if (!slot) return res.status(400).json({ success: false, message: "A selected class is not part of this leave" })
    if (chosen.some((x) => x.slot === slot)) return res.status(400).json({ success: false, message: `${slot.courseName} on ${fmtDate(slot.dateKey)} was selected twice` })
    const sub = slot.candidates.find((c) => c._id === String(a.substituteId))
    if (!sub) return res.status(400).json({ success: false, message: `That faculty member is not free for ${slot.courseName} on ${fmtDate(slot.dateKey)}` })
    if (chosen.some((x) => x.slot.dateKey === slot.dateKey && x.sub._id === sub._id && overlaps(x.slot, slot))) {
      return res.status(400).json({ success: false, message: `${sub.name} cannot cover two classes at the same time on ${fmtDate(slot.dateKey)}` })
    }
    chosen.push({ slot, sub })
  }

  // substitutions first (idempotent upserts), leave status last - so a failed attempt can simply be retried
  for (const { slot, sub } of chosen) {
    await Substitution.findOneAndUpdate(
      { leaveId: String(leave._id), courseId: slot.courseId, dateKey: slot.dateKey },
      {
        department: ctx.dept, courseName: slot.courseName, time: slot.time,
        originalFacultyId: leave.facultyId, originalFacultyName: leave.facultyName,
        substituteId: sub._id, substituteName: sub.name, status: "Assigned",
      },
      { upsert: true, new: true }
    )
  }
  leave.status    = "Approved"
  leave.adminNote = note
  leave.updatedAt = new Date()
  await leave.save()

  await notify(leave.facultyId, "Leave Approved",
    `Your ${leave.type} leave (${fmtDate(leave.fromDate)} – ${fmtDate(leave.toDate)}) was approved by ${req.user.name}.` +
    `${chosen.length ? ` Cover arranged for ${chosen.length} class${chosen.length === 1 ? "" : "es"}.` : ""}${note ? ` Note: ${note}` : ""}`)
  const bySub = {}
  chosen.forEach((x) => { (bySub[x.sub._id] = bySub[x.sub._id] || []).push(x.slot) })
  for (const [subId, list] of Object.entries(bySub)) {
    const lines = list.slice(0, 3).map((s) => `${s.courseName} (${fmtDate(s.dateKey)}, ${s.time || "time TBD"})`).join("; ")
    await notify(subId, "Substitution Assigned", `You are covering ${list.length} class${list.length === 1 ? "" : "es"} for ${leave.facultyName}: ${lines}${list.length > 3 ? ` +${list.length - 3} more` : ""}.`)
  }
  res.json({ success: true, data: { leave, assigned: chosen.length, uncovered: impact.classes.length - chosen.length } })
})

/* ═══════════════════ Leave management (HOD "Leave Management" page) ═══════════════════
   Read-only views over the department's leave data - overview, history (+CSV), calendar, balances,
   insights. Every query is limited to the HOD's own faculty via getCtx(), never to ids the client sends. */

const LEAVE_STATUSES = ["Pending", "Approved", "Rejected"]
const LEAVE_TYPES    = ["Sick", "Casual", "Earned"]
const ISO_DAY        = /^\d{4}-\d{2}-\d{2}$/
const yearOf         = (q) => { const y = parseInt(q, 10); return y >= 2000 && y <= 2100 ? y : new Date().getFullYear() }
const todayUtcKey    = () => { const n = new Date(); return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())).toISOString().slice(0, 10) }
// calendar days of a leave that fall inside [a, b] (YYYY-MM-DD, inclusive)
const clippedDays = (l, a, b) => {
  const f = leaveKey(l.fromDate) > a ? leaveKey(l.fromDate) : a
  const t = leaveKey(l.toDate)   < b ? leaveKey(l.toDate)   : b
  return t < f ? 0 : Math.round((utcMs(t) - utcMs(f)) / DAY_MS) + 1
}
// every YYYY-MM-DD of a leave inside [a, b]
const eachDay = (l, a, b) => {
  const f = leaveKey(l.fromDate) > a ? leaveKey(l.fromDate) : a
  const t = leaveKey(l.toDate)   < b ? leaveKey(l.toDate)   : b
  const out = []
  for (let ms = utcMs(f); ms <= utcMs(t) && out.length < 400; ms += DAY_MS) out.push(new Date(ms).toISOString().slice(0, 10))
  return out
}
const csvCell = (v) => {
  let t = v == null ? "" : String(v)
  if (/^[=+\-@\t\r]/.test(t)) t = "'" + t            // stop spreadsheet formula injection from user-typed text
  return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}

// Turns ?status&type&facultyId&from&to&q into a Mongo filter, always inside the HOD's department
function parseLeaveQuery(ctx, q) {
  const f = { facultyId: { $in: ctx.idStrs } }
  if (q.status) { if (!LEAVE_STATUSES.includes(q.status)) return { error: "Invalid status" }; f.status = q.status }
  if (q.type)   { if (!LEAVE_TYPES.includes(q.type))       return { error: "Invalid leave type" }; f.type = q.type }
  if (q.facultyId) f.facultyId = ctx.idStrs.includes(String(q.facultyId)) ? String(q.facultyId) : { $in: [] }
  if (q.from) { if (!ISO_DAY.test(q.from) || isNaN(utcMs(q.from))) return { error: "from must be YYYY-MM-DD" }; f.toDate = { $gte: new Date(utcMs(q.from)) } }
  if (q.to)   { if (!ISO_DAY.test(q.to)   || isNaN(utcMs(q.to)))   return { error: "to must be YYYY-MM-DD" };   f.fromDate = { $lt: new Date(utcMs(q.to) + DAY_MS) } }
  if (typeof q.q === "string" && q.q.trim()) {
    const re = new RegExp(escapeRe(q.q.trim().slice(0, 60)), "i")
    f.$or = [{ facultyName: re }, { reason: re }]
  }
  return { filter: f }
}

// GET /api/hod/leaves/overview - numbers for the stat cards
exports.getLeaveOverview = wrap(async (req, res) => {
  const ctx = await getCtx(req)
  const now = new Date()
  const today = todayUtcKey()
  const todayStart = new Date(utcMs(today))
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const inFaculty  = { $in: ctx.idStrs }

  const [pending, decided, current, upcoming, sub] = await Promise.all([
    Leave.find({ status: "Pending", facultyId: inFaculty }).sort({ appliedAt: 1 }).lean(),
    Leave.find({ status: { $in: ["Approved", "Rejected"] }, facultyId: inFaculty, updatedAt: { $gte: monthStart } }).lean(),
    Leave.find({ status: "Approved", facultyId: inFaculty, fromDate: { $lt: new Date(todayStart.getTime() + DAY_MS) }, toDate: { $gte: todayStart } }).lean(),
    Leave.find({ status: "Approved", facultyId: inFaculty, fromDate: { $gte: new Date(todayStart.getTime() + DAY_MS), $lt: new Date(todayStart.getTime() + 15 * DAY_MS) } }).sort({ fromDate: 1 }).lean(),
    computeSubstitutions(ctx),
  ])
  const waiting = (l) => Math.max(0, Math.floor((now - new Date(l.appliedAt)) / DAY_MS))
  res.json({
    success: true,
    data: {
      counts: {
        pending: pending.length,
        approvedThisMonth: decided.filter((l) => l.status === "Approved").length,
        rejectedThisMonth: decided.filter((l) => l.status === "Rejected").length,
        onLeaveToday: current.length,
        upcoming: upcoming.length,
        uncoveredClasses: sub.slots.filter((s) => !s.substitute).length,
        totalFaculty: ctx.faculty.length,
      },
      oldestPending: pending[0] ? { facultyName: pending[0].facultyName, daysWaiting: waiting(pending[0]) } : null,
      waitingOver3Days: pending.filter((l) => waiting(l) > 3).length,
      awayToday: current.map((l) => ({ leaveId: String(l._id), facultyName: l.facultyName, type: l.type, toDate: l.toDate })),
      upcoming: upcoming.slice(0, 6).map((l) => ({ leaveId: String(l._id), facultyName: l.facultyName, type: l.type, fromDate: l.fromDate, toDate: l.toDate, duration: l.duration })),
    },
  })
})

// GET /api/hod/leaves/history?status&type&facultyId&from&to&q&page&limit
exports.getLeaveHistory = wrap(async (req, res) => {
  const ctx = await getCtx(req)
  const parsed = parseLeaveQuery(ctx, req.query)
  if (parsed.error) return res.status(400).json({ success: false, message: parsed.error })
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 15))
  const total = await Leave.countDocuments(parsed.filter)
  const pages = Math.max(1, Math.ceil(total / limit))
  const page  = Math.min(pages, Math.max(1, parseInt(req.query.page, 10) || 1))
  const rows  = await Leave.find(parsed.filter).sort({ appliedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean()
  const subs  = rows.length ? await Substitution.find({ leaveId: { $in: rows.map((r) => String(r._id)) } }).lean() : []
  res.json({
    success: true, total, page, pages, limit,
    data: rows.map((l) => ({
      ...l,
      decidedAt: l.status === "Pending" ? null : l.updatedAt,
      substitutions: subs.filter((s) => s.leaveId === String(l._id))
        .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
        .map((s) => ({ _id: String(s._id), courseName: s.courseName, dateKey: s.dateKey, time: s.time, substituteName: s.substituteName })),
    })),
  })
})

// GET /api/hod/leaves/calendar?month=YYYY-MM - approved + pending leaves overlapping the month, and public holidays
exports.getLeaveCalendar = wrap(async (req, res) => {
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(req.query.month || "") ? req.query.month : todayUtcKey().slice(0, 7)
  const [y, mo] = month.split("-").map(Number)
  const start = new Date(Date.UTC(y, mo - 1, 1))
  const end   = new Date(Date.UTC(y, mo, 1))                       // exclusive
  const ctx = await getCtx(req)
  const [leaves, holidays] = await Promise.all([
    Leave.find({ status: { $in: ["Approved", "Pending"] }, facultyId: { $in: ctx.idStrs }, fromDate: { $lt: end }, toDate: { $gte: start } }).sort({ fromDate: 1 }).lean(),
    Holiday.find({ date: { $gte: start, $lt: end } }).sort({ date: 1 }).lean(),
  ])
  res.json({
    success: true,
    data: {
      month, totalFaculty: ctx.faculty.length,
      leaves: leaves.map((l) => ({ _id: String(l._id), facultyId: l.facultyId, facultyName: l.facultyName, type: l.type, status: l.status, fromDate: l.fromDate, toDate: l.toDate, duration: l.duration })),
      holidays: holidays.map((h) => ({ name: h.name, date: h.date, type: h.type })),
    },
  })
})

// GET /api/hod/leaves/balances?year=YYYY - per-faculty allocation / used / pending for the calendar year
exports.getLeaveBalances = wrap(async (req, res) => {
  const year = yearOf(req.query.year)
  const a = `${year}-01-01`, b = `${year}-12-31`
  const ctx = await getCtx(req)
  const [leaves, balances] = await Promise.all([
    Leave.find({ status: { $in: ["Approved", "Pending"] }, facultyId: { $in: ctx.idStrs }, fromDate: { $lt: new Date(utcMs(b) + DAY_MS) }, toDate: { $gte: new Date(utcMs(a)) } }).lean(),
    LeaveBalance.find({ facultyId: { $in: ctx.idStrs }, year }).lean(),
  ])
  const rows = ctx.faculty.map((f) => {
    const id = String(f._id)
    const mine = leaves.filter((l) => l.facultyId === id)
    const byType = { Sick: 0, Casual: 0, Earned: 0 }
    let used = 0, pending = 0
    mine.forEach((l) => {
      const d = clippedDays(l, a, b)
      if (l.status === "Approved") { used += d; byType[l.type] = (byType[l.type] || 0) + d } else pending += d
    })
    const allocated = balances.find((x) => x.facultyId === id)?.totalLeaves ?? 12   // 12 = same default as the faculty portal
    return { facultyId: id, name: f.name, email: f.email, allocated, used, pending, remaining: allocated - used, byType, requests: mine.length }
  }).sort((x, y) => y.used - x.used || x.name.localeCompare(y.name))
  res.json({
    success: true,
    data: {
      year, rows,
      totals: { allocated: rows.reduce((n, r) => n + r.allocated, 0), used: rows.reduce((n, r) => n + r.used, 0), pending: rows.reduce((n, r) => n + r.pending, 0) },
    },
  })
})

// GET /api/hod/leaves/insights?year=YYYY - patterns across the year
exports.getLeaveInsights = wrap(async (req, res) => {
  const year = yearOf(req.query.year)
  const a = `${year}-01-01`, b = `${year}-12-31`
  const ctx = await getCtx(req)
  const leaves = await Leave.find({ facultyId: { $in: ctx.idStrs }, fromDate: { $lt: new Date(utcMs(b) + DAY_MS) }, toDate: { $gte: new Date(utcMs(a)) } }).lean()
  const approved = leaves.filter((l) => l.status === "Approved")
  const rejected = leaves.filter((l) => l.status === "Rejected")
  const decided  = leaves.filter((l) => l.status !== "Pending")

  const byMonth = new Array(12).fill(0)
  const byWeekday = { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0 }
  const byType = Object.fromEntries(LEAVE_TYPES.map((t) => [t, { type: t, count: 0, days: 0 }]))
  const person = {}
  approved.forEach((l) => {
    const days = eachDay(l, a, b)
    byType[l.type] && (byType[l.type].count++, byType[l.type].days += days.length)
    const p = (person[l.facultyId] = person[l.facultyId] || { facultyId: l.facultyId, name: l.facultyName || ctx.nameOf[l.facultyId] || "", days: 0, requests: 0 })
    p.days += days.length; p.requests++
    days.forEach((k) => { byMonth[Number(k.slice(5, 7)) - 1]++; const wd = weekdayOf(k); if (wd in byWeekday) byWeekday[wd]++ })
  })
  const weekdayTotal = Object.values(byWeekday).reduce((n, v) => n + v, 0)
  const hours = decided.map((l) => Math.max(0, (new Date(l.updatedAt) - new Date(l.appliedAt)) / 36e5))
  const round1 = (n) => Math.round(n * 10) / 10
  res.json({
    success: true,
    data: {
      year,
      totals: {
        applications: leaves.length, approved: approved.length, rejected: rejected.length, pending: leaves.length - decided.length,
        approvalRate: approved.length + rejected.length ? Math.round((approved.length / (approved.length + rejected.length)) * 100) : null,
        avgDecisionHours: hours.length ? round1(hours.reduce((n, h) => n + h, 0) / hours.length) : null,
        avgDuration: approved.length ? round1(approved.reduce((n, l) => n + l.duration, 0) / approved.length) : null,
      },
      byType: Object.values(byType),
      byMonth,
      byWeekday: Object.entries(byWeekday).map(([day, days]) => ({ day, days })),
      monFriShare: weekdayTotal ? Math.round(((byWeekday.Monday + byWeekday.Friday) / weekdayTotal) * 100) : null,
      topAbsentees: Object.values(person).sort((x, y) => y.days - x.days).slice(0, 5),
    },
  })
})

// GET /api/hod/leaves/export?...same filters as history - CSV download
exports.exportLeavesCsv = wrap(async (req, res) => {
  const ctx = await getCtx(req)
  const parsed = parseLeaveQuery(ctx, req.query)
  if (parsed.error) return res.status(400).json({ success: false, message: parsed.error })
  const rows = await Leave.find(parsed.filter).sort({ appliedAt: -1 }).limit(5000).lean()
  const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "")
  const head = ["Faculty", "Type", "From", "To", "Days", "Status", "Applied on", "Decided on", "Reason", "HOD note"]
  const lines = [head.map(csvCell).join(",")]
  rows.forEach((l) => lines.push([
    l.facultyName, l.type, day(l.fromDate), day(l.toDate), l.duration, l.status, day(l.appliedAt),
    l.status === "Pending" ? "" : day(l.updatedAt), l.reason, l.adminNote,
  ].map(csvCell).join(",")))
  const name = `leaves-${(ctx.dept || "department").replace(/[^A-Za-z0-9_-]+/g, "_")}-${todayUtcKey()}.csv`
  res.setHeader("Content-Type", "text/csv; charset=utf-8")
  res.setHeader("Content-Disposition", `attachment; filename="${name}"`)
  res.send("\uFEFF" + lines.join("\r\n"))
})

/* ═══════════════════ Faculty workload (HOD "Faculty" page) ═══════════════════
   One "load index" per teacher, roughly "hours of work per week", built only from data WorkLens already has:
   teaching (course + batch schedules), substitutions covered, open tasks, pending question papers and days the HOD
   marked "Other Duty". Fairness is judged against the department average, so the HOD sees who is stretched and who has room.
   (ExtraDuty records have no faculty field, so they cannot be attributed to a person and are not counted.) */

const WORKLOAD = {
  coverPastDays: 28, coverFutureDays: 7,           // substitution window = 5 weeks (the load is averaged per week)
  defaultSessionHours: 1,                          // used when a class time cannot be parsed
  taskPoints: { High: 2, Medium: 1, Low: 0.5 }, overdueTaskExtra: 1,
  paperPoints: 2, overduePaperExtra: 2,
  otherDutyDayPoints: 3,
  teachingNormHours: 16,                           // flag only: teaching hours per week above this
  overloadedAt: 1.3, capacityAt: 0.7,              // share of the department average
}
const COVER_WEEKS = (WORKLOAD.coverPastDays + WORKLOAD.coverFutureDays) / 7
const round1 = (n) => Math.round(n * 10) / 10
// Same rule as the dashboard's overdue list: due BEFORE today (something due today is not overdue yet)
const isOverdue = (d, today0 = startOfDay(new Date())) => !!d && new Date(d) < today0
const sessionHours = (time) => {
  const r = parseRange(time)
  return r ? { hours: (r.end - r.start) / 60, estimated: false } : { hours: WORKLOAD.defaultSessionHours, estimated: true }
}

// everything `id` teaches: the course itself (main teacher) and any batch they take
function teachingOf(courses, id) {
  const rows = []
  const add = (c, role, batch, schedule, students) => {
    const days = parseDays(schedule?.days)
    const { hours, estimated } = sessionHours(schedule?.time)
    rows.push({
      courseId: String(c._id), courseName: c.courseName, courseCode: c.courseCode || c.courseId || "", sem: c.sem || "",
      role, batchName: batch, days, time: schedule?.time || "", room: schedule?.room || "",
      sessionHours: round1(hours), estimated: estimated && days.length > 0, hoursPerWeek: round1(hours * days.length), students,
    })
  }
  for (const c of courses) {
    if (teacherOf(c) === id) add(c, "Course", "", c.schedule, (c.students || []).length)
    for (const b of c.batches || []) {
      if (b.teacher && b.teacher.id && String(b.teacher.id) === id) add(c, "Batch", b.batchName || "", b.schedule, (b.students || []).length)
    }
  }
  return rows
}

const bandOf = (ratio, enough) => (!enough ? "balanced" : ratio >= WORKLOAD.overloadedAt * 100 ? "overloaded" : ratio <= WORKLOAD.capacityAt * 100 ? "capacity" : "balanced")

async function computeWorkload(ctx, { withStatus = true } = {}) {
  const now = new Date()
  const today0 = startOfDay(now)
  const today = dateKey(now)
  const from  = dateKey(addDays(now, -WORKLOAD.coverPastDays))
  const to    = dateKey(addDays(now, WORKLOAD.coverFutureDays))
  const todayUtc = todayUtcKey()
  const end14    = new Date(utcMs(todayUtc) + 13 * DAY_MS).toISOString().slice(0, 10)
  const inFaculty = { $in: ctx.idStrs }

  const [courses, subs, tasks, papers, duty, away, availability] = await Promise.all([
    Course.find({ status: { $ne: "archived" }, $or: [{ "teacher.id": { $in: ctx.ids } }, { "batches.teacher.id": { $in: ctx.ids } }] }).lean(),
    Substitution.find({ substituteId: inFaculty, dateKey: { $gte: from, $lte: to } }).lean(),
    HodTask.find({ department: ctx.dept, assignedToId: inFaculty, status: { $ne: "Completed" } }).lean(),
    QuestionPaper.find({ department: ctx.dept, facultyId: inFaculty, status: { $in: ["Pending", "Changes Requested"] } }).lean(),
    FacultyStatus.find({ facultyId: inFaculty, status: "Other Duty", dateKey: { $gte: from, $lte: to } }).lean(),
    Leave.find({ status: "Approved", facultyId: inFaculty, fromDate: { $lt: new Date(utcMs(end14) + DAY_MS) }, toDate: { $gte: new Date(utcMs(todayUtc)) } }).lean(),
    withStatus ? computeAvailability(ctx) : null,
  ])
  const statusOf = availability ? Object.fromEntries(availability.faculty.map((f) => [f._id, f])) : {}

  const list = ctx.faculty.map((f) => {
    const id = String(f._id)
    const teaching = teachingOf(courses, id)
    const teachingHours = round1(teaching.reduce((n, t) => n + t.hoursPerWeek, 0))

    const mySubs = subs.filter((x) => x.substituteId === id)
    const coverHours = mySubs.reduce((n, x) => n + sessionHours(x.time).hours, 0)

    const myTasks = tasks.filter((x) => x.assignedToId === id)
    const overdueTasks = myTasks.filter((x) => isOverdue(x.dueDate, today0)).length
    const taskPts = myTasks.reduce((n, x) => n + (WORKLOAD.taskPoints[x.priority] ?? 1), 0) + overdueTasks * WORKLOAD.overdueTaskExtra

    const myPapers = papers.filter((x) => x.facultyId === id)
    const overduePapers = myPapers.filter((x) => isOverdue(x.dueDate, today0)).length
    const paperPts = myPapers.length * WORKLOAD.paperPoints + overduePapers * WORKLOAD.overduePaperExtra

    const dutyDays = duty.filter((x) => x.facultyId === id).length
    const components = {
      teaching: round1(teachingHours),
      cover:    round1(coverHours / COVER_WEEKS),
      tasks:    round1(taskPts),
      papers:   round1(paperPts),
      duty:     round1((dutyDays / COVER_WEEKS) * WORKLOAD.otherDutyDayPoints),
    }
    const load = round1(Object.values(components).reduce((n, v) => n + v, 0))
    const st = statusOf[id]
    return {
      _id: id, name: f.name, email: f.email,
      status: st ? st.status : "", statusNote: st ? st.note : "",
      courses: new Set(teaching.map((t) => t.courseId)).size,
      students: teaching.reduce((n, t) => n + t.students, 0),
      sessionsPerWeek: teaching.reduce((n, t) => n + t.days.length, 0),
      teachingHours, estimatedTimes: teaching.some((t) => t.estimated),
      overNorm: teachingHours > WORKLOAD.teachingNormHours,
      cover: { count: mySubs.length, hours: round1(coverHours), upcoming: mySubs.filter((x) => x.dateKey > today).length },
      tasks: { open: myTasks.length, overdue: overdueTasks, high: myTasks.filter((x) => x.priority === "High").length },
      papers: { pending: myPapers.length, overdue: overduePapers },
      dutyDays,
      awayNext14: away.filter((l) => l.facultyId === id).reduce((n, l) => n + clippedDays(l, todayUtc, end14), 0),
      components, load,
    }
  })

  /* fairness is relative to the department */
  const n = list.length
  const loads = list.map((x) => x.load)
  const mean = n ? loads.reduce((a, b) => a + b, 0) / n : 0
  const sorted = [...loads].sort((a, b) => a - b)
  const median = n ? (n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2) : 0
  const sd = n ? Math.sqrt(loads.reduce((a, b) => a + (b - mean) ** 2, 0) / n) : 0
  const enough = n >= 2 && mean > 0
  const balanceScore = enough ? Math.max(0, Math.min(100, Math.round(100 - (sd / mean) * 100))) : null
  list.forEach((x) => { x.ratio = mean > 0 ? Math.round((x.load / mean) * 100) : 0; x.band = bandOf(x.ratio, enough) })
  list.sort((a, b) => b.load - a.load || a.name.localeCompare(b.name))

  const free = list.filter((x) => x.status !== "On Leave")
  const dept = {
    count: n, mean: round1(mean), median: round1(median), balanceScore,
    balanceLabel: balanceScore == null ? "Not enough data" : balanceScore >= 80 ? "Well balanced" : balanceScore >= 60 ? "Some imbalance" : "Uneven",
    mostLoaded: list[0] ? { _id: list[0]._id, name: list[0].name, load: list[0].load } : null,
    mostCapacity: free.length ? { _id: free[free.length - 1]._id, name: free[free.length - 1].name, load: free[free.length - 1].load } : null,
    overloaded: list.filter((x) => x.band === "overloaded").length,
    withCapacity: list.filter((x) => x.band === "capacity").length,
  }
  return { weights: WORKLOAD, dept, faculty: list, byId: Object.fromEntries(list.map((x) => [x._id, x])), raw: { courses, subs, tasks, papers, duty, today } }
}

function workloadInsights(list, dept) {
  if (list.length < 2) return []
  const out = []
  const names = (xs) => xs.map((x) => x.name).join(", ")
  const available = list.filter((x) => x.band === "capacity" && x.status !== "On Leave")
  const lightest = available[available.length - 1] || [...list].filter((x) => x.status !== "On Leave" && x.band !== "overloaded").pop()

  list.filter((x) => x.band === "overloaded").slice(0, 2).forEach((x) =>
    out.push({ level: "warn", facultyId: x._id, text: `${x.name} is at ${x.ratio}% of the department average (${x.load} pts).${lightest ? ` ${lightest.name} has the most room (${lightest.load} pts).` : ""}` }))

  const top = list[0], low = list[list.length - 1]
  if (!out.length && low.load > 0 && top.load / low.load >= 2) out.push({ level: "warn", facultyId: top._id, text: `${top.name} carries ${round1(top.load / low.load)}× the load of ${low.name}.` })

  const od = list.filter((x) => x.tasks.overdue + x.papers.overdue > 0)
  if (od.length) {
    const total = od.reduce((n, x) => n + x.tasks.overdue + x.papers.overdue, 0)
    const worst = [...od].sort((a, b) => (b.tasks.overdue + b.papers.overdue) - (a.tasks.overdue + a.papers.overdue))[0]
    out.push({ level: "warn", facultyId: worst._id, text: `${total} overdue task${total === 1 ? "" : "s"}/paper${total === 1 ? "" : "s"} across ${od.length} faculty — most with ${worst.name}.` })
  }
  const norm = list.filter((x) => x.overNorm)
  if (norm.length) out.push({ level: "warn", facultyId: norm[0]._id, text: `${names(norm)} ${norm.length === 1 ? "teaches" : "teach"} more than ${WORKLOAD.teachingNormHours} hours a week.` })

  const avgCover = list.reduce((n, x) => n + x.cover.count, 0) / list.length
  const heavyCover = list.filter((x) => x.cover.count >= 3 && x.cover.count >= 2 * avgCover)
  if (heavyCover.length) out.push({ level: "info", facultyId: heavyCover[0]._id, text: `${heavyCover[0].name} has covered ${heavyCover[0].cover.count} classes in the last 4 weeks — consider rotating substitutions.` })

  const away = list.filter((x) => x.awayNext14 >= 3)
  if (away.length) out.push({ level: "info", facultyId: away[0]._id, text: `${away[0].name} will be away ${away[0].awayNext14} days in the next 2 weeks, so their work will shift to others.` })

  if (available.length && out.some((o) => o.level === "warn")) out.push({ level: "good", facultyId: available[available.length - 1]._id, text: `${names(available.slice(-3).reverse())} ${available.length === 1 ? "has" : "have"} capacity for extra work.` })
  if (!out.some((o) => o.level === "warn")) out.push({ level: "good", text: dept.balanceScore != null && dept.balanceScore >= 80 ? "Workload is well balanced across the department." : "No overload or overdue work detected." })
  return out.slice(0, 6)
}

// GET /api/hod/faculty/workload
exports.getWorkload = wrap(async (req, res) => {
  const ctx = await getCtx(req)
  const wl = await computeWorkload(ctx)
  res.json({ success: true, data: { weights: wl.weights, dept: wl.dept, faculty: wl.faculty, insights: workloadInsights(wl.faculty, wl.dept) } })
})

// GET /api/hod/faculty/:id/workload - the breakdown behind one person's score
exports.getFacultyWorkload = wrap(async (req, res) => {
  const ctx = await getCtx(req)
  const id = String(req.params.id)
  if (!ctx.idStrs.includes(id)) return res.status(404).json({ success: false, message: "Faculty not found in your department" })
  const wl = await computeWorkload(ctx)
  const me = wl.byId[id]
  const { courses, subs, tasks, papers, duty, today } = wl.raw
  const now = new Date()
  const year = now.getFullYear(), a = `${year}-01-01`, b = `${year}-12-31`

  const [leaves, balance] = await Promise.all([
    Leave.find({ facultyId: id, status: { $in: ["Approved", "Pending"] }, fromDate: { $lt: new Date(utcMs(b) + DAY_MS) }, toDate: { $gte: new Date(utcMs(a)) } }).lean(),
    LeaveBalance.findOne({ facultyId: id, year }).lean(),
  ])
  const allocated = balance?.totalLeaves ?? 12
  const used = leaves.filter((l) => l.status === "Approved").reduce((n, l) => n + clippedDays(l, a, b), 0)
  const pending = leaves.filter((l) => l.status === "Pending").reduce((n, l) => n + clippedDays(l, a, b), 0)
  const todayUtc = todayUtcKey()

  const schedule = teachingOf(courses, id)
  const week = SCHEDULE_DAYS.map((day) => {
    const sessions = schedule.filter((t) => t.days.includes(day))
      .map((t) => ({ courseName: t.courseName, courseCode: t.courseCode, batchName: t.batchName, time: t.time, room: t.room, hours: t.sessionHours, range: parseRange(t.time) }))
      .sort((x, y) => (x.range?.start ?? 9999) - (y.range?.start ?? 9999))
      .map(({ range, ...rest }) => rest)
    return { day, hours: round1(sessions.reduce((n, x) => n + x.hours, 0)), sessions }
  })
  res.json({
    success: true,
    data: {
      faculty: { _id: id, name: me.name, email: me.email },
      summary: me,
      schedule, week,
      cover: subs.filter((x) => x.substituteId === id).sort((x, y) => y.dateKey.localeCompare(x.dateKey))
        .map((x) => ({ _id: String(x._id), dateKey: x.dateKey, courseName: x.courseName, time: x.time, originalFacultyName: x.originalFacultyName, upcoming: x.dateKey > today })),
      tasks: tasks.filter((x) => x.assignedToId === id).sort((x, y) => new Date(x.dueDate) - new Date(y.dueDate))
        .map((x) => ({ _id: String(x._id), title: x.title, priority: x.priority, status: x.status, dueDate: x.dueDate, overdue: isOverdue(x.dueDate) })),
      papers: papers.filter((x) => x.facultyId === id)
        .map((x) => ({ _id: String(x._id), courseName: x.courseName, examType: x.examType, status: x.status, dueDate: x.dueDate, overdue: isOverdue(x.dueDate) })),
      dutyDays: duty.filter((x) => x.facultyId === id).map((x) => x.dateKey).sort(),
      leave: {
        year, allocated, used, pending, remaining: allocated - used,
        upcoming: leaves.filter((l) => leaveKey(l.toDate) >= todayUtc).sort((x, y) => new Date(x.fromDate) - new Date(y.fromDate)).slice(0, 5)
          .map((l) => ({ _id: String(l._id), type: l.type, status: l.status, fromDate: l.fromDate, toDate: l.toDate, duration: l.duration })),
      },
    },
  })
})

/* ═══════════════════ Timetable conflicts ═══════════════════ */

exports.getConflicts = wrap(async (req, res) => {
  const ctx = await getCtx(req)
  const conflicts = await computeConflicts(ctx)
  const rooms = [...new Set(ctx.courses.map((c) => (c.schedule?.room || "").trim()).filter(Boolean))].sort()
  res.json({ success: true, data: conflicts, rooms })
})

// Body: { courseId, room?, time? }
exports.resolveConflict = wrap(async (req, res) => {
  const { courseId, room, time } = req.body
  const ctx = await getCtx(req)
  const course = ctx.courses.find((c) => String(c._id) === String(courseId))
  if (!course) return res.status(404).json({ success: false, message: "Course not found in your department" })
  const set = {}
  if (typeof room === "string" && room.trim()) set["schedule.room"] = room.trim()
  if (typeof time === "string" && time.trim()) {
    if (!parseRange(time)) return res.status(400).json({ success: false, message: 'Time must look like "10:00 AM - 11:00 AM"' })
    set["schedule.time"] = time.trim()
  }
  if (!Object.keys(set).length) return res.status(400).json({ success: false, message: "Provide a new room or time" })
  await Course.updateOne({ _id: course._id }, { $set: set })
  if (teacherOf(course)) {
    await notify(teacherOf(course), "Timetable Updated",
      `${course.courseName} was rescheduled by the HOD${set["schedule.room"] ? ` — room ${set["schedule.room"]}` : ""}${set["schedule.time"] ? ` — ${set["schedule.time"]}` : ""}.`)
  }
  const fresh = await getCtx(req)
  res.json({ success: true, data: await computeConflicts(fresh) })
})

/* ═══════════════════ Faculty tasks ═══════════════════ */

exports.getFaculty = wrap(async (req, res) => {
  const ctx = await getCtx(req)
  res.json({ success: true, data: ctx.faculty.map((f) => ({ _id: String(f._id), name: f.name })) })
})

exports.getOverdueTasks = wrap(async (req, res) => {
  const ctx = await getCtx(req)
  const today = startOfDay(new Date())
  const tasks = await HodTask.find({ department: ctx.dept, status: { $ne: "Completed" }, dueDate: { $lt: today } }).sort({ dueDate: 1 }).lean()
  res.json({
    success: true,
    data: tasks.map((t) => ({ ...t, daysOverdue: Math.round((today - startOfDay(t.dueDate)) / 864e5) })),
  })
})

exports.createTask = wrap(async (req, res) => {
  const { title, assignedToId, dueDate, priority = "Medium", description = "" } = req.body
  if (!title || !assignedToId || !dueDate) {
    return res.status(400).json({ success: false, message: "title, assignedToId and dueDate are required" })
  }
  const ctx = await getCtx(req)
  if (!ctx.idStrs.includes(String(assignedToId))) {
    return res.status(400).json({ success: false, message: "Assignee must be faculty in your department" })
  }
  const task = await HodTask.create({
    title, description, priority, department: ctx.dept,
    assignedToId, assignedToName: ctx.nameOf[assignedToId],
    assignedById: String(req.user._id), dueDate: new Date(dueDate),
  })
  await notify(assignedToId, "New Task from HOD", `${title} — due ${fmtDate(task.dueDate)}.`)
  res.status(201).json({ success: true, data: task })
})

// Body: { status?, dueDate? }
exports.updateTask = wrap(async (req, res) => {
  const task = await HodTask.findById(req.params.id)
  if (!task || task.department !== req.dept) return res.status(404).json({ success: false, message: "Task not found" })
  const { status, dueDate } = req.body
  if (status) {
    if (!["Pending", "In Progress", "Completed"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" })
    }
    task.status = status
    task.completedAt = status === "Completed" ? new Date() : undefined
  }
  if (dueDate) {
    task.dueDate = new Date(dueDate)
    await notify(task.assignedToId, "Task Deadline Extended", `"${task.title}" is now due ${fmtDate(task.dueDate)}.`)
  }
  await task.save()
  res.json({ success: true, data: task })
})

exports.remindTask = wrap(async (req, res) => {
  const task = await HodTask.findById(req.params.id)
  if (!task || task.department !== req.dept) return res.status(404).json({ success: false, message: "Task not found" })
  await notify(task.assignedToId, "Task Overdue — Reminder",
    `"${task.title}" was due on ${fmtDate(task.dueDate)}. Please complete it as soon as possible.`)
  res.json({ success: true })
})

/* ═══════════════════ Question papers ═══════════════════ */

exports.getPendingPapers = wrap(async (req, res) => {
  const papers = await QuestionPaper.find({ department: req.dept, status: "Submitted" }).sort({ dueDate: 1 }).lean()
  res.json({ success: true, data: papers })
})

// Body: { decision: "approve" | "changes", note? }
exports.reviewPaper = wrap(async (req, res) => {
  const { decision, note = "" } = req.body
  if (!["approve", "changes"].includes(decision)) {
    return res.status(400).json({ success: false, message: "decision must be approve or changes" })
  }
  if (decision === "changes" && !note.trim()) {
    return res.status(400).json({ success: false, message: "Add a note describing the changes needed" })
  }
  const paper = await QuestionPaper.findById(req.params.id)
  if (!paper || paper.department !== req.dept) return res.status(404).json({ success: false, message: "Paper not found" })
  if (paper.status !== "Submitted") return res.status(400).json({ success: false, message: "Paper is not awaiting review" })
  paper.status = decision === "approve" ? "Approved" : "Changes Requested"
  paper.reviewNote = note
  paper.reviewedAt = new Date()
  await paper.save()
  await notify(paper.facultyId,
    decision === "approve" ? "Question Paper Approved" : "Question Paper — Changes Requested",
    `${paper.courseName} (${paper.examType}) ${decision === "approve" ? "was approved" : "needs changes"}.${note ? ` Note: ${note}` : ""}`)
  res.json({ success: true, data: paper })
})

/* ═══════════════════ Escalations ═══════════════════ */

exports.getOpenEscalations = wrap(async (req, res) => {
  const order = { High: 0, Medium: 1, Low: 2 }
  const list = await Escalation.find({ department: req.dept, status: "Open" }).lean()
  list.sort((a, b) => order[a.priority] - order[b.priority] || new Date(a.createdAt) - new Date(b.createdAt))
  res.json({ success: true, data: list })
})

exports.resolveEscalation = wrap(async (req, res) => {
  const { note = "" } = req.body
  if (!note.trim()) return res.status(400).json({ success: false, message: "Add a resolution note" })
  const esc = await Escalation.findById(req.params.id)
  if (!esc || esc.department !== req.dept) return res.status(404).json({ success: false, message: "Escalation not found" })
  esc.status = "Resolved"
  esc.resolution = note
  esc.resolvedAt = new Date()
  await esc.save()
  if (esc.assignedToId) await notify(esc.assignedToId, "Escalation Resolved", `${esc.studentName}: ${esc.subject} — ${note}`)
  res.json({ success: true, data: esc })
})

/* ═══════════════════ Deadlines ═══════════════════ */

exports.getDeadlines = wrap(async (req, res) => {
  const ctx = await getCtx(req)
  res.json({ success: true, data: await computeDeadlines(ctx, 50) })
})

exports.createDeadline = wrap(async (req, res) => {
  const { title, type = "other", dueDate } = req.body
  if (!title || !dueDate) return res.status(400).json({ success: false, message: "title and dueDate are required" })
  const d = await Deadline.create({ department: req.dept, title, type, dueDate: new Date(dueDate) })
  res.status(201).json({ success: true, data: d })
})

exports.completeDeadline = wrap(async (req, res) => {
  const d = await Deadline.findById(req.params.id)
  if (!d || d.department !== req.dept) return res.status(404).json({ success: false, message: "Deadline not found" })
  d.completed = true
  d.completedAt = new Date()
  await d.save()
  res.json({ success: true })
})

exports.deleteDeadline = wrap(async (req, res) => {
  const d = await Deadline.findById(req.params.id)
  if (!d || d.department !== req.dept) return res.status(404).json({ success: false, message: "Deadline not found" })
  await d.deleteOne()
  res.json({ success: true })
})

