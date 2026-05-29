const express = require("express")
const router  = express.Router()

const {
  submitWorkflowFeedback,
  getAllWorkflowFeedback,
} = require("../controller/dashboardController")


router.post("/feedback", submitWorkflowFeedback)  // POST /api/workflow/feedback
router.get("/feedback",  getAllWorkflowFeedback)   // GET  /api/workflow/feedback


module.exports = router
