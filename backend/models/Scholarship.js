const mongoose = require("mongoose")

const ScholarshipSchema = new mongoose.Schema({
  // Student being nominated
  studentId:   { type: String, required: true },
  studentName: { type: String, required: true },

  // Course context (nomination is tied to a course the faculty teaches)
  courseId:   { type: String, default: "" },
  courseName: { type: String, default: "" },

  // Faculty who nominated (links to faculty portal user)
  facultyId:   { type: String, required: true },
  facultyName: { type: String, required: true },

  // Scholarship details
  type: {
    type: String,
    enum: ["Merit", "Need-based", "Sports", "Research", "Other"],
    default: "Merit",
  },
  amount:       { type: Number, required: true, min: 0 },
  academicYear: { type: String, default: () => `${new Date().getFullYear()}-${new Date().getFullYear() + 1}` },
  reason:       { type: String, required: true },

  // Lifecycle
  status: {
    type: String,
    enum: ["Pending", "Approved", "Rejected", "Disbursed"],
    default: "Pending",
  },
  adminNote: { type: String, default: "" },

  appliedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})

ScholarshipSchema.index({ status: 1 })
ScholarshipSchema.index({ facultyId: 1 })

module.exports = mongoose.model("Scholarship", ScholarshipSchema)
