/**
 * Course Allocation engine — PURE functions (no database, no clock, no randomness).
 * Same input  →  same ranking, every time.
 *
 *   1. evaluateEligibility()  mandatory checks (department, qualification, approved leave, timetable,
 *                             workload limits, duplicates).  A failed check means "cannot be assigned".
 *                             These are NEVER mixed into the score.
 *   2. scoreCandidate()       the six weighted components (0–100 each).  A component whose data is
 *                             missing is reported as UNKNOWN (raw = null) — it is never guessed.
 *   3. rankCandidates()       eligible first, then by score, with fixed tie-breakers.
 *
 * Department-wide optimisation (future): the service builds one `evaluateCandidate()` result per
 * (course × faculty) pair; an optimiser only has to pick a set of pairs that maximises Σ score subject
 * to `eligibility !== "ineligible"`. Nothing in this file knows about a single "selected course".
 */

const WEIGHT_KEYS = ["expertise", "previousTeaching", "relevantExperience", "workload", "timetable", "continuity"]

const WEIGHT_LABELS = {
  expertise:          "Subject expertise & qualifications",
  previousTeaching:   "Previous teaching experience",
  relevantExperience: "Relevant academic / practical experience",
  workload:           "Workload suitability",
  timetable:          "Timetable availability",
  continuity:         "Course continuity",
}

const DEFAULT_WEIGHTS = { expertise: 30, previousTeaching: 25, relevantExperience: 15, workload: 15, timetable: 10, continuity: 5 }

const DEFAULT_LIMITS = {
  maxWeeklyHours:    Number(process.env.COURSE_ALLOC_MAX_WEEKLY_HOURS) || 20,
  maxCourses:        Number(process.env.COURSE_ALLOC_MAX_COURSES) || 5,
  leaveBlockPercent: Number(process.env.COURSE_ALLOC_LEAVE_BLOCK_PERCENT) || 25,
}

const DEFAULT_POLICY = { unknownPolicy: "zero", blockOnUnknownQualification: false }

const LEVEL_RANK = { Diploma: 1, Bachelors: 2, Masters: 3, PhD: 4 }   // "Other" is recorded but cannot be ranked

const round1 = (n) => Math.round(n * 10) / 10
const clamp  = (n, lo, hi) => Math.min(hi, Math.max(lo, n))
const plural = (n, one, many) => (n === 1 ? one : many)

/* ═══════════════════════════ settings ═══════════════════════════ */

/** Merge a stored settings row (or nothing) with the defaults. Always returns a complete object. */
function normalizeSettings(doc) {
  const d = doc || {}
  const weights = {}
  for (const k of WEIGHT_KEYS) {
    const v = Number(d.weights && d.weights[k])
    weights[k] = Number.isFinite(v) && v >= 0 ? v : DEFAULT_WEIGHTS[k]
  }
  const num = (v, fb) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : fb)
  return {
    weights,
    limits: {
      maxWeeklyHours:    num(d.limits && d.limits.maxWeeklyHours,    DEFAULT_LIMITS.maxWeeklyHours),
      maxCourses:        num(d.limits && d.limits.maxCourses,        DEFAULT_LIMITS.maxCourses),
      leaveBlockPercent: num(d.limits && d.limits.leaveBlockPercent, DEFAULT_LIMITS.leaveBlockPercent),
    },
    unknownPolicy: d.unknownPolicy === "renormalize" ? "renormalize" : DEFAULT_POLICY.unknownPolicy,
    blockOnUnknownQualification: typeof d.blockOnUnknownQualification === "boolean"
      ? d.blockOnUnknownQualification : DEFAULT_POLICY.blockOnUnknownQualification,
  }
}

