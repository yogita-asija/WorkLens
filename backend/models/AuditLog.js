const mongoose = require("mongoose")

const AuditLogSchema = new mongoose.Schema({
  adminId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  adminName:  { type: String, required: true },
  action:     { type: String, required: true },   // "CREATE_USER", "DELETE_COURSE", etc.
  module:     { type: String, required: true },   // "teacher", "course", "department", "leave"
  targetId:   { type: String, default: "" },      // ID of the affected resource
  targetName: { type: String, default: "" },
  detail:     { type: String, default: "" },      // human-readable detail
  ip:         { type: String, default: "" },
  timestamp:  { type: Date, default: Date.now },
}, { timestamps: true })

AuditLogSchema.index({ adminId: 1, timestamp: -1 })
AuditLogSchema.index({ module: 1, timestamp: -1 })

module.exports = mongoose.model("AuditLog", AuditLogSchema)
