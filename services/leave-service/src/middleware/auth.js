/**
 * Login-token authentication for this service (same behaviour and messages as the backend's middleware/auth.js).
 *
 *   authenticate   needs `Authorization: Bearer <token>`; verifies it, loads the user from auth-service, sets req.user
 *   requireHod     authenticate + role must be "hod"; sets req.dept (same as the backend's requireHod)
 */
const jwt = require("jsonwebtoken")
const users = require("../users")

const SECRET = process.env.JWT_SECRET
if (!SECRET) {
  console.error("❌ JWT_SECRET is required (use the same value as backend/.env and gateway/.env)")
  process.exit(1)
}

const verifyToken = (token) => jwt.verify(token, SECRET)

async function authenticate(req, res, next) {
  if (req.user) return next()   // already authenticated by the global /api guard
  const [scheme, token] = (req.headers.authorization || "").split(" ")
  if (scheme !== "Bearer" || !token) return res.status(401).json({ success: false, message: "Authentication required" })

  let payload
  try { payload = verifyToken(token) }
  catch (e) {
    const expired = e.name === "TokenExpiredError"
    return res.status(401).json({ success: false, message: expired ? "Session expired, please log in again" : "Invalid token" })
  }

  try {
    const user = await users.getById(payload.sub)
    if (!user) return res.status(401).json({ success: false, message: "User not found" })
    req.user = user
    next()
  } catch (e) {
    if (e && e.status === 503) return res.status(503).json({ success: false, message: e.message })
    return res.status(401).json({ success: false, message: "Invalid credentials" })
  }
}

function requireHod(req, res, next) {
  authenticate(req, res, (err) => {
    if (err) return next(err)
    if (!req.user) return // authenticate already responded
    if (req.user.role !== "hod") return res.status(403).json({ success: false, message: "HOD access only" })
    req.dept = (req.user.department || "").trim()
    next()
  })
}

module.exports = { authenticate, requireHod, verifyToken }
