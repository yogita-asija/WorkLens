/**
 * HOD · Department Report  (one click -> attendance + leave + workload + syllabus)
 *
 *   GET  /api/hod/reports/department?from=YYYY-MM-DD&to=YYYY-MM-DD
 *   GET  /api/hod/reports/snapshots            list saved reports
 *   POST /api/hod/reports/snapshots            save a report (frozen copy + checksum)
 *   GET  /api/hod/reports/snapshots/:id        open a saved report (+ checksum verification)
 *
 * Period (from/to) drives attendance and leave. Workload is a "right now" snapshot (same numbers as the
 * Faculty Workload page) and syllabus is cumulative progress to date.
 *
 * Attendance rule: a student is "attended" if status is present OR late. Students below ATTENDANCE_MIN %
 * (default 75, env REPORT_ATTENDANCE_MIN) are flagged.
 */
const crypto         = require("crypto")
const mongoose       = require("mongoose")
const Attendance     = require("../../models/Attendance")
const ReportSnapshot = require("../../models/HOD/ReportSnapshot")
const Syllabus       = require("../../models/Syllabus")
const { Leave }      = require("../../models/Leave")
const H              = require("../../utils/hodHelpers")
const { computeWorkload } = require("./hodWorkloadController")

const wrap = H.wrap("hodReport")
const ATTENDANCE_MIN = Number(process.env.REPORT_ATTENDANCE_MIN) || 75
const KEY = /^\d{4}-\d{2}-\d{2}$/
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null)

function resolvePeriod(q) {
  const today = H.localKey()
  let to = KEY.test(q.to || "") ? q.to : today
  let from = KEY.test(q.from || "") ? q.from : H.addKeyDays(to, -29)
  if (from > to) [from, to] = [to, from]
  if (H.diffDays(from, to) > 366) from = H.addKeyDays(to, -366)
  return { from, to, days: H.diffDays(from, to) + 1 }
}

/* ───────────────────────── attendance ───────────────────────── */
async function attendanceSection(courses, { from, to }) {
  const codes = [...new Set(courses.flatMap((c) => [c.courseId, c.courseCode]).filter(Boolean))]
  const byCode = new Map()
  for (const c of courses) { if (c.courseId) byCode.set(c.courseId, c); if (c.courseCode && !byCode.has(c.courseCode)) byCode.set(c.courseCode, c) }

  const records = codes.length
    ? await Attendance.find({ courseId: { $in: codes }, date: { $gte: from, $lte: to } }).lean()
    : []

  const per = new Map()              // course _id -> accumulator
  const students = new Map()         // `${courseKey}|${studentId}` -> { name, course, total, attended }
  for (const r of records) {
    const c = byCode.get(r.courseId); if (!c) continue
    const k = String(c._id)
    if (!per.has(k)) per.set(k, { sessions: new Set(), marks: 0, present: 0, late: 0, absent: 0 })
    const a = per.get(k)
    a.sessions.add(`${r.date}`)
    for (const s of r.students || []) {
      const st = String(s.status || "").toLowerCase()
      a.marks++
      if (st === "present") a.present++
      else if (st === "late") a.late++
      else a.absent++
      const sk = `${k}|${s.id || s.name}`
      if (!students.has(sk)) students.set(sk, { id: s.id || "", name: s.name || "Unknown", courseKey: k, total: 0, attended: 0 })
      const row = students.get(sk); row.total++
      if (st === "present" || st === "late") row.attended++
    }
  }

  const rows = courses.map((c) => {
    const k = String(c._id); const a = per.get(k)
    const marks = a ? a.marks : 0; const attended = a ? a.present + a.late : 0
    const mine = [...students.values()].filter((s) => s.courseKey === k)
    return {
      courseId: c.courseId, courseCode: c.courseCode || c.courseId, courseName: c.courseName,
      teacher: (c.teacher && c.teacher.name) || "—",
      enrolled: (c.students || []).length + (c.batches || []).reduce((s, b) => s + (b.students || []).length, 0),
      sessions: a ? a.sessions.size : 0,
      present: a ? a.present : 0, late: a ? a.late : 0, absent: a ? a.absent : 0,
      percent: pct(attended, marks),
      belowMin: mine.filter((s) => pct(s.attended, s.total) < ATTENDANCE_MIN).length,
    }
  }).sort((x, y) => (x.percent ?? 101) - (y.percent ?? 101))

  const totalMarks = rows.reduce((s, r) => s + r.present + r.late + r.absent, 0)
  const totalAttended = rows.reduce((s, r) => s + r.present + r.late, 0)
  const courseName = Object.fromEntries(courses.map((c) => [String(c._id), c.courseCode || c.courseId]))
  const atRisk = [...students.values()]
    .map((s) => ({ ...s, percent: pct(s.attended, s.total) }))
    .filter((s) => s.percent < ATTENDANCE_MIN)
    .sort((a, b) => a.percent - b.percent || b.total - a.total)

  return {
    threshold: ATTENDANCE_MIN,
    summary: {
      percent: pct(totalAttended, totalMarks),
      sessions: rows.reduce((s, r) => s + r.sessions, 0),
      coursesWithData: rows.filter((r) => r.sessions > 0).length,
      coursesWithoutData: rows.filter((r) => r.sessions === 0).length,
      studentsBelowMin: atRisk.length,
    },
    courses: rows,
    atRisk: atRisk.slice(0, 15).map((s) => ({ id: s.id, name: s.name, course: courseName[s.courseKey], percent: s.percent, classes: s.total })),
  }
}

