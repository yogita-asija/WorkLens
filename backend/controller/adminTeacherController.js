const bcrypt    = require("bcryptjs")
const User      = require("../models/User")
const Course    = require("../models/course")
const { Leave } = require("../models/Leave")
const Attendance= require("../models/Attendance")
const logAudit  = require("../utils/logAudit")

// helper to clean password from output
const cleanUser = (u) => {
  const obj = u.toObject ? u.toObject() : { ...u }
  delete obj.password
  return obj
}

// ─── GET /api/admin/teachers ─────────────────────────────────────────────────
exports.getTeachers = async (req, res) => {
  try {
    const { search, department, page = 1, limit = 20, status } = req.query

    const filter = { role: "teaching" }
    if (department) filter.department = department
    if (search) {
      const re = new RegExp(search, "i")
      filter.$or = [{ name: re }, { email: re }]
    }

    const skip  = (Number(page) - 1) * Number(limit)
    const total = await User.countDocuments(filter)
    const users = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean()

    // Enrich with course count
    const enriched = await Promise.all(users.map(async (u) => {
      const courseCount = await Course.countDocuments({ "teacher.id": u._id })
      return { ...u, courseCount }
    }))

    res.json({ success: true, data: enriched, total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── GET /api/admin/teachers/:id ─────────────────────────────────────────────
exports.getTeacherById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password").lean()
    if (!user || user.role !== "teaching") {
      return res.status(404).json({ success: false, message: "Teacher not found" })
    }

    const [courses, leaves] = await Promise.all([
      Course.find({ "teacher.id": user._id }).select("courseName courseId status students progress").lean(),
      Leave.find({ facultyId: String(user._id) }).sort({ appliedAt: -1 }).limit(10).lean(),
    ])

    res.json({ success: true, data: { ...user, courses, leaves } })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── POST /api/admin/teachers ────────────────────────────────────────────────
exports.createTeacher = async (req, res) => {
  try {
    const { name, email, password = "Welcome@123", department, phone, bio } = req.body

    if (!name || !email) {
      return res.status(400).json({ success: false, message: "name and email are required" })
    }

    const exists = await User.findOne({ email })
    if (exists) return res.status(409).json({ success: false, message: "Email already registered" })

    const hashed = await bcrypt.hash(password, 10)
    const teacher = await User.create({ name, email, password: hashed, role: "teaching", department: department || "", phone: phone || "", bio: bio || "" })

    await logAudit({
      adminId: req.admin._id, adminName: req.admin.name,
      action: "CREATE_TEACHER", module: "teacher",
      targetId: String(teacher._id), targetName: teacher.name,
      detail: `Created teacher account for ${teacher.email}`,
      ip: req.ip,
    })

    res.status(201).json({ success: true, message: "Teacher created successfully", data: cleanUser(teacher) })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── PUT /api/admin/teachers/:id ─────────────────────────────────────────────
exports.updateTeacher = async (req, res) => {
  try {
    const { name, email, department, phone, bio } = req.body
    const teacher = await User.findById(req.params.id)
    if (!teacher || teacher.role !== "teaching") {
      return res.status(404).json({ success: false, message: "Teacher not found" })
    }

    if (name)       teacher.name       = name
    if (email)      teacher.email      = email
    if (department !== undefined) teacher.department = department
    if (phone !== undefined)      teacher.phone      = phone
    if (bio !== undefined)        teacher.bio        = bio
    await teacher.save()

    // Sync teacher name in courses
    if (name) {
      await Course.updateMany({ "teacher.id": teacher._id }, { "teacher.name": name })
    }

    await logAudit({
      adminId: req.admin._id, adminName: req.admin.name,
      action: "UPDATE_TEACHER", module: "teacher",
      targetId: String(teacher._id), targetName: teacher.name,
      detail: `Updated teacher profile`,
      ip: req.ip,
    })

    res.json({ success: true, message: "Teacher updated", data: cleanUser(teacher) })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── DELETE /api/admin/teachers/:id ──────────────────────────────────────────
exports.deleteTeacher = async (req, res) => {
  try {
    const teacher = await User.findById(req.params.id)
    if (!teacher || teacher.role !== "teaching") {
      return res.status(404).json({ success: false, message: "Teacher not found" })
    }

    const name = teacher.name
    await teacher.deleteOne()

    await logAudit({
      adminId: req.admin._id, adminName: req.admin.name,
      action: "DELETE_TEACHER", module: "teacher",
      targetId: req.params.id, targetName: name,
      detail: `Deleted teacher account`,
      ip: req.ip,
    })

    res.json({ success: true, message: "Teacher deleted" })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── PATCH /api/admin/teachers/:id/reset-password ────────────────────────────
exports.resetPassword = async (req, res) => {
  try {
    const { newPassword = "Welcome@123" } = req.body
    const teacher = await User.findById(req.params.id)
    if (!teacher || teacher.role !== "teaching") {
      return res.status(404).json({ success: false, message: "Teacher not found" })
    }

    teacher.password = await bcrypt.hash(newPassword, 10)
    await teacher.save()

    await logAudit({
      adminId: req.admin._id, adminName: req.admin.name,
      action: "RESET_PASSWORD", module: "teacher",
      targetId: String(teacher._id), targetName: teacher.name,
      detail: `Password reset`,
      ip: req.ip,
    })

    res.json({ success: true, message: "Password reset successfully" })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── PATCH /api/admin/teachers/:id/assign-department ─────────────────────────
exports.assignDepartment = async (req, res) => {
  try {
    const { department } = req.body
    if (!department) return res.status(400).json({ success: false, message: "department is required" })

    const teacher = await User.findByIdAndUpdate(
      req.params.id,
      { department },
      { new: true }
    ).select("-password")

    if (!teacher || teacher.role !== "teaching") {
      return res.status(404).json({ success: false, message: "Teacher not found" })
    }

    await logAudit({
      adminId: req.admin._id, adminName: req.admin.name,
      action: "ASSIGN_DEPARTMENT", module: "teacher",
      targetId: String(teacher._id), targetName: teacher.name,
      detail: `Assigned to department: ${department}`,
      ip: req.ip,
    })

    res.json({ success: true, message: "Department assigned", data: teacher })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}