/** Validate settings coming from the HOD's form. Returns { errors, value }. */
function validateSettings(input) {
  const errors = []
  const i = input || {}
  const weights = {}
  let sum = 0
  for (const k of WEIGHT_KEYS) {
    const v = Number(i.weights && i.weights[k])
    if (!Number.isFinite(v) || v < 0 || v > 100) errors.push(`${WEIGHT_LABELS[k]} weight must be between 0 and 100`)
    weights[k] = v
    sum += Number.isFinite(v) ? v : 0
  }
  if (Math.abs(sum - 100) > 0.5) errors.push(`Weights must add up to 100 (currently ${round1(sum)})`)

  const limits = {}
  const lim = (key, label, max) => {
    const v = Number(i.limits && i.limits[key])
    if (!Number.isFinite(v) || v <= 0 || v > max) errors.push(`${label} must be between 1 and ${max}`)
    limits[key] = v
  }
  lim("maxWeeklyHours", "Maximum weekly teaching hours", 80)
  lim("maxCourses", "Maximum concurrent courses", 30)
  lim("leaveBlockPercent", "Leave threshold (%)", 100)

  const unknownPolicy = i.unknownPolicy === "renormalize" ? "renormalize" : "zero"
  const blockOnUnknownQualification = !!i.blockOnUnknownQualification
  return { errors, value: { weights, limits, unknownPolicy, blockOnUnknownQualification } }
}

/* ═══════════════════════════ text matching ═══════════════════════════ */

const STOP = new Set((
  "a an and the of to for in on with at by or as using " +
  "i ii iii iv v vi vii viii ix x " +
  "advanced introduction intro fundamentals fundamental basics basic principles principle concepts concept " +
  "applied theory lab laboratory practical practicals course courses studies study topics topic special " +
  "seminar project modern essentials overview foundations foundation elementary general selected " +
  "dr prof professor mr mrs ms"
).split(" "))

