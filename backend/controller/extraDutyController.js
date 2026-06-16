const ExtraDuty = require("../models/ExtraDuty");

// ➤ CREATE duty
exports.createDuty = async (req, res) => {
  try {
    const duty = await ExtraDuty.create(req.body);
    res.status(201).json(duty);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ➤ GET all duties
exports.getAllDuties = async (req, res) => {
  try {
    const duties = await ExtraDuty.find();
    res.json(duties);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ➤ GET one duty
exports.getDutyById = async (req, res) => {
  try {
    const duty = await ExtraDuty.findById(req.params.id);
    res.json(duty);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ➤ UPDATE duty
exports.updateDuty = async (req, res) => {
  try {
    const duty = await ExtraDuty.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(duty);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ➤ DELETE duty
exports.deleteDuty = async (req, res) => {
  try {
    await ExtraDuty.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};