const AuditLog = require("../models/AuditLog")

/**
 * Log an admin action to the audit trail.
 * Never throws — non-critical, fire-and-forget.
 */
async function logAudit({ adminId, adminName, action, module, targetId = "", targetName = "", detail = "", ip = "" }) {
  try {
    await AuditLog.create({ adminId, adminName, action, module, targetId, targetName, detail, ip, timestamp: new Date() })
  } catch (err) {
    console.error("logAudit failed (non-critical):", err.message)
  }
}

module.exports = logAudit