function stem(w) {
  if (/[0-9+#]/.test(w)) return w
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y"
  if (w.length > 4 && /(ss|x|z|ch|sh)es$/.test(w)) return w.slice(0, -2)
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us") && !w.endsWith("is")) return w.slice(0, -1)
  return w
}

/** "Advanced Algorithms & Data Structures" → [{ raw:"algorithms", stem:"algorithm" }, …] */
function tokenPairs(str) {
  const out = []
  for (const raw of String(str || "").toLowerCase().replace(/[^a-z0-9+#]+/g, " ").split(" ")) {
    if (!raw || STOP.has(raw)) continue
    out.push({ raw, stem: stem(raw) })
  }
  return out
}
const stems = (str) => new Set(tokenPairs(str).map((t) => t.stem))

/** The topics a teacher of this course should know: HOD-defined tags, else the words of the course title. */
function courseTopics(course, requirement) {
  const tags = ((requirement && requirement.subjectTags) || [])
    .map((t) => String(t || "").trim()).filter(Boolean)
    .map((t) => ({ label: t, tokens: stems(t) }))
    .filter((t) => t.tokens.size)
  if (tags.length) return { source: "requirement", tags }

  const seen = new Set()
  const derived = []
  for (const p of tokenPairs(course && course.courseName)) {
    if (seen.has(p.stem)) continue
    seen.add(p.stem)
    derived.push({ label: p.raw, tokens: new Set([p.stem]) })
  }
  return { source: "derived", tags: derived }
}

const overlapRatio = (needle, hay) => {
  if (!needle.size) return 0
  let hit = 0
  needle.forEach((t) => { if (hay.has(t)) hit++ })
  return hit / needle.size
}

/* ═══════════════════════════ schedules ═══════════════════════════ */

const SCHEDULE_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

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

/** "09:00 AM - 10:00 AM" → { start, end };  "10:00 AM" → { start, end: null };  junk → { start: null, end: null } */
function parseTimeSpec(str) {
  const s = String(str || "")
  const range = s.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*(?:-|–|—|to)\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i)
  if (range) {
    const start = toMin(range[1]); const end = toMin(range[2])
    if (start != null && end != null && end > start) return { start, end }
  }
  const single = s.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i)
  return { start: single ? toMin(single[1]) : null, end: null }
}

const fmtMin = (m) => {
  const h = Math.floor(m / 60); const mi = m % 60
  const p = h >= 12 ? "PM" : "AM"
  return `${((h + 11) % 12) + 1}:${String(mi).padStart(2, "0")} ${p}`
}
const slotLabel = (s) => `${s.day} ${s.start == null ? "(time not set)" : fmtMin(s.start) + (s.end != null ? `–${fmtMin(s.end)}` : "")}`

/**
 * One course/batch schedule → its weekly sessions and teaching hours.
 *   known     : days AND a start time are readable (needed to check clashes)
 *   estimated : hours are not exact (an end time is missing) → credits are used as hours per week,
 *               the same convention Smart Duty Allocation already uses.
 */
function scheduleInfo(schedule, credits) {
  const days = parseDays(schedule && schedule.days)
  const t = parseTimeSpec(schedule && schedule.time)
  const sessions = days.map((day) => ({ day, start: t.start, end: t.end }))
  const known = days.length > 0 && t.start != null
  const exact = days.length > 0 && t.start != null && t.end != null
  const fallback = Number(credits) > 0 ? Number(credits) : 0
  const hours = exact ? days.length * ((t.end - t.start) / 60) : fallback
  return { sessions, known, hours, estimated: !exact }
}

/** "conflict" | "uncertain" | "none" for two sessions */
function sessionRelation(a, b) {
  if (a.day !== b.day) return "none"
  if (a.start == null || b.start == null) return "uncertain"
  if (a.end != null && b.end != null) return a.start < b.end && b.start < a.end ? "conflict" : "none"
  if (a.end == null && b.end == null) return a.start === b.start ? "conflict" : "uncertain"
  const ranged = a.end != null ? a : b
  const point  = a.end != null ? b : a
  if (point.start >= ranged.start && point.start < ranged.end) return "conflict"
  if (point.start >= ranged.end) return "none"      // starts after the other class is over, whatever its length
  return "uncertain"                                 // starts earlier; its (unknown) length decides
}

/* ═══════════════════════════ leave ═══════════════════════════ */

const dayIndex = (k) => Math.floor(new Date(`${k}T00:00:00.000Z`).getTime() / 864e5)

/**
 * Days of [startKey, endKey] covered by the given leaves (overlapping leaves are merged, so a day is
 * never counted twice).  leaves: [{ from:"YYYY-MM-DD", to:"YYYY-MM-DD", type }]
 */
function leaveCoverage(leaves, startKey, endKey) {
  const s = dayIndex(startKey); const e = dayIndex(endKey)
  const spans = []
  for (const l of leaves || []) {
    const a = Math.max(s, dayIndex(l.from)); const b = Math.min(e, dayIndex(l.to))
    if (a <= b) spans.push([a, b])
  }
  spans.sort((x, y) => x[0] - y[0])
  let days = 0; let curS = null; let curE = null
  for (const [a, b] of spans) {
    if (curS === null) { curS = a; curE = b } else if (a <= curE + 1) { curE = Math.max(curE, b) } else { days += curE - curS + 1; curS = a; curE = b }
  }
  if (curS !== null) days += curE - curS + 1
  return { days, termDays: e - s + 1 }
}

/* ═══════════════════════════ scoring components ═══════════════════════════ */

const unknown = (reason) => ({ raw: null, detail: reason, facts: [] })

/** 1 · Subject expertise — how many of the course's topics the faculty's recorded expertise covers. */
function scoreExpertise(topics, profile) {
  if (!topics.tags.length) return unknown("The course title has no distinctive topic and the HOD has not set subject tags for it")
  const evidence = []
  if (profile) {
    ;(profile.specializations || []).forEach((s) => evidence.push({ kind: "Specialization", text: s, w: 1 }))
    ;(profile.qualifications || []).forEach((q) => q.field && evidence.push({ kind: `${q.level} field`, text: q.field, w: 0.7 }))
    ;(profile.researchAreas || []).forEach((r) => evidence.push({ kind: "Research area", text: r, w: 0.6 }))
  }
  const items = evidence.map((e) => ({ ...e, tokens: stems(e.text) })).filter((e) => e.tokens.size)
  if (!items.length) return unknown("No specialization, qualification field or research area recorded for this faculty")

  const facts = []
  let total = 0
  for (const tag of topics.tags) {
    let best = { score: 0, by: null }
    for (const it of items) {
      const sc = overlapRatio(tag.tokens, it.tokens) * it.w
      if (sc > best.score) best = { score: sc, by: `${it.kind}: ${it.text}` }
    }
    total += best.score
    facts.push({ topic: tag.label, score: round1(best.score * 100), matchedBy: best.by })
  }
  const raw = round1((total / topics.tags.length) * 100)
  const matched = facts.filter((f) => f.score > 0)
  const detail = matched.length
    ? `Matches ${matched.length} of ${topics.tags.length} course ${plural(topics.tags.length, "topic", "topics")} (${matched.map((f) => `${f.topic} ← ${f.matchedBy}`).join("; ")})`
    : `Recorded expertise does not match any of the ${topics.tags.length} course ${plural(topics.tags.length, "topic", "topics")} (${topics.tags.map((t) => t.label).join(", ")})`
  return { raw, detail, facts }
}

/** 2 · Previous teaching experience — same course in earlier terms (70%), similar courses (30%). */
function scoreTeaching(t) {
  if (!t.hasRecords) return unknown("No teaching history on record for this faculty (WorkLens courses, allocation history or profile)")
  const exact = clamp(t.exactTerms / 3, 0, 1)
  const similar = clamp(t.similarCourses / 3, 0, 1)
  const raw = round1(100 * (0.7 * exact + 0.3 * similar))
  const bits = []
  bits.push(t.exactTerms > 0
    ? `Taught this course in ${t.exactTerms} ${plural(t.exactTerms, "term", "terms")}`
    : "Has not taught this course before")
  if (t.similarCourses > 0) bits.push(`${t.similarCourses} similar ${plural(t.similarCourses, "course", "courses")} taught`)
  return { raw, detail: bits.join("; "), facts: [{ exactTerms: t.exactTerms, similarCourses: t.similarCourses }] }
}

/** 3 · Relevant academic / practical experience — academic years (50%) + years of practical work in the course's topics (50%). */
function scoreExperience(topics, profile) {
  if (!profile) return unknown("No experience recorded for this faculty")
  const parts = []
  const facts = []
  const detail = []

  if (typeof profile.academicExperienceYears === "number") {
    parts.push(clamp(profile.academicExperienceYears / 10, 0, 1))
    facts.push({ academicYears: profile.academicExperienceYears })
    detail.push(`${profile.academicExperienceYears} ${plural(profile.academicExperienceYears, "year", "years")} of academic experience`)
  }
  const practical = profile.practicalExperience || []
  if (!practical.length && profile.noPracticalExperience) {
    parts.push(0)
    facts.push({ relevantPracticalYears: 0 })
    detail.push("declared no practical experience")
  } else if (practical.length) {
    let relevantYears = 0
    for (const p of practical) {
      const hay = stems(`${p.title} ${p.domain}`)
      if (topics.tags.some((t) => overlapRatio(t.tokens, hay) > 0)) relevantYears += Number(p.years) || 0
    }
    parts.push(clamp(relevantYears / 5, 0, 1))
    facts.push({ relevantPracticalYears: relevantYears })
    detail.push(relevantYears > 0 ? `${relevantYears} ${plural(relevantYears, "year", "years")} of practical work in the course's topics` : "no practical experience in the course's topics")
  }
  if (!parts.length) return unknown("No academic or practical experience recorded for this faculty")
  return { raw: round1((parts.reduce((a, b) => a + b, 0) / parts.length) * 100), detail: detail.join("; "), facts }
}

/** 4 · Workload suitability — 100 up to half the weekly limit, then falls linearly to 0 at the limit. */
function scoreWorkload(w) {
  const util = w.projectedHours / w.maxHours
  const raw = util <= 0.5 ? 100 : util >= 1 ? 0 : round1(((1 - util) / 0.5) * 100)
  const detail = `${round1(w.currentHours)}h now → ${round1(w.projectedHours)}h/week with this course (limit ${w.maxHours}h)${w.estimated ? ", partly estimated from credits" : ""}`
  return { raw, detail, facts: [{ currentHours: round1(w.currentHours), projectedHours: round1(w.projectedHours), maxHours: w.maxHours }] }
}

/** 5 · Timetable availability — 100 when none of the course's days already has a class, −25 per existing class that day. */
function scoreTimetable(tt) {
  if (!tt.scheduleKnown) return unknown("The course has no readable day/time, so clashes cannot be checked")
  if (tt.conflicts.length) return { raw: 0, detail: `Clashes with ${tt.conflicts.length} existing ${plural(tt.conflicts.length, "class", "classes")}`, facts: [] }
  const perDay = tt.courseSessions.map((s) => tt.existingSessions.filter((e) => e.day === s.day).length)
  const avg = perDay.reduce((a, b) => a + Math.max(0, 100 - 25 * b), 0) / (perDay.length || 1)
  const busy = perDay.filter((n) => n > 0).length
  return {
    raw: round1(avg),
    detail: busy === 0 ? "No clashes, and no other classes on the course's days" : `No clashes; already teaches on ${busy} of the course's ${perDay.length} ${plural(perDay.length, "day", "days")}`,
    facts: [],
  }
}

/** 6 · Course continuity — taught it last term (100), earlier (60), has history but not this faculty (0). */
function scoreContinuity(c) {
  if (!c.courseHasHistory) return unknown("This course has no recorded teacher history")
  if (c.currentlyTeaching) return { raw: 100, detail: "Currently teaches this course", facts: [] }
  if (c.taughtLastTerm) return { raw: 100, detail: "Taught this course in the most recent previous term", facts: [] }
  if (c.taughtEarlier) return { raw: 60, detail: "Taught this course in an earlier term", facts: [] }
  return { raw: 0, detail: "Has not taught this course before", facts: [] }
}

/* ═══════════════════════════ eligibility ═══════════════════════════ */

const chk = (key, label, status, detail, extra = {}) => ({ key, label, status, detail, ...extra })
// status: "pass" | "fail" | "warn" | "unknown" | "na"      (fail = blocking, the others never block)

function highestLevel(profile) {
  let best = 0
  for (const q of (profile && profile.qualifications) || []) best = Math.max(best, LEVEL_RANK[q.level] || 0)
  return best
}

/**
 * Mandatory checks. Kept completely separate from scoring.
 * `i` carries only measured facts; this function turns them into pass / fail / unknown.
 */
function evaluateEligibility(i) {
  const checks = []
  const { settings, requirement, profile } = i

  // 1 · department boundary
  checks.push(i.sameDepartment
    ? chk("department", "Department", "pass", "Teaching faculty of your department")
    : chk("department", "Department", "fail", "Not teaching faculty of your department"))

  // 2 · not already the teacher / assigned
  if (i.alreadyAssigned) checks.push(chk("duplicate", "Duplicate assignment", "fail", "Already the teacher of this course"))
  else checks.push(chk("duplicate", "Duplicate assignment", "pass", "Not currently assigned to this course"))

  // 3 · qualification
  const minLevel = requirement && requirement.minQualification
  if (!minLevel) {
    checks.push(chk("qualification", "Qualification", "na", "No minimum qualification set for this course"))
  } else {
    const have = highestLevel(profile)
    if (!have) {
      const blocking = settings.blockOnUnknownQualification
      checks.push(chk("qualification", "Qualification", blocking ? "fail" : "unknown",
        `${minLevel} required — this faculty's qualifications are not recorded${blocking ? " (policy: unverified qualifications are blocked)" : ", so it cannot be verified"}`))
    } else if (have >= LEVEL_RANK[minLevel]) {
      checks.push(chk("qualification", "Qualification", "pass", `${minLevel} or higher required — requirement met`))
    } else {
      checks.push(chk("qualification", "Qualification", "fail", `${minLevel} or higher required — highest recorded is below that`))
    }
  }

  // 4 · subject match (only when the HOD made it mandatory)
  if (requirement && requirement.requireSubjectMatch) {
    if (i.expertiseRaw === null) checks.push(chk("subject", "Subject match", "unknown", "Subject match required — expertise is not recorded, so it cannot be verified"))
    else if (i.expertiseRaw > 0) checks.push(chk("subject", "Subject match", "pass", "Recorded expertise matches the course topics"))
    else checks.push(chk("subject", "Subject match", "fail", "Subject match required — recorded expertise does not match the course topics"))
  }

  // 5 · approved leave inside the term
  const L = i.leave
  const pct = L.termDays ? (L.approvedDays / L.termDays) * 100 : 0
  if (L.approvedDays === 0) checks.push(chk("leave", "Approved leave", "pass", "No approved leave during the term"))
  else if (pct >= settings.limits.leaveBlockPercent) {
    checks.push(chk("leave", "Approved leave", "fail",
      `${L.approvedDays} approved leave ${plural(L.approvedDays, "day", "days")} in a ${L.termDays}-day term (${round1(pct)}% ≥ the ${settings.limits.leaveBlockPercent}% limit)`))
  } else {
    checks.push(chk("leave", "Approved leave", "warn", `${L.approvedDays} approved leave ${plural(L.approvedDays, "day", "days")} during the term (${round1(pct)}%)`))
  }
  if (L.pendingDays > 0) checks.push(chk("leavePending", "Pending leave", "warn", `${L.pendingDays} ${plural(L.pendingDays, "day", "days")} of leave requested but not yet decided`))

  // 6 · timetable
  const T = i.timetable
  if (!T.scheduleKnown) {
    checks.push(chk("timetable", "Timetable", "unknown", "The course has no readable day/time, so clashes cannot be checked"))
  } else if (T.conflicts.length) {
    checks.push(chk("timetable", "Timetable", "fail", `Clashes with ${T.conflicts.map((c) => `${c.withCourse} (${c.slot})`).join("; ")}`, { conflicts: T.conflicts }))
  } else if (T.uncertain.length) {
    checks.push(chk("timetable", "Timetable", "warn", `Possible overlap — end time not recorded for ${T.uncertain.map((c) => `${c.withCourse} (${c.slot})`).join("; ")}`, { uncertain: T.uncertain }))
  } else {
    checks.push(chk("timetable", "Timetable", "pass", "No clash with existing classes"))
  }

  // 7 · workload limits
  const W = i.workload
  if (W.projectedHours > W.maxHours) {
    checks.push(chk("workload", "Weekly teaching hours", "fail", `Would reach ${round1(W.projectedHours)}h/week, above the ${W.maxHours}h limit${W.estimated ? " (partly estimated)" : ""}`))
  } else {
    // an estimate only needs the HOD's attention when it is close to the limit
    const nearLimit = W.estimated && W.projectedHours > W.maxHours * 0.85
    checks.push(chk("workload", "Weekly teaching hours", nearLimit ? "warn" : "pass",
      `${round1(W.projectedHours)}h/week of ${W.maxHours}h limit${W.estimated ? " — partly estimated from credits because some class times are incomplete" : ""}`))
  }
  if (W.projectedCourses > settings.limits.maxCourses) {
    checks.push(chk("courseCount", "Concurrent courses", "fail", `Would teach ${W.projectedCourses} courses, above the limit of ${settings.limits.maxCourses}`))
  } else {
    checks.push(chk("courseCount", "Concurrent courses", "pass", `${W.projectedCourses} of ${settings.limits.maxCourses} allowed courses`))
  }

  if (i.profileComplete === false) {
    checks.push(chk("profile", "Academic profile", "warn", "This faculty member has not completed their academic profile, so some scores are unknown"))
  }

  const failed  = checks.filter((c) => c.status === "fail")
  const review  = checks.filter((c) => c.status === "unknown" || c.status === "warn")
  return {
    status: failed.length ? "ineligible" : review.length ? "review" : "eligible",
    checks,
    blockers: failed.map((c) => `${c.label}: ${c.detail}`),
    warnings: review.map((c) => `${c.label}: ${c.detail}`),
  }
}

/* ═══════════════════════════ one candidate ═══════════════════════════ */

/**
 * Score + eligibility for ONE faculty member and ONE course target.
 * `i` is the prepared, measured input (see courseAllocationService.buildCandidateInput).
 */
function evaluateCandidate(i) {
  const { settings } = i

  const comps = {
    expertise:          scoreExpertise(i.topics, i.profile),
    previousTeaching:   scoreTeaching(i.teaching),
    relevantExperience: scoreExperience(i.topics, i.profile),
    workload:           scoreWorkload(i.workload),
    timetable:          scoreTimetable(i.timetable),
    continuity:         scoreContinuity(i.continuity),
  }

  const sumW = WEIGHT_KEYS.reduce((a, k) => a + settings.weights[k], 0) || 1
  const knownW = WEIGHT_KEYS.reduce((a, k) => a + (comps[k].raw === null ? 0 : settings.weights[k]), 0)
  const divisor = settings.unknownPolicy === "renormalize" ? (knownW || 1) : sumW

  let total = 0
  const components = WEIGHT_KEYS.map((k) => {
    const c = comps[k]
    const known = c.raw !== null
    const contribution = known ? (settings.weights[k] * c.raw) / divisor : 0
    total += contribution
    return {
      key: k, label: WEIGHT_LABELS[k],
      weight: round1((settings.weights[k] / sumW) * 100),
      raw: c.raw, known,
      contribution: round1(contribution),
      detail: c.detail, facts: c.facts,
    }
  })

  const eligibility = evaluateEligibility({ ...i, expertiseRaw: comps.expertise.raw })
  const completeness = Math.round((knownW / sumW) * 100)

  return {
    facultyId: i.faculty.id,
    name: i.faculty.name,
    email: i.faculty.email,
    score: round1(total),
    completeness,
    components,
    eligibility,
    explanation: buildExplanation(components, eligibility),
    workload: {
      currentHours: round1(i.workload.currentHours),
      projectedHours: round1(i.workload.projectedHours),
      maxHours: i.workload.maxHours,
      currentCourses: i.workload.currentCourses,
      projectedCourses: i.workload.projectedCourses,
      maxCourses: settings.limits.maxCourses,
      estimated: i.workload.estimated,
    },
    unknownFields: components.filter((c) => !c.known).map((c) => c.label),
  }
}

function buildExplanation(components, eligibility) {
  const lines = []
  for (const c of components) {
    if (!c.known) lines.push(`${c.label}: unknown — ${c.detail}`)
    else lines.push(`${c.label}: ${c.raw}/100 — ${c.detail}`)
  }
  if (eligibility.status === "ineligible") lines.unshift(`Not eligible: ${eligibility.blockers.join(" | ")}`)
  return lines
}

/* ═══════════════════════════ ranking ═══════════════════════════ */

const comp = (c, k) => (c.components.find((x) => x.key === k) || {}).raw
const num  = (v) => (v === null || v === undefined ? -1 : v)

/**
 * Eligible / needs-review first (by score), ineligible last. Ties are broken the same way every time:
 * previous teaching → expertise → lower projected hours → name → id.
 */
function rankCandidates(list) {
  const order = (s) => (s === "ineligible" ? 1 : 0)
  const sorted = [...list].sort((a, b) =>
    order(a.eligibility.status) - order(b.eligibility.status) ||
    b.score - a.score ||
    num(comp(b, "previousTeaching")) - num(comp(a, "previousTeaching")) ||
    num(comp(b, "expertise")) - num(comp(a, "expertise")) ||
    a.workload.projectedHours - b.workload.projectedHours ||
    String(a.name).localeCompare(String(b.name)) ||
    String(a.facultyId).localeCompare(String(b.facultyId)))
  let r = 0
  return sorted.map((c) => ({ ...c, rank: c.eligibility.status === "ineligible" ? null : ++r }))
}

module.exports = {
  WEIGHT_KEYS, WEIGHT_LABELS, DEFAULT_WEIGHTS, DEFAULT_LIMITS, DEFAULT_POLICY, LEVEL_RANK,
  normalizeSettings, validateSettings,
  tokenPairs, stems, courseTopics,
  parseDays, parseTimeSpec, scheduleInfo, sessionRelation, slotLabel,
  leaveCoverage,
  scoreExpertise, scoreTeaching, scoreExperience, scoreWorkload, scoreTimetable, scoreContinuity,
  evaluateEligibility, evaluateCandidate, rankCandidates,
}
