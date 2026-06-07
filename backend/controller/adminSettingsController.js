const SystemSettings = require("../models/SystemSettings")
const logAudit       = require("../utils/logAudit")

const DEFAULT_SETTINGS = [
  { key: "university_name",    value: "WorkLens University",       group: "general" },
  { key: "university_email",   value: "admin@worklens.edu",        group: "general" },
  { key: "university_phone",   value: "+91-9876543200",            group: "general" },
  { key: "university_address", value: "123 University Road, Delhi",group: "general" },
  { key: "academic_year",      value: "2025-2026",                 group: "academic" },
  { key: "current_semester",   value: "Even",                      group: "academic" },
  { key: "max_leave_days",     value: 12,                          group: "academic" },
  { key: "email_notifications",value: true,                        group: "notification" },
  { key: "leave_auto_approve", value: false,                       group: "notification" },
]

// ─── GET /api/admin/settings ──────────────────────────────────────────────────
exports.getSettings = async (req, res) => {
  try {
    // Ensure defaults exist
    for (const s of DEFAULT_SETTINGS) {
      await SystemSettings.findOneAndUpdate(
        { key: s.key },
        { $setOnInsert: { value: s.value, group: s.group } },
        { upsert: true, new: false }
      )
    }

    const settings = await SystemSettings.find().lean()
    // Convert to flat object
    const flat = {}
    settings.forEach(s => { flat[s.key] = s.value })

    res.json({ success: true, data: flat })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── PUT /api/admin/settings ──────────────────────────────────────────────────
exports.updateSettings = async (req, res) => {
  try {
    const updates = req.body // { key: value, ... }

    await Promise.all(
      Object.entries(updates).map(([key, value]) =>
        SystemSettings.findOneAndUpdate({ key }, { value }, { upsert: true })
      )
    )

    await logAudit({
      adminId: req.admin._id, adminName: req.admin.name,
      action: "UPDATE_SETTINGS", module: "settings",
      detail: `Updated system settings: ${Object.keys(updates).join(", ")}`,
      ip: req.ip,
    })

    res.json({ success: true, message: "Settings saved successfully" })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}