/* ───────────────────────── leave ───────────────────────── */
async function leaveSection(ctx, { from, to }) {
  const fromD = H.keyToUTC(from); const toD = H.keyToUTC(to)
  const leaves = ctx.idStrs.length
    ? await Leave.find({ facultyId: { $in: ctx.idStrs }, fromDate: { $lte: toD }, toDate: { $gte: fromD } }).lean()
    : []
  const clipped = (l) => {          // days of this leave that fall inside the period (inclusive)
    const a = H.utcKey(l.fromDate) > from ? H.utcKey(l.fromDate) : from
    const b = H.utcKey(l.toDate) < to ? H.utcKey(l.toDate) : to
    return Math.max(0, H.diffDays(a, b) + 1)
  }
  const sum = (arr, status) => arr.filter((l) => !status || l.status === status)
  const days = (arr) => arr.reduce((s, l) => s + clipped(l), 0)

  const today = H.localKey()
  const onLeaveToday = leaves.filter((l) => l.status === "Approved" && H.utcKey(l.fromDate) <= today && H.utcKey(l.toDate) >= today)
    .map((l) => l.facultyName)

  const byType = {}
  for (const l of sum(leaves, "Approved")) byType[l.type] = (byType[l.type] || 0) + clipped(l)

  const rows = ctx.faculty.map((f) => {
    const mine = leaves.filter((l) => l.facultyId === String(f._id))
    return {
      facultyId: String(f._id), name: f.name,
      applications: mine.length,
      approvedDays: days(sum(mine, "Approved")),
      pending: sum(mine, "Pending").length,
      rejected: sum(mine, "Rejected").length,
    }
  }).sort((a, b) => b.approvedDays - a.approvedDays || a.name.localeCompare(b.name))

  const workingDaysInPeriod = Array.from({ length: H.diffDays(from, to) + 1 }, (_, i) => H.weekdayOf(H.addKeyDays(from, i)))
    .filter((d) => d !== "Sunday").length
  const capacityDays = workingDaysInPeriod * Math.max(1, ctx.faculty.length)
  const approvedDays = days(sum(leaves, "Approved"))

  return {
    summary: {
      applications: leaves.length,
      approved: sum(leaves, "Approved").length, pending: sum(leaves, "Pending").length, rejected: sum(leaves, "Rejected").length,
      approvedDays, byType,
      absenceRate: pct(approvedDays, capacityDays),     // approved leave days / (working days x faculty)
      onLeaveToday,
    },
    faculty: rows,
  }
}

