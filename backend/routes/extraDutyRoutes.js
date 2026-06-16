const express = require("express");
const router = express.Router();

const extraDutyController = require("../controller/extraDutyController");

// CREATE
router.post("/", extraDutyController.createDuty);

// GET ALL
router.get("/", extraDutyController.getAllDuties);

// GET ONE
router.get("/:id", extraDutyController.getDutyById);

// UPDATE
router.put("/:id", extraDutyController.updateDuty);

// DELETE
router.delete("/:id", extraDutyController.deleteDuty);

module.exports = router;