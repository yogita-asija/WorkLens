const express     = require("express")
const router      = express.Router()
const { authenticate: requireAuth } = require("../middleware/auth")
const { submitWorkflowFeedback } = require("../controller/dashboardController")

router.post("/feedback", requireAuth, submitWorkflowFeedback)   // POST /api/workflow/feedback

module.exports = router