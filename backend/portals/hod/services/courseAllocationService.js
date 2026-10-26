/**
 * Course Allocation — data layer.
 *
 *   loadContext()        one round of queries for the whole department (faculty, courses, leave,
 *                        profiles, allocation history, settings).  Everything below is in-memory.
 *   evaluateTarget()     rank every faculty member for ONE course (or batch).  This is the unit a future
 *                        department-wide optimiser calls once per course; pass `tentative` to make it
 *                        aware of assignments that have been chosen but not saved yet.
 *   buildEvaluationMatrix()  evaluateTarget() for many targets → the score/eligibility matrix an
 *                        optimiser needs.  (No optimiser is implemented yet — by design.)
 *   confirmAllocation()  re-runs the evaluation on the server, refuses anything blocked / duplicated /
 *                        stale, writes the history row and updates the course atomically.
 */
const User         = require("../../../shared/models/User")
const Course       = require("../../../shared/models/Course")
const Notification = require("../../../shared/models/Notification")
const { Leave }    = require("../../../shared/models/Leave")
const { CourseAllocation, AllocationSettings, FacultyProfile, CourseRequirement } = require("../models/CourseAllocation")
const E = require("../utils/courseAllocationEngine")
const { missingFields, isComplete } = require("../../../shared/utils/facultyProfile")

