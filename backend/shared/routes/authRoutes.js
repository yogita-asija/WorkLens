const express = require("express")
const router  = express.Router()
const { loginUser, me } = require("../controller/authController")
const { authenticate } = require("../middleware/auth")

router.post("/login", loginUser)
router.get("/me", authenticate, me)

module.exports = router
