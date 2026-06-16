const express = require("express")
const router  = express.Router()
const ctrl    = require("../controller/lessonPlanController")

router.get("/stats",    ctrl.getLessonPlanStats)
router.get("/calendar", ctrl.getCalendarData)
router.get("/",         ctrl.getLessonPlans)
router.get("/:id",      ctrl.getLessonPlanById)
router.post("/",        ctrl.createLessonPlan)
router.put("/:id",      ctrl.updateLessonPlan)
router.patch("/:id/complete", ctrl.markPlanComplete)
router.delete("/:id",   ctrl.deleteLessonPlan)

module.exports = router
