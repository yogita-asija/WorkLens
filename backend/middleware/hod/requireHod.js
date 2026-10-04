const User = require("../../models/User")

/**
 * Middleware: require a logged-in HOD.
 * Reads userId from header `x-user-id` (same pattern as requireAuth).
 * Sets req.user and req.dept (the HOD's department name).
 */
async function requireHod(req, res, next) {
  const userId = req.headers["x-user-id"]
  if (!userId) {
    return res.status(401).json({ success: false, message: "Authentication required" })
  }
  try {
    const user = await User.findById(userId).select("-password")
    if (!user) return res.status(401).json({ success: false, message: "User not found" })
    if (user.role !== "hod") {
      return res.status(403).json({ success: false, message: "HOD access only" })
    }
    req.user = user
    req.dept = (user.department || "").trim()
    next()
  } catch {
    return res.status(401).json({ success: false, message: "Invalid user credentials" })
  }
}

module.exports = requireHod
