const mongoose = require("mongoose")

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ["teaching", "non-teaching", "admin"],
    required: true,
  },
  department:    { type: String, default: "" },
  phone:         { type: String, default: "" },
  bio:           { type: String, default: "" },
  notifications: {
    email:       { type: Boolean, default: true },
    assignments: { type: Boolean, default: true },
    submissions: { type: Boolean, default: true },
    reports:     { type: Boolean, default: false },
  },
}, { timestamps: true })

module.exports = mongoose.model("User", userSchema)
