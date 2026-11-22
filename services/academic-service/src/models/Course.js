const mongoose = require("mongoose")

// Stamped by HOD → Course Allocation when a teacher is assigned (read by the faculty "Courses" page).
const allocationInfo = () => ({
  term:         { type: String, default: "" },                         // e.g. "2026-27 Odd Semester"
  startDate:    { type: String, default: "" },                         // YYYY-MM-DD
  endDate:      { type: String, default: "" },
  allocationId: { type: mongoose.Schema.Types.ObjectId, ref: "CourseAllocation" },
  assignedAt:   { type: Date },
})

const CourseSchema = new mongoose.Schema({
  courseId:    { type: String, required: true, unique: true },  // unique already creates index
  courseCode:  { type: String },
  courseName:  { type: String, required: true },
  description: { type: String, default: "" },
  label:       { type: String },
  sem:         { type: String, default: "N/A" },
  credits:     { type: Number, default: 3 },
  status:      { type: String, enum: ["active", "inactive", "archived"], default: "active" },
  // Owning department. Left empty on older courses; set automatically the first time an HOD allocates the course.
  department:  { type: String, default: "" },
  teacher: {
    id:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, default: "" },
  },
  allocation: allocationInfo(),
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
    allocation: allocationInfo(),
    students: [{ id: String, name: String, enrolledAt: { type: Date, default: Date.now } }],
  }],
}, { timestamps: true })

// Only add indexes not already created by schema-level options
CourseSchema.index({ status: 1 })
CourseSchema.index({ department: 1 })
CourseSchema.index({ "teacher.id": 1 })
CourseSchema.index({ "batches.teacher.id": 1 })

module.exports = mongoose.model("Course", CourseSchema)
