const mongoose = require("mongoose")

const ProgramSchema = new mongoose.Schema(
  {
    programId:   { type: String, required: true, unique: true },
    name:        { type: String, required: true },
    shortName:   { type: String, default: "" },          // e.g. "B.Tech CSE"
    department:  { type: String, default: "" },
    duration:    { type: Number, default: 4 },            // years
    totalSems:   { type: Number, default: 8 },
    level:       {
      type: String,
      enum: ["UG", "PG", "Diploma", "PhD"],
      default: "UG",
    },
    status:      { type: String, enum: ["active", "inactive"], default: "active" },
    description: { type: String, default: "" },
    intake:      { type: Number, default: 60 },           // seats per batch
    courses:     [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }],
  },
  { timestamps: true }
)

ProgramSchema.index({ status: 1 })
ProgramSchema.index({ department: 1 })

module.exports = mongoose.models.Program || mongoose.model("Program", ProgramSchema)