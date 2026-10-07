const mongoose = require("mongoose")
const { Schema } = mongoose

// A duty (e.g. "Orientation 2026") created by the HOD and assigned to department faculty.
const dutyAllocationSchema = new Schema({
  department:    { type: String, default: "", index: true },
  title:         { type: String, required: true, trim: true },
  // title with years/digits removed — used to find "previous similar duties"
  similarityKey: { type: String, default: "", index: true },
  description:   { type: String, default: "" },
  dateKey:       { type: String, required: true },          // YYYY-MM-DD (timezone-safe, same style as Substitution.dateKey)
  durationHours: { type: Number, required: true, min: 0.5, max: 24 },
  requiredCount: { type: Number, required: true, min: 1 },
  createdById:   { type: String, default: "" },
  assignees: [{
    _id:         false,
    facultyId:   { type: String, required: true },
    facultyName: { type: String, default: "" },
    assignedAt:  { type: Date, default: Date.now },
  }],
}, { timestamps: true })

dutyAllocationSchema.index({ department: 1, dateKey: -1 })
dutyAllocationSchema.index({ "assignees.facultyId": 1, dateKey: 1 })

dutyAllocationSchema.statics.similarityKeyOf = function (title) {
  return String(title || "")
    .toLowerCase()
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/[0-9]+/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

dutyAllocationSchema.pre("validate", function (next) {
  this.similarityKey = this.constructor.similarityKeyOf(this.title)
  next()
})

module.exports = mongoose.models.DutyAllocation || mongoose.model("DutyAllocation", dutyAllocationSchema)
