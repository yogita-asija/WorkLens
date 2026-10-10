const express     = require("express")
const router      = express.Router()
const requireAuth = require("../middleware/requireAuth")
const { submitWorkflowFeedback } = require("../controller/dashboardController")

router.post("/feedback", requireAuth, submitWorkflowFeedback)   // POST /api/workflow/feedback

module.exports = router