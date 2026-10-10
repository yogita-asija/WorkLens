/**
 * HOD · Faculty Workload endpoints (the "Faculty" page).
 *
 *   GET /api/hod/faculty/workload        department summary + one row per faculty member
 *   GET /api/hod/faculty/:id/workload    full breakdown for one person (opened inside the card)
 *
 * Load index: 1 point ≈ 1 hour of work per week. It is the sum of five parts:
 *   teaching  scheduled class hours per week (main course + batches they teach)
 *   cover     substitute classes in the last 14 / next 14 days, averaged per week
 *   tasks     open HOD tasks (points by priority, +extra if overdue)
 *   papers    question papers still due (points each, +extra if overdue)
 *   duty      "Other Duty" days + hours of Smart Duty Allocation duties, averaged per week
 */
const mongoose = require("mongoose")
const DutyAllocation = require("../../models/HOD/DutyAllocation")
const { Leave, LeaveBalance } = require("../../models/Leave")
const { HodTask, QuestionPaper, Substitution, FacultyStatus } = require("../../models/HOD/HodModels")
const H = require("../../utils/hodHelpers")

const wrap = H.wrap("hodWorkload")

// Shown to the HOD in the "How is the load calculated?" panel, so keep names in sync with FacultyBalance.jsx.
const WEIGHTS = {
  coverPastDays: 14,
  coverFutureDays: 14,
  taskPoints: { High: 3, Medium: 2, Low: 1 },
  overdueTaskExtra: 2,
  paperPoints: 3,
  overduePaperExtra: 3,
  otherDutyDayPoints: 4,
  overloadedAt: 1.3,   // load >= 130% of department average
  capacityAt: 0.7,     // load <= 70% of department average
}
const TEACHING_NORM_HOURS = Number(process.env.TEACHING_NORM_HOURS) || 16
const WEEKS_IN_WINDOW = (WEIGHTS.coverPastDays + WEIGHTS.coverFutureDays) / 7

const round1 = H.round1
const plural = (n, one, many) => (n === 1 ? one : many)
const subHours = (s) => { const r = H.parseRange(s.time); return r ? (r.end - r.start) / 60 : 1 }
const nowMinutes = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() }

