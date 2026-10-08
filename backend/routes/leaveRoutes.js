const express      = require("express")
const router       = express.Router()
const requireAuth  = require("../middleware/requireAuth")
const requireHod   = require("../middleware/hod/requireHod")

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
router.patch("/:id/status", requireHod, updateLeaveStatus)   // PATCH  /api/leaves/:id/status  (HOD only — this used to be completely unauthenticated)
router.delete("/:id",       requireAuth, deleteLeave)        // DELETE /api/leaves/:id

// ── Stats (requireAuth) ──────────────────────────────────────────────────────
router.get("/balance",      requireAuth, getBalance)         // GET    /api/leaves/balance
router.get("/monthly",      requireAuth, getMonthlyStats)    // GET    /api/leaves/monthly

// ── Holiday calendar (public — same for all users) ───────────────────────────
router.get("/holidays",     getHolidays)                     // GET    /api/leaves/holidays

module.exports = router