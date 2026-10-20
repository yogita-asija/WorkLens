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

function resolveTarget(course, batchId) {
  if (batchId) {
    const b = (course.batches || []).find((x) => String(x._id) === String(batchId))
    if (!b) throw new AllocationError(404, "Batch not found on this course")
    return {
      scope: "batch", batchId: String(b._id), batchName: b.batchName, targetKey: String(b._id),
      schedule: b.schedule || {}, teacher: { id: sid(b.teacher && b.teacher.id), name: (b.teacher && b.teacher.name) || "" },
      label: `${course.courseCode || course.courseId} · ${b.batchName}`,
    }
  }
  return {
    scope: "course", batchId: "", batchName: "", targetKey: "main",
    schedule: course.schedule || {}, teacher: { id: sid(course.teacher && course.teacher.id), name: (course.teacher && course.teacher.name) || "" },
    label: `${course.courseCode || course.courseId}`,
  }
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

/** The faculty member's other (non-archived-or-archived) teaching + current load. */
function facultyLoad(ctx, course, target, facultyId, tentative) {
  const existing = []      // active classes, for load + clashes
  const everTaught = []    // any status, for "previous teaching"
  for (const c of ctx.courses) {
    const cid = String(c._id)
    const add = (schedule, label, isTarget, batchLabel) => {
      const info = E.scheduleInfo(schedule, c.credits)
      const row = { courseId: cid, course: c, label: batchLabel ? `${c.courseCode || c.courseId} · ${batchLabel}` : `${c.courseCode || c.courseId}`, info }
      everTaught.push(row)
      if (c.status === "active" && !isTarget) existing.push(row)
    }
    if (sid(c.teacher && c.teacher.id) === facultyId) add(c.schedule, null, cid === String(course._id) && target.scope === "course")
    for (const b of c.batches || []) {
      if (sid(b.teacher && b.teacher.id) === facultyId) add(b.schedule, null, cid === String(course._id) && target.scope === "batch" && String(b._id) === target.batchId, b.batchName)
    }
  }
  for (const t of tentative || []) {
    if (t.facultyId !== facultyId || t.courseId === String(course._id)) continue
    existing.push({ courseId: t.courseId, label: t.label, info: t.info })
  }
  return { existing, everTaught }
}

function buildCandidateInput(ctx, course, target, topics, requirement, fac, tentative) {
  const id = fac.id
  const profile = ctx.profileById[id] || null
  const settings = ctx.settings
  const { existing, everTaught } = facultyLoad(ctx, course, target, id, tentative)

  /* course schedule vs existing classes */
  const ci = E.scheduleInfo(target.schedule, course.credits)
  const existingSessions = []
  const conflicts = []; const uncertain = []
  const seen = new Set()
  for (const row of existing) {
    for (const s of row.info.sessions) {
      existingSessions.push({ ...s, label: row.label })
      for (const cs of ci.sessions) {
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
    currentHours, projectedHours: currentHours + ci.hours, maxHours: settings.limits.maxWeeklyHours,
    estimated: ci.estimated || existing.some((r) => r.info.estimated),
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
  const currentlyTeaching = target.teacher.id === id
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
  const courseHasHistory = prior.length > 0 || !!target.teacher.id || thisCourseAllocs.length > 0
    || Object.values(ctx.profileById).some((p) => (p.teachingHistory || []).some((h) => matchesCourse(h.courseCode, h.courseName, course)))
  const continuity = {
    courseHasHistory,
    currentlyTeaching,
    taughtLastTerm: prior.length > 0 && prior[0].facultyId === id,
    taughtEarlier: mine.length > 0 || manualExact.length > 0,
  }

  return {
    faculty: fac, profile, topics, requirement, settings,
    profileComplete: isComplete(profile),
    sameDepartment: true,
    alreadyAssigned: currentlyTeaching,
    timetable: { scheduleKnown: ci.known, conflicts, uncertain, courseSessions: ci.sessions, existingSessions },
    workload, leave,
    teaching: { exactTerms, similarCourses: similarIds.size + manualSimilar, hasRecords },
    continuity,
  }
}

/* ═══════════════════════════ evaluation ═══════════════════════════ */

/**
 * Rank all department faculty for one course/batch.
 * `ctx.term.name` must be set (it is only used to ignore the CURRENT term when reading history).
 */
function evaluateTarget(ctx, course, target, { tentative } = {}) {
  const requirement = ctx.requirementByCourse[String(course._id)] || null
  const topics = E.courseTopics(course, requirement)
  const evaluated = ctx.faculty.map((f) => E.evaluateCandidate(buildCandidateInput(ctx, course, target, topics, requirement, f, tentative)))
  return {
    topics: { source: topics.source, tags: topics.tags.map((t) => t.label) },
    requirement: requirement
      ? { subjectTags: requirement.subjectTags || [], minQualification: requirement.minQualification || "", requireSubjectMatch: !!requirement.requireSubjectMatch }
      : { subjectTags: [], minQualification: "", requireSubjectMatch: false },
    candidates: E.rankCandidates(evaluated),
  }
}

/** One evaluateTarget() per (course, batch) — the input a department-wide optimiser would consume. */
function buildEvaluationMatrix(ctx, targets, opts) {
  return targets.map(({ course, batchId }) => {
    const target = resolveTarget(course, batchId)
    return { courseId: String(course._id), targetKey: target.targetKey, ...evaluateTarget(ctx, course, target, opts) }
  })
}

const shapeSettings = (s) => ({ weights: s.weights, limits: s.limits, unknownPolicy: s.unknownPolicy, blockOnUnknownQualification: s.blockOnUnknownQualification })

/* ═══════════════════════════ handlers' building blocks ═══════════════════════════ */

function activeAllocationFor(ctx, course, target, term) {
  return ctx.allocations.find((a) => a.status === "active" && String(a.courseRef) === String(course._id) && a.targetKey === target.targetKey && a.term === term) || null
}

async function recommend(dept, body) {
  const { errors, value } = parseTermInput(body)
  if (errors.length) throw new AllocationError(400, errors.join(". "))
  if (!isId(body.courseId)) throw new AllocationError(400, "Select a course")

  const ctx = await loadContext(dept, value)
  ctx.term.name = value.term
  const course = ctx.courseById[String(body.courseId)]
  if (!course) throw new AllocationError(404, "Course not found")
  const state = courseDeptState(ctx, course)
  if (state === "other") throw new AllocationError(403, "This course belongs to another department")
  if (course.status === "archived") throw new AllocationError(400, "Archived courses cannot be allocated")
  const target = resolveTarget(course, body.batchId)

  const result = evaluateTarget(ctx, course, target)
  const ci = E.scheduleInfo(target.schedule, course.credits)
  const active = activeAllocationFor(ctx, course, target, value.term)

  const notices = []
  if (!ctx.faculty.length) notices.push("No teaching faculty are registered in your department.")
  if (!ci.known) notices.push("This course has no readable days/time, so timetable clashes cannot be checked for anyone.")
  if (ci.estimated) notices.push("Weekly hours for this course are estimated from its credits because the class time is incomplete.")
  const incomplete = ctx.faculty.filter((f) => !isComplete(ctx.profileById[f.id])).length
  if (incomplete) notices.push(`${incomplete} of ${ctx.faculty.length} faculty have not completed their academic profile (Settings → Academic Profile), so parts of their score are unknown. You can send them a reminder under "Faculty profiles".`)
  if (result.topics.source === "derived") notices.push("No subject tags are set for this course, so its topics were taken from the course title. Set tags under \"Course requirements\" for a sharper match.")
  if (state === "unclaimed") notices.push(`This course has no department yet. Confirming an assignment will set it to "${ctx.dept}".`)

  return {
    course: courseCard(ctx, course, state),
    target: { scope: target.scope, batchId: target.batchId, batchName: target.batchName, label: target.label, currentTeacher: target.teacher.id ? target.teacher : null },
    term: value,
    settings: shapeSettings(ctx.settings),
    ...result,
    activeAllocation: active ? { id: String(active._id), facultyName: active.facultyName, term: active.term } : null,
    notices,
    totals: {
      faculty: result.candidates.length,
      eligible: result.candidates.filter((c) => c.eligibility.status !== "ineligible").length,
    },
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
  id: String(a._id),
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

async function confirmAllocation(req, body) {
  const dept = req.dept
  const { errors, value } = parseTermInput(body)
  if (errors.length) throw new AllocationError(400, errors.join(". "))
  if (!isId(body.courseId)) throw new AllocationError(400, "Select a course")
  if (!isId(body.facultyId)) throw new AllocationError(400, "Select a faculty member")
  const note = String(body.note || "").trim().slice(0, 500)

  // Everything is recomputed here from the database — nothing the browser sent about scores or
  // eligibility is trusted.
  const ctx = await loadContext(dept, value)
  ctx.term.name = value.term
  const course = ctx.courseById[String(body.courseId)]
  if (!course) throw new AllocationError(404, "Course not found")
  const state = courseDeptState(ctx, course)
  if (state === "other") throw new AllocationError(403, "This course belongs to another department")
  if (course.status === "archived") throw new AllocationError(400, "Archived courses cannot be allocated")
  const target = resolveTarget(course, body.batchId)

  const dup = activeAllocationFor(ctx, course, target, value.term)
  if (dup) {
    throw new AllocationError(409, `${target.label} is already allocated to ${dup.facultyName} for "${value.term}". Cancel that allocation in the history first if you want to change it.`, { code: "DUPLICATE" })
  }

  const result = evaluateTarget(ctx, course, target)
  const cand = result.candidates.find((c) => c.facultyId === String(body.facultyId))
  if (!cand) throw new AllocationError(400, "That person is not teaching faculty of your department", { code: "NOT_IN_DEPARTMENT" })

  if (cand.eligibility.status === "ineligible") {
    throw new AllocationError(409, `${cand.name} can no longer be assigned: ${cand.eligibility.blockers.join(" | ")}`, { code: "INELIGIBLE", blockers: cand.eligibility.blockers })
  }
  const prev = target.teacher
  if (prev.id && prev.id !== cand.facultyId && !body.replaceExisting) {
    throw new AllocationError(409, `${target.label} is currently taught by ${prev.name || "another faculty member"}. Confirm that you want to replace them.`, { code: "REPLACES_EXISTING", currentTeacher: prev })
  }
  if (cand.eligibility.warnings.length && !body.acknowledgeWarnings) {
    throw new AllocationError(409, "Review and acknowledge the warnings before confirming", { code: "WARNINGS_NOT_ACKNOWLEDGED", warnings: cand.eligibility.warnings })
  }

  const faculty = ctx.faculty.find((f) => f.id === cand.facultyId)
  const now = new Date()

  // 1 ─ history row first: the partial unique index is the final guard against duplicates / races
  let allocation
  try {
    allocation = await CourseAllocation.create({
      department: dept,
      courseRef: course._id, courseId: course.courseId || "", courseCode: course.courseCode || course.courseId || "", courseName: course.courseName, courseSem: course.sem || "",
      scope: target.scope, batchId: target.batchId, batchName: target.batchName, targetKey: target.targetKey,
      term: value.term, startDate: value.startDate, endDate: value.endDate,
      facultyId: faculty.id, facultyName: faculty.name,
      status: "active",
      rank: cand.rank, candidatesConsidered: result.candidates.length,
      scoreSnapshot: { total: cand.score, completeness: cand.completeness, components: cand.components },
      eligibilitySnapshot: { status: cand.eligibility.status, checks: cand.eligibility.checks },
      settingsSnapshot: shapeSettings(ctx.settings),
      warnings: cand.eligibility.warnings, acknowledgedWarnings: !!body.acknowledgeWarnings,
      replacedExisting: !!(prev.id && prev.id !== faculty.id), previousTeacher: { id: prev.id, name: prev.name },
      note, assignedById: String(req.user._id), assignedByName: req.user.name || "",
    })
  } catch (e) {
    if (e && e.code === 11000) throw new AllocationError(409, `${target.label} was just allocated for "${value.term}" by someone else. Refresh and review.`, { code: "DUPLICATE" })
    throw e
  }

  // 2 ─ update the course only if nobody changed its teacher since we read it
  const info = { term: value.term, startDate: value.startDate, endDate: value.endDate, allocationId: allocation._id, assignedAt: now }
  const claim = !(course.department || "").trim()
  const deptFilter = claim ? { $in: [null, ""] } : course.department
  const prevMatch = prev.id ? prev.id : null
  let res
  if (target.scope === "course") {
    res = await Course.updateOne(
      { _id: course._id, "teacher.id": prevMatch, department: deptFilter },
      { $set: { "teacher.id": faculty.id, "teacher.name": faculty.name, allocation: info, ...(claim ? { department: dept } : {}) } },
    )
  } else {
    res = await Course.updateOne(
      { _id: course._id, department: deptFilter, batches: { $elemMatch: { _id: target.batchId, "teacher.id": prevMatch } } },
      { $set: { "batches.$.teacher": { id: faculty.id, name: faculty.name }, "batches.$.allocation": info, ...(claim ? { department: dept } : {}) } },
    )
  }
  if (!res.matchedCount) {
    await CourseAllocation.deleteOne({ _id: allocation._id })
    throw new AllocationError(409, "This course was changed by someone else while you were reviewing. Refresh the recommendations and try again.", { code: "STALE" })
  }

  // 3 ─ older allocations of the same course/batch are history now
  await CourseAllocation.updateMany(
    { courseRef: course._id, targetKey: target.targetKey, status: "active", _id: { $ne: allocation._id } },
    { $set: { status: "superseded" } },
  )

  // 4 ─ tell the people concerned
  await notify(faculty.id, "Course Assigned",
    `${req.user.name || "Your HOD"} assigned you ${course.courseCode || course.courseId} — ${course.courseName}${target.batchName ? ` (${target.batchName})` : ""} for ${value.term} (${fmtDate(value.startDate)} – ${fmtDate(value.endDate)}).`,
    { allocationId: String(allocation._id), courseId: String(course._id) })
  if (prev.id && prev.id !== faculty.id) {
    await notify(prev.id, "Course Reassigned",
      `${course.courseCode || course.courseId} — ${course.courseName}${target.batchName ? ` (${target.batchName})` : ""} is now assigned to ${faculty.name} for ${value.term}.`,
      { allocationId: String(allocation._id), courseId: String(course._id) })
  }

  return allocationShape(allocation.toObject())
}

async function cancelAllocation(req, id, reason) {
  if (!isId(id)) throw new AllocationError(400, "Invalid allocation id")
  const a = await CourseAllocation.findById(id)
  if (!a || a.department !== req.dept) throw new AllocationError(404, "Allocation not found")
  if (a.status !== "active") throw new AllocationError(409, "Only an active allocation can be cancelled")

  a.status = "cancelled"
  a.cancelledAt = new Date()
  a.cancelledById = String(req.user._id)
  a.cancelReason = String(reason || "").trim().slice(0, 300)
  await a.save()

  // Remove the teacher only if they are still the one this allocation put there
  if (a.scope === "course") {
    await Course.updateOne({ _id: a.courseRef, "teacher.id": a.facultyId }, { $set: { "teacher.name": "" }, $unset: { "teacher.id": "", allocation: "" } })
  } else {
    await Course.updateOne(
      { _id: a.courseRef, batches: { $elemMatch: { _id: a.batchId, "teacher.id": a.facultyId } } },
      { $set: { "batches.$.teacher.name": "" }, $unset: { "batches.$.teacher.id": "", "batches.$.allocation": "" } },
    )
  }
  await notify(a.facultyId, "Course Allocation Cancelled",
    `Your allocation to ${a.courseCode} — ${a.courseName}${a.batchName ? ` (${a.batchName})` : ""} for ${a.term} was cancelled by ${req.user.name || "your HOD"}.`,
    { allocationId: String(a._id), courseId: String(a.courseRef) })
  return allocationShape(a.toObject())
}

async function listHistory(dept, q = {}) {
  const filter = { department: dept }
  if (isId(q.courseId)) filter.courseRef = q.courseId
  if (isId(q.facultyId)) filter.facultyId = q.facultyId
  if (["active", "cancelled", "superseded"].includes(q.status)) filter.status = q.status
  const rows = await CourseAllocation.find(filter).sort({ createdAt: -1 }).limit(Math.min(Number(q.limit) || 100, 300)).lean()
  return rows.map(allocationShape)
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
  loadContext, courseDeptState, resolveTarget, evaluateTarget, buildEvaluationMatrix, buildCandidateInput,
  recommend, listCourses, confirmAllocation, cancelAllocation, listHistory,
  getSettings, saveSettings, listFacultyProfiles, remindIncomplete, getRequirement, saveRequirement,
}