/** Loads everything once, then returns a function that builds one person's numbers. */
async function gather(ctx) {
  const today = H.localKey()
  const from = H.addKeyDays(today, -WEIGHTS.coverPastDays)
  const to = H.addKeyDays(today, WEIGHTS.coverFutureDays)
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
  const todayUTC = H.keyToUTC(today)
  const in14UTC = H.keyToUTC(H.addKeyDays(today, 14))
  const year = new Date().getFullYear()
  const yStart = new Date(Date.UTC(year, 0, 1)); const yEnd = new Date(Date.UTC(year + 1, 0, 1))

  const [subs, tasks, papers, statuses, duties, leaves] = await Promise.all([
    Substitution.find({ substituteId: { $in: ctx.idStrs }, dateKey: { $gte: from, $lte: to } }).lean(),
    HodTask.find({ assignedToId: { $in: ctx.idStrs }, status: { $ne: "Completed" } }).lean(),
    QuestionPaper.find({ department: ctx.dept, facultyId: { $in: ctx.idStrs }, status: { $in: ["Pending", "Changes Requested"] } }).lean(),
    FacultyStatus.find({ facultyId: { $in: ctx.idStrs }, dateKey: { $gte: from, $lte: to } }).lean(),
    DutyAllocation.find({ department: ctx.dept, dateKey: { $gte: from, $lte: to }, "assignees.facultyId": { $in: ctx.idStrs } }).lean(),
    Leave.find({
      facultyId: { $in: ctx.idStrs }, status: { $in: ["Approved", "Pending"] },
      $or: [{ toDate: { $gte: todayUTC } }, { fromDate: { $gte: yStart, $lt: yEnd } }],
    }).lean(),
  ])
  const balances = await LeaveBalance.find({ facultyId: { $in: ctx.idStrs }, year }).lean()

  return function build(f) {
    const id = String(f._id)
    const sess = H.weeklySessions(ctx.courses, id)

    // students taught (main course roster + the batches they teach), counted once each
    const students = new Set()
    let courseCount = 0
    for (const c of ctx.courses) {
      let teaches = false
      if (H.teacherOf(c) === id) { teaches = true; (c.students || []).forEach((s) => students.add(s.id || s.name)) }
      for (const b of c.batches || []) {
        if (b.teacher && b.teacher.id && String(b.teacher.id) === id) { teaches = true; (b.students || []).forEach((s) => students.add(s.id || s.name)) }
      }
      if (teaches) courseCount++
    }

    // cover
    const mySubs = subs.filter((s) => s.substituteId === id)
    const coverHours = mySubs.reduce((s, x) => s + subHours(x), 0)
    const coverUpcoming = mySubs.filter((s) => s.dateKey >= today).length

    // tasks / papers
    const myTasks = tasks.filter((t) => t.assignedToId === id)
    const myPapers = papers.filter((p) => p.facultyId === id)
    const taskOverdue = myTasks.filter((t) => new Date(t.dueDate) < startOfToday)
    const paperOverdue = myPapers.filter((p) => p.dueDate && new Date(p.dueDate) < startOfToday)
    const taskPts = myTasks.reduce((s, t) => s + (WEIGHTS.taskPoints[t.priority] || 0), 0) + taskOverdue.length * WEIGHTS.overdueTaskExtra
    const paperPts = myPapers.length * WEIGHTS.paperPoints + paperOverdue.length * WEIGHTS.overduePaperExtra

    // duty
    const dutyDays = statuses.filter((s) => s.facultyId === id && s.status === "Other Duty").map((s) => s.dateKey).sort()
    const myDuties = duties.filter((d) => d.assignees.some((a) => a.facultyId === id))
    const dutyHours = myDuties.reduce((s, d) => s + d.durationHours, 0)
    const dutyPts = (dutyDays.length * WEIGHTS.otherDutyDayPoints + dutyHours) / WEEKS_IN_WINDOW

    const components = {
      teaching: round1(sess.hours),
      cover: round1(coverHours / WEEKS_IN_WINDOW),
      tasks: round1(taskPts),
      papers: round1(paperPts),
      duty: round1(dutyPts),
    }
    const load = round1(Object.values(components).reduce((s, v) => s + v, 0))

    // leave facts
    const myLeaves = leaves.filter((l) => l.facultyId === id)
    const awayNext14 = myLeaves.filter((l) => l.status === "Approved").reduce((n, l) => {
      const a = new Date(Math.max(new Date(l.fromDate), todayUTC)); const b = new Date(Math.min(new Date(l.toDate), in14UTC - 864e5))
      return b >= a ? n + Math.round((b - a) / 864e5) + 1 : n
    }, 0)

    // live status, same wording the dashboard uses
    const away = myLeaves.some((l) => l.status === "Approved" && H.utcKey(l.fromDate) <= today && H.utcKey(l.toDate) >= today)
    const override = statuses.find((s) => s.facultyId === id && s.dateKey === today)
    const inClass = sess.sessions.some((s) => s.day === H.weekdayOf(today) && s.range && nowMinutes() >= s.range.start && nowMinutes() < s.range.end)
    const status = away ? "On Leave" : override ? override.status : inClass ? "Teaching" : "Available"

    return {
      sess, mySubs, myTasks, myPapers, taskOverdue, paperOverdue, dutyDays, myDuties, myLeaves, balances,
      row: {
        _id: id, name: f.name, email: f.email || "", status,
        courses: courseCount, students: students.size,
        teachingHours: round1(sess.hours), sessionsPerWeek: sess.sessions.length, estimatedTimes: sess.estimated,
        overNorm: sess.hours > TEACHING_NORM_HOURS,
        awayNext14,
        tasks: { open: myTasks.length, overdue: taskOverdue.length },
        papers: { pending: myPapers.length, overdue: paperOverdue.length },
        cover: { count: mySubs.length, hours: round1(coverHours), upcoming: coverUpcoming },
        components, load,
      },
      today, year, startOfToday,
    }
  }
}

