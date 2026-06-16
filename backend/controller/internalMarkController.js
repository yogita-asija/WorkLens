const InternalMark = require("../models/InternalMark")
const Course       = require("../models/course")

// GET /api/internal-marks/students
// Pulls unique students from Course.students[] — same source as attendance roster.
// If teacherId is given, tries to scope to that teacher's courses first;
// falls back to all active courses so seeded / unassigned data always works.
exports.getTeacherStudents = async (req, res) => {
  try {
    const { teacherId } = req.query

    let courses = []
    if (teacherId) {
      courses = await Course.find({ "teacher.id": teacherId, status: "active" }).lean()
    }
    // Fall back to all active courses (mirrors attendance behaviour)
    if (!courses.length) {
      courses = await Course.find({ status: "active" }).lean()
    }

    // Deduplicate students across courses, same way attendance roster does
    const studentMap = {}
    for (const course of courses) {
      for (const s of course.students || []) {
        const key = s.id || String(s._id)
        if (!studentMap[key]) {
          studentMap[key] = { id: key, name: s.name, courses: [] }
        }
        studentMap[key].courses.push({
          courseId:   course.courseId || course.courseCode,
          courseName: course.courseName,
        })
      }
    }

    res.json(Object.values(studentMap).sort((a, b) => a.name.localeCompare(b.name)))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// GET /api/internal-marks/:studentId
exports.getStudentMarks = async (req, res) => {
  try {
    const { teacherId } = req.query
    const filter = { studentId: req.params.studentId }
    if (teacherId) filter.teacherId = teacherId
    const marks = await InternalMark.find(filter).lean().sort({ createdAt: -1 })
    res.json(marks)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// POST /api/internal-marks
exports.addMark = async (req, res) => {
  try {
    const { studentId, studentName, courseId, courseName, teacherId, category, marks, maxMarks, remarks } = req.body
    if (!studentId || !category || marks === undefined)
      return res.status(400).json({ message: "studentId, category, and marks are required" })
    const doc = await InternalMark.create({
      studentId, studentName, courseId, courseName, teacherId, category,
      marks, maxMarks: maxMarks || 100, remarks: remarks || "",
    })
    res.status(201).json(doc)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// PUT /api/internal-marks/:id
exports.updateMark = async (req, res) => {
  try {
    const doc = await InternalMark.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    if (!doc) return res.status(404).json({ message: "Mark not found" })
    res.json(doc)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// DELETE /api/internal-marks/:id
exports.deleteMark = async (req, res) => {
  try {
    const doc = await InternalMark.findByIdAndDelete(req.params.id)
    if (!doc) return res.status(404).json({ message: "Mark not found" })
    res.json({ message: "Deleted" })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
