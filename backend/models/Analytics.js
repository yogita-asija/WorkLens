<<<<<<< HEAD
// const mongoose = require("mongoose")

// const analyticsSchema = new mongoose.Schema({
//   role:           { type: String, required: true },
//   stats:          Object,
//   weeklyActivity: Array,
//   timeSpentTrend: Array,
//   attendanceTrend:Array,
//   courseWorkload: Array,
//   courses:        Array,
//   insights:       Array,
// }, { timestamps: true })

// module.exports = mongoose.model("Analytics", analyticsSchema)
=======
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
>>>>>>> 09f24e068a6d5e720349f39069d3dab7860edc3b
