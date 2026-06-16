const bcrypt       = require("bcryptjs")
const User         = require("../models/User")
const InternalMark = require("../models/InternalMark")
const Attendance   = require("../models/Attendance")
const logAudit     = require("../utils/logAudit")

const cleanUser = (u) => {
  const obj = u.toObject ? u.toObject() : { ...u }
  delete obj.password
  return obj
}

// ─── GET /api/admin/students ──────────────────────────────────────────────────
// Query params: search, program, semester, batch, section, studentStatus, page, limit
exports.getStudents = async (req, res) => {
  try {
    const {
      search, program, semester, batch, section,
      studentStatus, page = 1, limit = 15,
    } = req.query

    const filter = { role: "student" }
    if (program)       filter.program       = program
    if (semester)      filter.semester      = Number(semester)
    if (batch)         filter.batch         = batch
    if (section)       filter.section       = section
    if (studentStatus) filter.studentStatus = studentStatus

    if (search) {
      const re = new RegExp(search, "i")
      filter.$or = [{ name: re }, { email: re }, { rollNumber: re }]
    }

    const skip  = (Number(page) - 1) * Number(limit)
    const total = await User.countDocuments(filter)
    const students = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean()

    res.json({
      success: true,
      data:    students,
      total,
      page:    Number(page),
      pages:   Math.ceil(total / Number(limit)),
    })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── GET /api/admin/students/:id ─────────────────────────────────────────────
// Returns full profile + marks summary + attendance summary
exports.getStudentById = async (req, res) => {
  try {
    const student = await User.findById(req.params.id).select("-password").lean()
    if (!student || student.role !== "student") {
      return res.status(404).json({ success: false, message: "Student not found" })
    }

    // Fetch marks grouped by course
    const marks = await InternalMark.find({ studentId: String(student._id) })
      .sort({ createdAt: -1 })
      .lean()

    // Fetch attendance records where this student appears
    const attendanceRecords = await Attendance.find({
      "students.id": String(student._id),
    }).lean()

    // Summarise attendance per course
    const attendanceMap = {}
    for (const record of attendanceRecords) {
      const entry = record.students.find(s => s.id === String(student._id))
      if (!entry) continue
      if (!attendanceMap[record.courseId]) {
        attendanceMap[record.courseId] = {
          courseId:   record.courseId,
          courseName: record.courseName,
          total:      0,
          present:    0,
        }
      }
      attendanceMap[record.courseId].total++
      if (entry.status === "present" || entry.status === "late") {
        attendanceMap[record.courseId].present++
      }
    }

    const attendance = Object.values(attendanceMap).map(a => ({
      ...a,
      percentage: a.total > 0 ? Math.round((a.present / a.total) * 100) : 0,
    }))

    res.json({ success: true, data: { ...student, marks, attendance } })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── POST /api/admin/students ─────────────────────────────────────────────────
exports.createStudent = async (req, res) => {
  try {
    const {
      name, email, password = "Welcome@123",
      rollNumber, program, semester, batch, section,
      department, phone, dateOfBirth, enrollmentDate,
      guardianName, guardianPhone, address,
    } = req.body

    if (!name || !email || !rollNumber) {
      return res.status(400).json({
        success: false,
        message: "name, email and rollNumber are required",
      })
    }

    const exists = await User.findOne({ $or: [{ email }, { rollNumber }] })
    if (exists) {
      const conflict = exists.email === email ? "Email" : "Roll number"
      return res.status(409).json({ success: false, message: `${conflict} already registered` })
    }

    const hashed  = await bcrypt.hash(password, 10)
    const student = await User.create({
      name, email, password: hashed,
      role: "student",
      rollNumber, program, semester, batch, section,
      department:     department     || "",
      phone:          phone          || "",
      dateOfBirth:    dateOfBirth    || undefined,
      enrollmentDate: enrollmentDate || undefined,
      guardianName:   guardianName   || undefined,
      guardianPhone:  guardianPhone  || undefined,
      address:        address        || undefined,
      studentStatus:  "active",
    })

    await logAudit({
      adminId:    req.admin._id,
      adminName:  req.admin.name,
      action:     "CREATE_STUDENT",
      module:     "student",
      targetId:   String(student._id),
      targetName: student.name,
      detail:     `Created student account for ${student.email} (${rollNumber})`,
      ip:         req.ip,
    })

    res.status(201).json({
      success: true,
      message: "Student created successfully",
      data:    cleanUser(student),
    })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── PUT /api/admin/students/:id ─────────────────────────────────────────────
exports.updateStudent = async (req, res) => {
  try {
    const {
      name, email, rollNumber, program, semester, batch, section,
      department, phone, bio, dateOfBirth, enrollmentDate,
      guardianName, guardianPhone, address,
    } = req.body

    const student = await User.findById(req.params.id)
    if (!student || student.role !== "student") {
      return res.status(404).json({ success: false, message: "Student not found" })
    }

    // Check rollNumber uniqueness if being changed
    if (rollNumber && rollNumber !== student.rollNumber) {
      const dup = await User.findOne({ rollNumber })
      if (dup) return res.status(409).json({ success: false, message: "Roll number already in use" })
    }

    if (name        !== undefined) student.name          = name
    if (email       !== undefined) student.email         = email
    if (rollNumber  !== undefined) student.rollNumber    = rollNumber
    if (program     !== undefined) student.program       = program
    if (semester    !== undefined) student.semester      = semester
    if (batch       !== undefined) student.batch         = batch
    if (section     !== undefined) student.section       = section
    if (department  !== undefined) student.department    = department
    if (phone       !== undefined) student.phone         = phone
    if (bio         !== undefined) student.bio           = bio
    if (dateOfBirth    !== undefined) student.dateOfBirth    = dateOfBirth
    if (enrollmentDate !== undefined) student.enrollmentDate = enrollmentDate
    if (guardianName   !== undefined) student.guardianName   = guardianName
    if (guardianPhone  !== undefined) student.guardianPhone  = guardianPhone
    if (address        !== undefined) student.address        = address

    await student.save()

    await logAudit({
      adminId:    req.admin._id,
      adminName:  req.admin.name,
      action:     "UPDATE_STUDENT",
      module:     "student",
      targetId:   String(student._id),
      targetName: student.name,
      detail:     `Updated student profile`,
      ip:         req.ip,
    })

    res.json({ success: true, message: "Student updated", data: cleanUser(student) })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── DELETE /api/admin/students/:id ──────────────────────────────────────────
exports.deleteStudent = async (req, res) => {
  try {
    const student = await User.findById(req.params.id)
    if (!student || student.role !== "student") {
      return res.status(404).json({ success: false, message: "Student not found" })
    }

    const { name } = student
    await student.deleteOne()

    await logAudit({
      adminId:    req.admin._id,
      adminName:  req.admin.name,
      action:     "DELETE_STUDENT",
      module:     "student",
      targetId:   req.params.id,
      targetName: name,
      detail:     `Deleted student account`,
      ip:         req.ip,
    })

    res.json({ success: true, message: "Student deleted" })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── PATCH /api/admin/students/:id/reset-password ────────────────────────────
exports.resetPassword = async (req, res) => {
  try {
    const { newPassword = "Welcome@123" } = req.body
    const student = await User.findById(req.params.id)
    if (!student || student.role !== "student") {
      return res.status(404).json({ success: false, message: "Student not found" })
    }

    student.password = await bcrypt.hash(newPassword, 10)
    await student.save()

    await logAudit({
      adminId:    req.admin._id,
      adminName:  req.admin.name,
      action:     "RESET_PASSWORD",
      module:     "student",
      targetId:   String(student._id),
      targetName: student.name,
      detail:     `Password reset`,
      ip:         req.ip,
    })

    res.json({ success: true, message: "Password reset successfully" })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── PATCH /api/admin/students/:id/assign-semester ───────────────────────────
exports.assignSemester = async (req, res) => {
  try {
    const { semester } = req.body
    if (!semester) return res.status(400).json({ success: false, message: "semester is required" })

    const student = await User.findByIdAndUpdate(
      req.params.id,
      { semester: Number(semester) },
      { new: true }
    ).select("-password")

    if (!student || student.role !== "student") {
      return res.status(404).json({ success: false, message: "Student not found" })
    }

    await logAudit({
      adminId:    req.admin._id,
      adminName:  req.admin.name,
      action:     "ASSIGN_SEMESTER",
      module:     "student",
      targetId:   String(student._id),
      targetName: student.name,
      detail:     `Assigned to semester ${semester}`,
      ip:         req.ip,
    })

    res.json({ success: true, message: "Semester assigned", data: student })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── PATCH /api/admin/students/:id/change-status ─────────────────────────────
exports.changeStatus = async (req, res) => {
  try {
    const { studentStatus } = req.body
    const allowed = ["active", "inactive", "graduated", "dropped"]
    if (!studentStatus || !allowed.includes(studentStatus)) {
      return res.status(400).json({
        success: false,
        message: `studentStatus must be one of: ${allowed.join(", ")}`,
      })
    }

    const student = await User.findByIdAndUpdate(
      req.params.id,
      { studentStatus },
      { new: true }
    ).select("-password")

    if (!student || student.role !== "student") {
      return res.status(404).json({ success: false, message: "Student not found" })
    }

    await logAudit({
      adminId:    req.admin._id,
      adminName:  req.admin.name,
      action:     "CHANGE_STUDENT_STATUS",
      module:     "student",
      targetId:   String(student._id),
      targetName: student.name,
      detail:     `Status changed to ${studentStatus}`,
      ip:         req.ip,
    })

    res.json({ success: true, message: `Student marked as ${studentStatus}`, data: student })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}