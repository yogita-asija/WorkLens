const QuestionPaper = require("../models/QuestionPaper")
const Course        = require("../models/course")

// GET /api/question-papers
exports.getAllPapers = async (req, res) => {
  try {
    const { courseId, examType, status, search } = req.query
    const filter = {}
    if (courseId) filter.courseId = courseId
    if (examType) filter.examType = examType
    if (status)   filter.status   = status
    if (search) {
      filter.$or = [
        { title:      { $regex: search, $options: "i" } },
        { courseName: { $regex: search, $options: "i" } },
        { courseCode: { $regex: search, $options: "i" } },
      ]
    }
    const docs = await QuestionPaper.find(filter).sort({ createdAt: -1 }).lean()
    res.json(docs)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// GET /api/question-papers/stats
exports.getStats = async (req, res) => {
  try {
    const [total, mid, end, draft] = await Promise.all([
      QuestionPaper.countDocuments({}),
      QuestionPaper.countDocuments({ examType: "Mid Semester" }),
      QuestionPaper.countDocuments({ examType: "End Semester" }),
      QuestionPaper.countDocuments({ status: "Draft" }),
    ])
    res.json({ total, mid, end, draft })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// GET /api/question-papers/:id
exports.getPaperById = async (req, res) => {
  try {
    const doc = await QuestionPaper.findById(req.params.id).lean()
    if (!doc) return res.status(404).json({ message: "Not found" })
    res.json(doc)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// POST /api/question-papers
exports.createPaper = async (req, res) => {
  try {
    const { courseId, title, semester, examType, duration, totalMarks, instructions, content, status } = req.body

    // Resolve course details
    let courseName = ""
    let courseCode  = ""
    if (courseId) {
      const course = await Course.findOne({ courseId }).lean()
      if (course) {
        courseName = course.courseName || ""
        courseCode  = course.courseCode  || ""
      }
    }

    const publishedAt = (status === "Published") ? new Date() : null

    const doc = await QuestionPaper.create({
      title, courseId, courseName, courseCode, semester,
      examType, duration, totalMarks, instructions, content,
      status: status || "Draft",
      publishedAt,
    })
    res.status(201).json(doc)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// PUT /api/question-papers/:id
exports.updatePaper = async (req, res) => {
  try {
    const { courseId, title, semester, examType, duration, totalMarks, instructions, content, status } = req.body
    const existing = await QuestionPaper.findById(req.params.id)
    if (!existing) return res.status(404).json({ message: "Not found" })

    // Resolve course details if courseId changed
    let courseName = existing.courseName
    let courseCode  = existing.courseCode
    if (courseId && courseId !== existing.courseId) {
      const course = await Course.findOne({ courseId }).lean()
      if (course) {
        courseName = course.courseName || ""
        courseCode  = course.courseCode  || ""
      }
    }

    // Set publishedAt when first publishing
    let publishedAt = existing.publishedAt
    if (status === "Published" && existing.status !== "Published") {
      publishedAt = new Date()
    }

    const updated = await QuestionPaper.findByIdAndUpdate(
      req.params.id,
      { title, courseId: courseId || existing.courseId, courseName, courseCode,
        semester, examType, duration, totalMarks, instructions, content,
        status: status || existing.status, publishedAt },
      { new: true, runValidators: true }
    ).lean()

    res.json(updated)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// DELETE /api/question-papers/:id
exports.deletePaper = async (req, res) => {
  try {
    const doc = await QuestionPaper.findByIdAndDelete(req.params.id)
    if (!doc) return res.status(404).json({ message: "Not found" })
    res.json({ message: "Deleted" })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// PATCH /api/question-papers/:id/publish
exports.publishPaper = async (req, res) => {
  try {
    const doc = await QuestionPaper.findByIdAndUpdate(
      req.params.id,
      { status: "Published", publishedAt: new Date() },
      { new: true }
    ).lean()
    if (!doc) return res.status(404).json({ message: "Not found" })
    res.json(doc)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
