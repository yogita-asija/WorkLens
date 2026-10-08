/**
 * Shared helpers for the HOD controllers (leave management + faculty workload).
 * Conventions match hodController.js / dutyAllocationController.js:
 *   - leave + holiday dates are stored as UTC midnight  -> compared with UTC "YYYY-MM-DD" keys
 *   - Substitution / FacultyStatus use dateKey          -> "YYYY-MM-DD"
 */
const User = require("../models/User")
const Course = require("../models/course")

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const SCHEDULE_DAYS = WEEKDAYS.slice(1, 7) // Mon–Sat

// Same env var the Smart Duty Allocation page uses.
const WEEKLY_CAPACITY_HOURS = Number(process.env.DUTY_WEEKLY_CAPACITY_HOURS) || 40

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const pad = (n) => String(n).padStart(2, "0")
const round1 = (n) => Math.round(n * 10) / 10

/** Local-time key, used for "today" (FacultyStatus/Substitution keys are local, like hodController). */
const localKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
/** UTC key, for leave/holiday dates stored as UTC midnight. */
const utcKey = (d) => new Date(d).toISOString().slice(0, 10)

const keyToUTC = (k) => new Date(`${k}T00:00:00.000Z`)
const addKeyDays = (k, n) => { const d = keyToUTC(k); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const weekdayOf = (k) => WEEKDAYS[keyToUTC(k).getUTCDay()]
const diffDays = (a, b) => Math.round((keyToUTC(b) - keyToUTC(a)) / 864e5) // b - a in days
const fmtShort = (k) => keyToUTC(k).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })

/** "Mon,Wed,Fri" | "Monday Wednesday" -> ["Monday","Wednesday","Friday"] */
function parseDays(str) {
  if (!str || str === "Not set" || !String(str).trim()) return []
  const abbr = {
    mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday",
    m: "Monday", t: "Tuesday", w: "Wednesday", th: "Thursday", f: "Friday", s: "Saturday",
  }
  const out = []
  for (const raw of String(str).split(/[,\s\/\-]+/).map((p) => p.trim().toLowerCase()).filter(Boolean)) {
    const full = SCHEDULE_DAYS.find((d) => d.toLowerCase() === raw)
    if (full) { out.push(full); continue }
    if (abbr[raw]) { out.push(abbr[raw]); continue }
    const prefix = SCHEDULE_DAYS.find((d) => d.toLowerCase().startsWith(raw))
    if (prefix) out.push(prefix)
  }
  return [...new Set(out)]
}

function toMin(t) {
  const m = String(t).match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const mi = parseInt(m[2], 10)
  const p = (m[3] || "").toUpperCase()
  if (p === "PM" && h !== 12) h += 12
  if (p === "AM" && h === 12) h = 0
  return h * 60 + mi
}

/** "09:00 AM - 10:00 AM" -> { start, end } minutes, or null if unreadable */
function parseRange(str) {
  if (!str) return null
  const m = String(str).match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*(?:-|–|—|to)\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i)
  if (!m) return null
  const start = toMin(m[1]); const end = toMin(m[2])
  if (start == null || end == null || end <= start) return null
  return { start, end }
}

/** Do two { range, time } slots clash? Falls back to comparing the raw time text when unreadable. */
function overlaps(a, b) {
  if (a.range && b.range) return a.range.start < b.range.end && b.range.start < a.range.end
  return !!a.time && a.time.trim().toLowerCase() === (b.time || "").trim().toLowerCase()
}

const teacherOf = (c) => (c.teacher && c.teacher.id ? String(c.teacher.id) : "")

/** The department's faculty + the (non-archived) courses any of them teach, as main or batch teacher. */
async function loadDept(req) {
  const dept = req.dept || ""
  const facFilter = { role: "teaching" }
  if (dept) facFilter.department = new RegExp(`^${escapeRe(dept)}$`, "i")
  const faculty = await User.find(facFilter).select("name email department").lean()
  const ids = faculty.map((f) => f._id)
  const idStrs = ids.map(String)
  const courses = await Course.find({
    status: { $ne: "archived" },
    $or: [{ "teacher.id": { $in: ids } }, { "batches.teacher.id": { $in: ids } }],
  }).lean()
  const nameOf = Object.fromEntries(faculty.map((f) => [String(f._id), f.name]))
  return { dept, faculty, ids, idStrs, courses, nameOf }
}

/**
 * Every weekly teaching session of one faculty member (main course + batches they teach).
 * Sessions with a readable day but unreadable time count as 1 hour (estimated = true).
 */
function weeklySessions(courses, facultyId) {
  const sessions = []
  let estimated = false
  const add = (c, schedule, batchName) => {
    const days = parseDays(schedule && schedule.days)
    const range = parseRange(schedule && schedule.time)
    const list = days.length ? days : [null]
    for (const day of list) {
      if (!range) estimated = true
      sessions.push({
        courseId: String(c._id), courseCode: c.courseCode || c.courseId || "", courseName: c.courseName,
        batchName: batchName || "", day, time: (schedule && schedule.time) || "", room: (schedule && schedule.room) || "",
        range, hours: range ? (range.end - range.start) / 60 : 1,
      })
    }
  }
  for (const c of courses) {
    if (teacherOf(c) === facultyId) add(c, c.schedule, "")
    for (const b of c.batches || []) {
      if (b.teacher && b.teacher.id && String(b.teacher.id) === facultyId) add(c, b.schedule, b.batchName)
    }
  }
  return { sessions, hours: sessions.reduce((s, x) => s + x.hours, 0), estimated }
}

/** try/catch wrapper -> JSON 500 */
const wrap = (tag) => (fn) => async (req, res) => {
  try { await fn(req, res) }
  catch (err) {
    console.error(`${tag} error:`, err)
    res.status(500).json({ success: false, message: err.message })
  }
}

module.exports = {
  WEEKDAYS, SCHEDULE_DAYS, WEEKLY_CAPACITY_HOURS,
  escapeRe, pad, round1, localKey, utcKey, keyToUTC, addKeyDays, weekdayOf, diffDays, fmtShort,
  parseDays, parseRange, overlaps, teacherOf, loadDept, weeklySessions, wrap,
}