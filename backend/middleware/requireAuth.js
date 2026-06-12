const User = require("../models/User")

/**
 * Middleware: require a logged-in faculty user.
 * Reads userId from header: x-user-id  (set by the frontend from useAppStore user._id)
 * Same pattern as the existing requireAdmin middleware.
 */
async function requireAuth(req, res, next) {
  const userId = req.headers["x-user-id"]

  if (!userId) {
    return res.status(401).json({ success: false, message: "Authentication required" })
  }

  try {
    const user = await User.findById(userId).select("-password")
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" })
    }
    req.user = user
    next()
  } catch {
    return res.status(401).json({ success: false, message: "Invalid user credentials" })
  }
}

module.exports = requireAuth
