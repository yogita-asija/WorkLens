const express = require("express")
const router  = express.Router()

const {
  getMyScholarships,
  getSummary,
  applyScholarship,
  withdrawScholarship,
} = require("../controller/scholarshipController")

// ── Faculty-facing scholarship nominations ────────────────────────────────────
router.get("/",            getMyScholarships)   // GET    /api/scholarships?facultyId=
router.get("/summary",     getSummary)          // GET    /api/scholarships/summary?facultyId=
router.post("/",           applyScholarship)    // POST   /api/scholarships
router.delete("/:id",      withdrawScholarship) // DELETE /api/scholarships/:id

module.exports = router
