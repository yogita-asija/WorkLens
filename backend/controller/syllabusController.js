const Syllabus = require("../models/Syllabus")
const Course   = require("../models/course")

// GET /api/syllabus  — all syllabi for teacher's courses
exports.getAllSyllabus = async (req, res) => {
  try {
    const syllabi = await Syllabus.find().populate("courseId", "courseName courseCode courseId status sem batch").lean()
    const result = syllabi.map(s => enrichSyllabus(s))
    res.json(result)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// GET /api/syllabus/:courseId
exports.getSyllabusByCourse = async (req, res) => {
  try {
    const syllabus = await Syllabus.findOne({ courseId: req.params.courseId })
      .populate("courseId", "courseName courseCode courseId status sem batch")
      .lean()
    if (!syllabus) return res.status(404).json({ message: "Syllabus not found" })
    res.json(enrichSyllabus(syllabus))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// POST /api/syllabus  — create syllabus for a course
exports.createSyllabus = async (req, res) => {
  try {
    const { courseId, modules } = req.body
    if (!courseId) return res.status(400).json({ message: "courseId is required" })

    const exists = await Syllabus.findOne({ courseId })
    if (exists) return res.status(400).json({ message: "Syllabus already exists for this course" })

    const syllabus = await Syllabus.create({ courseId, modules: modules || [] })
    const populated = await syllabus.populate("courseId", "courseName courseCode courseId status sem batch")
    res.status(201).json(enrichSyllabus(populated.toObject()))
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// PUT /api/syllabus/:courseId  — replace modules entirely
exports.updateSyllabus = async (req, res) => {
  try {
    const { modules } = req.body
    const syllabus = await Syllabus.findOneAndUpdate(
      { courseId: req.params.courseId },
      { modules },
      { new: true, runValidators: true }
    ).populate("courseId", "courseName courseCode courseId status sem batch").lean()
    if (!syllabus) return res.status(404).json({ message: "Syllabus not found" })
    res.json(enrichSyllabus(syllabus))
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// PATCH /api/syllabus/:courseId/topic  — toggle a topic completed
exports.updateTopic = async (req, res) => {
  try {
    const { moduleId, topicId, completed } = req.body
    const syllabus = await Syllabus.findOne({ courseId: req.params.courseId })
    if (!syllabus) return res.status(404).json({ message: "Syllabus not found" })

    const mod = syllabus.modules.id(moduleId)
    if (!mod) return res.status(404).json({ message: "Module not found" })

    const topic = mod.topics.id(topicId)
    if (!topic) return res.status(404).json({ message: "Topic not found" })

    topic.completed   = completed
    topic.completedAt = completed ? new Date() : null

    await syllabus.save()
    await syllabus.populate("courseId", "courseName courseCode courseId status sem batch")
    res.json(enrichSyllabus(syllabus.toObject()))
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// DELETE /api/syllabus/:courseId
exports.deleteSyllabus = async (req, res) => {
  try {
    const s = await Syllabus.findOneAndDelete({ courseId: req.params.courseId })
    if (!s) return res.status(404).json({ message: "Syllabus not found" })
    res.json({ message: "Syllabus deleted" })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ── helper ──────────────────────────────────────────────────────────────────
function enrichSyllabus(s) {
  const allTopics       = s.modules.flatMap(m => m.topics)
  const totalTopics     = allTopics.length
  const completedTopics = allTopics.filter(t => t.completed).length
  const progress        = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0

  let courseStatus = "active"
  if (progress === 100)          courseStatus = "completed"
  else if (progress >= 60)       courseStatus = "on-track"
  else if (progress > 0)         courseStatus = "in-progress"
  else                           courseStatus = "not-started"

  return {
    ...s,
    totalTopics,
    completedTopics,
    progress,
    courseStatus,
  }
}
