const bcrypt = require("bcryptjs")
const User   = require("../models/User")
const { signToken } = require("../middleware/auth")

/* Brute-force protection: 5 failed logins per email+IP -> locked for 15 minutes (in-memory, resets on restart). */
const MAX_FAILS = 5, LOCK_MS = 15 * 60 * 1000
const fails = new Map()
const keyOf = (req, email) => `${req.ip}|${String(email).toLowerCase()}`
const locked = (k) => { const f = fails.get(k); return f && f.count >= MAX_FAILS && Date.now() - f.last < LOCK_MS }
const fail = (k) => { const f = fails.get(k); const fresh = !f || Date.now() - f.last >= LOCK_MS; fails.set(k, { count: fresh ? 1 : f.count + 1, last: Date.now() }) }

const roleMap = {
  "Teaching Staff":     "teaching",
  "Non-Teaching Staff": "non-teaching",
  "HOD":                "hod",
}

const publicUser = (user) => ({
  _id:        user._id,
  name:       user.name,
  email:      user.email,
  role:       user.role,
  department: user.department || "",
  phone:      user.phone || "",
  bio:        user.bio || "",
  memberSince: user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : "Jan 2024",
})

exports.loginUser = async (req, res) => {
  const { email, password, role } = req.body || {}

  if (!email || !password || !role) {
    return res.status(400).json({ message: "All fields are required" })
  }
  // reject objects such as { "$ne": null } (NoSQL injection)
  if ([email, password, role].some((v) => typeof v !== "string")) {
    return res.status(400).json({ message: "Invalid input" })
  }

  const k = keyOf(req, email)
  if (locked(k)) return res.status(429).json({ message: "Too many failed attempts. Try again in 15 minutes." })

  const dbRole = roleMap[role] || role

  try {
    const user = await User.findOne({ email: email.trim(), role: dbRole })
      || await User.findOne({ email: email.trim().toLowerCase(), role: dbRole })
    const ok = user && await bcrypt.compare(password, user.password)
    if (!ok) { fail(k); return res.status(400).json({ message: "Invalid credentials" }) }

    fails.delete(k)
    return res.json({ message: "Login successful", token: signToken(user), user: publicUser(user) })
  } catch (err) {
    console.error("Login error:", err.message)
    return res.status(500).json({ message: "Server error" })
  }
}

// GET /api/auth/me – lets the frontend check a stored token is still valid
exports.me = (req, res) => res.json({ user: publicUser(req.user) })
