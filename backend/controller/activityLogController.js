const ActivityLog = require("../models/ActivityLog")


// GET /activity-logs  — with optional ?type=attendance&from=2026-01-01&to=2026-12-31
const getAllLogs = async (req, res) => {
  try {
    const { type, from, to } = req.query

    let filter = {}

    if (type && type !== "all") {
      filter.type = type
    }

    if (from || to) {
      filter.timestamp = {}
      if (from) filter.timestamp.$gte = new Date(from)
      if (to)   filter.timestamp.$lte = new Date(to + "T23:59:59")
    }

    const logs = await ActivityLog.find(filter).sort({ timestamp: -1 })

    // Sidebar stats
    const total = await ActivityLog.countDocuments()

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const last7 = await ActivityLog.countDocuments({ timestamp: { $gte: sevenDaysAgo } })

    // Breakdown by type
    const breakdownRaw = await ActivityLog.aggregate([
      { $group: { _id: "$type", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ])
    const breakdown = breakdownRaw.map(b => ({ type: b._id, count: b.count }))

    // Most active day
    const allLogs = await ActivityLog.find({}, "timestamp")
    const dayMap = {}
    allLogs.forEach(l => {
      const day = new Date(l.timestamp).toLocaleDateString("en-US", { weekday: "long" })
      dayMap[day] = (dayMap[day] || 0) + 1
    })
    let mostActiveDay = "—", maxCount = 0
    Object.entries(dayMap).forEach(([d, c]) => {
      if (c > maxCount) { maxCount = c; mostActiveDay = d }
    })

    res.json({
      logs,
      stats: {
        total,
        last7,
        mostActiveDay,
        mostActiveDayCount: maxCount,
        breakdown,
      }
    })
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch activity logs", error: err.message })
  }
}


// POST /activity-logs — manual creation (frontend can also call this)
const createLog = async (req, res) => {
  try {
    const { type, title, subject, course, detail, timestamp } = req.body

    if (!type || !title) {
      return res.status(400).json({ message: "type and title are required" })
    }

    const newLog = await ActivityLog.create({
      type,
      title,
      subject,
      course,
      detail,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    })

    res.json({ message: "Activity log created!", data: newLog })
  } catch (err) {
    res.status(500).json({ message: "Failed to create activity log", error: err.message })
  }
}


// DELETE /activity-logs/:id
const deleteLog = async (req, res) => {
  try {
    await ActivityLog.findByIdAndDelete(req.params.id)
    res.json({ message: "Activity log deleted" })
  } catch (err) {
    res.status(500).json({ message: "Failed to delete activity log", error: err.message })
  }
}


// DELETE /activity-logs  — clear all logs
const clearAllLogs = async (req, res) => {
  try {
    await ActivityLog.deleteMany({})
    res.json({ message: "All activity logs cleared" })
  } catch (err) {
    res.status(500).json({ message: "Failed to clear logs", error: err.message })
  }
}


module.exports = {
  getAllLogs,
  createLog,
  deleteLog,
  clearAllLogs,
}
