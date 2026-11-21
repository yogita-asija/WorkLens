/**
 * Tokens and request authentication.
 *
 *   signToken(user)   login token. Payload { sub, role, dept }: `dept` is new, so other services and the
 *                     gateway can know the user's department without a database lookup.
 *   authenticate      user-facing routes: verifies the token, then loads the user (so a deleted user is rejected)
 *   requireInternal   /internal/* routes: only other WorkLens services may call them (shared key)
 *
 * The internal key is derived from JWT_SECRET, so there is nothing extra to configure.
 */
const jwt = require("jsonwebtoken")
const crypto = require("crypto")
const User = require("./models/User")

const SECRET = process.env.JWT_SECRET
if (!SECRET) {
  console.error("❌ JWT_SECRET is required (use the same value as backend/.env and gateway/.env)")
  process.exit(1)
}
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h"
const INTERNAL_KEY = crypto.createHmac("sha256", SECRET).update("worklens-internal").digest("hex")

const signToken = (user) =>
  jwt.sign({ sub: String(user._id), role: user.role, dept: user.department || "" }, SECRET, { expiresIn: EXPIRES_IN })

async function authenticate(req, res, next) {
  const [scheme, token] = (req.headers.authorization || "").split(" ")
  if (scheme !== "Bearer" || !token) return res.status(401).json({ success: false, message: "Authentication required" })
  let payload
  try { payload = jwt.verify(token, SECRET) }
  catch (e) {
    return res.status(401).json({ success: false, message: e.name === "TokenExpiredError" ? "Session expired, please log in again" : "Invalid token" })
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

function requireInternal(req, res, next) {
  const given = Buffer.from(String(req.headers["x-internal-key"] || ""))
  const want = Buffer.from(INTERNAL_KEY)
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
    return res.status(403).json({ success: false, message: "Forbidden" })
  }
  next()
}

module.exports = { signToken, authenticate, requireInternal }
