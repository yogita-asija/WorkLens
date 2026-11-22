const express = require("express")
const router  = express.Router()

const {
  getAllLogs,
  createLog,
  deleteLog,
  clearAllLogs,
} = require("../controller/activityLogController")

router.get("/",      getAllLogs)    // GET  /activity-logs
router.post("/",     createLog)    // POST /activity-logs
router.delete("/",   clearAllLogs) // DELETE /activity-logs  (clear all)
router.delete("/:id",deleteLog)    // DELETE /activity-logs/:id

module.exports = router
