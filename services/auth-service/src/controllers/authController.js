const bcrypt = require("bcryptjs")
const User   = require("../models/User")
const { signToken } = require("../auth")

/* Brute-force protection: 5 failed logins per email+IP -> locked for 15 minutes (in-memory, resets on restart).
   req.ip is the real client address because server.js trusts the gateway's X-Forwarded-For. */
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

// POST /api/auth/login
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

/* ── Internal (other services only) ─────────────────────────────────────────────────────────── */

const OBJECT_ID = /^[0-9a-fA-F]{24}$/

// GET /internal/users/:id
exports.internalGetUser = async (req, res) => {
  if (!OBJECT_ID.test(req.params.id)) return res.status(400).json({ message: "Invalid id" })
  const user = await User.findById(req.params.id).select("-password").lean()
  if (!user) return res.status(404).json({ message: "User not found" })
  res.json(user)
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const MAX_LIST = 1000

// GET /internal/users?dept=&role=&ids=a,b,c      (filters combine; at least one is required)
//   dept  matches case-insensitively and ignores surrounding spaces ("cse", " CSE " and "CSE" are the same department),
//         the same rule the HOD <-> faculty chat has always used
//   role  one role, or several separated by commas: role=teaching,hod
exports.internalListUsers = async (req, res) => {
  const { dept, role, ids } = req.query
  const filter = {}
  if (typeof dept === "string" && dept.trim()) filter.department = new RegExp(`^\\s*${escapeRe(dept.trim())}\\s*$`, "i")
  if (typeof role === "string" && role) {
    const roles = role.split(",").map((s) => s.trim()).filter(Boolean)
    if (roles.length) filter.role = roles.length === 1 ? roles[0] : { $in: roles }
  }
  if (typeof ids === "string" && ids) {
    const list = ids.split(",").map((s) => s.trim()).filter((s) => OBJECT_ID.test(s))
    if (!list.length) return res.json([])
    filter._id = { $in: list }
  }
  if (!Object.keys(filter).length) return res.status(400).json({ message: "Give at least one of dept, role, ids" })
  res.json(await User.find(filter).select("-password").limit(MAX_LIST).lean())
}
