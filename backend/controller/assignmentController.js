const Assignment   = require("../models/Assignment")
const Course       = require("../models/course")
const Notification = require("../models/Notification")

const toPlain = a => ({
  _id:         a._id,
  title:       a.title,
  description: a.description,
  course:      a.course,
  courseId:    a.courseId,
  type:        a.type,
  deadline:    a.deadline,
  uploadDate:  a.uploadDate,
  maxGrade:    a.maxGrade,
  total:       a.total,
  submitted:   a.submissions?.length || 0,
  submissions: a.submissions || [],
  pending:     a.pending || [],
  submitted_names: a.submitted_names || [],
  completed:   a.completed,
  createdAt:   a.createdAt,
})

// GET /api/assignments
exports.getAllAssignments = async (req, res) => {
  try {
    const { courseId, type, completed } = req.query
    const filter = {}
    if (courseId) filter.courseId = courseId
    if (type)     filter.type = type
    if (completed !== undefined) filter.completed = completed === "true"

    const docs = await Assignment.find(filter).sort({ createdAt: -1 }).lean()
    const result = docs.map(a => ({ ...a, submitted: a.submissions?.length || 0 }))
    res.json(result)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// GET /api/assignments/:id
exports.getAssignmentById = async (req, res) => {
  try {
    const a = await Assignment.findById(req.params.id).lean()
    if (!a) return res.status(404).json({ message: "Not found" })
    res.json({ ...a, submitted: a.submissions?.length || 0 })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// GET /api/assignments/course/:courseId
exports.getAssignmentsByCourse = async (req, res) => {
  try {
    const docs = await Assignment.find({ courseId: req.params.courseId }).sort({ createdAt: -1 }).lean()
    res.json(docs.map(a => ({ ...a, submitted: a.submissions?.length || 0 })))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// POST /api/assignments
exports.createAssignment = async (req, res) => {
  try {
    const { title, description, courseId, course, type, deadline, total, uploadDate, maxGrade } = req.body
    if (!title) return res.status(400).json({ message: "Title is required" })

    // Auto-fill course name
    let courseName = course || ""
    if (courseId && !courseName) {
      const c = await Course.findById(courseId).lean()
      if (c) courseName = c.courseName || c.label || ""
    }

    // Auto-fill total from course enrollment
    let totalCount = Number(total) || 0
    if (!totalCount && courseId) {
      const c = await Course.findById(courseId).lean()
      if (c) totalCount = c.students?.length || 0
    }

    const saved = await Assignment.create({
      title, description: description || "",
      courseId: courseId || undefined,
      course: courseName,
      type: type || "ASSIGNMENT",
      deadline: deadline || "",
      total: totalCount,
      uploadDate: uploadDate || new Date().toISOString().slice(0, 10),
      maxGrade: maxGrade || 100,
      submissions: [],
      completed: false,
    })

    // Notify the course teacher (best-effort)
    try {
      if (courseId) {
        const c = await Course.findById(courseId).lean()
        if (c?.teacher?.id) {
          await Notification.create({
            userId:  c.teacher.id,
            type:    "assignment",
            title:   "Assignment Created",
            message: `"${title}" has been added to ${courseName || c.courseName}${deadline ? `. Due: ${new Date(deadline).toLocaleDateString()}` : ""}.`,
          })
        }
      }
    } catch {}

    res.status(201).json({ ...saved.toObject(), submitted: 0 })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// PUT /api/assignments/:id
exports.updateAssignment = async (req, res) => {
  try {
    const updated = await Assignment.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).lean()
    if (!updated) return res.status(404).json({ message: "Not found" })
    res.json({ ...updated, submitted: updated.submissions?.length || 0 })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// DELETE /api/assignments/:id
exports.deleteAssignment = async (req, res) => {
  try {
    const deleted = await Assignment.findByIdAndDelete(req.params.id)
    if (!deleted) return res.status(404).json({ message: "Not found" })

    // Notify course teacher (best-effort)
    try {
      if (deleted.courseId) {
        const c = await Course.findById(deleted.courseId).lean()
        if (c?.teacher?.id) {
          await Notification.create({
            userId:  c.teacher.id,
            type:    "assignment",
            title:   "Assignment Removed",
            message: `"${deleted.title}" has been deleted from ${deleted.course || c.courseName}.`,
          })
        }
      }
    } catch {}

    res.json({ message: "Assignment deleted" })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// POST /api/assignments/:id/submit
exports.submitAssignment = async (req, res) => {
  try {
    const { studentId, studentName, fileUrl, fileName } = req.body
    if (!studentId || !studentName) return res.status(400).json({ message: "studentId and studentName required" })

    const a = await Assignment.findById(req.params.id)
    if (!a) return res.status(404).json({ message: "Not found" })

    const deadline = a.deadline ? new Date(a.deadline) : null
    const now = new Date()
    const isLate = deadline && now > deadline

    const existing = a.submissions.find(s => s.studentId === studentId)
    if (existing) {
      existing.fileUrl    = fileUrl || existing.fileUrl
      existing.fileName   = fileName || existing.fileName
      existing.submittedAt = now
      existing.status     = isLate ? "late" : "submitted"
    } else {
      a.submissions.push({
        studentId, studentName,
        fileUrl: fileUrl || "",
        fileName: fileName || "",
        submittedAt: now,
        status: isLate ? "late" : "submitted",
        grade: null, feedback: "",
      })
    }

    // Sync legacy fields
    a.submitted_names = a.submissions.map(s => s.studentName)
    await a.save()
    res.json({ ...a.toObject(), submitted: a.submissions.length })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// PUT /api/assignments/:id/grade/:submissionId
exports.gradeSubmission = async (req, res) => {
  try {
    const { grade, feedback } = req.body
    if (grade === undefined) return res.status(400).json({ message: "grade is required" })

    const a = await Assignment.findById(req.params.id)
    if (!a) return res.status(404).json({ message: "Assignment not found" })

    const sub = a.submissions.id(req.params.submissionId)
    if (!sub) return res.status(404).json({ message: "Submission not found" })

    sub.grade    = Number(grade)
    sub.feedback = feedback || ""
    sub.status   = "graded"
    await a.save()

    // Notify course teacher (best-effort)
    try {
      if (a.courseId) {
        const c = await Course.findById(a.courseId).lean()
        if (c?.teacher?.id) {
          await Notification.create({
            userId:  c.teacher.id,
            type:    "grade",
            title:   "Submission Graded",
            message: `${sub.studentName}'s submission for "${a.title}" graded: ${grade}/${a.maxGrade || 100}.`,
          })
        }
      }
    } catch {}

    res.json({ message: "Graded", submission: sub })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// GET /api/assignments/analytics
exports.getAnalytics = async (req, res) => {
  try {
    const all = await Assignment.find({}).lean()
    const total = all.length
    const active = all.filter(a => !a.completed).length
    const completed = all.filter(a => a.completed).length

    const now = new Date()
    const overdue = all.filter(a => !a.completed && a.deadline && new Date(a.deadline) < now).length

    const byType = {}
    for (const a of all) {
      byType[a.type] = (byType[a.type] || 0) + 1
    }

    const totalSubmissions = all.reduce((s, a) => s + (a.submissions?.length || 0), 0)
    const totalExpected    = all.reduce((s, a) => s + (a.total || 0), 0)
    const avgRate = totalExpected > 0 ? Math.round((totalSubmissions / totalExpected) * 100) : 0

    res.json({ total, active, completed, overdue, byType, avgSubmissionRate: avgRate, totalSubmissions })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// GET /api/assignments/:id/students-marks
// Returns all students enrolled in the assignment's course, with their marks if any
exports.getAssignmentStudentsMarks = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id).lean()
    if (!assignment) return res.status(404).json({ message: "Assignment not found" })

    if (!assignment.courseId) {
      return res.json({ students: [], message: "No course linked to this assignment" })
    }

    const course = await Course.findById(assignment.courseId).lean()
    if (!course) return res.status(404).json({ message: "Course not found" })

    const students = (course.students || []).map(s => {
      const submission = (assignment.submissions || []).find(sub => sub.studentId === s.id)
      return {
        id: s.id,
        name: s.name,
        submissionId: submission?._id || null,
        grade: submission?.grade ?? null,
        maxGrade: assignment.maxGrade || 100,
        feedback: submission?.feedback || "",
        status: submission?.status || "not_submitted",
        submittedAt: submission?.submittedAt || null,
      }
    })

    res.json({
      assignmentId: assignment._id,
      assignmentTitle: assignment.title,
      maxGrade: assignment.maxGrade || 100,
      courseId: course.courseId || course.courseCode,
      courseName: course.courseName,
      students,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// PUT /api/assignments/:id/bulk-marks
// Save marks for multiple students at once
exports.bulkSaveMarks = async (req, res) => {
  try {
    const { marks } = req.body // [{ studentId, studentName, grade, feedback }]
    if (!Array.isArray(marks)) return res.status(400).json({ message: "marks must be an array" })

    const assignment = await Assignment.findById(req.params.id)
    if (!assignment) return res.status(404).json({ message: "Assignment not found" })

    for (const m of marks) {
      if (m.grade === null || m.grade === undefined || m.grade === "") continue
      const existing = assignment.submissions.find(s => s.studentId === m.studentId)
      if (existing) {
        existing.grade = Number(m.grade)
        existing.feedback = m.feedback || existing.feedback || ""
        existing.status = "graded"
      } else {
        assignment.submissions.push({
          studentId: m.studentId,
          studentName: m.studentName,
          grade: Number(m.grade),
          feedback: m.feedback || "",
          status: "graded",
          submittedAt: new Date(),
        })
      }
    }

    assignment.submitted_names = assignment.submissions.map(s => s.studentName)
    await assignment.save()

    // Notify course teacher (best-effort)
    try {
      const gradedCount = marks.filter(m => m.grade !== null && m.grade !== undefined && m.grade !== "").length
      if (gradedCount > 0 && assignment.courseId) {
        const c = await Course.findById(assignment.courseId).lean()
        if (c?.teacher?.id) {
          await Notification.create({
            userId:  c.teacher.id,
            type:    "grade",
            title:   "Marks Saved",
            message: `${gradedCount} student mark(s) saved for "${assignment.title}" in ${assignment.course || c.courseName}.`,
          })
        }
      }
    } catch {}

    res.json({ message: "Marks saved successfully", count: marks.length })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