class AllocationError extends Error {
  constructor(status, message, extra = {}) { super(message); this.status = status; this.extra = extra }
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const pad      = (n) => String(n).padStart(2, "0")
const localKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const utcKey   = (d) => new Date(d).toISOString().slice(0, 10)
const isId     = (s) => /^[a-f\d]{24}$/i.test(String(s || ""))
const validKey = (k) => /^\d{4}-\d{2}-\d{2}$/.test(String(k)) && !isNaN(new Date(`${k}T00:00:00.000Z`).getTime())
const sid      = (v) => (v ? String(v) : "")
const sameStr  = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase()
const fmtDate  = (k) => new Date(`${k}T00:00:00.000Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })

/* ═══════════════════════════ input validation ═══════════════════════════ */

function parseTermInput(body) {
  const errors = []
  const term = String((body && body.term) || "").trim()
  const startDate = String((body && body.startDate) || "").trim()
  const endDate = String((body && body.endDate) || "").trim()
  if (!term) errors.push("Semester / term name is required")
  else if (term.length > 80) errors.push("Semester / term name is too long (80 characters max)")
  if (!validKey(startDate)) errors.push("A valid semester start date is required")
  if (!validKey(endDate)) errors.push("A valid semester end date is required")
  if (!errors.length) {
    if (endDate <= startDate) errors.push("Semester end date must be after the start date")
    else if ((new Date(endDate) - new Date(startDate)) / 864e5 > 400) errors.push("A semester cannot be longer than 400 days")
    else if (endDate < localKey()) errors.push("This semester has already ended")
  }
  return { errors, value: { term, startDate, endDate } }
}

/* ═══════════════════════════ context ═══════════════════════════ */

async function loadContext(dept, { startDate, endDate } = {}) {
  dept = String(dept || "").trim()
  if (!dept) throw new AllocationError(400, "Your profile has no department set, so course allocation is unavailable")
  const deptRe = new RegExp(`^${escapeRe(dept)}$`, "i")

  const [facultyDocs, courses, settingsDoc, allocations, requirements] = await Promise.all([
    User.find({ role: "teaching", department: deptRe }).select("name email department").lean(),
    Course.find({}).select("-students -batches.students").lean(),
    AllocationSettings.findOne({ department: dept }).lean(),
    CourseAllocation.find({ department: dept, status: { $in: ["active", "superseded"] } }).lean(),
    CourseRequirement.find({ department: dept }).lean(),
  ])
  const facIds = facultyDocs.map((f) => String(f._id))

  const teacherIds = new Set()
  for (const c of courses) {
    if (c.teacher && c.teacher.id) teacherIds.add(String(c.teacher.id))
    for (const b of c.batches || []) if (b.teacher && b.teacher.id) teacherIds.add(String(b.teacher.id))
  }
  const [teacherUsers, profiles, leaves] = await Promise.all([
    User.find({ _id: { $in: [...teacherIds] } }).select("department").lean(),
    FacultyProfile.find({ facultyId: { $in: facIds } }).lean(),
    startDate && endDate && facIds.length
      ? Leave.find({
          facultyId: { $in: facIds }, status: { $in: ["Approved", "Pending"] },
          fromDate: { $lte: new Date(`${endDate}T23:59:59.999Z`) }, toDate: { $gte: new Date(`${startDate}T00:00:00.000Z`) },
        }).lean()
      : Promise.resolve([]),
  ])

  const leavesBy = {}
  for (const l of leaves) {
    ;(leavesBy[l.facultyId] = leavesBy[l.facultyId] || []).push({ from: utcKey(l.fromDate), to: utcKey(l.toDate), type: l.type, status: l.status })
  }

  return {
    dept,
    term: { startDate, endDate },
    faculty: facultyDocs.map((f) => ({ id: String(f._id), name: f.name, email: f.email || "" })),
    courses,
    courseById: Object.fromEntries(courses.map((c) => [String(c._id), c])),
    teacherDept: Object.fromEntries(teacherUsers.map((u) => [String(u._id), u.department || ""])),
    settings: E.normalizeSettings(settingsDoc),
    settingsDoc,
    profileById: Object.fromEntries(profiles.map((p) => [p.facultyId, p])),
    allocations,
    requirementByCourse: Object.fromEntries(requirements.map((r) => [String(r.courseRef), r])),
    leavesBy,
  }
}

/** "own" | "unclaimed" | "other" — Course has no mandatory department, so it is inferred when empty. */
function courseDeptState(ctx, course) {
  const dept = (course.department || "").trim()
  if (dept) return sameStr(dept, ctx.dept) ? "own" : "other"
  const teachers = [course.teacher && course.teacher.id, ...(course.batches || []).map((b) => b.teacher && b.teacher.id)].filter(Boolean).map(String)
  if (!teachers.length) return "unclaimed"
  const depts = teachers.map((id) => ctx.teacherDept[id] || "")
  if (depts.some((d) => sameStr(d, ctx.dept))) return "own"
  return depts.some(Boolean) ? "other" : "unclaimed"
}

/* ═══════════════════════════ what the HOD typed ═══════════════════════════ */

/**
 * body = {
 *   course:  { courseId?, courseCode, courseName, credits },
 *   batches: { total, from, to, schedule: { days, time } },   // total = 1 → whole course; batches from..to meet together
 *   term, startDate, endDate }
 * Credits and schedule are always entered by the HOD. Batch i of a course is its i-th batch (created as
 * "Batch i" if it does not exist yet); the teacher gets batches from..to, which have class together (one schedule).
 */
function parseCourseInput(body) {
  const errors = []
  const c = (body && body.course) || {}
  const b = (body && body.batches) || {}
  const courseCode = String(c.courseCode || "").trim().slice(0, 30)
  const courseName = String(c.courseName || "").trim().slice(0, 120)
  const credits = Number(c.credits)
  if (!courseCode) errors.push("Course code is required")
  if (!courseName) errors.push("Course name is required")
  if (!(credits > 0 && credits <= 20)) errors.push("Credits must be between 0.5 and 20")

  const total = parseInt(b.total, 10) || 1
  if (!(total >= 1 && total <= 30)) errors.push("Number of batches must be between 1 and 30")
  const whole = total === 1
  const from = whole ? 1 : parseInt(b.from, 10)
  const to = whole ? 1 : parseInt(b.to, 10)
  if (!whole && !(from >= 1 && to >= from && to <= total)) errors.push("Choose a valid batch range")

  // The selected batches meet TOGETHER: one weekly schedule for the whole selection.
  const raw = b.schedule || (Array.isArray(b.schedules) ? b.schedules[0] : null) || {}
  const days = String(raw.days || "").trim(); const time = String(raw.time || "").trim()
  const parts = []
  if (!errors.length) {
    const label = whole ? "the course" : (from === to ? `Batch ${from}` : `Batches ${from}–${to}`)
    const t = E.parseTimeSpec(time)
    if (!E.parseDays(days).length) errors.push(`Select the class days for ${label}`)
    else if (t.start == null || t.end == null) errors.push(`Enter a start and end time for ${label}`)
    else for (let i = whole ? 0 : from; i <= (whole ? 0 : to); i++) parts.push({ index: i, schedule: { days, time } })
  }
  return { errors, value: { courseId: isId(c.courseId) ? String(c.courseId) : "", courseCode, courseName, credits, total, whole, from, to, parts } }
}

/** The course as typed: an existing Course (matched by id, else by code) with the HOD's values laid over it, or a new one. */
function resolveCourse(ctx, input) {
  let existing = input.courseId ? ctx.courseById[input.courseId] : null
  if (!existing) existing = ctx.courses.find((c) => sameStr(c.courseCode, input.courseCode) || sameStr(c.courseId, input.courseCode)) || null
  if (existing) {
    const state = courseDeptState(ctx, existing)
    if (state === "other") throw new AllocationError(403, "A course with this code belongs to another department")
    if (existing.status === "archived") throw new AllocationError(400, "This course is archived and cannot be allocated")
  }
  const key = existing ? String(existing._id) : `new:${input.courseCode.toLowerCase()}`
  const course = {
    ...(existing || { status: "active", teacher: {}, batches: [], schedule: {}, department: "" }),
    _id: existing ? existing._id : key, courseCode: input.courseCode, courseName: input.courseName, credits: input.credits,
  }
  return { existing, course, key, state: existing ? courseDeptState(ctx, existing) : "unclaimed" }
}

const teacherOfDoc = (t) => ({ id: sid(t && t.id), name: (t && t.name) || "" })

/** Parts = the main course, or batches from..to (existing batch i, else a not-yet-created "Batch i"). */
function buildTarget(course, input) {
  const code = course.courseCode
  if (input.whole) {
    return {
      scope: "course", label: code,
      parts: [{ index: 0, batchId: "", name: "", targetKey: "main", schedule: input.parts[0].schedule, teacher: teacherOfDoc(course.teacher) }],
    }
  }
  const parts = input.parts.map((p) => {
    const b = (course.batches || [])[p.index - 1]
    return { index: p.index, batchId: b ? String(b._id) : "", name: b ? b.batchName : `Batch ${p.index}`, targetKey: b ? String(b._id) : `new:${p.index}`, schedule: p.schedule, teacher: teacherOfDoc(b && b.teacher) }
  })
  const first = parts[0].index; const last = parts[parts.length - 1].index
  return { scope: "batch", label: `${code} · ${first === last ? `Batch ${first}` : `Batches ${first}–${last}`}`, parts }
}

const targetTeachers = (t) => {
  const seen = new Map()
  t.parts.forEach((p) => { if (p.teacher.id) seen.set(p.teacher.id, p.teacher) })
  return [...seen.values()]
}

/* ═══════════════════════════ per-candidate facts ═══════════════════════════ */

const matchesCourse = (code, name, course) => {
  if (code && [course.courseCode, course.courseId].some((c) => sameStr(c, code))) return true
  if (!code && name) {
    const a = E.stems(name); const b = E.stems(course.courseName)
    return a.size > 0 && a.size === b.size && [...a].every((t) => b.has(t))
  }
  return false
}

/** The faculty member's other teaching: active classes (load + clashes) and everything ever taught. */
function facultyLoad(ctx, course, target, facultyId, tentative) {
  const existing = []
  const everTaught = []
  const ownBatch = new Set(target.parts.map((p) => p.batchId).filter(Boolean))
  for (const c of ctx.courses) {
    const cid = String(c._id)
    const sameCourse = cid === String(course._id)
    const add = (schedule, batchLabel, isTarget) => {
      const info = E.scheduleInfo(schedule, c.credits)
      const row = { courseId: cid, course: c, batch: batchLabel, joint: batchLabel ? `${(schedule && schedule.days) || ""}|${(schedule && schedule.time) || ""}` : "", label: batchLabel ? `${c.courseCode || c.courseId} · ${batchLabel}` : `${c.courseCode || c.courseId}`, info }
      everTaught.push(row)
      if (c.status === "active" && !isTarget) existing.push(row)
    }
    if (sid(c.teacher && c.teacher.id) === facultyId) add(c.schedule, "", sameCourse && target.scope === "course")
    for (const b of c.batches || []) {
      if (sid(b.teacher && b.teacher.id) === facultyId) add(b.schedule, b.batchName, sameCourse && target.scope === "batch" && ownBatch.has(String(b._id)))
    }
  }
  for (const t of tentative || []) {
    if (t.facultyId !== facultyId || t.courseId === String(course._id)) continue
    existing.push({ courseId: t.courseId, label: t.label, info: t.info })
  }
  // batches of one course that meet at the same time are ONE class (not several): count their hours once
  const merged = []
  const byKey = new Map()
  for (const r of existing) {
    const key = r.joint ? `${r.courseId}|${r.joint}` : ""
    if (key && byKey.has(key)) { const m = byKey.get(key); m.labels.push(r.batch); continue }
    const row = { ...r, labels: r.batch ? [r.batch] : [] }
    if (key) byKey.set(key, row)
    merged.push(row)
  }
  for (const r of merged) if (r.labels.length > 1) r.label = `${r.course.courseCode || r.course.courseId} · ${r.labels.join(", ")}`
  return { existing: merged, everTaught }
}

function buildCandidateInput(ctx, course, target, topics, requirement, fac, tentative) {
  const id = fac.id
  const profile = ctx.profileById[id] || null
  const settings = ctx.settings
  const { existing, everTaught } = facultyLoad(ctx, course, target, id, tentative)

  /* the new classes (every selected batch) vs the faculty's existing classes */
  const infos = [{ part: target.parts[0], info: E.scheduleInfo(target.parts[0].schedule, course.credits) }]   // joint class: counted once
  const newSessions = infos[0].info.sessions
  const newHours = infos[0].info.hours
  const existingSessions = []
  const conflicts = []; const uncertain = []
  const seen = new Set()
  for (const row of existing) {
    for (const s of row.info.sessions) {
      existingSessions.push({ ...s, label: row.label })
      for (const cs of newSessions) {
        const rel = E.sessionRelation(cs, s)
        if (rel === "none") continue
        const k = `${rel}|${row.label}|${s.day}`
        if (seen.has(k)) continue
        seen.add(k)
        ;(rel === "conflict" ? conflicts : uncertain).push({ withCourse: row.label, day: s.day, slot: E.slotLabel(s) })
      }
    }
  }

  /* workload */
  const currentHours = existing.reduce((a, r) => a + r.info.hours, 0)
  const courseIds = new Set(existing.map((r) => r.courseId))
  const projectedIds = new Set([...courseIds, String(course._id)])
  const workload = {
    currentHours, projectedHours: currentHours + newHours, maxHours: settings.limits.maxWeeklyHours,
    estimated: infos.some((x) => x.info.estimated) || existing.some((r) => r.info.estimated),
    currentCourses: courseIds.size, projectedCourses: projectedIds.size,
  }

  /* leave */
  const L = ctx.leavesBy[id] || []
  const termDays = E.leaveCoverage([], ctx.term.startDate, ctx.term.endDate).termDays
  const approved = E.leaveCoverage(L.filter((l) => l.status === "Approved"), ctx.term.startDate, ctx.term.endDate).days
  const all = E.leaveCoverage(L, ctx.term.startDate, ctx.term.endDate).days
  const leave = { approvedDays: approved, pendingDays: Math.max(0, all - approved), termDays }

  /* previous teaching */
  const thisCourseAllocs = ctx.allocations.filter((a) => String(a.courseRef) === String(course._id))
  const mine = thisCourseAllocs.filter((a) => a.facultyId === id && a.term !== ctx.term.name)
  const allocTerms = new Set(mine.map((a) => a.term))
  const manual = (profile && profile.teachingHistory) || []
  const manualExact = manual.filter((h) => matchesCourse(h.courseCode, h.courseName, course))
  const manualTerms = manualExact.reduce((a, h) => a + (Number(h.terms) || 1), 0)
  const sameCourseRows = existing.filter((r) => r.courseId === String(course._id))
  const currentlyTeaching = target.parts.some((p) => p.teacher.id === id) || sameCourseRows.length > 0
  const exactTerms = allocTerms.size + manualTerms + (currentlyTeaching && allocTerms.size === 0 ? 1 : 0)

  const touches = (name) => topics.tags.some((t) => [...t.tokens].some((tok) => E.stems(name).has(tok)))
  const similarIds = new Set()
  for (const r of everTaught) if (r.courseId !== String(course._id) && touches(r.course.courseName)) similarIds.add(r.courseId)
  for (const a of ctx.allocations) {
    if (a.facultyId === id && String(a.courseRef) !== String(course._id) && touches(a.courseName)) similarIds.add(String(a.courseRef))
  }
  const manualSimilar = manual.filter((h) => !manualExact.includes(h) && touches(h.courseName)).length
  const hasRecords = everTaught.length > 0 || ctx.allocations.some((a) => a.facultyId === id) || manual.length > 0 || !!(profile && profile.noPriorTeaching)

  /* continuity */
  const prior = thisCourseAllocs.filter((a) => a.term !== ctx.term.name)
    .sort((a, b) => String(b.endDate).localeCompare(String(a.endDate)) || new Date(b.createdAt) - new Date(a.createdAt))
  const courseHasHistory = prior.length > 0 || targetTeachers(target).length > 0 || thisCourseAllocs.length > 0
    || Object.values(ctx.profileById).some((p) => (p.teachingHistory || []).some((h) => matchesCourse(h.courseCode, h.courseName, course)))
  const continuity = {
    courseHasHistory,
    currentlyTeaching,
    taughtLastTerm: prior.length > 0 && prior[0].facultyId === id,
    taughtEarlier: mine.length > 0 || manualExact.length > 0,
  }

  return {
    faculty: fac, profile, topics, requirement, settings,
    alsoTeaches: sameCourseRows.flatMap((r) => r.labels || []).filter(Boolean),   // other batches of THIS course they already have
    profileComplete: isComplete(profile),
    sameDepartment: true,
    alreadyAssigned: target.parts.every((p) => p.teacher.id === id),
    timetable: { scheduleKnown: infos.every((x) => x.info.known), conflicts, uncertain, courseSessions: newSessions, existingSessions },
    workload, leave,
    teaching: { exactTerms, similarCourses: similarIds.size + manualSimilar, hasRecords },
    continuity,
  }
}

/* ═══════════════════════════ evaluation ═══════════════════════════ */

/**
 * Rank all department faculty for one course (or a range of its batches).
 * `ctx.term.name` must be set (only used to ignore the CURRENT term when reading history).
 */
function evaluateTarget(ctx, course, target, { tentative } = {}) {
  const requirement = ctx.requirementByCourse[String(course._id)] || null
  const topics = E.courseTopics(course, requirement)
  const evaluated = ctx.faculty.map((f) => {
    const input = buildCandidateInput(ctx, course, target, topics, requirement, f, tentative)
    return { ...E.evaluateCandidate(input), alsoTeaches: input.alsoTeaches }
  })
  return {
    topics: { source: topics.source, tags: topics.tags.map((t) => t.label) },
    requirement: requirement
      ? { subjectTags: requirement.subjectTags || [], minQualification: requirement.minQualification || "", requireSubjectMatch: !!requirement.requireSubjectMatch }
      : { subjectTags: [], minQualification: "", requireSubjectMatch: false },
    candidates: E.rankCandidates(evaluated),
  }
}

/** evaluateTarget() for many prepared { course, target } pairs — the input a department-wide optimiser would consume. */
function buildEvaluationMatrix(ctx, items, opts) {
  return items.map(({ course, target }) => ({ courseId: String(course._id), label: target.label, ...evaluateTarget(ctx, course, target, opts) }))
}

const shapeSettings = (s) => ({ weights: s.weights, limits: s.limits, unknownPolicy: s.unknownPolicy, blockOnUnknownQualification: s.blockOnUnknownQualification })

const activeAllocationFor = (ctx, course, part, term) =>
  ctx.allocations.find((a) => a.status === "active" && String(a.courseRef) === String(course._id) && a.targetKey === part.targetKey && a.term === term) || null

/* ═══════════════════════════ handlers' building blocks ═══════════════════════════ */

function prepare(ctx, body) {
  const ci = parseCourseInput(body)
  if (ci.errors.length) throw new AllocationError(400, ci.errors.join(". "))
  const { existing, course, state } = resolveCourse(ctx, ci.value)
  return { input: ci.value, existing, course, state, target: buildTarget(course, ci.value) }
}

async function recommend(dept, body) {
  const { errors, value } = parseTermInput(body)
  if (errors.length) throw new AllocationError(400, errors.join(". "))
  const ctx = await loadContext(dept, value)
  ctx.term.name = value.term
  const { input, existing, course, state, target } = prepare(ctx, body)

  const result = evaluateTarget(ctx, course, target)
  const active = target.parts.map((p) => activeAllocationFor(ctx, course, p, value.term)).find(Boolean)
  return {
    course: {
      _id: existing ? String(existing._id) : "", isNew: !existing, courseCode: course.courseCode, courseName: course.courseName,
      credits: course.credits, departmentState: state,
    },
    target: {
      scope: target.scope, label: target.label,
      batches: target.parts.filter((p) => p.index).map((p) => ({ index: p.index, name: p.name, currentTeacher: p.teacher.id ? p.teacher : null })),
      total: input.total,
      currentTeachers: targetTeachers(target),
    },
    term: value,
    settings: shapeSettings(ctx.settings),
    ...result,
    activeAllocation: active ? { id: String(active._id), facultyName: active.facultyName, term: active.term } : null,
    totals: { faculty: result.candidates.length, eligible: result.candidates.filter((c) => c.eligibility.status !== "ineligible").length },
  }
}

function courseCard(ctx, c, state) {
  const sched = E.scheduleInfo(c.schedule, c.credits)
  const req = ctx.requirementByCourse[String(c._id)]
  return {
    _id: String(c._id), courseId: c.courseId || c.courseCode, courseCode: c.courseCode || c.courseId, courseName: c.courseName,
    sem: c.sem || "N/A", credits: c.credits || 0, status: c.status || "active",
    schedule: c.schedule || { days: "", time: "", room: "" }, scheduleKnown: sched.known,
    departmentState: state,
    teacher: c.teacher && c.teacher.id ? { id: String(c.teacher.id), name: c.teacher.name || "" } : null,
    allocation: c.allocation && c.allocation.term ? { term: c.allocation.term, startDate: c.allocation.startDate, endDate: c.allocation.endDate, assignedAt: c.allocation.assignedAt } : null,
    hasRequirement: !!req,
    batches: (c.batches || []).map((b) => ({
      _id: String(b._id), batchName: b.batchName, schedule: b.schedule || { days: "", time: "", room: "" },
      teacher: b.teacher && b.teacher.id ? { id: String(b.teacher.id), name: b.teacher.name || "" } : null,
      allocation: b.allocation && b.allocation.term ? { term: b.allocation.term, startDate: b.allocation.startDate, endDate: b.allocation.endDate } : null,
    })),
  }
}

/** Existing courses of the department — only used to suggest / pre-fill while the HOD types. */
async function listCourses(dept) {
  const ctx = await loadContext(dept)
  return ctx.courses
    .filter((c) => c.status !== "archived")
    .map((c) => ({ c, state: courseDeptState(ctx, c) }))
    .filter((x) => x.state !== "other")
    .map((x) => courseCard(ctx, x.c, x.state))
    .sort((a, b) => String(a.courseCode).localeCompare(String(b.courseCode)))
}

/* ═══════════════════════════ confirm ═══════════════════════════ */

const allocationShape = (a) => ({
  id: String(a._id), groupId: a.groupId || "", batchIndex: a.batchIndex || 0,
  courseRef: String(a.courseRef), courseId: a.courseId, courseCode: a.courseCode, courseName: a.courseName, courseSem: a.courseSem,
  scope: a.scope, batchId: a.batchId, batchName: a.batchName,
  term: a.term, startDate: a.startDate, endDate: a.endDate,
  facultyId: a.facultyId, facultyName: a.facultyName,
  status: a.status, rank: a.rank, candidatesConsidered: a.candidatesConsidered,
  score: a.scoreSnapshot ? a.scoreSnapshot.total : null,
  completeness: a.scoreSnapshot ? a.scoreSnapshot.completeness : null,
  components: a.scoreSnapshot ? a.scoreSnapshot.components : [],
  eligibility: a.eligibilitySnapshot || null,
  settings: a.settingsSnapshot || null,
  warnings: a.warnings || [], acknowledgedWarnings: !!a.acknowledgedWarnings,
  replacedExisting: !!a.replacedExisting, previousTeacher: a.previousTeacher && a.previousTeacher.id ? a.previousTeacher : null,
  note: a.note || "",
  assignedByName: a.assignedByName || "", createdAt: a.createdAt,
  cancelledAt: a.cancelledAt || null, cancelReason: a.cancelReason || "",
})

const notify = async (userId, title, message, meta = {}) => {
  try { await Notification.create({ userId, type: "course", title, message, link: "/courses", meta }) } catch { /* never block the assignment */ }
}

const batchWord = (parts) => {
  const idx = parts.filter((p) => p.index).map((p) => p.index)
  if (!idx.length) return ""
  return idx.length === 1 ? ` (Batch ${idx[0]})` : ` (Batches ${idx[0]}–${idx[idx.length - 1]})`
}

async function confirmAllocation(req, body) {
  const dept = req.dept
  const { errors, value } = parseTermInput(body)
  if (errors.length) throw new AllocationError(400, errors.join(". "))
  if (!isId(body.facultyId)) throw new AllocationError(400, "Select a faculty member")
  const note = String(body.note || "").trim().slice(0, 500)

  // Everything is recomputed from the database — nothing the browser sent about scores or eligibility is trusted.
  const ctx = await loadContext(dept, value)
  ctx.term.name = value.term
  const { input, existing, course, target } = prepare(ctx, body)

  for (const p of target.parts) {
    const dup = activeAllocationFor(ctx, course, p, value.term)
    if (dup) {
      throw new AllocationError(409, `${target.label} is already allocated to ${dup.facultyName} for "${value.term}". Cancel that allocation in the history first if you want to change it.`, { code: "DUPLICATE" })
    }
  }

  const result = evaluateTarget(ctx, course, target)
  const cand = result.candidates.find((c) => c.facultyId === String(body.facultyId))
  if (!cand) throw new AllocationError(400, "That person is not teaching faculty of your department", { code: "NOT_IN_DEPARTMENT" })
  if (cand.eligibility.status === "ineligible") {
    throw new AllocationError(409, `${cand.name} can no longer be assigned: ${cand.eligibility.blockers.join(" | ")}`, { code: "INELIGIBLE", blockers: cand.eligibility.blockers })
  }
  const others = targetTeachers(target).filter((t) => t.id !== cand.facultyId)
  if (others.length && !body.replaceExisting) {
    throw new AllocationError(409, `${target.label} is currently taught by ${others.map((t) => t.name || "another faculty member").join(", ")}. Confirm that you want to replace them.`, { code: "REPLACES_EXISTING", currentTeacher: others[0] })
  }
  if (cand.eligibility.warnings.length && !body.acknowledgeWarnings) {
    throw new AllocationError(409, "Review and acknowledge the warnings before confirming", { code: "WARNINGS_NOT_ACKNOWLEDGED", warnings: cand.eligibility.warnings })
  }

  const faculty = ctx.faculty.find((f) => f.id === cand.facultyId)
  const now = new Date()
  const claim = !(course.department || "").trim()
  const deptFilter = claim ? { $in: [null, ""] } : course.department

  // 0 ─ the course itself: created if the HOD typed a new one; credits / name / schedule are the HOD's values
  let courseId
  if (existing) {
    courseId = existing._id
  } else {
    const created = await Course.create({
      courseId: input.courseCode, courseCode: input.courseCode, courseName: input.courseName,
      label: `${input.courseCode} — ${input.courseName}`, credits: input.credits, status: "active", department: dept,
      schedule: input.whole ? { ...input.parts[0].schedule, room: "" } : { days: "", time: "", room: "" },
    })
    courseId = created._id
  }
  if (!input.whole) {                                    // make sure Batch 1..total exist
    const have = existing ? (existing.batches || []).length : 0
    if (have < input.total) {
      const add = []
      for (let i = have + 1; i <= input.total; i++) add.push({ batchName: `Batch ${i}`, teacher: {}, schedule: { days: "", time: "", room: "" } })
      await Course.updateOne({ _id: courseId }, { $push: { batches: { $each: add } } })
    }
  }
  const fresh = await Course.findById(courseId).lean()
  const deptNow = claim ? { $in: [null, "", dept] } : deptFilter
  await Course.updateOne({ _id: courseId }, { $set: { courseName: input.courseName, credits: input.credits, label: `${input.courseCode} — ${input.courseName}` } })

  // 1 ─ history rows (one per batch, same groupId). The partial unique index is the final guard against duplicates / races.
  const groupId = `${courseId}-${now.getTime()}-${faculty.id.slice(-4)}`
  const rows = []
  const parts = target.parts.map((p) => {
    const b = p.index ? (fresh.batches || [])[p.index - 1] : null
    return { ...p, batchId: b ? String(b._id) : "", name: b ? b.batchName : "", targetKey: b ? String(b._id) : "main", batchDoc: b }
  })
  try {
    for (const p of parts) {
      rows.push(await CourseAllocation.create({
        department: dept, groupId, batchIndex: p.index,
        courseRef: courseId, courseId: input.courseCode, courseCode: input.courseCode, courseName: input.courseName, courseSem: course.sem || "",
        scope: target.scope, batchId: p.batchId, batchName: p.name, targetKey: p.targetKey,
        term: value.term, startDate: value.startDate, endDate: value.endDate,
        facultyId: faculty.id, facultyName: faculty.name,
        status: "active",
        rank: cand.rank, candidatesConsidered: result.candidates.length,
        scoreSnapshot: { total: cand.score, completeness: cand.completeness, components: cand.components },
        eligibilitySnapshot: { status: cand.eligibility.status, checks: cand.eligibility.checks },
        settingsSnapshot: shapeSettings(ctx.settings),
        warnings: cand.eligibility.warnings, acknowledgedWarnings: !!body.acknowledgeWarnings,
        replacedExisting: !!(p.teacher.id && p.teacher.id !== faculty.id), previousTeacher: { id: p.teacher.id, name: p.teacher.name },
        note, assignedById: String(req.user._id), assignedByName: req.user.name || "",
      }))
    }
  } catch (e) {
    for (const r of rows) await CourseAllocation.deleteOne({ _id: r._id })
    if (e && e.code === 11000) throw new AllocationError(409, `${target.label} was just allocated for "${value.term}" by someone else. Refresh and review.`, { code: "DUPLICATE" })
    throw e
  }

  // 2 ─ update the course only where nobody changed the teacher since we read it
  const applied = []
  const rollback = async () => {
    for (const a of applied) {
      const prevId = a.part.teacher.id
      if (a.part.index) {
        await Course.updateOne({ _id: courseId, batches: { $elemMatch: { _id: a.part.batchId, "teacher.id": faculty.id } } },
          prevId ? { $set: { "batches.$.teacher": { id: prevId, name: a.part.teacher.name } } }
                 : { $set: { "batches.$.teacher.name": "" }, $unset: { "batches.$.teacher.id": "" } })
      } else {
        await Course.updateOne({ _id: courseId, "teacher.id": faculty.id },
          prevId ? { $set: { "teacher.id": prevId, "teacher.name": a.part.teacher.name } }
                 : { $set: { "teacher.name": "" }, $unset: { "teacher.id": "" } })
      }
    }
    for (const r of rows) await CourseAllocation.deleteOne({ _id: r._id })
  }
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]
    const info = { term: value.term, startDate: value.startDate, endDate: value.endDate, allocationId: rows[i]._id, assignedAt: now }
    const prevMatch = p.teacher.id ? p.teacher.id : null
    const room = p.batchDoc && p.batchDoc.schedule ? p.batchDoc.schedule.room || "" : (fresh.schedule && fresh.schedule.room) || ""
    let res
    if (!p.index) {
      res = await Course.updateOne(
        { _id: courseId, "teacher.id": prevMatch, department: deptNow },
        { $set: { "teacher.id": faculty.id, "teacher.name": faculty.name, schedule: { ...p.schedule, room }, allocation: info, ...(claim ? { department: dept } : {}) } },
      )
    } else {
      res = await Course.updateOne(
        { _id: courseId, department: deptNow, batches: { $elemMatch: { _id: p.batchId, "teacher.id": prevMatch } } },
        { $set: { "batches.$.teacher": { id: faculty.id, name: faculty.name }, "batches.$.schedule": { ...p.schedule, room }, "batches.$.allocation": info, ...(claim ? { department: dept } : {}) } },
      )
    }
    if (!res.matchedCount) {
      await rollback()
      throw new AllocationError(409, "This course was changed by someone else while you were reviewing. Refresh the recommendations and try again.", { code: "STALE" })
    }
    applied.push({ part: p })
  }

  // 3 ─ older allocations of the same course/batches are history now
  await CourseAllocation.updateMany(
    { courseRef: courseId, targetKey: { $in: parts.map((p) => p.targetKey) }, status: "active", groupId: { $ne: groupId } },
    { $set: { status: "superseded" } },
  )

  // 4 ─ tell the people concerned
  const where = `${input.courseCode} — ${input.courseName}${batchWord(parts)}`
  await notify(faculty.id, "Course Assigned",
    `${req.user.name || "Your HOD"} assigned you ${where} for ${value.term} (${fmtDate(value.startDate)} – ${fmtDate(value.endDate)}).`,
    { groupId, courseId: String(courseId) })
  for (const t of others) {
    await notify(t.id, "Course Reassigned", `${where} is now assigned to ${faculty.name} for ${value.term}.`, { groupId, courseId: String(courseId) })
  }

  return { ...allocationShape(rows[0].toObject ? rows[0].toObject() : rows[0]), batchNames: parts.filter((p) => p.index).map((p) => p.name), count: rows.length }
}

async function cancelAllocation(req, id, reason) {
  if (!isId(id)) throw new AllocationError(400, "Invalid allocation id")
  const first = await CourseAllocation.findById(id)
  if (!first || first.department !== req.dept) throw new AllocationError(404, "Allocation not found")
  if (first.status !== "active") throw new AllocationError(409, "Only an active allocation can be cancelled")

  // a multi-batch assignment is cancelled as a whole
  const group = first.groupId
    ? await CourseAllocation.find({ department: req.dept, groupId: first.groupId, status: "active" }).lean()
    : [first.toObject ? first.toObject() : first]
  const why = String(reason || "").trim().slice(0, 300)

  for (const a of group) {
    const doc = await CourseAllocation.findById(a._id)
    doc.status = "cancelled"; doc.cancelledAt = new Date(); doc.cancelledById = String(req.user._id); doc.cancelReason = why
    await doc.save()
    // Remove the teacher only if they are still the one this allocation put there
    if (a.scope === "course") {
      await Course.updateOne({ _id: a.courseRef, "teacher.id": a.facultyId }, { $set: { "teacher.name": "" }, $unset: { "teacher.id": "", allocation: "" } })
    } else {
      await Course.updateOne(
        { _id: a.courseRef, batches: { $elemMatch: { _id: a.batchId, "teacher.id": a.facultyId } } },
        { $set: { "batches.$.teacher.name": "" }, $unset: { "batches.$.teacher.id": "", "batches.$.allocation": "" } },
      )
    }
  }
  const names = group.filter((a) => a.batchName).map((a) => a.batchName)
  await notify(first.facultyId, "Course Allocation Cancelled",
    `Your allocation to ${first.courseCode} — ${first.courseName}${names.length ? ` (${names.join(", ")})` : ""} for ${first.term} was cancelled by ${req.user.name || "your HOD"}.`,
    { groupId: first.groupId || "", courseId: String(first.courseRef) })
  return { ...allocationShape(first.toObject ? first.toObject() : first), status: "cancelled" }
}

/** One entry per assignment (a multi-batch assignment is a single entry listing its batches). */
async function listHistory(dept, q = {}) {
  const filter = { department: dept }
  if (isId(q.courseId)) filter.courseRef = q.courseId
  if (isId(q.facultyId)) filter.facultyId = q.facultyId
  if (["active", "cancelled", "superseded"].includes(q.status)) filter.status = q.status
  const rows = await CourseAllocation.find(filter).sort({ createdAt: -1 }).limit(Math.min(Number(q.limit) || 300, 600)).lean()
  const out = []
  const byGroup = new Map()
  for (const r of rows) {
    const key = r.groupId ? `${r.groupId}|${r.status}` : String(r._id)
    if (byGroup.has(key)) {
      const g = byGroup.get(key)
      if (r.batchName) g.batchNames.push(r.batchName)
      continue
    }
    const g = { ...allocationShape(r), batchNames: r.batchName ? [r.batchName] : [] }
    byGroup.set(key, g); out.push(g)
  }
  out.forEach((g) => g.batchNames.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })))
  return out
}

/* ═══════════════════════════ settings / profiles / requirements ═══════════════════════════ */

async function getSettings(dept) {
  const doc = await AllocationSettings.findOne({ department: dept }).lean()
  return { ...shapeSettings(E.normalizeSettings(doc)), saved: !!doc, defaults: { weights: E.DEFAULT_WEIGHTS, limits: E.DEFAULT_LIMITS }, labels: E.WEIGHT_LABELS }
}

async function saveSettings(req, body) {
  const { errors, value } = E.validateSettings(body)
  if (errors.length) throw new AllocationError(400, errors.join(". "))
  await AllocationSettings.findOneAndUpdate(
    { department: req.dept },
    { $set: { ...value, updatedById: String(req.user._id) }, $setOnInsert: { department: req.dept } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
  return getSettings(req.dept)
}

const cleanList = (arr, max = 30, len = 80) =>
  [...new Set((Array.isArray(arr) ? arr : []).map((s) => String(s || "").trim().slice(0, len)).filter(Boolean))].slice(0, max)

async function listFacultyProfiles(dept) {
  const ctx = await loadContext(dept)
  return ctx.faculty.map((f) => {
    const p = ctx.profileById[f.id] || null
    const missing = missingFields(p)
    return {
      facultyId: f.id, name: f.name, email: f.email,
      complete: missing.length === 0, missing,
      completeness: Math.round(((5 - missing.length) / 5) * 100),
      updatedAt: p ? p.updatedAt : null,
      profile: p ? {
        qualifications: p.qualifications || [], specializations: p.specializations || [], researchAreas: p.researchAreas || [],
        academicExperienceYears: typeof p.academicExperienceYears === "number" ? p.academicExperienceYears : null,
        practicalExperience: p.practicalExperience || [], noPracticalExperience: !!p.noPracticalExperience,
        teachingHistory: p.teachingHistory || [], noPriorTeaching: !!p.noPriorTeaching,
      } : null,
    }
  })
}

/** Notify every faculty member whose academic profile is still incomplete. */
async function remindIncomplete(req) {
  const rows = (await listFacultyProfiles(req.dept)).filter((r) => !r.complete)
  await Promise.all(rows.map((r) => notifyProfile(r.facultyId, req.user.name || "Your HOD", r.missing)))
  return { reminded: rows.length }
}
const notifyProfile = async (userId, from, missing) => {
  try {
    await Notification.create({
      userId, type: "system", title: "Complete your academic profile", link: "/settings",
      message: `${from} asked you to complete your academic profile in Settings. Still missing: ${missing.join(", ")}. It is used to match you to courses.`,
    })
  } catch { /* ignore */ }
}

async function getRequirement(dept, courseId) {
  if (!isId(courseId)) throw new AllocationError(400, "Invalid course id")
  const r = await CourseRequirement.findOne({ department: dept, courseRef: courseId }).lean()
  return { subjectTags: (r && r.subjectTags) || [], minQualification: (r && r.minQualification) || "", requireSubjectMatch: !!(r && r.requireSubjectMatch) }
}

async function saveRequirement(req, courseId, body) {
  if (!isId(courseId)) throw new AllocationError(400, "Invalid course id")
  const course = await Course.findById(courseId).select("department teacher batches.teacher").lean()
  if (!course) throw new AllocationError(404, "Course not found")
  const ctx = { dept: req.dept, teacherDept: {} }
  const ids = [course.teacher && course.teacher.id, ...(course.batches || []).map((b) => b.teacher && b.teacher.id)].filter(Boolean)
  if (ids.length) (await User.find({ _id: { $in: ids } }).select("department").lean()).forEach((u) => { ctx.teacherDept[String(u._id)] = u.department || "" })
  if (courseDeptState(ctx, course) === "other") throw new AllocationError(403, "This course belongs to another department")

  const min = String(body.minQualification || "")
  if (!["", "Diploma", "Bachelors", "Masters", "PhD"].includes(min)) throw new AllocationError(400, "Invalid minimum qualification")
  const value = { subjectTags: cleanList(body.subjectTags, 15, 60), minQualification: min, requireSubjectMatch: !!body.requireSubjectMatch, updatedById: String(req.user._id) }
  await CourseRequirement.findOneAndUpdate(
    { department: req.dept, courseRef: courseId },
    { $set: value, $setOnInsert: { department: req.dept, courseRef: courseId } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
  return { subjectTags: value.subjectTags, minQualification: value.minQualification, requireSubjectMatch: value.requireSubjectMatch }
}

module.exports = {
  AllocationError,
  loadContext, courseDeptState, buildTarget, evaluateTarget, buildEvaluationMatrix, buildCandidateInput,
  recommend, listCourses, confirmAllocation, cancelAllocation, listHistory,
  getSettings, saveSettings, listFacultyProfiles, remindIncomplete, getRequirement, saveRequirement,
}
