const express = require("express")
const router  = express.Router()
const ctrl    = require("../controller/assignmentController")

router.get("/analytics",              ctrl.getAnalytics)
router.get("/",                       ctrl.getAllAssignments)
router.post("/",                      ctrl.createAssignment)
router.get("/course/:courseId",       ctrl.getAssignmentsByCourse)
router.get("/:id",                    ctrl.getAssignmentById)
router.put("/:id",                    ctrl.updateAssignment)
router.delete("/:id",                 ctrl.deleteAssignment)
router.post("/:id/submit",            ctrl.submitAssignment)
router.put("/:id/grade/:submissionId", ctrl.gradeSubmission)

module.exports = router
