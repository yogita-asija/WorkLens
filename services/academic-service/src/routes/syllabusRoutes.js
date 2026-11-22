const express = require("express")
const router  = express.Router()
const ctrl    = require("../controller/syllabusController")

router.get("/",                        ctrl.getAllSyllabus)
router.get("/:courseId",               ctrl.getSyllabusByCourse)
router.post("/",                       ctrl.createSyllabus)
router.put("/:courseId",               ctrl.updateSyllabus)
router.patch("/:courseId/topic",       ctrl.updateTopic)
router.delete("/:courseId",            ctrl.deleteSyllabus)

module.exports = router
