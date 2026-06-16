const Scholarship = require("../models/Scholarship")
const User        = require("../models/User")
const Notification= require("../models/Notification")
const logAudit    = require("../utils/logAudit")

// GET /api/admin/scholarships
exports.getScholarships = async (req, res) => {
  try {
    const { status, type, search, page = 1, limit = 20 } = req.query
    const filter = {}
    if (status) filter.status = status
    if (type)   filter.type   = type
    if (search) {
      const re = new RegExp(search, "i")
      filter.$or = [{ studentName: re }, { facultyName: re }, { courseName: re }]
    }
    const skip  = (Number(page) - 1) * Number(limit)
    const total = await Scholarship.countDocuments(filter)
    const data  = await Scholarship.find(filter).sort({ appliedAt: -1 }).skip(skip).limit(Number(limit)).lean()
    res.json({ success: true, data, total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
  } catch (err) { res.status(500).json({ success: false, message: err.message }) }
}

// GET /api/admin/scholarships/summary
exports.getScholarshipSummary = async (req, res) => {
  try {
    const all = await Scholarship.find().lean()
    const byStatus = { Pending: 0, Approved: 0, Rejected: 0, Disbursed: 0 }
    const byType   = {}
    let totalAmountApproved = 0, totalAmountDisbursed = 0, totalAmountRequested = 0
    all.forEach(s => {
      byStatus[s.status] = (byStatus[s.status] || 0) + 1
      byType[s.type]     = (byType[s.type] || 0) + 1
      totalAmountRequested += s.amount || 0
      if (s.status === "Approved")  totalAmountApproved  += s.amount || 0
      if (s.status === "Disbursed") totalAmountDisbursed += s.amount || 0
    })
    res.json({ success: true, data: { total: all.length, ...byStatus, byType: Object.entries(byType).map(([type,count])=>({type,count})), totalAmountRequested, totalAmountApproved, totalAmountDisbursed } })
  } catch (err) { res.status(500).json({ success: false, message: err.message }) }
}

// POST /api/admin/scholarships
exports.createScholarship = async (req, res) => {
  try {
    const sch = await Scholarship.create({ ...req.body, status: "Approved" })
    res.status(201).json({ success: true, data: sch })
  } catch (err) { res.status(500).json({ success: false, message: err.message }) }
}

// PATCH /api/admin/scholarships/:id/status
exports.updateScholarshipStatus = async (req, res) => {
  try {
    const { status, adminNote = "" } = req.body
    if (!["Approved","Rejected","Disbursed"].includes(status))
      return res.status(400).json({ success: false, message: "Invalid status" })
    const sch = await Scholarship.findById(req.params.id)
    if (!sch) return res.status(404).json({ success: false, message: "Not found" })
    if (status === "Disbursed" && sch.status !== "Approved")
      return res.status(400).json({ success: false, message: "Must be Approved first" })
    sch.status = status; sch.adminNote = adminNote; sch.updatedAt = new Date()
    await sch.save()
    try {
      const faculty = await User.findById(sch.facultyId)
      if (faculty) await Notification.create({ userId: faculty._id, type: "system", title: `Scholarship ${status}`, message: `Your nomination for ${sch.studentName} has been ${status.toLowerCase()}.` })
    } catch {}
    await logAudit({ adminId: req.admin._id, adminName: req.admin.name, action: `SCHOLARSHIP_${status.toUpperCase()}`, module: "scholarship", targetId: String(sch._id), targetName: sch.studentName, detail: `${status} for ${sch.studentName}`, ip: req.ip })
    res.json({ success: true, data: sch })
  } catch (err) { res.status(500).json({ success: false, message: err.message }) }
}

// DELETE /api/admin/scholarships/:id
exports.deleteScholarship = async (req, res) => {
  try {
    await Scholarship.findByIdAndDelete(req.params.id)
    res.json({ success: true, message: "Deleted" })
  } catch (err) { res.status(500).json({ success: false, message: err.message }) }
}
