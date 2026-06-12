const express      = require("express")
const router       = express.Router()
const requireAuth  = require("../middleware/requireAuth")

const {
  getLeaves,
  getBalance,
  getMonthlyStats,
  applyLeave,
  updateLeaveStatus,
  deleteLeave,
  getHolidays,
} = require("../controller/leaveController")

// ── Leave applications (requireAuth: reads x-user-id header) ─────────────────
router.get("/",             requireAuth, getLeaves)          // GET    /api/leaves
router.post("/",            requireAuth, applyLeave)         // POST   /api/leaves
router.patch("/:id/status", updateLeaveStatus)               // PATCH  /api/leaves/:id/status  (admin action — no faculty auth needed)
router.delete("/:id",       requireAuth, deleteLeave)        // DELETE /api/leaves/:id

// ── Stats (requireAuth) ──────────────────────────────────────────────────────
router.get("/balance",      requireAuth, getBalance)         // GET    /api/leaves/balance
router.get("/monthly",      requireAuth, getMonthlyStats)    // GET    /api/leaves/monthly

// ── Holiday calendar (public — same for all users) ───────────────────────────
router.get("/holidays",     getHolidays)                     // GET    /api/leaves/holidays

module.exports = router
