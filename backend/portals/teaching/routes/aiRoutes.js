const express = require("express")
const router  = express.Router()
const ctrl    = require("../controller/aiController")

router.post("/generate-lesson-plan", ctrl.generateLessonPlan)

module.exports = router
