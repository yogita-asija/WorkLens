const mongoose = require("mongoose")

const TimetableSchema = new mongoose.Schema({
  semesterLabel: { type: String, required: true }, // e.g. "Odd Sem 2025-26"
  departmentId:  { type: mongoose.Schema.Types.ObjectId, ref: "Department" },
  departmentName:{ type: String, required: true },
  courseId:      { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  courseCode:    { type: String, required: true },
  courseName:    { type: String, required: true },
  teacherId:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  teacherName:   { type: String, required: true },
  day:           { type: String, enum: ["Mon","Tue","Wed","Thu","Fri","Sat"], required: true },
  startTime:     { type: String, required: true },  // "09:00"
  endTime:       { type: String, required: true },  // "10:00"
  room:          { type: String, required: true },
  type:          { type: String, enum: ["Lecture","Lab","Tutorial"], default: "Lecture" },
}, { timestamps: true })

// Index for clash detection queries
TimetableSchema.index({ semesterLabel: 1, day: 1, startTime: 1 })
TimetableSchema.index({ teacherId: 1, semesterLabel: 1 })

module.exports = mongoose.model("Timetable", TimetableSchema)