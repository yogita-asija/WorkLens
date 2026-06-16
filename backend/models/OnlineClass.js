const mongoose = require("mongoose")

const OnlineClassSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  courseId:    { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  courseName:  { type: String, default: "" },
  courseCode:  { type: String, default: "" },
  batch:       { type: String, default: "" },
  teacherId:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  teacherName: { type: String, default: "" },
  scheduledAt: { type: Date, required: true },
  duration:    { type: Number, default: 60 }, // minutes
  platform:    { type: String, enum: ["zoom", "meet", "teams", "other"], default: "meet" },
  meetingLink: { type: String, default: "" },
  meetingId:   { type: String, default: "" },
  password:    { type: String, default: "" },
  description: { type: String, default: "" },
  status:      { type: String, enum: ["scheduled", "live", "completed", "cancelled"], default: "scheduled" },
  notifyStudents: { type: Boolean, default: true },
  // enrolled students snapshot for easy notification
  students:    [{ id: String, name: String }],
  // who joined
  joinedBy:    [{ studentId: String, joinedAt: Date }],
  recordingUrl: { type: String, default: "" },
}, { timestamps: true })

OnlineClassSchema.index({ courseId: 1, scheduledAt: -1 })
OnlineClassSchema.index({ teacherId: 1, scheduledAt: 1 })
OnlineClassSchema.index({ status: 1 })

module.exports = mongoose.model("OnlineClass", OnlineClassSchema)
