const { Leave, LeaveBalance } = require("../models/Leave")
const User     = require("../models/User")
const logAudit = require("../utils/logAudit")
const Notification = require("../models/Notification")

// ─── GET /api/admin/leaves ────────────────────────────────────────────────────
exports.getAllLeaves = async (req, res) => {
  try {
    const { status, type, facultyId, page = 1, limit = 20, from, to } = req.query

    const filter = {}
    if (status)    filter.status    = status
    if (type)      filter.type      = type
    if (facultyId) filter.facultyId = facultyId

    if (from || to) {
      filter.fromDate = {}
      if (from) filter.fromDate.$gte = new Date(from)
      if (to)   filter.fromDate.$lte = new Date(to)
    }

    const skip  = (Number(page) - 1) * Number(limit)
    const total = await Leave.countDocuments(filter)
    const leaves = await Leave.find(filter)
      .sort({ appliedAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean()

    res.json({ success: true, data: leaves, total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── PATCH /api/admin/leaves/:id/status ──────────────────────────────────────
exports.updateLeaveStatus = async (req, res) => {
  try {
    const { status, adminNote = "" } = req.body

    if (!["Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ success: false, message: "status must be Approved or Rejected" })
    }

    const leave = await Leave.findById(req.params.id)
    if (!leave) return res.status(404).json({ success: false, message: "Leave not found" })

    leave.status    = status
    leave.adminNote = adminNote
    leave.updatedAt = new Date()
    await leave.save()

    // Send notification to faculty (best-effort)
    try {
      const user = await User.findOne({ email: leave.facultyName })
      if (user) {
        await Notification.create({
          userId:  user._id,
          type:    "system",
          title:   `Leave ${status}`,
          message: `Your ${leave.type} leave (${leave.duration} day(s)) has been ${status.toLowerCase()}. ${adminNote ? `Note: ${adminNote}` : ""}`,
        })
      }
    } catch {}

    await logAudit({
      adminId: req.admin._id, adminName: req.admin.name,
      action: `LEAVE_${status.toUpperCase()}`, module: "leave",
      targetId: String(leave._id), targetName: leave.facultyName,
      detail: `${status} leave for ${leave.facultyName} (${leave.type}, ${leave.duration} days). ${adminNote}`,
      ip: req.ip,
    })

    res.json({ success: true, message: `Leave ${status.toLowerCase()} successfully`, data: leave })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── GET /api/admin/leaves/summary ───────────────────────────────────────────
exports.getLeaveSummary = async (req, res) => {
  try {
    const [pending, approved, rejected, total] = await Promise.all([
      Leave.countDocuments({ status: "Pending" }),
      Leave.countDocuments({ status: "Approved" }),
      Leave.countDocuments({ status: "Rejected" }),
      Leave.countDocuments(),
    ])

    // Monthly breakdown for current year
    const year = new Date().getFullYear()
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    const monthly = new Array(12).fill(0)
    const leaves = await Leave.find({ fromDate: { $gte: new Date(year, 0, 1), $lte: new Date(year, 11, 31) } })
    leaves.forEach(l => { monthly[new Date(l.fromDate).getMonth()]++ })

    res.json({
      success: true,
      data: {
        pending, approved, rejected, total,
        monthly: monthNames.map((m, i) => ({ month: m, leaves: monthly[i] })),
      }
    })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}
