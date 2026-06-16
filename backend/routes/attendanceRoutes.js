const express = require("express")
const router  = express.Router()

const {
  getAllAttendance,
  getAttendanceByDate,
  saveAttendance,
  deleteAttendance,
  exportAttendanceCSV,
  getStudentHistory,
  getAttendanceRoster,
} = require("../controller/attendanceController")


router.get("/",                          getAllAttendance)      // GET  /attendance
router.get("/student/:studentId",        getStudentHistory)    // GET  /attendance/student/CS2021001
router.get("/:courseId/:date/export",    exportAttendanceCSV)  // GET  /attendance/CS401/2026-03-29/export
router.get("/roster/:courseId",          getAttendanceRoster)     // GET  /attendance/roster/CS401
router.get("/:courseId/:date",           getAttendanceByDate)  // GET  /attendance/CS401/2026-03-29
router.post("/",                         saveAttendance)       // POST /attendance
router.delete("/:id",                    deleteAttendance)     // DELETE /attendance/:id



module.exports = router
