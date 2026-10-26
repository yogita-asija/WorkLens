const express = require("express")
const router  = express.Router()
const { requireRole } = require("../middleware/auth")
const c = require("../controller/facultyProfileController")

// Teaching staff maintain their own academic profile (used by HOD → Course Allocation)
router.use(requireRole("teaching"))
router.get("/me", c.getMine)
router.put("/me", c.saveMine)

module.exports = router
