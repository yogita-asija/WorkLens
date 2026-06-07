const mongoose = require("mongoose")

const SystemSettingsSchema = new mongoose.Schema({
  key:   { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  group: { type: String, default: "general" }, // "general" | "email" | "academic" | "notification"
}, { timestamps: true })

module.exports = mongoose.model("SystemSettings", SystemSettingsSchema)
