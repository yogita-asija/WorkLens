const express    = require("express")
const router     = express.Router()
const requireHod = require("../../middleware/hod/requireHod")
const c          = require("../../controller/HOD/hodController")
const duty       = require("../../controller/HOD/dutyAllocationController")
const wf         = require("../../controller/HOD/workflowInsightsController")

router.use(requireHod) // every /api/hod/* route is HOD-only

router.get("/dashboard",               c.getDashboard)

router.get("/leaves/pending",          c.getPendingLeaves)
router.patch("/leaves/:id",            c.reviewLeave)

router.get("/availability",            c.getAvailability)
router.post("/availability/status",    c.setFacultyStatus)

router.get("/substitutions",           c.getSubstitutions)
router.post("/substitutions",          c.assignSubstitute)
router.delete("/substitutions/:id",    c.removeSubstitution)

router.get("/conflicts",               c.getConflicts)
router.patch("/conflicts/resolve",     c.resolveConflict)

router.get("/faculty",                 c.getFaculty)
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

router.get("/workflow-insights",                       wf.getInsights)
router.post("/workflow-insights/actions",              wf.createAction)
router.patch("/workflow-insights/actions/:id/resolve", wf.resolveAction)
router.delete("/workflow-insights/actions/:id",        wf.deleteAction)

module.exports = router
