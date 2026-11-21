const { authenticate } = require("./auth")
const { ALLOWED_ROLES, deptKey } = require("../utils/deptChat")

/**
 * Middleware for /api/dept-messages/*  —  HOD or faculty, with a department set.
 * Identity comes from the signed login token (see shared/middleware/auth.js). Sets req.user.
 */
function requireDeptMember(req, res, next) {
  const check = () => {
    if (!req.user) return // authenticate already responded
    const user = req.user
    if (!ALLOWED_ROLES.includes(user.role)) {
      return res.status(403).json({ success: false, message: "Department messaging is for HOD and faculty only" })
    }
    if (!deptKey(user.department)) {
      return res.status(403).json({ success: false, message: "Your profile has no department set, so department messaging is unavailable" })
    }
    next()
  }
  if (req.user) return check()                 // already authenticated by the global /api guard
  authenticate(req, res, (err) => (err ? next(err) : check()))
}

/** Tiny in-memory sliding-window limiter (per user). Use a Redis-backed one if you run several server instances. */
function rateLimit({ windowMs = 60_000, max = 40 } = {}) {
  const hits = new Map()
  setInterval(() => {
    const cutoff = Date.now() - windowMs
    for (const [k, arr] of hits) { const keep = arr.filter((t) => t > cutoff); keep.length ? hits.set(k, keep) : hits.delete(k) }
  }, windowMs).unref()

  return (req, res, next) => {
    const key = String(req.user?._id || req.ip)
    const now = Date.now()
    const arr = (hits.get(key) || []).filter((t) => t > now - windowMs)
    if (arr.length >= max) {
      res.set("Retry-After", String(Math.ceil(windowMs / 1000)))
      return res.status(429).json({ success: false, message: "You are sending messages too fast. Please wait a moment." })
    }
    arr.push(now)
    hits.set(key, arr)
    next()
  }
}

module.exports = requireDeptMember
module.exports.rateLimit = rateLimit
