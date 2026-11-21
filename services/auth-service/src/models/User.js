const mongoose = require("mongoose")

// Identical to backend/shared/models/User.js (same `users` collection, see README: shared during the transition).
const userSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ["teaching", "non-teaching", "admin", "hod"],
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