/* ───────────────────────── workload ───────────────────────── */
async function workloadSection(req) {
  const w = await computeWorkload(req)
  const norm = Number(process.env.TEACHING_NORM_HOURS) || 16
  return {
    dept: w.dept, insights: w.insights, teachingNorm: norm,
    faculty: w.faculty.map((f) => ({
      _id: f._id, name: f.name, status: f.status, load: f.load, ratio: f.ratio, band: f.band,
      teachingHours: f.teachingHours, courses: f.courses, students: f.students,
      coverClasses: f.cover.count, openTasks: f.tasks.open, overdueTasks: f.tasks.overdue,
      papersDue: f.papers.pending, overNorm: f.overNorm,
    })),
  }
}

/* ───────────────────────── syllabus ───────────────────────── */
async function syllabusSection(courses) {
  const ids = courses.map((c) => c._id)
  const docs = ids.length ? await Syllabus.find({ courseId: { $in: ids } }).lean() : []
  const byCourse = new Map(docs.map((d) => [String(d.courseId), d]))
  const rows = courses.map((c) => {
    const s = byCourse.get(String(c._id))
    const topics = s ? s.modules.flatMap((m) => m.topics || []) : []
    const done = topics.filter((t) => t.completed).length
    const modules = s ? s.modules.length : 0
    const modulesDone = s ? s.modules.filter((m) => (m.topics || []).length && m.topics.every((t) => t.completed)).length : 0
    const progress = topics.length ? Math.round((done / topics.length) * 100) : 0
    return {
      courseId: c.courseId, courseCode: c.courseCode || c.courseId, courseName: c.courseName,
      teacher: (c.teacher && c.teacher.name) || "—",
      hasSyllabus: !!s && topics.length > 0,
      modules, modulesDone, topics: topics.length, topicsDone: done, progress,
      status: !s || !topics.length ? "No syllabus" : progress === 100 ? "Completed" : progress >= 60 ? "On track" : progress > 0 ? "Behind" : "Not started",
      lastUpdate: s ? s.updatedAt : null,
    }
  }).sort((a, b) => a.progress - b.progress)
  const withSyl = rows.filter((r) => r.hasSyllabus)
  const totalTopics = withSyl.reduce((s, r) => s + r.topics, 0)
  const doneTopics = withSyl.reduce((s, r) => s + r.topicsDone, 0)
  return {
    summary: {
      avgProgress: pct(doneTopics, totalTopics),
      courses: rows.length, withSyllabus: withSyl.length, noSyllabus: rows.length - withSyl.length,
      completed: rows.filter((r) => r.status === "Completed").length,
      behind: rows.filter((r) => r.status === "Behind" || r.status === "Not started").length,
      topics: totalTopics, topicsDone: doneTopics,
    },
    courses: rows,
  }
}

