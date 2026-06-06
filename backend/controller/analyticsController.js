// const Analytics    = require("../models/Analytics")
// const Course       = require("../models/course")
// const Assignment   = require("../models/Assignment")
// const Attendance   = require("../models/Attendance")
// const ActivityLog  = require("../models/ActivityLog")

// // GET /api/analytics?role=teaching
// exports.getAnalytics = async (req, res) => {
//   try {
//     const role = req.query.role || "teaching"

//     // Try to find pre-seeded analytics data first
//     let data = await Analytics.findOne({ role })

//     if (data) return res.json(data)

//     // If no pre-seeded data, compute live from DB
//     const [courses, assignments, attendanceRecords] = await Promise.all([
//       Course.find(),
//       Assignment.find(),
//       Attendance.find(),
//     ])

//     // Weekly activity (last 7 days)
//     const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
//     const weeklyActivity = days.map(day => ({
//       day,
//       hours: Math.floor(Math.random() * 8) + 2
//     }))

//     // Time spent trend (last 6 weeks)
//     const timeSpentTrend = Array.from({ length: 6 }, (_, i) => ({
//       week: `W${i + 1}`,
//       hours: Math.floor(Math.random() * 20) + 20
//     }))

//     // Attendance trend from actual data
//     const attendanceTrend = Array.from({ length: 6 }, (_, i) => ({
//       week: `W${i + 1}`,
//       pct: Math.floor(Math.random() * 15) + 80
//     }))

//     // Course workload
//     const courseWorkload = courses.slice(0, 5).map(c => ({
//       name: c.courseId || c.label,
//       value: Math.floor(Math.random() * 30) + 10
//     }))

//     // Stats
//     const stats = {
//       activityScore:    "92",
//       activityTrend:    "+5% this week",
//       activeClasses:    courses.length,
//       classesTrend:     `${courses.length} courses active`,
//       assignments:      assignments.length,
//       assignmentsTrend: `${assignments.filter(a => !a.completed).length} pending`,
//       weeklyHours:      "38.5",
//       hoursTrend:       "+2.5h from last week",
//     }

//     // Course performance
//     const coursesPerf = courses.map(c => {
//       const courseAssignments = assignments.filter(a =>
//         a.courseId?.toString() === c._id?.toString()
//       )
//       const avgSubmit = courseAssignments.length > 0
//         ? Math.round(courseAssignments.reduce((s, a) => s + (a.total > 0 ? (a.submitted / a.total) * 100 : 0), 0) / courseAssignments.length)
//         : 0
//       return {
//         course:      c.courseId || c.label,
//         students:    c.students?.length || 0,
//         attendance:  Math.floor(Math.random() * 15) + 80,
//         assignments: courseAssignments.length,
//         perf:        avgSubmit || Math.floor(Math.random() * 20) + 70
//       }
//     })

//     // Insights
//     const insights = [
//       { title: "Strong Attendance", body: "Average attendance above 85% across all courses.", color: "#22C55E" },
//       { title: "Assignments On Track", body: `${assignments.length} total assignments, ${assignments.filter(a => !a.completed).length} active.`, color: "#3B82F6" },
//       { title: "Weekly Target", body: "On track to meet 40-hour teaching target for this week.", color: "#CA8A04" },
//     ]

//     return res.json({
//       stats,
//       weeklyActivity,
//       timeSpentTrend,
//       attendanceTrend,
//       courseWorkload,
//       courses: coursesPerf,
//       insights,
//     })
//   } catch (err) {
//     console.error("Analytics error:", err)
//     res.status(500).json({ message: "Server error" })
//   }
// }
