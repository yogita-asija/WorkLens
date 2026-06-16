const OnlineClass  = require("../models/OnlineClass")
const Course       = require("../models/course")
const Notification = require("../models/Notification")

// helper: auto-update status based on time
function resolveStatus(cls) {
  if (cls.status === "cancelled" || cls.status === "completed") return cls.status
  const now = Date.now()
  const start = new Date(cls.scheduledAt).getTime()
  const end   = start + (cls.duration || 60) * 60000
  if (now >= start && now <= end) return "live"
  if (now > end) return "completed"
  return "scheduled"
}

// GET /api/online-classes  — list with filters
exports.getAll = async (req, res) => {
  try {
    const { status, courseId, from, to } = req.query
    const filter = {}
    if (status && status !== "all") filter.status = status
    if (courseId) filter.courseId = courseId
    if (from || to) {
      filter.scheduledAt = {}
      if (from) filter.scheduledAt.$gte = new Date(from)
      if (to)   filter.scheduledAt.$lte = new Date(to)
    }

    let classes = await OnlineClass.find(filter).sort({ scheduledAt: 1 }).lean()

    // resolve live/completed dynamically
    classes = classes.map(c => ({ ...c, status: resolveStatus(c) }))

    res.json(classes)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// GET /api/online-classes/stats
exports.getStats = async (req, res) => {
  try {
    let classes = await OnlineClass.find().lean()
    classes = classes.map(c => ({ ...c, status: resolveStatus(c) }))

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd   = new Date(todayStart.getTime() + 86400000)

    const total      = classes.length
    const upcoming   = classes.filter(c => c.status === "scheduled").length
    const completed  = classes.filter(c => c.status === "completed").length
    const live       = classes.filter(c => c.status === "live").length
    const today      = classes.filter(c => {
      const d = new Date(c.scheduledAt)
      return d >= todayStart && d < todayEnd
    }).length
    const cancelled  = classes.filter(c => c.status === "cancelled").length

    res.json({ total, upcoming, completed, live, today, cancelled })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// GET /api/online-classes/:id
exports.getById = async (req, res) => {
  try {
    const cls = await OnlineClass.findById(req.params.id).lean()
    if (!cls) return res.status(404).json({ message: "Class not found" })
    res.json({ ...cls, status: resolveStatus(cls) })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// POST /api/online-classes
exports.create = async (req, res) => {
  try {
    const {
      title, courseId, scheduledAt, duration, platform,
      meetingLink, meetingId, password, description, notifyStudents
    } = req.body

    if (!title)       return res.status(400).json({ message: "Title is required" })
    if (!courseId)    return res.status(400).json({ message: "Course is required" })
    if (!scheduledAt) return res.status(400).json({ message: "Scheduled date/time is required" })
    if (!meetingLink) return res.status(400).json({ message: "Meeting link is required" })

    // fetch course info + students
    const course = await Course.findById(courseId).lean()
    if (!course) return res.status(404).json({ message: "Course not found" })

    const cls = await OnlineClass.create({
      title,
      courseId,
      courseName:  course.courseName,
      courseCode:  course.courseCode || course.courseId,
      batch:       course.batch || "",
      scheduledAt: new Date(scheduledAt),
      duration:    duration || 60,
      platform:    platform || "meet",
      meetingLink: meetingLink || "",
      meetingId:   meetingId  || "",
      password:    password   || "",
      description: description || "",
      notifyStudents: notifyStudents !== false,
      students: (course.students || []).map(s => ({ id: s.id, name: s.name })),
      status: "scheduled",
    })

    // send notifications to enrolled students
    if (notifyStudents !== false && course.students?.length) {
      // We store notifications per student userId — students here are stored by id string
      // Create a broadcast notification (userId null means system broadcast, or per student)
      const dateStr = new Date(scheduledAt).toLocaleString("en-IN", {
        dateStyle: "medium", timeStyle: "short"
      })
      const notifDocs = course.students.map(s => ({
        // userId would be student user _id — we use student id as reference in meta
        type:    "system",
        title:   `Online Class: ${title}`,
        message: `${course.courseName} — scheduled on ${dateStr}. Join link shared by faculty.`,
        link:    meetingLink,
        meta:    { classId: cls._id, courseId, studentId: s.id, platform, meetingLink },
      }))
      // Insert up to 200 notifications (bulk)
      if (notifDocs.length <= 200) {
        await Notification.insertMany(notifDocs)
      }
    }

    res.status(201).json(cls)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// PUT /api/online-classes/:id
exports.update = async (req, res) => {
  try {
    const cls = await OnlineClass.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    if (!cls) return res.status(404).json({ message: "Class not found" })
    res.json(cls)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// PATCH /api/online-classes/:id/status
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body
    const allowed = ["scheduled", "live", "completed", "cancelled"]
    if (!allowed.includes(status)) return res.status(400).json({ message: "Invalid status" })
    const cls = await OnlineClass.findByIdAndUpdate(req.params.id, { status }, { new: true })
    if (!cls) return res.status(404).json({ message: "Class not found" })
    res.json(cls)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// DELETE /api/online-classes/:id
exports.remove = async (req, res) => {
  try {
    const cls = await OnlineClass.findByIdAndDelete(req.params.id)
    if (!cls) return res.status(404).json({ message: "Class not found" })
    res.json({ message: "Class deleted" })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
