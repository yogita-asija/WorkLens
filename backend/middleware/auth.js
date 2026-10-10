/**
 * JWT authentication (replaces the old forgeable `x-user-id` header).
 *
 *   signToken(user)   -> string   (used by POST /api/auth/login)
 *   authenticate      -> express middleware: needs `Authorization: Bearer <token>`,
 *                        loads the user from the DB and sets req.user
 *   requireRole(...r) -> express middleware factory (run after authenticate)
 *
 * Set JWT_SECRET in backend/.env (long random string). In production the server refuses to start without it.
 */
const jwt  = require("jsonwebtoken")
const crypto = require("crypto")
const User = require("../models/User")

let SECRET = process.env.JWT_SECRET
if (!SECRET) {
  if (process.env.NODE_ENV === "production") throw new Error("JWT_SECRET must be set in production")
  SECRET = crypto.randomBytes(48).toString("hex")
  console.warn("⚠️  JWT_SECRET not set – using a temporary one. Everyone is logged out whenever the server restarts. Add JWT_SECRET to backend/.env")
}
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h"

const signToken = (user) => jwt.sign({ sub: String(user._id), role: user.role }, SECRET, { expiresIn: EXPIRES_IN })

async function authenticate(req, res, next) {
  const header = req.headers.authorization || ""
  const [scheme, token] = header.split(" ")
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ success: false, message: "Authentication required" })
  }
  let payload
  try { payload = jwt.verify(token, SECRET) }
  catch (e) {
    const expired = e.name === "TokenExpiredError"
    return res.status(401).json({ success: false, message: expired ? "Session expired, please log in again" : "Invalid token" })
  }
  try {
    const user = await User.findById(payload.sub).select("-password")
    if (!user) return res.status(401).json({ success: false, message: "User not found" })
    req.user = user
    next()
  } catch {
    return res.status(401).json({ success: false, message: "Invalid credentials" })
  }
}

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: "You do not have access to this" })
  }
  next()
}

module.exports = { signToken, authenticate, requireRole }
