const mongoose = require("mongoose")

const analyticsSchema = new mongoose.Schema({
  role:           { type: String, required: true },
  stats:          Object,
  weeklyActivity: Array,
  timeSpentTrend: Array,
  attendanceTrend:Array,
  courseWorkload: Array,
  courses:        Array,
  insights:       Array,
}, { timestamps: true })

module.exports = mongoose.model("Analytics", analyticsSchema)
