const Timetable  = require("../models/Timetable")
const Course     = require("../models/course")
const User       = require("../models/User")
const Department = require("../models/Department")
const logAudit   = require("../utils/logAudit")

// ── GET /api/admin/timetable?semesterLabel=&departmentId= ─────────────────────
exports.getTimetable = async (req, res) => {
  try {
    const { semesterLabel, departmentId, teacherId } = req.query
    const filter = {}
    if (semesterLabel) filter.semesterLabel = semesterLabel
    if (departmentId)  filter.departmentId  = departmentId
    if (teacherId)     filter.teacherId     = teacherId

    const slots = await Timetable.find(filter).lean()
    res.json({ success: true, data: slots })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ── GET /api/admin/timetable/my — faculty portal: own schedule ────────────────
exports.getMyTimetable = async (req, res) => {
  try {
    const teacherId = req.user?._id || req.query.teacherId
    if (!teacherId) return res.status(400).json({ success: false, message: "teacherId required" })

    const slots = await Timetable.find({ teacherId }).sort({ day: 1, startTime: 1 }).lean()
    res.json({ success: true, data: slots })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ── POST /api/admin/timetable — add a slot ────────────────────────────────────
exports.addSlot = async (req, res) => {
  try {
    const { semesterLabel, courseId, teacherId, day, startTime, endTime, room, type } = req.body
    if (!semesterLabel || !courseId || !teacherId || !day || !startTime || !endTime || !room) {
      return res.status(400).json({ success: false, message: "All fields are required" })
    }

    // ── clash checks ──────────────────────────────────────────────────────────
    const [teacherClash, roomClash] = await Promise.all([
      Timetable.findOne({ semesterLabel, teacherId, day, startTime }),
      Timetable.findOne({ semesterLabel, room, day, startTime }),
    ])

    if (teacherClash) {
      return res.status(409).json({
        success: false,
        message: `Clash: ${teacherClash.teacherName} already has ${teacherClash.courseCode} at this time`,
        clash: "teacher",
      })
    }
    if (roomClash) {
      return res.status(409).json({
        success: false,
        message: `Clash: Room ${room} is already occupied by ${roomClash.courseName} at this time`,
        clash: "room",
      })
    }

    // ── fetch related docs ────────────────────────────────────────────────────
    const [course, teacher] = await Promise.all([
      Course.findById(courseId).lean(),
      User.findById(teacherId).select("-password").lean(),
    ])
    if (!course)   return res.status(404).json({ success: false, message: "Course not found" })
    if (!teacher)  return res.status(404).json({ success: false, message: "Teacher not found" })

    const dept = await Department.findOne({ name: course.departmentName || teacher.department }).lean()

    const slot = await Timetable.create({
      semesterLabel,
      departmentId:   dept?._id,
      departmentName: dept?.name || teacher.department || "",
      courseId:   course._id,
      courseCode: course.courseCode || course.courseId,
      courseName: course.courseName,
      teacherId:  teacher._id,
      teacherName:teacher.name,
      day, startTime, endTime,
      room, type: type || "Lecture",
    })

    await logAudit({
      adminId: req.admin._id, adminName: req.admin.name,
      action: "CREATE_TIMETABLE_SLOT", module: "timetable",
      targetId: String(slot._id), targetName: `${course.courseCode} ${day} ${startTime}`,
      detail: `Added ${course.courseCode} on ${day} ${startTime}–${endTime} Room ${room}`,
      ip: req.ip,
    })

    res.status(201).json({ success: true, message: "Slot added", data: slot })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ── DELETE /api/admin/timetable/:id ──────────────────────────────────────────
exports.deleteSlot = async (req, res) => {
  try {
    const slot = await Timetable.findById(req.params.id)
    if (!slot) return res.status(404).json({ success: false, message: "Slot not found" })

    await slot.deleteOne()

    await logAudit({
      adminId: req.admin._id, adminName: req.admin.name,
      action: "DELETE_TIMETABLE_SLOT", module: "timetable",
      targetId: req.params.id, targetName: `${slot.courseCode} ${slot.day} ${slot.startTime}`,
      detail: `Removed ${slot.courseCode} from ${slot.day} ${slot.startTime} Room ${slot.room}`,
      ip: req.ip,
    })

    res.json({ success: true, message: "Slot removed" })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ── PUT /api/admin/timetable/:id — edit a slot ───────────────────────────────
exports.updateSlot = async (req, res) => {
  try {
    const { room, type, startTime, endTime, day } = req.body
    const slot = await Timetable.findById(req.params.id)
    if (!slot) return res.status(404).json({ success: false, message: "Slot not found" })

    // Clash check on new time/room (exclude self)
    if (room || startTime || day) {
      const newDay   = day       || slot.day
      const newStart = startTime || slot.startTime
      const newRoom  = room      || slot.room

      const [teacherClash, roomClash] = await Promise.all([
        Timetable.findOne({ _id: { $ne: slot._id }, semesterLabel: slot.semesterLabel, teacherId: slot.teacherId, day: newDay, startTime: newStart }),
        Timetable.findOne({ _id: { $ne: slot._id }, semesterLabel: slot.semesterLabel, room: newRoom, day: newDay, startTime: newStart }),
      ])
      if (teacherClash) return res.status(409).json({ success: false, message: `Teacher clash: ${teacherClash.courseCode} at this time`, clash: "teacher" })
      if (roomClash)    return res.status(409).json({ success: false, message: `Room clash: ${roomClash.courseName}`,                      clash: "room"    })
    }

    if (room)      slot.room      = room
    if (type)      slot.type      = type
    if (startTime) slot.startTime = startTime
    if (endTime)   slot.endTime   = endTime
    if (day)       slot.day       = day
    await slot.save()

    res.json({ success: true, message: "Slot updated", data: slot })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ── GET /api/admin/timetable/semesters — list unique semester labels ──────────
exports.getSemesters = async (req, res) => {
  try {
    const semesters = await Timetable.distinct("semesterLabel")
    res.json({ success: true, data: semesters })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}