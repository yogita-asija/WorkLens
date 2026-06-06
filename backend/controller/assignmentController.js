const Assignment = require("../models/Assignment")
const Course     = require("../models/course")

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
