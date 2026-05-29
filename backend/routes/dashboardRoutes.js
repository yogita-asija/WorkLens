const express = require("express")
const router  = express.Router()

const {
  getStats,
  getToday,
  getWeeklyActivity,
  getHours,
  getRecentActivity,
  getCourses,
} = require("../controller/dashboardController")


router.get("/stats",           getStats)          // GET /api/dashboard/stats
router.get("/today",           getToday)          // GET /api/dashboard/today
router.get("/weekly-activity", getWeeklyActivity) // GET /api/dashboard/weekly-activity
router.get("/hours",           getHours)          // GET /api/dashboard/hours
router.get("/recent-activity", getRecentActivity) // GET /api/dashboard/recent-activity
router.get("/courses",         getCourses)        // GET /api/dashboard/courses


module.exports = router
