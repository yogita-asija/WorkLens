const express = require("express")
const router  = express.Router()
const ctrl    = require("../controller/courseController")

router.get("/",                          ctrl.getCourses)
router.post("/",                         ctrl.createCourse)
router.get("/:id/students",             ctrl.getCourseStudents)
router.get("/:id/analytics",            ctrl.getCourseAnalytics)
router.get("/:id",                       ctrl.getCourseById)
router.put("/:id",                       ctrl.updateCourse)
router.delete("/:id",                    ctrl.deleteCourse)
router.post("/:id/enroll",              ctrl.enrollStudents)
router.delete("/:id/enroll/:studentId", ctrl.unenrollStudent)

module.exports = router
