const { Leave, LeaveBalance, Holiday } = require("../models/Leave")
const Notification = require("../models/Notification")

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Calculate the number of calendar days between two dates (inclusive).
 */
function calcDays(from, to) {
  const f = new Date(from)
  const t = new Date(to)
  return Math.round((t - f) / (1000 * 60 * 60 * 24)) + 1
}

/**
 * Fetch or create a LeaveBalance document for the given faculty / year.
 */
async function getOrCreateBalance(facultyId, year) {
  let bal = await LeaveBalance.findOne({ facultyId, year })
  if (!bal) {
    bal = await LeaveBalance.create({ facultyId, year, totalLeaves: 12, taken: 0, holidays: 8 })
  }
  return bal
}

// ─── GET /api/leaves ─────────────────────────────────────────────────────────
// Returns all leave applications for the logged-in faculty, newest first.
// Optional query params: ?status=Pending|Approved|Rejected, ?type=Sick|Casual|Earned
const getLeaves = async (req, res) => {
  try {
    const facultyId = req.user._id.toString()
    const filter = { facultyId }

    if (req.query.status) filter.status = req.query.status
    if (req.query.type)   filter.type   = req.query.type

    const leaves = await Leave.find(filter).sort({ appliedAt: -1 })
    res.json({ success: true, data: leaves })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── GET /api/leaves/balance ─────────────────────────────────────────────────
// Returns leave balance stats for the logged-in faculty.
const getBalance = async (req, res) => {
  try {
    const facultyId = req.user._id.toString()
    const year      = Number(req.query.year) || new Date().getFullYear()

    const bal = await getOrCreateBalance(facultyId, year)

    // Re-compute taken from approved leaves (source of truth)
    const approved = await Leave.find({ facultyId, status: "Approved" })
    const taken    = approved.reduce((sum, l) => sum + l.duration, 0)

    // Sync the balance document
    bal.taken = taken
    await bal.save()

    res.json({
      success: true,
      data: {
        totalLeaves:     bal.totalLeaves,
        taken:           bal.taken,
        remaining:       bal.totalLeaves - bal.taken,
        holidaysAvailed: bal.holidays,
      },
    })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── GET /api/leaves/monthly ─────────────────────────────────────────────────
// Returns monthly leave day totals for the current year for the logged-in faculty.
const getMonthlyStats = async (req, res) => {
  try {
    const facultyId = req.user._id.toString()
    const year      = Number(req.query.year) || new Date().getFullYear()

    const from = new Date(year, 0, 1)
    const to   = new Date(year, 11, 31)

    const leaves = await Leave.find({
      facultyId,
      fromDate: { $gte: from, $lte: to },
    })

    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    const monthly    = new Array(12).fill(0)

    leaves.forEach(l => {
      const m = new Date(l.fromDate).getMonth()
      monthly[m] += l.duration
    })

    const data = monthNames.map((name, i) => ({ month: name, days: monthly[i] }))
    res.json({ success: true, data })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── POST /api/leaves ────────────────────────────────────────────────────────
// Apply for leave. facultyId and facultyName come from the authenticated user.
// Body: { type, fromDate, toDate, reason }
const applyLeave = async (req, res) => {
  try {
    const facultyId   = req.user._id.toString()
    const facultyName = req.user.name

    const { type, fromDate, toDate, reason } = req.body

    // Validation
    if (!type || !fromDate || !reason) {
      return res.status(400).json({ success: false, message: "type, fromDate, and reason are required" })
    }

    const from = new Date(fromDate)
    const to   = new Date(toDate || fromDate)

    if (to < from) {
      return res.status(400).json({ success: false, message: "toDate cannot be before fromDate" })
    }

    const duration = calcDays(from, to)

    // Check balance
    const year = from.getFullYear()
    const bal  = await getOrCreateBalance(facultyId, year)
    const approved = await Leave.find({ facultyId, status: "Approved" })
    const takenSoFar = approved.reduce((sum, l) => sum + l.duration, 0)

    if (takenSoFar + duration > bal.totalLeaves) {
      return res.status(400).json({
        success: false,
        message: `Insufficient leave balance. You have ${bal.totalLeaves - takenSoFar} day(s) remaining.`,
      })
    }

    const leave = await Leave.create({
      facultyId,
      facultyName,
      type,
      fromDate: from,
      toDate:   to,
      duration,
      reason,
      status: "Pending",
    })

    // Notify the faculty member (best-effort)
    try {
      await Notification.create({
        userId:  facultyId,
        type:    "system",
        title:   "Leave Application Submitted",
        message: `Your ${type} leave request for ${duration} day(s) (${from.toLocaleDateString()} – ${to.toLocaleDateString()}) has been submitted and is pending approval.`,
      })
    } catch {}

    res.status(201).json({ success: true, message: "Leave application submitted", data: leave })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── PATCH /api/leaves/:id/status ────────────────────────────────────────────
// Approve or reject a leave (admin action).
// Body: { status: "Approved" | "Rejected", adminNote? }
const updateLeaveStatus = async (req, res) => {
  try {
    const { id }                    = req.params
    const { status, adminNote = "" } = req.body

    if (!["Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ success: false, message: "status must be Approved or Rejected" })
    }

    const leave = await Leave.findById(id)
    if (!leave) {
      return res.status(404).json({ success: false, message: "Leave not found" })
    }

    leave.status    = status
    leave.adminNote = adminNote
    leave.updatedAt = new Date()
    await leave.save()

    res.json({ success: true, message: `Leave ${status.toLowerCase()} successfully`, data: leave })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── DELETE /api/leaves/:id ───────────────────────────────────────────────────
// Cancel / delete a Pending leave application.
const deleteLeave = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id)
    if (!leave) {
      return res.status(404).json({ success: false, message: "Leave not found" })
    }
    if (leave.status !== "Pending") {
      return res.status(400).json({ success: false, message: "Only Pending leaves can be cancelled" })
    }

    await leave.deleteOne()
    res.json({ success: true, message: "Leave cancelled successfully" })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── GET /api/leaves/holidays ────────────────────────────────────────────────
// Returns the public holiday calendar. (No auth needed — same for everyone)
const getHolidays = async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear()
    const from = new Date(year, 0, 1)
    const to   = new Date(year, 11, 31)

    const holidays = await Holiday.find({ date: { $gte: from, $lte: to } }).sort({ date: 1 })
    res.json({ success: true, data: holidays })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

module.exports = {
  getLeaves,
  getBalance,
  getMonthlyStats,
  applyLeave,
  updateLeaveStatus,
  deleteLeave,
  getHolidays,
}
