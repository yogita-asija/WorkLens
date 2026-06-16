const Course = require("../models/course")

// Day order for sorting
const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

// Parse days string like "Mon,Wed,Fri" or "Monday Wednesday" or "MWF"
function parseDays(daysStr) {
  if (!daysStr || daysStr === "Not set" || daysStr.trim() === "") return []

  const abbrevMap = {
    mon: "Monday", tue: "Tuesday", wed: "Wednesday",
    thu: "Thursday", fri: "Friday", sat: "Saturday",
    m: "Monday", t: "Tuesday", w: "Wednesday",
    th: "Thursday", f: "Friday", s: "Saturday",
  }

  // Split by comma, space, slash, or individual chars if no separator
  const parts = daysStr
    .split(/[,\s\/\-]+/)
    .map(p => p.trim().toLowerCase())
    .filter(Boolean)

  const resolved = []
  for (const p of parts) {
    const full = DAY_ORDER.find(d => d.toLowerCase() === p)
    if (full) { resolved.push(full); continue }
    const abbrev = abbrevMap[p]
    if (abbrev) { resolved.push(abbrev); continue }
    // Try prefix match
    const prefixMatch = DAY_ORDER.find(d => d.toLowerCase().startsWith(p))
    if (prefixMatch) resolved.push(prefixMatch)
  }
  return [...new Set(resolved)]
}

// Parse time string "09:00 AM - 10:00 AM" → { start: "09:00 AM", end: "10:00 AM", sortKey: 900 }
function parseTime(timeStr) {
  if (!timeStr || timeStr.trim() === "") return { start: "TBD", end: "", sortKey: 9999 }

  const rangeMatch = timeStr.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*[-–to]+\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i)
  if (rangeMatch) {
    const start = rangeMatch[1].trim()
    const end   = rangeMatch[2].trim()
    // Compute sort key from start time
    const m = start.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
    let sortKey = 9999
    if (m) {
      let h = parseInt(m[1])
      const min = parseInt(m[2])
      const period = (m[3] || "").toUpperCase()
      if (period === "PM" && h !== 12) h += 12
      if (period === "AM" && h === 12) h = 0
      sortKey = h * 100 + min
    }
    return { start, end, sortKey, display: `${start} – ${end}` }
  }

  // Single time
  return { start: timeStr.trim(), end: "", sortKey: 9999, display: timeStr.trim() }
}

// GET /api/timetable
// Returns the full weekly timetable for the authenticated faculty's courses
exports.getTimetable = async (req, res) => {
  try {
    const { teacherId } = req.query

    // Build filter — if teacherId provided, filter by teacher
    const filter = { status: { $ne: "archived" } }
    if (teacherId) filter["teacher.id"] = teacherId

    const courses = await Course.find(filter).lean()

    // Build timetable slots
    // Result shape: { [day]: [ { ...slotInfo } ] }
    const timetable = {}
    DAY_ORDER.forEach(d => { timetable[d] = [] })

    // Stats accumulators
    let totalWeeklyClasses  = 0
    let totalTeachingMinutes = 0

    const today = new Date()
    const todayName = today.toLocaleDateString("en-US", { weekday: "long" })

    for (const course of courses) {
      const { schedule = {} } = course
      const days = parseDays(schedule.days || "")
      const timeInfo = parseTime(schedule.time || "")

      // Compute duration in minutes if we have a range
      let durationMins = 60 // default 1 hour
      if (timeInfo.start && timeInfo.end) {
        const parse = (t) => {
          const m = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
          if (!m) return null
          let h = parseInt(m[1]), min = parseInt(m[2])
          const p = (m[3] || "").toUpperCase()
          if (p === "PM" && h !== 12) h += 12
          if (p === "AM" && h === 12) h = 0
          return h * 60 + min
        }
        const s = parse(timeInfo.start)
        const e = parse(timeInfo.end)
        if (s !== null && e !== null && e > s) durationMins = e - s
      }

      for (const day of days) {
        if (!timetable[day]) continue
        timetable[day].push({
          courseId:   course._id,
          courseCode: course.courseCode || course.courseId || "",
          courseName: course.courseName || course.label || "Unnamed Course",
          sem:        course.sem || "N/A",
          batch:      course.batch || "—",
          room:       schedule.room || "TBD",
          timeInfo,
          durationMins,
          credits:    course.credits || 3,
          status:     course.status || "active",
          students:   course.students?.length || 0,
        })
        totalWeeklyClasses++
        totalTeachingMinutes += durationMins
      }
    }

    // Sort each day's slots by time
    DAY_ORDER.forEach(d => {
      timetable[d].sort((a, b) => a.timeInfo.sortKey - b.timeInfo.sortKey)
    })

    // Today's classes
    const todayClasses = timetable[todayName] || []

    // Free periods = slots in today's schedule that have no class
    // We define "free" as the number of unique time-slots in the week that today does NOT have
    // (simpler: count distinct time slots across week, subtract today's count)
    const allTimeSlots = new Set()
    DAY_ORDER.forEach(d => {
      timetable[d].forEach(slot => allTimeSlots.add(slot.timeInfo.display))
    })
    const todayTimeSlots = new Set(todayClasses.map(s => s.timeInfo.display))
    const freePeriodsToday = [...allTimeSlots].filter(t => !todayTimeSlots.has(t)).length

    // Teaching hours this week
    const teachingHoursWeek = Math.round((totalTeachingMinutes / 60) * 10) / 10

    // Teaching hours today
    const todayMinutes = todayClasses.reduce((s, c) => s + c.durationMins, 0)
    const teachingHoursToday = Math.round((todayMinutes / 60) * 10) / 10

    res.json({
      timetable,
      today: todayName,
      stats: {
        totalClassesWeek: totalWeeklyClasses,
        todayClassesCount: todayClasses.length,
        freePeriodsToday,
        teachingHoursWeek,
        teachingHoursToday,
      },
    })
  } catch (err) {
    console.error("getTimetable error:", err)
    res.status(500).json({ message: err.message })
  }
}
