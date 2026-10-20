const express    = require("express")
const router     = express.Router()
// NOTE: every folder name is lowercase, so these requires resolve the same on macOS, Windows and Linux hosts.
const requireHod = require("../../../shared/middleware/requireHod")
const c          = require("../controller/hodController")
const duty       = require("../controller/dutyAllocationController")
const courseAlloc = require("../controller/courseAllocationController")
const wf         = require("../controller/workflowInsightsController")
const leave      = require("../controller/hodLeaveController")
const workload   = require("../controller/hodWorkloadController")
const report     = require("../controller/hodReportController")

router.use(requireHod) // every /api/hod/* route is HOD-only

router.get("/dashboard",               c.getDashboard)

// ── Leave management ─────────────────────────────────────────────────────────
// Fixed paths first, then the ones with an :id.
router.get("/leaves/pending",          c.getPendingLeaves)
router.get("/leaves/overview",         leave.getOverview)
router.get("/leaves/history",          leave.getHistory)
router.get("/leaves/export",           leave.exportCsv)
router.get("/leaves/calendar",         leave.getCalendar)
router.get("/leaves/balances",         leave.getBalances)
router.get("/leaves/insights",         leave.getInsights)
router.get("/leaves/:id/impact",       leave.getImpact)
router.post("/leaves/:id/approve-with-cover", leave.approveWithCover)
router.patch("/leaves/:id",            c.reviewLeave)

router.get("/availability",            c.getAvailability)
router.post("/availability/status",    c.setFacultyStatus)

router.get("/substitutions",           c.getSubstitutions)
router.post("/substitutions",          c.assignSubstitute)
router.delete("/substitutions/:id",    c.removeSubstitution)

router.get("/conflicts",               c.getConflicts)
router.patch("/conflicts/resolve",     c.resolveConflict)

// ── Faculty + workload ───────────────────────────────────────────────────────
router.get("/faculty",                 c.getFaculty)
router.get("/faculty/workload",        workload.getWorkload)
router.get("/faculty/:id/workload",    workload.getFacultyWorkload)
router.post("/faculty/what-if",        workload.whatIf)

router.get("/tasks/overdue",           c.getOverdueTasks)
router.post("/tasks",                  c.createTask)
router.patch("/tasks/:id",             c.updateTask)
router.post("/tasks/:id/remind",       c.remindTask)

router.get("/papers/pending",          c.getPendingPapers)
router.patch("/papers/:id/review",     c.reviewPaper)

router.get("/escalations/open",        c.getOpenEscalations)
router.patch("/escalations/:id/resolve", c.resolveEscalation)

router.get("/deadlines",               c.getDeadlines)
router.post("/deadlines",              c.createDeadline)
router.patch("/deadlines/:id/complete", c.completeDeadline)
router.delete("/deadlines/:id",        c.deleteDeadline)

router.post("/duty-allocation/candidates",   duty.previewCandidates)
router.get("/duty-allocation",               duty.listDuties)
router.post("/duty-allocation",              duty.createDuty)
router.put("/duty-allocation/:id/assignees", duty.updateAssignees)
router.delete("/duty-allocation/:id",        duty.deleteDuty)

// ── Course allocation (assign courses to faculty for a semester) ─────────────
router.get("/course-allocation/courses",                    courseAlloc.listCourses)
router.get("/course-allocation/courses/:id/requirement",    courseAlloc.getRequirement)
router.put("/course-allocation/courses/:id/requirement",    courseAlloc.saveRequirement)
router.post("/course-allocation/recommendations",           courseAlloc.recommend)
router.post("/course-allocation/assign",                    courseAlloc.assign)
router.get("/course-allocation/history",                    courseAlloc.history)
router.post("/course-allocation/history/:id/cancel",        courseAlloc.cancel)
router.get("/course-allocation/settings",                   courseAlloc.getSettings)
router.put("/course-allocation/settings",                   courseAlloc.saveSettings)
router.get("/course-allocation/faculty-profiles",           courseAlloc.listProfiles)
router.post("/course-allocation/faculty-profiles/remind",   courseAlloc.remindProfiles)

// ── Reports ──
router.get("/reports/department",      report.getDepartmentReport)
router.get("/reports/snapshots",       report.listSnapshots)
router.post("/reports/snapshots",      report.createSnapshot)
router.get("/reports/snapshots/:id",   report.getSnapshot)
router.get("/reports/compare", report.compareSnapshots);


router.get("/workflow-insights",                       wf.getInsights)
router.post("/workflow-insights/actions",              wf.createAction)
router.patch("/workflow-insights/actions/:id/resolve", wf.resolveAction)
router.delete("/workflow-insights/actions/:id",        wf.deleteAction)

module.exports = router
