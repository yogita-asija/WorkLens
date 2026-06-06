<<<<<<< HEAD
// const express = require("express")
// const router  = express.Router()
// const { getAnalytics } = require("../controller/analyticsController")

// router.get("/", getAnalytics)

// module.exports = router
=======
const express = require("express")
const router  = express.Router()
const { getAnalytics } = require("../controller/analyticsController")

router.get("/", getAnalytics)

module.exports = router
>>>>>>> 09f24e068a6d5e720349f39069d3dab7860edc3b