/* ─────────────────────────── department-level fairness ─────────────────────────── */

function fairness(rows) {
  const n = rows.length
  const loads = rows.map((r) => r.load)
  const mean = n ? loads.reduce((s, v) => s + v, 0) / n : 0
  const sorted = [...loads].sort((a, b) => a - b)
  const median = n ? (n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2) : 0
  const sd = n ? Math.sqrt(loads.reduce((s, v) => s + (v - mean) ** 2, 0) / n) : 0

  // 100 = identical loads; each 1% of spread (sd / mean) costs one point
  const balanceScore = n >= 2 && mean > 0 ? Math.max(0, Math.min(100, Math.round(100 * (1 - sd / mean)))) : null
  const balanceLabel = balanceScore == null ? "Not enough data" : balanceScore >= 80 ? "Well balanced" : balanceScore >= 60 ? "Slightly uneven" : "Uneven"

  for (const r of rows) {
    r.ratio = mean > 0 ? Math.round((r.load / mean) * 100) : 100
    r.band = n < 2 ? "balanced" : r.ratio >= WEIGHTS.overloadedAt * 100 ? "overloaded" : r.ratio <= WEIGHTS.capacityAt * 100 ? "capacity" : "balanced"
  }
  const free = rows.filter((r) => r.status !== "On Leave")
  const most = n >= 2 && free.length ? free.reduce((a, b) => (b.load < a.load ? b : a)) : null

  return {
    dept: {
      balanceScore, balanceLabel, mean: round1(mean), median: round1(median),
      overloaded: rows.filter((r) => r.band === "overloaded").length,
      withCapacity: rows.filter((r) => r.band === "capacity").length,
      mostCapacity: most ? { name: most.name, load: most.load } : null,
    },
    mean,
  }
}

function buildInsights(rows, dept) {
  if (rows.length < 2) return []
  const out = []
  const over = rows.filter((r) => r.band === "overloaded").sort((a, b) => b.load - a.load)
  for (const r of over.slice(0, 3)) {
    out.push({ level: "warn", facultyId: r._id, text: `${r.name} is carrying ${r.ratio}% of the department average (${r.load} pts). Consider moving a task, paper or substitute class to someone else.` })
  }
  const roomy = rows.filter((r) => r.band === "capacity" && r.status !== "On Leave").sort((a, b) => a.load - b.load)
  if (roomy.length) {
    out.push({ level: "info", facultyId: roomy[0]._id, text: `${roomy[0].name} has the most room (${roomy[0].load} pts)${roomy.length > 1 ? `, along with ${roomy.length - 1} other${roomy.length > 2 ? "s" : ""}` : ""}. A good pick for the next task, duty or substitute class.` })
  }
  const overdue = rows.reduce((n, r) => n + r.tasks.overdue + r.papers.overdue, 0)
  if (overdue) out.push({ level: "warn", text: `${overdue} overdue ${plural(overdue, "item", "items")} (tasks and question papers) across the department.` })
  const norm = rows.filter((r) => r.overNorm)
  if (norm.length) out.push({ level: "info", facultyId: norm[0]._id, text: `${norm.map((r) => r.name).slice(0, 3).join(", ")}${norm.length > 3 ? ` +${norm.length - 3}` : ""} ${plural(norm.length, "teaches", "teach")} more than ${TEACHING_NORM_HOURS} h/week.` })
  for (const r of rows.filter((x) => x.awayNext14 >= 3).sort((a, b) => b.awayNext14 - a.awayNext14).slice(0, 2)) {
    out.push({ level: "info", facultyId: r._id, text: `${r.name} will be away ${r.awayNext14} days in the next two weeks, so expect extra cover work for others.` })
  }
  if (!out.some((i) => i.level === "warn") && dept.balanceScore != null && dept.balanceScore >= 80) {
    out.push({ level: "good", text: "Work is shared fairly evenly across the department." })
  }
  return out
}

