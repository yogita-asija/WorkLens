/**
 * Faculty academic profile — validation + "is it complete?" rules.
 * The faculty member fills this in themselves (Settings → Academic Profile); WorkLens reads it to rate
 * them for course allocation. It is mandatory for teaching staff.
 *
 * Required: ≥1 qualification (level + field), ≥1 specialization, years of academic experience,
 *           practical experience (≥1 entry OR "none"), prior teaching (≥1 entry OR "none").
 * Optional: research areas.
 */
const LEVELS = ["Diploma", "Bachelors", "Masters", "PhD", "Other"]

const numOrNull = (v, lo, hi) => {
  if (v === "" || v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) && n >= lo && n <= hi ? n : NaN
}
const cleanList = (arr, max = 30, len = 80) =>
  [...new Set((Array.isArray(arr) ? arr : []).map((s) => String(s || "").trim().slice(0, len)).filter(Boolean))].slice(0, max)

/** What is still missing (human readable). Works on a stored profile or a validated value. */
function missingFields(p) {
  const out = []
  if (!p) return ["Qualifications", "Specializations", "Academic experience", "Practical experience", "Prior teaching"]
  if (!(p.qualifications || []).some((q) => q.level && String(q.field || "").trim())) out.push("Qualifications")
  if (!(p.specializations || []).length) out.push("Specializations")
  if (typeof p.academicExperienceYears !== "number") out.push("Academic experience")
  if (!(p.practicalExperience || []).length && !p.noPracticalExperience) out.push("Practical experience")
  if (!(p.teachingHistory || []).length && !p.noPriorTeaching) out.push("Prior teaching")
  return out
}
const isComplete = (p) => missingFields(p).length === 0

/** Returns { errors, value } for a request body. */
function validateProfileInput(body) {
  const b = body || {}
  const errors = []

  const qualifications = (Array.isArray(b.qualifications) ? b.qualifications : []).slice(0, 15).map((q) => {
    const level = String((q && q.level) || "")
    if (!LEVELS.includes(level)) { errors.push("Each qualification needs a valid level"); return null }
    const field = String(q.field || "").trim().slice(0, 120)
    if (!field) { errors.push("Each qualification needs a field / subject"); return null }
    const year = numOrNull(q.year, 1950, 2100)
    if (Number.isNaN(year)) errors.push("Qualification year is invalid")
    return { level, field, institution: String(q.institution || "").trim().slice(0, 120), year: Number.isNaN(year) ? null : year }
  }).filter(Boolean)

  const academic = numOrNull(b.academicExperienceYears, 0, 60)
  if (academic === null || Number.isNaN(academic)) errors.push("Academic experience must be a number between 0 and 60 years")

  const noPracticalExperience = !!b.noPracticalExperience
  const practicalExperience = noPracticalExperience ? [] : (Array.isArray(b.practicalExperience) ? b.practicalExperience : []).slice(0, 20).map((p) => {
    const years = numOrNull(p.years, 0, 60)
    if (years === null || Number.isNaN(years)) { errors.push("Each practical experience needs years between 0 and 60"); return null }
    const title = String(p.title || "").trim().slice(0, 120); const domain = String(p.domain || "").trim().slice(0, 120)
    if (!title && !domain) { errors.push("Each practical experience needs a role or domain"); return null }
    return { title, domain, years }
  }).filter(Boolean)

  const noPriorTeaching = !!b.noPriorTeaching
  const teachingHistory = noPriorTeaching ? [] : (Array.isArray(b.teachingHistory) ? b.teachingHistory : []).slice(0, 40).map((h) => {
    const terms = numOrNull(h.terms, 1, 60)
    const courseName = String(h.courseName || "").trim().slice(0, 120); const courseCode = String(h.courseCode || "").trim().slice(0, 40)
    if (!courseName && !courseCode) { errors.push("Each teaching-history entry needs a course name or code"); return null }
    return { courseCode, courseName, terms: terms === null || Number.isNaN(terms) ? 1 : terms, institution: String(h.institution || "").trim().slice(0, 120) }
  }).filter(Boolean)

  const value = {
    qualifications, specializations: cleanList(b.specializations), researchAreas: cleanList(b.researchAreas),
    academicExperienceYears: Number.isNaN(academic) ? null : academic,
    practicalExperience, noPracticalExperience, teachingHistory, noPriorTeaching,
  }
  for (const m of missingFields(value)) errors.push(`${m} is required`)
  return { errors: [...new Set(errors)], value }
}

module.exports = { LEVELS, missingFields, isComplete, validateProfileInput }
