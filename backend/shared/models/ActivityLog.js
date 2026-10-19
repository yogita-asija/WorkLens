 const mongoose = require("mongoose")

const ActivityLogSchema = new mongoose.Schema({

  type:      String,   // "assignment" or "attendance" or "grading" or "course" or "deadline"
  title:     String,   // example: "Created new assignment"
  subject:   String,   // example: "Algorithm Analysis Project"
  course:    String,   // example: "CS401 — Advanced Algorithms"
  detail:    String,   // example: "Uploaded materials and set deadline for Feb 28"
  timestamp: Date,     // when this activity happened
    // Used only by anonymous workflow feedback (type "workflow")
  department:    String,
  respondentKey: { type: String, select: false },   // keyed hash, never returned by any API

}, { timestamps: true })

module.exports = mongoose.model("ActivityLog", ActivityLogSchema)
