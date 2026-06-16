const mongoose = require("mongoose");

const extraDutySchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
  },
  type: {
    type: String,
    required: true,
  },
  course: {
    type: String,
    required: true,
  },
  reason: {
    type: String,
  },
  hours: {
    type: String,
  },

});

module.exports = mongoose.model("ExtraDuty", extraDutySchema);