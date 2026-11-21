/**
 * Checks the login token's signature (no database). Without this anyone who could reach the service
 * could spend your Gemini quota, so it is mandatory.
 */
const jwt = require("jsonwebtoken")

const SECRET = process.env.JWT_SECRET
if (!SECRET) {
  console.error("❌ JWT_SECRET is required (use the same value as backend/.env and gateway/.env)")
  process.exit(1)
}

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

module.exports = { verifyJwt }
