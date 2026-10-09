const { Leave, LeaveBalance, Holiday } = require("../models/Leave")
const Notification = require("../models/Notification")
const User = require("../models/User")

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Calculate the number of calendar days between two dates (inclusive).
 */
function calcDays(from, to) {
  const f = new Date(from)
  const t = new Date(to)
  return Math.round((t - f) / (1000 * 60 * 60 * 24)) + 1
}

// Calendar-year helpers. Dates are compared as UTC YYYY-MM-DD, the same rule the HOD "Balances" tab uses,
// so the faculty and HOD screens always show the same numbers.
const dayKey = (d) => new Date(d).toISOString().slice(0, 10)
const utcMs  = (k) => Date.parse(`${k}T00:00:00Z`)

/** Days of a leave that fall inside one calendar year (inclusive). A leave that spans New Year is split. */
function daysInYear(leave, year) {
  const a = `${year}-01-01`, b = `${year}-12-31`
  const f = dayKey(leave.fromDate) > a ? dayKey(leave.fromDate) : a
  const t = dayKey(leave.toDate)   < b ? dayKey(leave.toDate)   : b
  return t < f ? 0 : Math.round((utcMs(t) - utcMs(f)) / 864e5) + 1
}

/** Approved leave days a faculty member has used in ONE calendar year (not all-time). */
async function approvedDaysInYear(facultyId, year) {
  const leaves = await Leave.find({
    facultyId, status: "Approved",
    fromDate: { $lt: new Date(Date.UTC(year + 1, 0, 1)) },
    toDate:   { $gte: new Date(Date.UTC(year, 0, 1)) },
  })
  return leaves.reduce((sum, l) => sum + daysInYear(l, year), 0)
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

    // Re-compute taken from approved leaves in THIS calendar year (source of truth)
    const taken = await approvedDaysInYear(facultyId, year)

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

    // Approved leave only (rejected / pending days were never taken), each day counted in its own month
    const a = `${year}-01-01`, b = `${year}-12-31`
    const leaves = await Leave.find({
      facultyId, status: "Approved",
      fromDate: { $lt: new Date(Date.UTC(year + 1, 0, 1)) },
      toDate:   { $gte: new Date(Date.UTC(year, 0, 1)) },
    })

    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    const monthly    = new Array(12).fill(0)

    leaves.forEach(l => {
      const f = dayKey(l.fromDate) > a ? dayKey(l.fromDate) : a
      const t = dayKey(l.toDate)   < b ? dayKey(l.toDate)   : b
      for (let ms = utcMs(f); ms <= utcMs(t); ms += 864e5) monthly[new Date(ms).getUTCMonth()]++
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

    // Check balance year by year - each calendar year has its own allowance, and a leave can span New Year
    for (let year = from.getUTCFullYear(); year <= to.getUTCFullYear(); year++) {
      const wanted = daysInYear({ fromDate: from, toDate: to }, year)
      if (!wanted) continue
      const bal  = await getOrCreateBalance(facultyId, year)
      const used = await approvedDaysInYear(facultyId, year)
      if (used + wanted > bal.totalLeaves) {
        return res.status(400).json({
          success: false,
          message: `Insufficient leave balance${from.getUTCFullYear() !== to.getUTCFullYear() ? ` for ${year}` : ""}. You have ${Math.max(0, bal.totalLeaves - used)} day(s) remaining.`,
        })
      }
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

    // Route already guarantees role is hod/admin. Further rules (same as the HOD module):
    // nobody reviews their own leave, and a HOD only reviews teaching staff of their OWN department.
    if (leave.facultyId === req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "You cannot review your own leave" })
    }
    if (req.user.role === "hod") {
      const applicant = await User.findById(leave.facultyId).select("role department")
      const dept = (req.user.department || "").trim().toLowerCase()
      const sameDept = applicant && dept && (applicant.department || "").trim().toLowerCase() === dept
      if (!applicant || applicant.role !== "teaching" || !sameDept) {
        return res.status(403).json({ success: false, message: "You can only review leaves from your own department" })
      }
    }

    leave.status    = status
    leave.adminNote = adminNote
    leave.updatedAt = new Date()
    await leave.save()

    res.json({ success: true, message: `Leave ${status.toLowerCase()} successfully`, data: leave })
  } catch (err) {
    if (err.name === "CastError") return res.status(404).json({ success: false, message: "Leave not found" })   // malformed id
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