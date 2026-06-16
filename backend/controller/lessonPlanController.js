const LessonPlan = require("../models/LessonPlan")
const Course     = require("../models/course")

// GET /api/lesson-plans
exports.getLessonPlans = async (req, res) => {
  try {
    const { facultyId, search } = req.query
    const filter = {}
    if (facultyId) filter["faculty.id"] = facultyId
    if (search) filter.title = { $regex: search, $options: "i" }

    const plans = await LessonPlan.find(filter).sort({ createdAt: -1 }).lean()
    const result = plans.map(plan => {
      const allTopics = plan.units.flatMap(u => u.topics)
      const totalTopics     = allTopics.length
      const completedTopics = allTopics.filter(t => t.status === "completed").length
      const progress = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0
      return { ...plan, totalTopics, completedTopics, progress }
    })
    res.json(result)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// GET /api/lesson-plans/stats
exports.getLessonPlanStats = async (req, res) => {
  try {
    const { facultyId } = req.query
    const filter = facultyId ? { "faculty.id": facultyId } : {}
    const plans = await LessonPlan.find(filter).lean()
    const allTopics       = plans.flatMap(p => p.units.flatMap(u => u.topics))
    const totalPlans      = plans.length
    const activeCourses   = new Set(plans.filter(p => p.status === "active").map(p => String(p.courseId))).size
    const completedTopics = allTopics.filter(t => t.status === "completed").length
    const pendingTopics   = allTopics.filter(t => t.status === "pending").length
    res.json({ totalPlans, activeCourses, completedTopics, pendingTopics })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// GET /api/lesson-plans/calendar
exports.getCalendarData = async (req, res) => {
  try {
    const { facultyId, month, year } = req.query
    const filter = facultyId ? { "faculty.id": facultyId } : {}
    const plans = await LessonPlan.find(filter).lean()

    const events = []
    for (const plan of plans) {
      for (const unit of plan.units) {
        for (const topic of unit.topics) {
          if (!topic.date) continue
          const d = new Date(topic.date)
          if (month && year) {
            if (d.getMonth() + 1 !== Number(month) || d.getFullYear() !== Number(year)) continue
          }
          events.push({
            date:       topic.date,
            topicTitle: topic.title,
            unitTitle:  unit.title,
            planTitle:  plan.title,
            planId:     plan._id,
            courseName: plan.courseName,
            status:     topic.status,
            topicId:    topic._id,
          })
        }
      }
    }
    res.json(events)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// GET /api/lesson-plans/:id
exports.getLessonPlanById = async (req, res) => {
  try {
    const plan = await LessonPlan.findById(req.params.id).lean()
    if (!plan) return res.status(404).json({ message: "Lesson plan not found" })
    const allTopics       = plan.units.flatMap(u => u.topics)
    const totalTopics     = allTopics.length
    const completedTopics = allTopics.filter(t => t.status === "completed").length
    const progress = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0
    res.json({ ...plan, totalTopics, completedTopics, progress })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// POST /api/lesson-plans
exports.createLessonPlan = async (req, res) => {
  try {
    const { title, courseId, description, startDate, endDate, units, faculty } = req.body
    if (!title || !courseId) return res.status(400).json({ message: "Title and course are required" })

    const course = await Course.findById(courseId).lean()
    const plan = await LessonPlan.create({
      title, courseId, description, startDate, endDate,
      units: units || [],
      faculty: faculty || {},
      courseName: course?.courseName || "",
      courseCode: course?.courseCode || course?.courseId || "",
    })
    res.status(201).json(plan)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// PUT /api/lesson-plans/:id
exports.updateLessonPlan = async (req, res) => {
  try {
    const plan = await LessonPlan.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean()
    if (!plan) return res.status(404).json({ message: "Not found" })
    res.json(plan)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// PATCH /api/lesson-plans/:id/complete
exports.markPlanComplete = async (req, res) => {
  try {
    const plan = await LessonPlan.findByIdAndUpdate(
      req.params.id,
      { status: "completed", $set: { "units.$[].topics.$[].status": "completed" } },
      { new: true }
    ).lean()
    if (!plan) return res.status(404).json({ message: "Not found" })
    res.json(plan)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// DELETE /api/lesson-plans/:id
exports.deleteLessonPlan = async (req, res) => {
  try {
    await LessonPlan.findByIdAndDelete(req.params.id)
    res.json({ message: "Deleted" })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
