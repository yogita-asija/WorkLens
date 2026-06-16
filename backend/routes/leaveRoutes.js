const express = require("express")
const router  = express.Router()

const {
  getLeaves,
  getBalance,
  getMonthlyStats,
  applyLeave,
  updateLeaveStatus,
  deleteLeave,
  getHolidays,
} = require("../controller/leaveController")

// ── Leave applications ───────────────────────────────────────────────────────
router.get("/",             getLeaves)          // GET    /api/leaves
router.post("/",            applyLeave)         // POST   /api/leaves
router.patch("/:id/status", updateLeaveStatus)  // PATCH  /api/leaves/:id/status
router.delete("/:id",       deleteLeave)        // DELETE /api/leaves/:id

// ── Stats ────────────────────────────────────────────────────────────────────
router.get("/balance",      getBalance)         // GET    /api/leaves/balance
router.get("/monthly",      getMonthlyStats)    // GET    /api/leaves/monthly

// ── Holiday calendar ─────────────────────────────────────────────────────────
router.get("/holidays",     getHolidays)        // GET    /api/leaves/holidays

module.exports = router
