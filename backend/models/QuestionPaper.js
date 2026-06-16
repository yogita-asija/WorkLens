const mongoose = require("mongoose")

const QuestionPaperSchema = new mongoose.Schema({
  title:        { type: String, required: true },
  courseId:     { type: String, required: true },
  courseName:   { type: String, default: "" },
  courseCode:   { type: String, default: "" },
  semester:     { type: String, default: "" },
  examType:     { type: String, enum: ["Quiz", "Mid Semester", "End Semester"], required: true },
  duration:     { type: Number, required: true },       // in minutes
  totalMarks:   { type: Number, required: true },
  instructions: { type: String, default: "" },
  content:      { type: String, default: "" },          // question paper body
  status:       { type: String, enum: ["Draft", "Published"], default: "Draft" },
  publishedAt:  { type: Date, default: null },
  teacher: {
    id:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, default: "" },
  },
}, { timestamps: true })

QuestionPaperSchema.index({ courseId: 1 })
QuestionPaperSchema.index({ examType: 1 })
QuestionPaperSchema.index({ status: 1 })

module.exports = mongoose.model("QuestionPaper", QuestionPaperSchema)
