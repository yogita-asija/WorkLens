const express = require("express")
const router  = express.Router()
const ctrl    = require("../controller/notificationController")

router.get("/",           ctrl.getNotifications)
router.post("/",          ctrl.createNotification)
router.patch("/read-all", ctrl.markAllRead)
router.patch("/:id/read", ctrl.markRead)
router.delete("/:id",     ctrl.deleteNotification)

module.exports = router
