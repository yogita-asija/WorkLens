const mongoose = require("mongoose")

const InternalMarkSchema = new mongoose.Schema({
  studentId:   { type: String, required: true },
  studentName: { type: String, required: true },
  courseId:    { type: String, required: true },
  courseName:  { type: String, default: "" },
  teacherId:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  category:    { type: String, required: true },   // free-text, teacher decides
  marks:       { type: Number, required: true },
  maxMarks:    { type: Number, default: 100 },
  remarks:     { type: String, default: "" },
}, { timestamps: true })

InternalMarkSchema.index({ studentId: 1, courseId: 1 })
InternalMarkSchema.index({ teacherId: 1 })

module.exports = mongoose.model("InternalMark", InternalMarkSchema)
