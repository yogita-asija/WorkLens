const Course   = require("../models/course")
const User     = require("../models/User")
const logAudit = require("../utils/logAudit")

// ─── GET /api/admin/courses ───────────────────────────────────────────────────
exports.getCourses = async (req, res) => {
  try {
    const { search, status, department, teacherId, page = 1, limit = 20 } = req.query

    const filter = {}
    if (status) filter.status = status
    if (teacherId) filter["teacher.id"] = teacherId
    if (search) {
      const re = new RegExp(search, "i")
      filter.$or = [{ courseName: re }, { courseId: re }, { courseCode: re }]
    }

    const skip  = (Number(page) - 1) * Number(limit)
    const total = await Course.countDocuments(filter)
    const courses = await Course.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean()

    res.json({ success: true, data: courses, total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── POST /api/admin/courses ──────────────────────────────────────────────────
exports.createCourse = async (req, res) => {
  try {
    const { courseId, courseCode, courseName, description, sem, credits, teacherId, schedule, capacity } = req.body

    if (!courseId || !courseName) {
      return res.status(400).json({ success: false, message: "courseId and courseName are required" })
    }

    let teacher = { id: null, name: "" }
    if (teacherId) {
      const t = await User.findById(teacherId).select("name")
      if (t) teacher = { id: t._id, name: t.name }
    }

    const course = await Course.create({
      courseId, courseCode, courseName, description: description || "",
      sem: sem || "N/A", credits: credits || 3,
      teacher, schedule: schedule || {}, capacity: capacity || 60,
      status: "active",
    })

    await logAudit({
      adminId: req.admin._id, adminName: req.admin.name,
      action: "CREATE_COURSE", module: "course",
      targetId: String(course._id), targetName: course.courseName,
      detail: `Created course ${courseId}`,
      ip: req.ip,
    })

    res.status(201).json({ success: true, message: "Course created", data: course })
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, message: "Course ID already exists" })
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── PUT /api/admin/courses/:id ───────────────────────────────────────────────
exports.updateCourse = async (req, res) => {
  try {
    const { courseName, courseCode, description, sem, credits, teacherId, schedule, capacity, status } = req.body

    const course = await Course.findById(req.params.id)
    if (!course) return res.status(404).json({ success: false, message: "Course not found" })

    if (courseName)  course.courseName  = courseName
    if (courseCode)  course.courseCode  = courseCode
    if (description !== undefined) course.description = description
    if (sem)         course.sem         = sem
    if (credits)     course.credits     = credits
    if (schedule)    course.schedule    = { ...course.schedule, ...schedule }
    if (capacity)    course.capacity    = capacity
    if (status)      course.status      = status

    if (teacherId) {
      const t = await User.findById(teacherId).select("name")
      if (t) course.teacher = { id: t._id, name: t.name }
    }

    await course.save()

    await logAudit({
      adminId: req.admin._id, adminName: req.admin.name,
      action: "UPDATE_COURSE", module: "course",
      targetId: String(course._id), targetName: course.courseName,
      detail: `Updated course`,
      ip: req.ip,
    })

    res.json({ success: true, message: "Course updated", data: course })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── DELETE /api/admin/courses/:id ───────────────────────────────────────────
exports.deleteCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
    if (!course) return res.status(404).json({ success: false, message: "Course not found" })

    const name = course.courseName
    await course.deleteOne()

    await logAudit({
      adminId: req.admin._id, adminName: req.admin.name,
      action: "DELETE_COURSE", module: "course",
      targetId: req.params.id, targetName: name,
      detail: `Deleted course`,
      ip: req.ip,
    })

    res.json({ success: true, message: "Course deleted" })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── PATCH /api/admin/courses/:id/assign-teacher ─────────────────────────────
exports.assignTeacher = async (req, res) => {
  try {
    const { teacherId } = req.body
    if (!teacherId) return res.status(400).json({ success: false, message: "teacherId is required" })

    const teacher = await User.findById(teacherId).select("name role")
    if (!teacher || teacher.role !== "teaching") {
      return res.status(404).json({ success: false, message: "Teacher not found" })
    }

    const course = await Course.findByIdAndUpdate(
      req.params.id,
      { teacher: { id: teacher._id, name: teacher.name } },
      { new: true }
    )
    if (!course) return res.status(404).json({ success: false, message: "Course not found" })

    await logAudit({
      adminId: req.admin._id, adminName: req.admin.name,
      action: "ASSIGN_TEACHER", module: "course",
      targetId: String(course._id), targetName: course.courseName,
      detail: `Assigned ${teacher.name} as course teacher`,
      ip: req.ip,
    })

    res.json({ success: true, message: "Teacher assigned", data: course })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── GET /api/admin/courses/stats ────────────────────────────────────────────
exports.getCourseStats = async (req, res) => {
  try {
    const [total, active, inactive, archived] = await Promise.all([
      Course.countDocuments(),
      Course.countDocuments({ status: "active" }),
      Course.countDocuments({ status: "inactive" }),
      Course.countDocuments({ status: "archived" }),
    ])

    const topCourses = await Course.find({ status: "active" })
      .sort({ "students.length": -1 })
      .limit(5)
      .select("courseName courseId students progress")
      .lean()

    res.json({ success: true, data: { total, active, inactive, archived, topCourses } })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}
