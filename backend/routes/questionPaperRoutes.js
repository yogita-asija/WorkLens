const express = require("express")
const router  = express.Router()
const ctrl    = require("../controller/questionPaperController")

router.get("/stats",     ctrl.getStats)
router.get("/",          ctrl.getAllPapers)
router.post("/",         ctrl.createPaper)
router.get("/:id",       ctrl.getPaperById)
router.put("/:id",       ctrl.updatePaper)
router.delete("/:id",    ctrl.deletePaper)
router.patch("/:id/publish", ctrl.publishPaper)

module.exports = router
