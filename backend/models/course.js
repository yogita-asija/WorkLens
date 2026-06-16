const mongoose = require("mongoose")

const CourseSchema = new mongoose.Schema({
  courseId:    { type: String, required: true, unique: true },  // unique already creates index
  courseCode:  { type: String },
  courseName:  { type: String, required: true },
  description: { type: String, default: "" },
  label:       { type: String },
  sem:         { type: String, default: "N/A" },
  credits:     { type: Number, default: 3 },
  status:      { type: String, enum: ["active", "inactive", "archived"], default: "active" },
  teacher: {
    id:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, default: "" },
  },
  schedule: {
    days: { type: String, default: "" },
    time: { type: String, default: "" },
    room: { type: String, default: "" },
  },
  capacity: { type: Number, default: 60 },
  progress: { type: Number, default: 0 },
  students: [{ id: String, name: String, enrolledAt: { type: Date, default: Date.now } }],

  // Multiple batches/sections for the same course, each can have its own teacher
  batches: [{
    batchName: { type: String, required: true },   // e.g. "Batch A", "Morning Section"
    teacher: {
      id:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String, default: "" },
    },
    schedule: {
      days: { type: String, default: "" },
      time: { type: String, default: "" },
      room: { type: String, default: "" },
    },
    capacity: { type: Number, default: 60 },
    students: [{ id: String, name: String, enrolledAt: { type: Date, default: Date.now } }],
  }],
}, { timestamps: true })

// Only add indexes not already created by schema-level options
CourseSchema.index({ status: 1 })
CourseSchema.index({ "teacher.id": 1 })
CourseSchema.index({ "batches.teacher.id": 1 })

module.exports = mongoose.model("Course", CourseSchema)
