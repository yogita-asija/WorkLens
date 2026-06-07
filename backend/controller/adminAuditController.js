const AuditLog = require("../models/AuditLog")

// ─── GET /api/admin/audit-logs ────────────────────────────────────────────────
exports.getAuditLogs = async (req, res) => {
  try {
    const { adminId, module, action, from, to, page = 1, limit = 30 } = req.query

    const filter = {}
    if (adminId) filter.adminId = adminId
    if (module)  filter.module  = module
    if (action)  filter.action  = action
    if (from || to) {
      filter.timestamp = {}
      if (from) filter.timestamp.$gte = new Date(from)
      if (to)   filter.timestamp.$lte = new Date(to)
    }

    const skip  = (Number(page) - 1) * Number(limit)
    const total = await AuditLog.countDocuments(filter)
    const logs  = await AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean()

    res.json({ success: true, data: logs, total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}
