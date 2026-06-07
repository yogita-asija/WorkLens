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

module.exports = router