/* ─────────────────────────── endpoints ─────────────────────────── */

exports.getWorkload = wrap(async (req, res) => {
  const ctx = await H.loadDept(req)
  const build = await gather(ctx)
  const rows = ctx.faculty.map((f) => build(f).row)
  const { dept } = fairness(rows)
  rows.sort((a, b) => b.load - a.load || a.name.localeCompare(b.name))
  res.json({ success: true, data: { dept, insights: buildInsights(rows, dept), weights: WEIGHTS, faculty: rows } })
})

exports.getFacultyWorkload = wrap(async (req, res) => {
  const ctx = await H.loadDept(req)
  const f = mongoose.isValidObjectId(req.params.id) ? ctx.faculty.find((x) => String(x._id) === req.params.id) : null
  if (!f) return res.status(404).json({ success: false, message: "Faculty not found in your department" })

  const build = await gather(ctx)
  const p = build(f)
  const { sess, mySubs, myTasks, myPapers, dutyDays, myDuties, myLeaves, today, year, startOfToday } = p

  const week = H.SCHEDULE_DAYS.map((day) => {
    const list = sess.sessions.filter((s) => s.day === day)
    return {
      day, hours: round1(list.reduce((s, x) => s + x.hours, 0)),
      sessions: list.map((s) => ({ courseCode: s.courseCode, courseName: s.courseName, batchName: s.batchName, time: s.time || "time TBD" })),
    }
  })

  const yStart = new Date(Date.UTC(year, 0, 1)); const yEnd = new Date(Date.UTC(year + 1, 0, 1))
  const inYear = myLeaves.filter((l) => new Date(l.fromDate) >= yStart && new Date(l.fromDate) < yEnd)
  const used = inYear.filter((l) => l.status === "Approved").reduce((s, l) => s + l.duration, 0)
  const pending = inYear.filter((l) => l.status === "Pending").reduce((s, l) => s + l.duration, 0)
  const bal = p.balances.find((b) => b.facultyId === p.row._id)
  const allocated = bal ? bal.totalLeaves : 12

  res.json({
    success: true,
    data: {
      faculty: { _id: p.row._id, name: p.row.name },
      summary: {
        load: p.row.load, components: p.row.components, teachingHours: p.row.teachingHours,
        sessionsPerWeek: p.row.sessionsPerWeek, estimatedTimes: p.row.estimatedTimes,
        cover: p.row.cover, tasks: p.row.tasks, papers: p.row.papers,
      },
      week,
      schedule: sess.sessions.map(({ range, ...s }) => s),
      cover: mySubs.sort((a, b) => a.dateKey.localeCompare(b.dateKey)).map((s) => ({
        _id: s._id, courseName: s.courseName, dateKey: s.dateKey, time: s.time, originalFacultyName: s.originalFacultyName, upcoming: s.dateKey >= today,
      })),
      tasks: myTasks.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)).map((t) => ({
        _id: t._id, title: t.title, priority: t.priority, dueDate: t.dueDate, overdue: new Date(t.dueDate) < startOfToday,
      })),
      papers: myPapers.map((x) => ({
        _id: x._id, courseName: x.courseName, examType: x.examType, status: x.status, dueDate: x.dueDate, overdue: !!x.dueDate && new Date(x.dueDate) < startOfToday,
      })),
      dutyDays,
      duties: myDuties.map((d) => ({ _id: d._id, title: d.title, dateKey: d.dateKey, durationHours: d.durationHours })),
      leave: {
        year, allocated, used, remaining: allocated - used, pending,
        upcoming: myLeaves.filter((l) => H.utcKey(l.toDate) >= today)
          .sort((a, b) => new Date(a.fromDate) - new Date(b.fromDate)).slice(0, 5)
          .map((l) => ({ _id: l._id, type: l.type, fromDate: l.fromDate, toDate: l.toDate, status: l.status })),
      },
    },
  })
})