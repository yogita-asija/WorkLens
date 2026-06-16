const Department = require("../models/Department")
const User       = require("../models/User")
const Course     = require("../models/course")
const logAudit   = require("../utils/logAudit")

// ─── GET /api/admin/departments ──────────────────────────────────────────────
exports.getDepartments = async (req, res) => {
  try {
    const { search } = req.query
    const filter = {}
    if (search) filter.name = new RegExp(search, "i")

    const depts = await Department.find(filter).sort({ name: 1 }).lean()

    // Enrich with live counts
    const enriched = await Promise.all(depts.map(async (d) => {
      const [teachers, courses] = await Promise.all([
        User.countDocuments({ role: "teaching", department: d.name }),
        Course.countDocuments({ status: "active" }),
      ])
      return { ...d, totalTeachers: teachers, totalCourses: courses }
    }))

    res.json({ success: true, data: enriched })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── GET /api/admin/departments/:id ──────────────────────────────────────────
exports.getDepartmentById = async (req, res) => {
  try {
    const dept = await Department.findById(req.params.id).lean()
    if (!dept) return res.status(404).json({ success: false, message: "Department not found" })

    const teachers = await User.find({ role: "teaching", department: dept.name })
      .select("-password").lean()

    res.json({ success: true, data: { ...dept, teachers } })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── POST /api/admin/departments ─────────────────────────────────────────────
exports.createDepartment = async (req, res) => {
  try {
    const { name, code, description } = req.body
    if (!name || !code) return res.status(400).json({ success: false, message: "name and code are required" })

    const dept = await Department.create({ name, code: code.toUpperCase(), description: description || "" })

    await logAudit({
      adminId: req.admin._id, adminName: req.admin.name,
      action: "CREATE_DEPARTMENT", module: "department",
      targetId: String(dept._id), targetName: dept.name,
      detail: `Created department ${code.toUpperCase()}`,
      ip: req.ip,
    })

    res.status(201).json({ success: true, message: "Department created", data: dept })
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, message: "Department name or code already exists" })
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── PUT /api/admin/departments/:id ──────────────────────────────────────────
exports.updateDepartment = async (req, res) => {
  try {
    const { name, code, description, status } = req.body
    const dept = await Department.findById(req.params.id)
    if (!dept) return res.status(404).json({ success: false, message: "Department not found" })

    if (name)        dept.name        = name
    if (code)        dept.code        = code.toUpperCase()
    if (description !== undefined) dept.description = description
    if (status)      dept.status      = status
    await dept.save()

    await logAudit({
      adminId: req.admin._id, adminName: req.admin.name,
      action: "UPDATE_DEPARTMENT", module: "department",
      targetId: String(dept._id), targetName: dept.name,
      detail: `Updated department`,
      ip: req.ip,
    })

    res.json({ success: true, message: "Department updated", data: dept })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── DELETE /api/admin/departments/:id ───────────────────────────────────────
exports.deleteDepartment = async (req, res) => {
  try {
    const dept = await Department.findById(req.params.id)
    if (!dept) return res.status(404).json({ success: false, message: "Department not found" })

    const teacherCount = await User.countDocuments({ department: dept.name })
    if (teacherCount > 0) {
      return res.status(400).json({ success: false, message: `Cannot delete: ${teacherCount} teacher(s) are still assigned to this department` })
    }

    await dept.deleteOne()

    await logAudit({
      adminId: req.admin._id, adminName: req.admin.name,
      action: "DELETE_DEPARTMENT", module: "department",
      targetId: req.params.id, targetName: dept.name,
      detail: `Deleted department`,
      ip: req.ip,
    })

    res.json({ success: true, message: "Department deleted" })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── PATCH /api/admin/departments/:id/hod ────────────────────────────────────
exports.assignHOD = async (req, res) => {
  try {
    const { userId } = req.body
    if (!userId) return res.status(400).json({ success: false, message: "userId is required" })

    const teacher = await User.findById(userId).select("-password")
    if (!teacher || teacher.role !== "teaching") {
      return res.status(404).json({ success: false, message: "Teacher not found" })
    }

    const dept = await Department.findByIdAndUpdate(
      req.params.id,
      { hod: { userId: teacher._id, name: teacher.name } },
      { new: true }
    )
    if (!dept) return res.status(404).json({ success: false, message: "Department not found" })

    await logAudit({
      adminId: req.admin._id, adminName: req.admin.name,
      action: "ASSIGN_HOD", module: "department",
      targetId: String(dept._id), targetName: dept.name,
      detail: `Assigned ${teacher.name} as HOD`,
      ip: req.ip,
    })

    res.json({ success: true, message: "HOD assigned", data: dept })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}
