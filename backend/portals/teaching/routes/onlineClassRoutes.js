const express = require("express")
const router  = express.Router()
const ctrl    = require("../controller/onlineClassController")

router.get("/stats",    ctrl.getStats)
router.get("/",         ctrl.getAll)
router.get("/:id",      ctrl.getById)
router.post("/",        ctrl.create)
router.put("/:id",      ctrl.update)
router.patch("/:id/status", ctrl.updateStatus)
router.delete("/:id",   ctrl.remove)

module.exports = router
