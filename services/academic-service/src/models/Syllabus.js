const mongoose = require("mongoose")

const TopicSchema = new mongoose.Schema({
  title:     { type: String, required: true },
  completed: { type: Boolean, default: false },
  completedAt: { type: Date },
})

const ModuleSchema = new mongoose.Schema({
  title:  { type: String, required: true },
  topics: [TopicSchema],
})

const SyllabusSchema = new mongoose.Schema({
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
    required: true,
    unique: true,
  },
  modules: [ModuleSchema],
}, { timestamps: true })

module.exports = mongoose.model("Syllabus", SyllabusSchema)
