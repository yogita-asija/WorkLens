const Attendance  = require("../models/Attendance")
const logActivity = require("../utils/logActivity")

const Course = require("../models/course")

const getAttendanceRoster = async (req, res) => {
  try {
    const course = await Course.findOne({
      courseId: req.params.courseId,
    })

    if (!course) {
      return res.status(404).json({
        message: "Course not found",
      })
    }

    const students = (course.students || []).map((s) => ({
      id: s.id || s._id,
      name: s.name,
      status: "present",
      notes: "",
    }))

    res.json({ students })
  } catch (err) {
    res.status(500).json({
      message: "Failed to load roster",
      error: err.message,
    })
  }
}

// GET /attendance
const getAllAttendance = async (req, res) => {
  try {
    const records = await Attendance.find().sort({ createdAt: -1 })
    res.json(records)
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch attendance records", error: err.message })
  }
}


// GET /attendance/:courseId/:date
const getAttendanceByDate = async (req, res) => {
  try {
    const record = await Attendance.findOne({
      courseId: req.params.courseId,
      date:     req.params.date,
    })

    if (!record) {
      return res.status(404).json({ message: "No attendance found for this course and date" })
    }

    res.json(record)
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch attendance", error: err.message })
  }
}


// POST /attendance  — save or update, then log the activity
const saveAttendance = async (req, res) => {
  try {
    const { courseId, courseName, date, topic, students } = req.body

    if (!courseId || !date || !Array.isArray(students)) {
      return res.status(400).json({ message: "courseId, date, and students array are required" })
    }

    // Count statuses for the log detail
    const presentCount = students.filter(s => s.status === "present").length
    const absentCount  = students.filter(s => s.status === "absent").length
    const lateCount    = students.filter(s => s.status === "late").length
    const totalCount   = students.length

    let existing = await Attendance.findOne({ courseId, date })
    let isUpdate = false

    if (existing) {
      existing.students   = students
      existing.courseName = courseName
      existing.topic = topic 
      await existing.save()
      isUpdate = true
    } else {
      await Attendance.create({ courseId, courseName, date, topic ,students })
    }

    // Log the activity automatically after saving
    await logActivity({
      type:    "attendance",
      title:   isUpdate ? "Updated attendance" : "Marked attendance",
      subject: `${courseId} — ${date}`,
      course:  courseName || courseId,
      detail:  `${presentCount} present, ${absentCount} absent, ${lateCount} late out of ${totalCount} students`,
    })

    res.json({
      message: isUpdate ? "Attendance updated!" : "Attendance saved!",
      data: existing || await Attendance.findOne({ courseId, date }),
    })
  } catch (err) {
    res.status(500).json({ message: "Failed to save attendance", error: err.message })
  }
}


// DELETE /attendance/:id
const deleteAttendance = async (req, res) => {
  try {
    const record = await Attendance.findById(req.params.id)

    await Attendance.findByIdAndDelete(req.params.id)

    // Log deletion too
    if (record) {
      await logActivity({
        type:    "attendance",
        title:   "Deleted attendance record",
        subject: `${record.courseId} — ${record.date}`,
        course:  record.courseName || record.courseId,
        detail:  `Attendance record for ${record.date} deleted`,
      })
    }

    res.json({ message: "Attendance record deleted" })
  } catch (err) {
    res.status(500).json({ message: "Failed to delete attendance", error: err.message })
  }
}


// GET /attendance/:courseId/:date/export  — download CSV
const exportAttendanceCSV = async (req, res) => {
  try {
    const record = await Attendance.findOne({
      courseId: req.params.courseId,
      date:     req.params.date,
    })

    if (!record) {
      return res.status(404).json({ message: "No attendance found for this course and date" })
    }

    const rows = [
      ["Student ID", "Name", "Status", "Notes", "Course", "Date"],
      ...record.students.map(s => [
        s.id,
        `"${(s.name  || "").replace(/"/g, '""')}"`,
        s.status,
        `"${(s.notes || "").replace(/"/g, '""')}"`,
        `"${(record.courseName || record.courseId).replace(/"/g, '""')}"`,
        record.date,
      ]),
    ]

    const csv = rows.map(r => r.join(",")).join("\n")
    const filename = `attendance_${record.courseId}_${record.date}.csv`

    res.setHeader("Content-Type", "text/csv")
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)
    res.send(csv)
  } catch (err) {
    res.status(500).json({ message: "Failed to export attendance", error: err.message })
  }
}


// GET /attendance/student/:studentId  — full history across all courses
const getStudentHistory = async (req, res) => {
  try {
    const { studentId } = req.params

    // Find every attendance record that contains this student
    const records = await Attendance.find({
      "students.id": studentId,
    }).sort({ date: -1 })

    if (records.length === 0) {
      return res.json({ studentId, studentName: null, history: [] })
    }

    // Pull out this student's entry from each record
    const history = records.map(record => {
      const entry = record.students.find(s => s.id === studentId)
      return {
        date:       record.date,
        courseId:   record.courseId,
        courseName: record.courseName || record.courseId,
        status:     entry ? entry.status : "unknown",
        notes:      entry ? entry.notes  : "",
      }
    })

    // Derive student name from latest record
    const latestEntry = records[0].students.find(s => s.id === studentId)
    const studentName = latestEntry ? latestEntry.name : studentId

    // Compute summary stats
    const total   = history.length
    const present = history.filter(h => h.status === "present").length
    const absent  = history.filter(h => h.status === "absent").length
    const late    = history.filter(h => h.status === "late").length

    // Per-course breakdown
    const courseMap = {}
    history.forEach(h => {
      if (!courseMap[h.courseId]) {
        courseMap[h.courseId] = { courseId: h.courseId, courseName: h.courseName, total: 0, present: 0, absent: 0, late: 0 }
      }
      courseMap[h.courseId].total++
      courseMap[h.courseId][h.status]++
    })

    res.json({
      studentId,
      studentName,
      summary: { total, present, absent, late },
      courseBreakdown: Object.values(courseMap),
      history,
    })
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch student history", error: err.message })
  }
}


module.exports = {
  getAllAttendance,
  getAttendanceByDate,
  saveAttendance,
  deleteAttendance,
  exportAttendanceCSV,
  getStudentHistory,
  getAttendanceRoster,
}
