/**
 * Request authentication for this service.
 *
 *   verifyJwt        user-facing routes: checks the login token's signature (no database lookup)
 *   requireInternal  /internal/* routes: only other WorkLens services may call them (shared key)
 *
 * The internal key is derived from JWT_SECRET, so there is nothing extra to configure:
 * every service that already shares JWT_SECRET can compute the same key.
 */
const jwt = require("jsonwebtoken")
const crypto = require("crypto")

const SECRET = process.env.JWT_SECRET
if (!SECRET) {
  console.error("❌ JWT_SECRET is required (use the same value as backend/.env and gateway/.env)")
  process.exit(1)
}

const INTERNAL_KEY = crypto.createHmac("sha256", SECRET).update("worklens-internal").digest("hex")

function verifyJwt(req, res, next) {
  const [scheme, token] = (req.headers.authorization || "").split(" ")
  if (scheme !== "Bearer" || !token) return res.status(401).json({ success: false, message: "Authentication required" })
  try {
    const p = jwt.verify(token, SECRET)
    req.auth = { id: String(p.sub), role: p.role, dept: p.dept || "" }
    next()
  } catch (e) {
    res.status(401).json({ success: false, message: e.name === "TokenExpiredError" ? "Session expired, please log in again" : "Invalid token" })
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

module.exports = { verifyJwt, requireInternal, INTERNAL_KEY }
