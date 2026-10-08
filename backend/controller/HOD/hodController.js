const User         = require("../../models/User")
const Course       = require("../../models/course")
const Attendance   = require("../../models/Attendance")
const Notification = require("../../models/Notification")
const { Leave }    = require("../../models/Leave")
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
  leave.decidedAt = new Date()
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
  if (!doc) return res.status(404).json({ success: false, message: "Not found" })
  await doc.deleteOne()
  res.json({ success: true })
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