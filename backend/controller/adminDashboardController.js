const User        = require("../models/User")
const Course      = require("../models/course")
const { Leave }   = require("../models/Leave")
const Attendance  = require("../models/Attendance")
const Notification= require("../models/Notification")
const ActivityLog = require("../models/ActivityLog")
const AuditLog    = require("../models/AuditLog")
const Department  = require("../models/Department")

// ─── GET /api/admin/dashboard/stats ──────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const [
      totalTeachers,
      activeTeachers,
      totalCourses,
      activeCourses,
      totalDepartments,
      pendingLeaves,
      totalLeaves,
    ] = await Promise.all([
      User.countDocuments({ role: "teaching" }),
      User.countDocuments({ role: "teaching" }),          // extend if active flag exists
      Course.countDocuments(),
      Course.countDocuments({ status: "active" }),
      Department.countDocuments({ status: "active" }),
      Leave.countDocuments({ status: "Pending" }),
      Leave.countDocuments(),
    ])

    // Attendance summary for current month
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const totalSessions = await Attendance.countDocuments({ createdAt: { $gte: monthStart } })

    // System notifications (unread)
    const systemNotifications = await Notification.countDocuments({ read: false })

    // Recent activities count (last 7 days)
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
    const recentActivityCount = await ActivityLog.countDocuments({ timestamp: { $gte: weekAgo } })

    res.json({
      success: true,
      data: {
        totalTeachers,
        activeTeachers,
        totalCourses,
        activeCourses,
        totalDepartments,
        pendingLeaves,
        totalLeaves,
        attendanceSessions: totalSessions,
        systemNotifications,
        recentActivityCount,
      }
    })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── GET /api/admin/dashboard/charts ─────────────────────────────────────────
exports.getCharts = async (req, res) => {
  try {
    const now = new Date()
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleString("en-US", { month: "short" }) })
    }

    // Leave trend over last 6 months
    const leaveData = await Promise.all(months.map(async ({ year, month, label }) => {
      const from = new Date(year, month, 1)
      const to   = new Date(year, month + 1, 0)
      const count = await Leave.countDocuments({ appliedAt: { $gte: from, $lte: to } })
      return { month: label, leaves: count }
    }))

    // Course distribution by department
    const deptCourses = await Course.aggregate([
      { $group: { _id: "$teacher.name", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 }
    ])

    // Teacher distribution by department
    const teachersByDept = await User.aggregate([
      { $match: { role: "teaching" } },
      { $group: { _id: "$department", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 }
    ])

    // Leave status breakdown
    const [pending, approved, rejected] = await Promise.all([
      Leave.countDocuments({ status: "Pending" }),
      Leave.countDocuments({ status: "Approved" }),
      Leave.countDocuments({ status: "Rejected" }),
    ])

    // Attendance trend (sessions per month, last 6)
    const attendanceData = await Promise.all(months.map(async ({ year, month, label }) => {
      const from = new Date(year, month, 1)
      const to   = new Date(year, month + 1, 0)
      const count = await Attendance.countDocuments({ createdAt: { $gte: from, $lte: to } })
      return { month: label, sessions: count }
    }))

    res.json({
      success: true,
      data: {
        leaveTrend:    leaveData,
        deptCourses:   deptCourses.map(d => ({ dept: d._id || "Unknown", courses: d.count })),
        teachersByDept: teachersByDept.map(d => ({ dept: d._id || "Unknown", teachers: d.count })),
        leaveStatus:   { pending, approved, rejected },
        attendanceTrend: attendanceData,
      }
    })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── GET /api/admin/dashboard/recent-activity ────────────────────────────────
exports.getRecentActivity = async (req, res) => {
  try {
    const logs = await AuditLog.find().sort({ timestamp: -1 }).limit(15).lean()
    res.json({ success: true, data: logs })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}
