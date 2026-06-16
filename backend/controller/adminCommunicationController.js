const Notification = require("../models/Notification")
const User         = require("../models/User")
const logAudit     = require("../utils/logAudit")

// ─── POST /api/admin/communications/send ─────────────────────────────────────
// Send notification to specific users, a department, or broadcast to all teachers
exports.sendNotification = async (req, res) => {
  try {
    const { title, message, type = "system", targetType, targetIds = [], department, link = "" } = req.body

    if (!title || !message) {
      return res.status(400).json({ success: false, message: "title and message are required" })
    }

    let recipients = []

    if (targetType === "broadcast") {
      recipients = await User.find({ role: { $in: ["teaching", "non-teaching"] } }).select("_id").lean()
    } else if (targetType === "department" && department) {
      recipients = await User.find({ department, role: "teaching" }).select("_id").lean()
    } else if (targetType === "specific" && targetIds.length > 0) {
      recipients = targetIds.map(id => ({ _id: id }))
    } else {
      return res.status(400).json({ success: false, message: "Invalid target configuration" })
    }

    if (recipients.length === 0) {
      return res.status(404).json({ success: false, message: "No recipients found" })
    }

    const notifications = recipients.map(r => ({
      userId:  r._id,
      type,
      title,
      message,
      link,
      meta:    { sentBy: req.admin.name, sentAt: new Date() },
    }))

    await Notification.insertMany(notifications)

    await logAudit({
      adminId: req.admin._id, adminName: req.admin.name,
      action: "SEND_NOTIFICATION", module: "communication",
      detail: `Sent "${title}" to ${recipients.length} recipient(s) via ${targetType}`,
      ip: req.ip,
    })

    res.json({ success: true, message: `Notification sent to ${recipients.length} recipient(s)` })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── GET /api/admin/communications/history ───────────────────────────────────
exports.getHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query
    const skip  = (Number(page) - 1) * Number(limit)
    const total = await Notification.countDocuments({ "meta.sentBy": { $exists: true } })
    const notes = await Notification.find({ "meta.sentBy": { $exists: true } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean()

    res.json({ success: true, data: notes, total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── GET /api/admin/communications/recipients ────────────────────────────────
// Returns list of teachers for targeting
exports.getRecipients = async (req, res) => {
  try {
    const { department } = req.query
    const filter = { role: "teaching" }
    if (department) filter.department = department

    const users = await User.find(filter).select("name email department").lean()
    res.json({ success: true, data: users })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}
