const express = require("express")
const router  = express.Router()
const ctrl    = require("../controller/studyMaterialController")

router.get("/stats",  ctrl.getMaterialStats)
router.get("/",       ctrl.getMaterials)
router.get("/:id",    ctrl.getMaterialById)
router.post("/",      ctrl.createMaterial)
router.put("/:id",    ctrl.updateMaterial)
router.delete("/:id", ctrl.deleteMaterial)

module.exports = router
