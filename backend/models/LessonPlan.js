const mongoose = require("mongoose")

const TopicSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  date:        { type: Date },
  status:      { type: String, enum: ["pending", "in-progress", "completed"], default: "pending" },
  description: { type: String, default: "" },
}, { _id: true })

const UnitSchema = new mongoose.Schema({
  title:  { type: String, required: true },
  topics: [TopicSchema],
}, { _id: true })

const LessonPlanSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  courseId:    { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  courseName:  { type: String, default: "" },
  courseCode:  { type: String, default: "" },
  faculty: {
    id:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, default: "" },
  },
  units:       [UnitSchema],
  status:      { type: String, enum: ["active", "completed", "archived"], default: "active" },
  startDate:   { type: Date },
  endDate:     { type: Date },
  description: { type: String, default: "" },
}, { timestamps: true })

LessonPlanSchema.index({ "faculty.id": 1 })
LessonPlanSchema.index({ courseId: 1 })

module.exports = mongoose.model("LessonPlan", LessonPlanSchema)
