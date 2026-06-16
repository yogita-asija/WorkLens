const express = require("express")
const router  = express.Router()
const ctrl    = require("../controller/internalMarkController")

router.get("/students",        ctrl.getTeacherStudents)
router.get("/:studentId",      ctrl.getStudentMarks)
router.post("/",               ctrl.addMark)
router.put("/:id",             ctrl.updateMark)
router.delete("/:id",          ctrl.deleteMark)

module.exports = router
