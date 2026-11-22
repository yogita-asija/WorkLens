const ActivityLog = require("../models/ActivityLog")

/**
 * Reusable activity logger — call this after any successful action.
 * Never crashes the main request if logging fails.
 */
async function logActivity({ type, title, subject, course, detail }) {
  try {
    await ActivityLog.create({
      type,
      title,
      subject,
      course,
      detail,
      timestamp: new Date(),
    })
  } catch (err) {
    console.error("logActivity failed (non-critical):", err.message)
  }
}

module.exports = logActivity
