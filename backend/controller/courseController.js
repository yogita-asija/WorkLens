const Course     = require("../models/course")
const Assignment = require("../models/Assignment")
const Notification = require("../models/Notification")

// GET /api/courses
exports.getCourses = async (req, res) => {
  try {
    const { status, search } = req.query
    const filter = {}
    if (status && status !== "all") filter.status = status
    if (search) filter.$or = [
      { courseName: { $regex: search, $options: "i" } },
      { courseId:   { $regex: search, $options: "i" } },
      { courseCode: { $regex: search, $options: "i" } },
    ]

    const courses = await Course.find(filter).lean()
    const assignments = await Assignment.find({}, "courseId submissions total completed").lean()

    const result = courses.map(c => {
      const cas = assignments.filter(a => a.courseId?.toString() === c._id?.toString())
      const submCount = cas.reduce((s, a) => s + (a.submissions?.length || 0), 0)
      const totalCount = cas.reduce((s, a) => s + (a.total || 0), 0)
      const progress = totalCount > 0
        ? Math.round((submCount / totalCount) * 100)
        : (c.progress || 0)
      return {
        _id:         c._id,
        courseId:    c.courseId || c.courseCode,
        courseCode:  c.courseCode || c.courseId,
        courseName:  c.courseName || c.label,
        description: c.description || "",
        label:       c.label || `${c.courseCode} — ${c.courseName}`,
        sem:         c.sem || "N/A",
        credits:     c.credits || 3,
        status:      c.status || "active",
        teacher:     c.teacher || {},
        students:    c.students?.length || 0,
        capacity:    c.capacity || 60,
        schedule:    c.schedule || { days: "Not set", time: "", room: "" },
        progress,
        assignmentCount: cas.length,
      }
    })
    res.json(result)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// GET /api/courses/:id
exports.getCourseById = async (req, res) => {
  try {
    const course = await Course.findOne({
      $or: [
        ...(req.params.id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: req.params.id }] : []),
        { courseId: req.params.id },
        { courseCode: req.params.id },
      ]
    }).lean()
    if (!course) return res.status(404).json({ message: "Course not found" })
    res.json(course)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// GET /api/courses/:courseId/students
exports.getCourseStudents = async (req, res) => {
  try {
    const course = await Course.findOne({
      $or: [{ courseId: req.params.courseId }, { courseCode: req.params.courseId }]
    })
    if (!course) return res.status(404).json({ message: "Course not found" })
    const students = (course.students || []).map(s => ({
      id: s.id, name: s.name, status: "present", notes: "", enrolledAt: s.enrolledAt,
    }))
    res.json({ courseId: course.courseId || course.courseCode, label: course.label || course.courseName, students })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// POST /api/courses
exports.createCourse = async (req, res) => {
  try {
    const { courseId, courseCode, courseName, description, sem, credits, teacher, schedule, capacity, students, status } = req.body
    if (!courseId && !courseCode) return res.status(400).json({ message: "courseId is required" })
    if (!courseName) return res.status(400).json({ message: "courseName is required" })

    const id = courseId || courseCode
    const existing = await Course.findOne({ courseId: id })
    if (existing) return res.status(400).json({ message: "Course ID already exists" })

    const course = await Course.create({
      courseId: id, courseCode: courseCode || id, courseName,
      description: description || "",
      label: `${id} — ${courseName}`,
      sem: sem || "N/A", credits: credits || 3,
      status: status || "active",
      teacher: teacher || {},
      schedule: schedule || { days: "", time: "", room: "" },
      capacity: capacity || 60,
      students: students || [],
    })
    res.status(201).json(course)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// PUT /api/courses/:id
exports.updateCourse = async (req, res) => {
  try {
    const course = await Course.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    if (!course) return res.status(404).json({ message: "Course not found" })
    res.json(course)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// DELETE /api/courses/:id
exports.deleteCourse = async (req, res) => {
  try {
    const course = await Course.findByIdAndDelete(req.params.id)
    if (!course) return res.status(404).json({ message: "Course not found" })
    res.json({ message: "Course deleted" })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// POST /api/courses/:id/enroll
exports.enrollStudents = async (req, res) => {
  try {
    const { students } = req.body // [{ id, name }]
    if (!Array.isArray(students)) return res.status(400).json({ message: "students must be an array" })

    const course = await Course.findById(req.params.id)
    if (!course) return res.status(404).json({ message: "Course not found" })

    let added = 0
    for (const s of students) {
      if (!course.students.find(x => x.id === s.id)) {
        course.students.push({ id: s.id, name: s.name, enrolledAt: new Date() })
        added++
      }
    }
    await course.save()
    res.json({ message: `${added} student(s) enrolled`, total: course.students.length })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// DELETE /api/courses/:id/enroll/:studentId
exports.unenrollStudent = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
    if (!course) return res.status(404).json({ message: "Course not found" })
    course.students = course.students.filter(s => s.id !== req.params.studentId)
    await course.save()
    res.json({ message: "Student unenrolled", total: course.students.length })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// GET /api/courses/:id/analytics
exports.getCourseAnalytics = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id).lean()
    if (!course) return res.status(404).json({ message: "Course not found" })

    const assignments = await Assignment.find({ courseId: req.params.id }).lean()
    const totalAssignments = assignments.length
    const graded = assignments.reduce((s, a) => s + a.submissions.filter(sub => sub.grade !== null).length, 0)
    const submitted = assignments.reduce((s, a) => s + a.submissions.length, 0)
    const avgGrade = graded > 0
      ? Math.round(assignments.reduce((s, a) => {
          const grades = a.submissions.filter(sub => sub.grade !== null).map(sub => sub.grade)
          return s + grades.reduce((g, v) => g + v, 0)
        }, 0) / graded)
      : null

    const byType = {}
    for (const a of assignments) {
      byType[a.type] = (byType[a.type] || 0) + 1
    }

    res.json({
      courseId: course._id,
      courseName: course.courseName,
      totalStudents: course.students?.length || 0,
      capacity: course.capacity || 60,
      totalAssignments,
      submitted,
      graded,
      avgGrade,
      submissionRate: course.students?.length
        ? Math.round((submitted / (totalAssignments * (course.students.length || 1))) * 100)
        : 0,
      assignmentsByType: byType,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
