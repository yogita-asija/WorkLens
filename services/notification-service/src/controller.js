const Notification = require("./models/Notification")

/* ── Public API (same behaviour as the old monolith notificationController) ─────────────────────── */

// GET /api/notifications?userId=xxx&unreadOnly=true
exports.getNotifications = async (req, res) => {
  try {
    const { userId, unreadOnly } = req.query
    const filter = {}
    if (userId) filter.userId = userId
    if (unreadOnly === "true") filter.read = false

    const notes = await Notification.find(filter).sort({ createdAt: -1 }).limit(50).lean()
    const unreadCount = await Notification.countDocuments({ ...filter, read: false })
    res.json({ notifications: notes, unreadCount })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// POST /api/notifications
exports.createNotification = async (req, res) => {
  try {
    const { userId, type, title, message, link, meta } = req.body
    if (!title || !message) return res.status(400).json({ message: "title and message required" })
    const n = await Notification.create({ userId, type: type || "system", title, message, link: link || "", meta: meta || {} })
    res.status(201).json(n)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// PATCH /api/notifications/:id/read
exports.markRead = async (req, res) => {
  try {
    const n = await Notification.findByIdAndUpdate(req.params.id, { read: true }, { new: true })
    if (!n) return res.status(404).json({ message: "Not found" })
    res.json(n)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// PATCH /api/notifications/read-all
exports.markAllRead = async (req, res) => {
  try {
    const { userId } = req.body
    const filter = { read: false }
    if (userId) filter.userId = userId
    await Notification.updateMany(filter, { read: true })
    res.json({ message: "All marked read" })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// DELETE /api/notifications/:id
exports.deleteNotification = async (req, res) => {
  try {
    await Notification.findByIdAndDelete(req.params.id)
    res.json({ message: "Deleted" })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

/* ── Internal API (called by other WorkLens services, never exposed through the gateway) ─────────── */

// POST /internal/notifications   body: one notification object, or an array of them
exports.internalCreate = async (req, res) => {
  try {
    const body = req.body
    if (Array.isArray(body)) {
      if (!body.length) return res.status(201).json({ created: 0 })
      const docs = await Notification.insertMany(body)
      return res.status(201).json({ created: docs.length })
    }
    const n = await Notification.create(body)
    res.status(201).json({ created: 1, id: String(n._id) })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// POST /internal/notifications/delete-many   body: {} (everything) or { userId } (used by the seed scripts)
exports.internalDeleteMany = async (req, res) => {
  try {
    const { userId, ...rest } = req.body || {}
    if (Object.keys(rest).length) return res.status(400).json({ message: "Only {} or { userId } is supported" })
    const result = await Notification.deleteMany(userId ? { userId } : {})
    res.json({ deleted: result.deletedCount ?? 0 })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}
