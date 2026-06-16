const express = require("express")
const router  = express.Router()
const ctrl    = require("../controller/timetableController")

router.get("/", ctrl.getTimetable)   // GET /api/timetable

module.exports = router
