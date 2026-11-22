const mongoose = require("mongoose")

const submissionSchema = new mongoose.Schema({
  studentId:   { type: String, required: true },
  studentName: { type: String, required: true },
  submittedAt: { type: Date, default: Date.now },
  fileUrl:     { type: String, default: "" },
  fileName:    { type: String, default: "" },
  grade:       { type: Number, default: null },
  maxGrade:    { type: Number, default: 100 },
  feedback:    { type: String, default: "" },
  status:      { type: String, enum: ["submitted", "graded", "late"], default: "submitted" },
}, { _id: true })

const assignmentSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  description: { type: String, default: "" },
  course:      { type: String, default: "" },
  courseId:    { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
  type:        { type: String, enum: ["ASSIGNMENT", "PROJECT", "CODING", "QUIZ", "EXAM"], default: "ASSIGNMENT" },
  deadline:    { type: String, default: "" },
  uploadDate:  { type: String, default: "" },
  maxGrade:    { type: Number, default: 100 },
  total:       { type: Number, default: 0 },
  submissions: [submissionSchema],
  completed:   { type: Boolean, default: false },
  // Legacy fields kept for backward compat
  pending:         { type: [String], default: [] },
  submitted_names: { type: [String], default: [] },
}, { timestamps: true })

assignmentSchema.virtual("submitted").get(function () {
  return this.submissions.length
})

assignmentSchema.index({ courseId: 1 })
assignmentSchema.index({ deadline: 1 })
assignmentSchema.index({ completed: 1 })

module.exports = mongoose.model("Assignment", assignmentSchema)
