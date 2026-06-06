const ActivityLog = require("../models/ActivityLog")
const Course      = require("../models/course")
const Attendance  = require("../models/Attendance")
const Leave       = require("../models/Leave").Leave

// GET /api/dashboard/stats
const getStats = async (req, res) => {
  try {
    const classesTaught = await Course.countDocuments()

    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const weekSessions = await Attendance.countDocuments({ createdAt: { $gte: weekAgo } })
    const weeklyHours  = Math.max(weekSessions * 1.5, 0)

    const monthAgo    = new Date()
    monthAgo.setDate(monthAgo.getDate() - 30)
    const recentLogs  = await ActivityLog.countDocuments({ timestamp: { $gte: monthAgo } })
    const activityScore = Math.min(100, Math.round((recentLogs / 30) * 100)) || 94

    res.json({
      classesTaught,
      assignments:   24,
      activityScore: `${activityScore}%`,
      weeklyHours:   Math.round(weeklyHours) || 37,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// GET /api/dashboard/today
const getToday = async (req, res) => {
  try {
    const pendingApprovals = await Leave.countDocuments({ status: "Pending" })

    res.json({
      todayDate:        new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
      classesToday:     [],
      pendingApprovals: pendingApprovals,
      deadlines:        [],
      notices:          ["Faculty meeting scheduled for 4:00 PM in Conference Room A"],
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
      { $group: { _id: { $dayOfWeek: "$timestamp" }, count: { $sum: 1 } } }
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
      { $group: { _id: { $dayOfWeek: "$timestamp" }, count: { $sum: 1 } } }
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

// POST /api/workflow/feedback
const submitWorkflowFeedback = async (req, res) => {
  try {
    const { category, message } = req.body
    if (!category) return res.status(400).json({ message: "Please select a category" })
    // Store in ActivityLog for simplicity
    await ActivityLog.create({
      type:      "workflow",
      title:     "Workflow feedback submitted",
      subject:   category,
      detail:    message || "",
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
  submitWorkflowFeedback,
  getAllWorkflowFeedback,
}
