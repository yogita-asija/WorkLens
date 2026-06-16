const mongoose = require("mongoose")

const DepartmentSchema = new mongoose.Schema({
  name:        { type: String, required: true, unique: true },
  code:        { type: String, required: true, unique: true }, // e.g. "CS", "ECE"
  description: { type: String, default: "" },
  hod: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name:   { type: String, default: "" },
  },
  totalTeachers: { type: Number, default: 0 },
  totalCourses:  { type: Number, default: 0 },
  status: { type: String, enum: ["active", "inactive"], default: "active" },
}, { timestamps: true })

module.exports = mongoose.model("Department", DepartmentSchema)
