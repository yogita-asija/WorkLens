const InternalMark = require("../models/InternalMark")
const Course       = require("../models/course")
const Attendance   = require("../models/Attendance")
const Assignment   = require("../models/Assignment")

// GET /api/internal-marks/students
exports.getTeacherStudents = async (req, res) => {
  try {
    const { teacherId } = req.query

    let courses = []
    if (teacherId) {
      courses = await Course.find({ "teacher.id": teacherId, status: "active" }).lean()
    }
    if (!courses.length) {
      courses = await Course.find({ status: "active" }).lean()
    }

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

// GET /api/internal-marks/course-table/:courseId
// Returns a table-ready payload with:
//   - Each individual assignment as its own column (not grouped by type)
//   - Ungraded submissions shown as "-"
//   - totalMax = sum of maxGrade across ALL assignments (regardless of grading status)
exports.getCourseMarksTable = async (req, res) => {
  try {
    const { courseId } = req.params
    const { teacherId } = req.query

    // 1. Get enrolled students from the Course document
    const course = await Course.findOne({ courseId }).lean()
    if (!course) return res.status(404).json({ message: "Course not found" })

    const enrolledStudents = (course.students || []).map(s => ({
      id:   s.id || String(s._id),
      name: s.name,
    }))

    // 2. Fetch all internal marks for this course
    const markFilter = { courseId }
    if (teacherId) markFilter.teacherId = teacherId
    const allMarks = await InternalMark.find(markFilter).lean()

    // 3. Fetch all assignments for this course
    const assignments = await Assignment.find({ courseId: course._id }).lean()

    // 4. Build individual assignment columns (one per assignment, not grouped by type)
    //    Each assignment column: { _id, title, type, maxGrade }
    //    For each student: grade or null (null → "-")
    const assignmentCols = assignments.map(a => ({
      assignmentId: String(a._id),
      title:        a.title,
      type:         a.type || "ASSIGNMENT",
      maxGrade:     a.maxGrade || 100,
    }))

    // Build a quick lookup: assignmentId → submissions map by studentId
    const submissionsByAssignment = {}
    for (const asgn of assignments) {
      const aid = String(asgn._id)
      submissionsByAssignment[aid] = {}
      for (const sub of (asgn.submissions || [])) {
        submissionsByAssignment[aid][sub.studentId] = {
          grade:    sub.grade,   // null if not graded
          status:   sub.status,
          graded:   sub.grade !== null && sub.grade !== undefined,
        }
      }
    }

    // 5. Fetch attendance per student
    const attendanceRecords = await Attendance.find({ courseId }).lean()
    const attendanceByStudent = {}
    for (const record of attendanceRecords) {
      for (const s of (record.students || [])) {
        if (!attendanceByStudent[s.id]) {
          attendanceByStudent[s.id] = { present: 0, total: 0 }
        }
        attendanceByStudent[s.id].total++
        if (s.status === "present") attendanceByStudent[s.id].present++
        else if (s.status === "late") attendanceByStudent[s.id].present += 0.5
      }
    }

    // 6. Collect all unique free-text categories from internal marks
    const TYPE_KEYS = ["ASSIGNMENT", "QUIZ", "EXAM", "CODING", "PROJECT"]
    const freeCategories = [...new Set(allMarks.map(m => m.category))]
      .filter(c => !TYPE_KEYS.includes(c.toUpperCase()))

    // 7. Compute totalMax = sum of maxGrade across ALL assignments (always, not just graded)
    const globalMaxFromAssignments = assignmentCols.reduce((sum, col) => sum + col.maxGrade, 0)

    // 8. Build rows
    const rows = enrolledStudents.map((s, idx) => {
      const studentMarks = allMarks.filter(m => m.studentId === s.id)
      const att          = attendanceByStudent[s.id] || { present: 0, total: 0 }
      const attendancePct = att.total > 0 ? Math.round((att.present / att.total) * 100) : null

      // Per-assignment grade for this student
      const assignmentGrades = {}
      for (const col of assignmentCols) {
        const sub = submissionsByAssignment[col.assignmentId]?.[s.id]
        assignmentGrades[col.assignmentId] = sub?.graded ? sub.grade : null  // null → "-"
      }

      // Free-text marks
      const freeMarks = {}
      for (const cat of freeCategories) {
        const entry = studentMarks.find(m => m.category === cat)
        freeMarks[cat] = entry ? { marks: entry.marks, maxMarks: entry.maxMarks, _id: entry._id } : null
      }

      // Total obtained = sum of graded assignment marks + free marks
      let totalObtained = 0
      for (const col of assignmentCols) {
        const grade = assignmentGrades[col.assignmentId]
        if (grade !== null) totalObtained += grade
      }
      for (const cat of freeCategories) {
        if (freeMarks[cat]) totalObtained += freeMarks[cat].marks
      }

      // Total max = all assignments max + all free marks max (regardless of grading)
      let totalMax = globalMaxFromAssignments
      for (const cat of freeCategories) {
        if (freeMarks[cat]) totalMax += freeMarks[cat].maxMarks
      }
      // If no assignments and no free marks at all, keep null
      const hasAnyData = assignmentCols.length > 0 || freeCategories.length > 0

      return {
        sno:            idx + 1,
        studentId:      s.id,
        studentName:    s.name,
        assignmentGrades,   // { [assignmentId]: number | null }
        freeMarks,          // { [categoryName]: {marks, maxMarks, _id} | null }
        attendance:         attendancePct,
        totalObtained:      hasAnyData ? totalObtained : null,
        totalMax:           hasAnyData ? totalMax : null,
      }
    })

    res.json({
      courseId,
      courseName:      course.courseName,
      assignmentCols,  // array of { assignmentId, title, type, maxGrade }
      categories:      freeCategories,
      rows,
    })
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
