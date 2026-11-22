const mongoose = require("mongoose")

const StudyMaterialSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  type:        {
    type: String,
    enum: ["notes", "ppt", "pdf", "lab_manual", "question_bank", "previous_paper", "video_link", "other"],
    required: true,
  },
  courseId:    { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  courseName:  { type: String, default: "" },
  courseCode:  { type: String, default: "" },
  // File upload: stored as base64 or URL in fileData, fileName, fileSize
  fileData:    { type: String, default: "" },      // base64 for files
  fileName:    { type: String, default: "" },
  fileSize:    { type: Number, default: 0 },       // bytes
  mimeType:    { type: String, default: "" },
  // For video/link type
  link:        { type: String, default: "" },
  teacher: {
    id:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, default: "" },
  },
  tags:        { type: [String], default: [] },
  downloads:   { type: Number, default: 0 },
}, { timestamps: true })

StudyMaterialSchema.index({ courseId: 1 })
StudyMaterialSchema.index({ type: 1 })
StudyMaterialSchema.index({ "teacher.id": 1 })
StudyMaterialSchema.index({ title: "text", description: "text" })

module.exports = mongoose.model("StudyMaterial", StudyMaterialSchema)
