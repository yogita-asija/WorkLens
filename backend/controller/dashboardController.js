const ActivityLog  = require("../models/ActivityLog")
const Course       = require("../models/course")
const Attendance   = require("../models/Attendance")
const Assignment   = require("../models/Assignment")
const { Leave }    = require("../models/Leave")

// GET /api/dashboard/stats?userId=xxx
const getStats = async (req, res) => {
  try {
    const { userId } = req.query

    // Count courses (filter by teacher if userId provided)
    const courseFilter = userId ? { "teacher.id": userId } : {}
    const classesTaught = await Course.countDocuments(courseFilter)

    // Count assignments linked to the teacher's courses
    let assignmentCount = 0
    if (userId) {
      const teacherCourses = await Course.find({ "teacher.id": userId }, "_id").lean()
      const courseIds = teacherCourses.map(c => c._id)
      assignmentCount = await Assignment.countDocuments({ courseId: { $in: courseIds } })
    } else {
      assignmentCount = await Assignment.countDocuments()
    }

    // Weekly hours: attendance sessions in last 7 days × 1.5h each
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const attendanceFilter = userId
      ? { createdAt: { $gte: weekAgo }, teacherId: userId }
      : { createdAt: { $gte: weekAgo } }
    const weekSessions  = await Attendance.countDocuments(attendanceFilter)
    const weeklyHours   = Math.round(weekSessions * 1.5) || 0

    // Activity score: based on logs in last 30 days (0–100)
    const monthAgo = new Date()
    monthAgo.setDate(monthAgo.getDate() - 30)
    const recentLogs    = await ActivityLog.countDocuments({ timestamp: { $gte: monthAgo } })
    const activityScore = Math.min(100, Math.round((recentLogs / 20) * 100)) || 0

    res.json({
      classesTaught,
      assignments:   assignmentCount,
      activityScore: `${activityScore}%`,
      weeklyHours,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// GET /api/dashboard/today?userId=xxx
const getToday = async (req, res) => {
  try {
    const { userId } = req.query

    const todayDate = new Date().toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    })

    // Today's day name (e.g. "Monday")
    const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" })

    // Today's classes: courses whose schedule.days includes today's name
    const courseFilter = userId ? { "teacher.id": userId, status: "active" } : { status: "active" }
    const allCourses = await Course.find(courseFilter, "courseName schedule").lean()
    const classesToday = allCourses
      .filter(c => {
        const days = c.schedule?.days || ""
        return days.toLowerCase().includes(todayName.toLowerCase().slice(0, 3))
      })
      .map(c => ({
        name: c.courseName,
        time: c.schedule?.time || "Time not set",
      }))

    // Pending leaves applied by this faculty
    const leaveFilter = userId ? { facultyId: userId, status: "Pending" } : { status: "Pending" }
    const pendingApprovals = await Leave.countDocuments(leaveFilter)

    // Deadlines: assignments due in next 7 days
    const now  = new Date()
    const soon = new Date(); soon.setDate(now.getDate() + 7)

    let assignmentDeadlines = []
    if (userId) {
      const teacherCourses = await Course.find({ "teacher.id": userId }, "_id courseName").lean()
      const courseIds = teacherCourses.map(c => c._id)
      const upcoming = await Assignment.find({
        courseId: { $in: courseIds },
        completed: false,
        deadline: { $exists: true, $ne: "" },
      }, "title deadline course").lean()

      assignmentDeadlines = upcoming
        .map(a => {
          const due = new Date(a.deadline)
          const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24))
          if (diffDays < 0 || diffDays > 7) return null
          return {
            title:  a.title,
            note:   diffDays === 0 ? "Due today" : diffDays === 1 ? "Due tomorrow" : `Due in ${diffDays} days`,
            urgent: diffDays <= 1,
          }
        })
        .filter(Boolean)
        .slice(0, 4)
    }

    // Notices from recent system activity logs
    const recentSystemLogs = await ActivityLog.find({ type: "system" })
      .sort({ timestamp: -1 })
      .limit(2)
      .lean()
    const notices = recentSystemLogs.length > 0
      ? recentSystemLogs.map(l => l.title + (l.detail ? `: ${l.detail}` : ""))
      : []

    res.json({
      todayDate,
      classesToday,
      pendingApprovals,
      deadlines: assignmentDeadlines,
      notices,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// GET /api/dashboard/weekly-activity
const getWeeklyActivity = async (req, res) => {
  try {
    const days    = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    const weekly = await ActivityLog.aggregate([
      { $match: { timestamp: { $gte: weekAgo } } },
      { $group: { _id: { $dayOfWeek: "$timestamp" }, count: { $sum: 1 } } },
    ])

    const map = {}
    weekly.forEach(w => { map[w._id] = w.count })

    const data = days.map((d, i) => ({ day: d, activities: map[i + 1] || 0 }))
    res.json(data)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// GET /api/dashboard/hours
const getHours = async (req, res) => {
  try {
    const days    = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    const weekly = await ActivityLog.aggregate([
      { $match: { timestamp: { $gte: weekAgo } } },
      { $group: { _id: { $dayOfWeek: "$timestamp" }, count: { $sum: 1 } } },
    ])

    const map = {}
    weekly.forEach(w => { map[w._id] = w.count })

    const data = days.map((d, i) => ({ day: d, hours: Math.round((map[i + 1] || 0) * 1.5) }))
    res.json(data)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// GET /api/dashboard/recent-activity
const getRecentActivity = async (req, res) => {
  try {
    const logs = await ActivityLog.find().sort({ timestamp: -1 }).limit(8)
    const data = logs.map(l => ({
      title: l.title,
      sub:   l.course || l.subject || "",
      time:  timeAgo(l.timestamp),
      type:  l.type || "default",
    }))
    res.json(data)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// GET /api/dashboard/courses
const getCourses = async (req, res) => {
  try {
    const courses = await Course.find()
    const data = courses.map(c => ({
      code:     c.courseId,
      name:     c.label,
      students: c.students ? c.students.length : 0,
      progress: c.progress || 0,
    }))
    res.json(data)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// GET /api/dashboard/upcoming-tasks?userId=xxx
const getUpcomingTasks = async (req, res) => {
  try {
    const { userId } = req.query
    const now  = new Date()
    const soon = new Date(); soon.setDate(now.getDate() + 14)

    let assignments = []
    if (userId) {
      const teacherCourses = await Course.find({ "teacher.id": userId }, "_id courseName").lean()
      const courseIds      = teacherCourses.map(c => c._id)
      assignments = await Assignment.find({
        courseId:  { $in: courseIds },
        completed: false,
        deadline:  { $exists: true, $ne: "" },
      }, "title deadline course").lean()
    } else {
      assignments = await Assignment.find({
        completed: false,
        deadline:  { $exists: true, $ne: "" },
      }, "title deadline course").lean()
    }

    const tasks = assignments
      .map((a, idx) => {
        const due      = new Date(a.deadline)
        const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24))
        let dueLabel
        if (diffDays < 0)      dueLabel = "Overdue"
        else if (diffDays === 0) dueLabel = "Today"
        else if (diffDays === 1) dueLabel = "Tomorrow"
        else if (diffDays <= 7)  dueLabel = `In ${diffDays} days`
        else                     dueLabel = `In ${diffDays} days`

        const priority = diffDays < 0 ? "high" : diffDays <= 1 ? "high" : diffDays <= 3 ? "medium" : "low"
        return {
          id:       a._id.toString(),
          label:    `Grade "${a.title}"${a.course ? ` — ${a.course}` : ""}`,
          due:      dueLabel,
          priority,
          done:     false,
        }
      })
      .sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 }
        return order[a.priority] - order[b.priority]
      })
      .slice(0, 6)

    res.json(tasks)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// POST /api/workflow/feedback
const submitWorkflowFeedback = async (req, res) => {
  try {
    const { category, message, customIssue } = req.body
    if (!category) return res.status(400).json({ message: "Please select a category" })
    await ActivityLog.create({
      type:      "workflow",
      title:     "Workflow feedback submitted",
      subject:   category,
      detail:    category === "Other"
        ? `Issue: ${customIssue}\n\nDescription: ${message}`
        : message,
      timestamp: new Date(),
    })
    res.json({ success: true, message: "Feedback submitted successfully" })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// GET /api/workflow/feedback
const getAllWorkflowFeedback = async (req, res) => {
  try {
    const feedbacks = await ActivityLog.find({ type: "workflow" }).sort({ timestamp: -1 })
    res.json(feedbacks)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// helper
function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

module.exports = {
  getStats,
  getToday,
  getWeeklyActivity,
  getHours,
  getRecentActivity,
  getCourses,
  getUpcomingTasks,
  submitWorkflowFeedback,
  getAllWorkflowFeedback,
}
