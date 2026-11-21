const Message = require("../models/Message")

// ─── GET /api/messages  ──────────────────────────────────────────────────────
// Returns inbox + sent for the logged-in faculty.
// Query: ?direction=inbox|sent&category=...&priority=...&search=...
exports.getMessages = async (req, res) => {
  try {
    const facultyId = req.user._id.toString()
    const { direction, category, priority, search } = req.query

    const filter = { senderId: facultyId }

    if (direction === "inbox") filter.direction = "received"
    else if (direction === "sent") filter.direction = "sent"

    if (category && category !== "All") filter.category = category
    if (priority && priority !== "All") filter.priority = priority

    if (search) {
      const re = { $regex: search, $options: "i" }
      filter.$or = [
        { subject: re },
        { message: re },
        { from:    re },
        { course:  re },
      ]
    }

    const messages = await Message.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean()

    // Stats
    const allForFaculty = await Message.find({ senderId: facultyId }).lean()
    const unreadCount        = allForFaculty.filter(m => m.direction === "received" && !m.isRead).length
    const announcementsSent  = allForFaculty.filter(m => m.direction === "sent" && m.category === "Announcement").length
    const today              = new Date(); today.setHours(0, 0, 0, 0)
    const todayCount         = allForFaculty.filter(m => new Date(m.createdAt) >= today).length

    res.json({
      success: true,
      data: messages,
      stats: {
        total:             allForFaculty.length,
        unread:            unreadCount,
        announcementsSent,
        today:             todayCount,
      },
    })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── POST /api/messages  ─────────────────────────────────────────────────────
// Faculty sends a message (direction = "sent")
exports.sendMessage = async (req, res) => {
  try {
    const facultyId   = req.user._id.toString()
    const senderName  = req.user.name || "Faculty"
    const { recipient, course, semester, batch, batches, recipients, subject, message, category, priority } = req.body

    if (!subject || !message) {
      return res.status(400).json({ success: false, message: "subject and message are required" })
    }

    const doc = await Message.create({
      senderId: facultyId,
      senderName,
      direction: "sent",
      from: senderName,
      recipient: recipient || "Entire Course",
      course:    course    || "",
      semester:  semester  || "",
      batch:     batch     || "",
      batches:   Array.isArray(batches) ? batches : [],
      recipients: Array.isArray(recipients) ? recipients : [],
      subject,
      message,
      category: category || "Announcement",
      priority: priority || "Normal",
      isRead: true,  // sent messages are always "read"
    })

    res.status(201).json({ success: true, data: doc })
  } catch (err) {
    res.status(400).json({ success: false, message: err.message })
  }
}

// ─── POST /api/messages/receive  ─────────────────────────────────────────────
// Simulates a student sending a message to this faculty (inbox entry).
// In a real system students would have their own accounts;
// for this project the frontend can call this to test inbox.
exports.receiveMessage = async (req, res) => {
  try {
    const facultyId  = req.user._id.toString()
    const senderName = req.user.name || "Faculty"
    const { from, course, semester, batch, subject, message, category, priority } = req.body

    if (!subject || !message) {
      return res.status(400).json({ success: false, message: "subject and message are required" })
    }

    const doc = await Message.create({
      senderId:  facultyId,   // owner = this faculty (their inbox)
      senderName,
      direction: "received",
      from:      from || "Student",
      recipient: "Entire Course",
      course:    course    || "",
      semester:  semester  || "",
      batch:     batch     || "",
      subject,
      message,
      category:  category || "Personal Message",
      priority:  priority || "Normal",
      isRead:    false,
    })

    res.status(201).json({ success: true, data: doc })
  } catch (err) {
    res.status(400).json({ success: false, message: err.message })
  }
}

// ─── PATCH /api/messages/:id/read  ───────────────────────────────────────────
exports.markRead = async (req, res) => {
  try {
    const facultyId = req.user._id.toString()
    const doc = await Message.findOneAndUpdate(
      { _id: req.params.id, senderId: facultyId },
      { isRead: true },
      { new: true }
    )
    if (!doc) return res.status(404).json({ success: false, message: "Message not found" })
    res.json({ success: true, data: doc })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── PATCH /api/messages/read-all  ───────────────────────────────────────────
exports.markAllRead = async (req, res) => {
  try {
    const facultyId = req.user._id.toString()
    await Message.updateMany(
      { senderId: facultyId, direction: "received", isRead: false },
      { isRead: true }
    )
    res.json({ success: true, message: "All inbox messages marked as read" })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── DELETE /api/messages/:id  ───────────────────────────────────────────────
exports.deleteMessage = async (req, res) => {
  try {
    const facultyId = req.user._id.toString()
    const doc = await Message.findOneAndDelete({ _id: req.params.id, senderId: facultyId })
    if (!doc) return res.status(404).json({ success: false, message: "Message not found" })
    res.json({ success: true, message: "Deleted" })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}
