const mongoose = require("mongoose");

// Faculty / profile info
const FacultySchema = new mongoose.Schema({
  name:           String,   // "Dr. Sarah Chen"
  title:          String,   // "Associate Professor"
  department:     String,   // "Computer Science"
  employeeId:     String,   // "FAC-2019-042"
  email:          String,
  phone:          String,
  office:         String,
  joinDate:       String,
  qualification:  String,
  specialization: String,
  experience:     String,
  initials:       String,   // "SC"
}, { timestamps: true });

module.exports = mongoose.model("Faculty", FacultySchema);
