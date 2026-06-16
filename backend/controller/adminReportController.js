const { Leave }  = require("../models/Leave")
const Attendance = require("../models/Attendance")
const User       = require("../models/User")
const Course     = require("../models/course")

// ─── GET /api/admin/reports/attendance ───────────────────────────────────────
exports.getAttendanceReport = async (req, res) => {
  try {
    const { from, to, courseId } = req.query

    const filter = {}
    if (courseId) filter.courseId = courseId
    if (from || to) {
      filter.date = {}
      if (from) filter.date.$gte = from
      if (to)   filter.date.$lte = to
    }

    const records = await Attendance.find(filter).sort({ date: -1 }).lean()

    // Aggregate stats
    const totalSessions = records.length
    let totalPresent = 0, totalStudents = 0
    records.forEach(r => {
      r.students?.forEach(s => {
        totalStudents++
        if (s.status === "present") totalPresent++
      })
    })

    const attendanceRate = totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : 0

    res.json({
      success: true,
      data: {
        records,
        summary: { totalSessions, totalPresent, totalStudents, attendanceRate },
      }
    })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── GET /api/admin/reports/leaves ───────────────────────────────────────────
exports.getLeaveReport = async (req, res) => {
  try {
    const { from, to, status, type } = req.query

    const filter = {}
    if (status) filter.status = status
    if (type)   filter.type   = type
    if (from || to) {
      filter.fromDate = {}
      if (from) filter.fromDate.$gte = new Date(from)
      if (to)   filter.fromDate.$lte = new Date(to)
    }

    const leaves = await Leave.find(filter).sort({ appliedAt: -1 }).lean()

    // Per-faculty summary
    const byFaculty = {}
    leaves.forEach(l => {
      if (!byFaculty[l.facultyName]) byFaculty[l.facultyName] = { name: l.facultyName, total: 0, approved: 0, pending: 0, rejected: 0, days: 0 }
      byFaculty[l.facultyName].total++
      byFaculty[l.facultyName][l.status.toLowerCase()]++
      byFaculty[l.facultyName].days += l.duration
    })

    res.json({
      success: true,
      data: {
        leaves,
        byFaculty: Object.values(byFaculty).sort((a, b) => b.total - a.total),
        totals: {
          total:    leaves.length,
          approved: leaves.filter(l => l.status === "Approved").length,
          pending:  leaves.filter(l => l.status === "Pending").length,
          rejected: leaves.filter(l => l.status === "Rejected").length,
        }
      }
    })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── GET /api/admin/reports/teacher-performance ───────────────────────────────
exports.getTeacherPerformance = async (req, res) => {
  try {
    const teachers = await User.find({ role: "teaching" }).select("-password").lean()

    const performance = await Promise.all(teachers.map(async (t) => {
      const [courseCount, attendanceSessions, leavesTaken] = await Promise.all([
        Course.countDocuments({ "teacher.id": t._id }),
        Attendance.countDocuments({}),
        Leave.countDocuments({ facultyId: String(t._id), status: "Approved" }),
      ])

      return {
        _id:        t._id,
        name:       t.name,
        email:      t.email,
        department: t.department,
        courseCount,
        leavesTaken,
        joined:     t.createdAt,
      }
    }))

    res.json({ success: true, data: performance })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}
