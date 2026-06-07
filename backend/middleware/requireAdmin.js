const User = require("../models/User")

/**
 * Middleware: require the request to be from an admin.
 * Reads userId from query, body, or header: x-admin-id
 * For production: replace with JWT verification.
 */
async function requireAdmin(req, res, next) {
  const adminId =
    req.headers["x-admin-id"] ||
    req.query.adminId ||
    req.body?.adminId

  if (!adminId) {
    return res.status(401).json({ success: false, message: "Admin authentication required" })
  }

  try {
    const admin = await User.findById(adminId).select("-password")
    if (!admin || admin.role !== "admin") {
      return res.status(403).json({ success: false, message: "Insufficient permissions" })
    }
    req.admin = admin
    next()
  } catch {
    return res.status(401).json({ success: false, message: "Invalid admin credentials" })
  }
}

module.exports = requireAdmin
