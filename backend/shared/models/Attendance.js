const mongoose = require("mongoose")

const AttendanceSchema = new mongoose.Schema({

  courseId:   String,   // example: "CS401"
  courseName: String,   // example: "CS401 — Advanced Algorithms"
  date:       String,   // example: "2026-03-29"
  topic:      String, 

  students: [
    {
      id:     String,   // example: "CS2021001"
      name:   String,   // example: "Alice Johnson"
      status: String,   // "present" or "absent" or "late"
      notes:  String,   // example: "Medical leave" or ""
    }
  ]

}, { timestamps: true })

module.exports = mongoose.model("Attendance", AttendanceSchema)