/* ───────────────────────── build ───────────────────────── */
async function buildReport(req, query) {
  const period = resolvePeriod(query || {})
  const ctx = await H.loadDept(req)

  const [attendance, leave, workload, syllabus] = await Promise.all([
    attendanceSection(ctx.courses, period),
    leaveSection(ctx, period),
    workloadSection(req),
    syllabusSection(ctx.courses),
  ])

  // Plain-language headline items so the HOD sees what needs attention without reading every table.
  const highlights = []
  if (attendance.summary.studentsBelowMin) highlights.push({ level: "warn", section: "Attendance", text: `${attendance.summary.studentsBelowMin} student${attendance.summary.studentsBelowMin === 1 ? " is" : "s are"} below ${ATTENDANCE_MIN}% attendance.` })
  const lowCourse = attendance.courses.find((c) => c.percent != null && c.percent < ATTENDANCE_MIN)
  if (lowCourse) highlights.push({ level: "warn", section: "Attendance", text: `${lowCourse.courseCode} has the lowest attendance (${lowCourse.percent}%).` })
  if (attendance.summary.coursesWithoutData) highlights.push({ level: "info", section: "Attendance", text: `${attendance.summary.coursesWithoutData} course${attendance.summary.coursesWithoutData === 1 ? " has" : "s have"} no attendance recorded in this period.` })
  if (leave.summary.pending) highlights.push({ level: "warn", section: "Leave", text: `${leave.summary.pending} leave request${leave.summary.pending === 1 ? " is" : "s are"} still pending.` })
  if (syllabus.summary.noSyllabus) highlights.push({ level: "info", section: "Syllabus", text: `${syllabus.summary.noSyllabus} course${syllabus.summary.noSyllabus === 1 ? " has" : "s have"} no syllabus set up.` })
  if (syllabus.summary.behind) highlights.push({ level: "warn", section: "Syllabus", text: `${syllabus.summary.behind} course${syllabus.summary.behind === 1 ? " is" : "s are"} behind on syllabus coverage.` })
  insightsFrom(workload).forEach((i) => highlights.push(i))

  return {
    meta: { department: ctx.dept || "All departments", generatedAt: new Date().toISOString(), generatedBy: req.user.name, period, faculty: ctx.faculty.length, courses: ctx.courses.length },
    highlights, attendance, leave, workload, syllabus,
  }
}

exports.getDepartmentReport = wrap(async (req, res) => {
  res.json({ success: true, data: await buildReport(req, req.query) })
})

/* ───────────────────────── saved snapshots (audit trail) ───────────────────────── */
// JSON with sorted keys, so the same data always gives the same checksum
const stable = (v) => Array.isArray(v) ? `[${v.map(stable).join(",")}]`
  : v && typeof v === "object" ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`
  : JSON.stringify(v === undefined ? null : v)
const checksumOf = (data) => crypto.createHash("sha256").update(stable(data)).digest("hex")
const mine = (req) => ({ department: req.dept || "" })

exports.createSnapshot = wrap(async (req, res) => {
  const { title, note } = req.body || {}
  if (typeof title !== "string" || !title.trim()) return res.status(400).json({ success: false, message: "Give the saved report a title, e.g. \"Semester 5 – attendance review\"." })
  const data = JSON.parse(JSON.stringify(await buildReport(req, req.body)))   // plain JSON only
  const snap = await ReportSnapshot.create({
    ...mine(req), title: title.trim().slice(0, 120), note: typeof note === "string" ? note.trim().slice(0, 500) : "",
    period: data.meta.period, createdBy: { id: String(req.user._id), name: req.user.name }, data, checksum: checksumOf(data),
  })
  res.status(201).json({ success: true, data: { _id: snap._id, title: snap.title, checksum: snap.checksum, createdAt: snap.createdAt } })
})

exports.listSnapshots = wrap(async (req, res) => {
  const rows = await ReportSnapshot.find(mine(req)).select("title note period createdBy checksum createdAt").sort({ createdAt: -1 }).limit(100).lean()
  res.json({ success: true, data: rows })
})

exports.getSnapshot = wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: "Saved report not found" })
  const snap = await ReportSnapshot.findOne({ _id: req.params.id, ...mine(req) }).lean()
  if (!snap) return res.status(404).json({ success: false, message: "Saved report not found" })
  const verified = checksumOf(snap.data) === snap.checksum      // false = the stored numbers were changed after saving
  const { data, ...meta } = snap
  res.json({ success: true, data: { snapshot: meta, report: data, verified } })
})

function insightsFrom(workload) {
  return (workload.insights || []).filter((i) => i.level === "warn").slice(0, 3)
    .map((i) => ({ level: "warn", section: "Workload", text: i.text }))
}