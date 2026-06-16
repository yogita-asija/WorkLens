const express    = require("express")
const router     = express.Router()
const requireAdmin = require("../middleware/requireAdmin")

const dashCtrl   = require("../controller/adminDashboardController")
const teachCtrl  = require("../controller/adminTeacherController")
const deptCtrl   = require("../controller/adminDepartmentController")
const courseCtrl = require("../controller/adminCourseController")
const leaveCtrl  = require("../controller/adminLeaveController")
const commCtrl   = require("../controller/adminCommunicationController")
const reportCtrl = require("../controller/adminReportController")
const settCtrl   = require("../controller/adminSettingsController")
const auditCtrl  = require("../controller/adminAuditController")
const studCtrl   = require("../controller/adminStudentController")
const progCtrl   = require("../controller/adminProgramController")

// All admin routes require admin authentication
router.use(requireAdmin)

// ── Dashboard ─────────────────────────────────────────────────────────────────
router.get("/dashboard/stats",           dashCtrl.getStats)
router.get("/dashboard/charts",          dashCtrl.getCharts)
router.get("/dashboard/recent-activity", dashCtrl.getRecentActivity)

// ── Teacher Management ────────────────────────────────────────────────────────
router.get("/teachers",                           teachCtrl.getTeachers)
router.get("/teachers/:id",                       teachCtrl.getTeacherById)
router.post("/teachers",                          teachCtrl.createTeacher)
router.put("/teachers/:id",                       teachCtrl.updateTeacher)
router.delete("/teachers/:id",                    teachCtrl.deleteTeacher)
router.patch("/teachers/:id/reset-password",      teachCtrl.resetPassword)
router.patch("/teachers/:id/assign-department",   teachCtrl.assignDepartment)

// ── Department Management ─────────────────────────────────────────────────────
router.get("/departments",           deptCtrl.getDepartments)
router.get("/departments/:id",       deptCtrl.getDepartmentById)
router.post("/departments",          deptCtrl.createDepartment)
router.put("/departments/:id",       deptCtrl.updateDepartment)
router.delete("/departments/:id",    deptCtrl.deleteDepartment)
router.patch("/departments/:id/hod", deptCtrl.assignHOD)

// ── Course Management ─────────────────────────────────────────────────────────
router.get("/courses/stats",                    courseCtrl.getCourseStats)
router.get("/courses",                          courseCtrl.getCourses)
router.post("/courses",                         courseCtrl.createCourse)
router.put("/courses/:id",                      courseCtrl.updateCourse)
router.delete("/courses/:id",                   courseCtrl.deleteCourse)
router.patch("/courses/:id/assign-teacher",     courseCtrl.assignTeacher)

// ── Leave Management ──────────────────────────────────────────────────────────
router.get("/leaves",              leaveCtrl.getAllLeaves)
router.get("/leaves/summary",      leaveCtrl.getLeaveSummary)
router.patch("/leaves/:id/status", leaveCtrl.updateLeaveStatus)

// ── Communications ────────────────────────────────────────────────────────────
router.post("/communications/send",        commCtrl.sendNotification)
router.get("/communications/history",      commCtrl.getHistory)
router.get("/communications/recipients",   commCtrl.getRecipients)

// ── Reports ───────────────────────────────────────────────────────────────────
router.get("/reports/attendance",          reportCtrl.getAttendanceReport)
router.get("/reports/leaves",              reportCtrl.getLeaveReport)
router.get("/reports/teacher-performance", reportCtrl.getTeacherPerformance)

// ── System Settings ───────────────────────────────────────────────────────────
router.get("/settings",  settCtrl.getSettings)
router.put("/settings",  settCtrl.updateSettings)

// ── Audit Logs ────────────────────────────────────────────────────────────────
router.get("/audit-logs", auditCtrl.getAuditLogs)

// ── Student Management ────────────────────────────────────────────────────────
router.get("/students",                            studCtrl.getStudents)
router.get("/students/:id",                        studCtrl.getStudentById)
router.post("/students",                           studCtrl.createStudent)
router.put("/students/:id",                        studCtrl.updateStudent)
router.delete("/students/:id",                     studCtrl.deleteStudent)
router.patch("/students/:id/reset-password",       studCtrl.resetPassword)
router.patch("/students/:id/assign-semester",      studCtrl.assignSemester)
router.patch("/students/:id/change-status",        studCtrl.changeStatus)


// ── Program Management ────────────────────────────────────────────────────────
router.get("/programs/stats",                   progCtrl.getProgramStats)
router.get("/programs",                         progCtrl.getPrograms)
router.get("/programs/:id",                     progCtrl.getProgramById)
router.post("/programs",                        progCtrl.createProgram)
router.put("/programs/:id",                     progCtrl.updateProgram)
router.delete("/programs/:id",                  progCtrl.deleteProgram)
router.patch("/programs/:id/link-course",       progCtrl.linkCourse)
router.patch("/programs/:id/unlink-course",     progCtrl.unlinkCourse)



// ── Timetable ─────────────────────────────────────────────────────────────────
const ttCtrl = require("../controller/adminTimetableController")
router.get("/timetable/semesters", ttCtrl.getSemesters)
router.get("/timetable",           ttCtrl.getTimetable)
router.post("/timetable",          ttCtrl.addSlot)
router.put("/timetable/:id",       ttCtrl.updateSlot)
router.delete("/timetable/:id",    ttCtrl.deleteSlot)
 
module.exports = router
// ── Scholarship Management ────────────────────────────────────────────────────
const scholCtrl = require("../controller/adminScholarshipController")
router.get("/scholarships/summary",       scholCtrl.getScholarshipSummary)
router.get("/scholarships",               scholCtrl.getScholarships)
router.post("/scholarships",              scholCtrl.createScholarship)
router.patch("/scholarships/:id/status",  scholCtrl.updateScholarshipStatus)
router.delete("/scholarships/:id",        scholCtrl.deleteScholarship)

// ── Admissions Management ─────────────────────────────────────────────────────
const admCtrl = require("../controller/adminAdmissionController")
router.get("/admissions/stats",          admCtrl.getAdmissionStats)
router.get("/admissions",                admCtrl.getAdmissions)
router.get("/admissions/:id",            admCtrl.getAdmissionById)
router.post("/admissions",               admCtrl.createAdmission)
router.put("/admissions/:id",            admCtrl.updateAdmission)
router.patch("/admissions/:id/status",   admCtrl.updateStatus)
router.delete("/admissions/:id",         admCtrl.deleteAdmission)

// ── Document Verification (via admissions) ────────────────────────────────────
router.get("/documents/stats",                admCtrl.getDocumentStats)
router.get("/documents",                      admCtrl.getDocumentQueue)
router.patch("/admissions/:id/document",      admCtrl.updateDocument)
router.post("/admissions/:id/note",           admCtrl.addTimelineNote)
router.post("/admissions/:id/documents",      admCtrl.addDocumentToChecklist)
router.patch("/admissions/:id/offer-letter",  admCtrl.sendOfferLetter)
router.post("/admissions/:id/convert",        admCtrl.convertToStudent)
