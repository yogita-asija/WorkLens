const Scholarship = require("../models/Scholarship")

// ─── GET /api/scholarships?facultyId= ─────────────────────────────────────────
// Faculty's own nominations (most recent first)
exports.getMyScholarships = async (req, res) => {
  try {
    const { facultyId } = req.query
    const filter = facultyId ? { facultyId } : {}

    const scholarships = await Scholarship.find(filter)
      .sort({ appliedAt: -1 })
      .lean()

    res.json({ success: true, data: scholarships })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── GET /api/scholarships/summary?facultyId= ─────────────────────────────────
exports.getSummary = async (req, res) => {
  try {
    const { facultyId } = req.query
    const filter = facultyId ? { facultyId } : {}

    const [pending, approved, rejected, disbursed, all] = await Promise.all([
      Scholarship.countDocuments({ ...filter, status: "Pending" }),
      Scholarship.countDocuments({ ...filter, status: "Approved" }),
      Scholarship.countDocuments({ ...filter, status: "Rejected" }),
      Scholarship.countDocuments({ ...filter, status: "Disbursed" }),
      Scholarship.find(filter).lean(),
    ])

    const totalAmountApproved = all
      .filter(s => s.status === "Approved" || s.status === "Disbursed")
      .reduce((sum, s) => sum + (s.amount || 0), 0)

    res.json({
      success: true,
      data: {
        total: all.length,
        pending, approved, rejected, disbursed,
        totalAmountApproved,
      }
    })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── POST /api/scholarships ────────────────────────────────────────────────────
// Body: { studentId, studentName, courseId?, courseName?, facultyId, facultyName,
//         type, amount, academicYear?, reason }
exports.applyScholarship = async (req, res) => {
  try {
    const {
      studentId, studentName,
      courseId = "", courseName = "",
      facultyId, facultyName,
      type, amount, academicYear, reason,
    } = req.body

    if (!studentId || !studentName || !facultyId || !facultyName || !amount || !reason) {
      return res.status(400).json({
        success: false,
        message: "studentId, studentName, facultyId, facultyName, amount, and reason are required",
      })
    }

    const scholarship = await Scholarship.create({
      studentId, studentName,
      courseId, courseName,
      facultyId, facultyName,
      type: type || "Merit",
      amount,
      academicYear,
      reason,
      status: "Pending",
    })

    res.status(201).json({ success: true, message: "Scholarship nomination submitted", data: scholarship })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── DELETE /api/scholarships/:id ─────────────────────────────────────────────
// Faculty can withdraw a nomination while it's still Pending
exports.withdrawScholarship = async (req, res) => {
  try {
    const sch = await Scholarship.findById(req.params.id)
    if (!sch) return res.status(404).json({ success: false, message: "Nomination not found" })
    if (sch.status !== "Pending") {
      return res.status(400).json({ success: false, message: "Only pending nominations can be withdrawn" })
    }
    await sch.deleteOne()
    res.json({ success: true, message: "Nomination withdrawn" })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}
