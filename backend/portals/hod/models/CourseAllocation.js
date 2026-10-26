const mongoose = require("mongoose")
const { Schema } = mongoose

const define = (name, schema) => mongoose.models[name] || mongoose.model(name, schema)

/* ═══════════════════════════════════════════════════════════════════════════
   Course Allocation (HOD) — collections
     CourseAllocation   one row per confirmed assignment  → the allocation HISTORY
     AllocationSettings one row per department            → weights, workload limits, policies
     FacultyProfile     one row per faculty member        → filled in BY THE FACULTY (Settings → Academic Profile)
     CourseRequirement  one row per (department, course)  → what the HOD requires for that course
   Nothing here is pre-filled: every field the HOD has not entered stays empty / null and the
   recommendation engine reports it as "unknown".
   ═══════════════════════════════════════════════════════════════════════════ */

const QUALIFICATION_LEVELS = ["Diploma", "Bachelors", "Masters", "PhD", "Other"]

/* ── history ─────────────────────────────────────────────────────────────── */
const allocationSchema = new Schema({
  department:  { type: String, required: true, index: true },
  groupId:     { type: String, default: "", index: true },    // rows created by one confirmation (several batches) share it
  batchIndex:  { type: Number, default: 0 },                  // 1-based batch number, 0 = whole course

  // What was allocated
  courseRef:   { type: Schema.Types.ObjectId, ref: "Course", required: true },
  courseId:    { type: String, default: "" },
  courseCode:  { type: String, default: "" },
  courseName:  { type: String, default: "" },
  courseSem:   { type: String, default: "" },
  scope:       { type: String, enum: ["course", "batch"], default: "course" },
  batchId:     { type: String, default: "" },            // batch subdocument _id when scope = "batch"
  batchName:   { type: String, default: "" },
  targetKey:   { type: String, required: true },         // "main" | batch _id  → used by the duplicate guard

  // For which period
  term:        { type: String, required: true, trim: true },
  startDate:   { type: String, required: true },         // YYYY-MM-DD
  endDate:     { type: String, required: true },

  // To whom
  facultyId:   { type: String, required: true, index: true },
  facultyName: { type: String, default: "" },

  status:      { type: String, enum: ["active", "cancelled", "superseded"], default: "active", index: true },

  // Why — frozen at the moment of confirmation so the decision can always be explained later
  rank:                { type: Number, default: null },
  candidatesConsidered:{ type: Number, default: 0 },
  scoreSnapshot:       { type: Schema.Types.Mixed, default: null },   // { total, completeness, components[] }
  eligibilitySnapshot: { type: Schema.Types.Mixed, default: null },   // { status, checks[] }
  settingsSnapshot:    { type: Schema.Types.Mixed, default: null },   // weights + limits used
  warnings:            { type: [String], default: [] },
  acknowledgedWarnings:{ type: Boolean, default: false },
  replacedExisting:    { type: Boolean, default: false },
  previousTeacher:     { id: { type: String, default: "" }, name: { type: String, default: "" } },
  note:                { type: String, default: "" },

  assignedById:   { type: String, default: "" },
  assignedByName: { type: String, default: "" },

  cancelledAt:    { type: Date },
  cancelledById:  { type: String, default: "" },
  cancelReason:   { type: String, default: "" },
}, { timestamps: true })

// One ACTIVE allocation per course (or batch) per term. Enforced by the database, so two HOD
// sessions (or a double click) can never create a duplicate or conflicting assignment.
allocationSchema.index(
  { courseRef: 1, targetKey: 1, term: 1 },
  { unique: true, partialFilterExpression: { status: "active" }, name: "uniq_active_allocation_per_term" },
)
allocationSchema.index({ department: 1, createdAt: -1 })
allocationSchema.index({ courseRef: 1, targetKey: 1, createdAt: -1 })

/* ── settings (per department) ───────────────────────────────────────────── */
const settingsSchema = new Schema({
  department: { type: String, required: true, unique: true },
  weights: {
    expertise:          { type: Number },
    previousTeaching:   { type: Number },
    relevantExperience: { type: Number },
    workload:           { type: Number },
    timetable:          { type: Number },
    continuity:         { type: Number },
  },
  limits: {
    maxWeeklyHours:    { type: Number },   // teaching hours / week, including the new course
    maxCourses:        { type: Number },   // concurrent active courses, including the new one
    leaveBlockPercent: { type: Number },   // approved leave ≥ this % of the term → not eligible
  },
  unknownPolicy:               { type: String, enum: ["zero", "renormalize"] },
  blockOnUnknownQualification: { type: Boolean },
  updatedById: { type: String, default: "" },
}, { timestamps: true })

/* ── faculty profile (entered by the faculty member) ─────────────────────── */
const profileSchema = new Schema({
  facultyId:  { type: String, required: true, unique: true },
  department: { type: String, default: "", index: true },
  qualifications: [{
    _id: false,
    level:       { type: String, enum: QUALIFICATION_LEVELS, required: true },
    field:       { type: String, default: "", trim: true },
    institution: { type: String, default: "", trim: true },
    year:        { type: Number, default: null },
  }],
  specializations: { type: [String], default: [] },
  researchAreas:   { type: [String], default: [] },
  academicExperienceYears: { type: Number, default: null, min: 0, max: 60 },   // null = unknown
  practicalExperience: [{
    _id: false,
    title:  { type: String, default: "", trim: true },
    domain: { type: String, default: "", trim: true },
    years:  { type: Number, default: 0, min: 0, max: 60 },
  }],
  noPracticalExperience: { type: Boolean, default: false },   // faculty declared "none" → known zero, not unknown
  noPriorTeaching:       { type: Boolean, default: false },
  // Teaching done OUTSIDE WorkLens (earlier institutions / terms before this system was used)
  teachingHistory: [{
    _id: false,
    courseCode:  { type: String, default: "", trim: true },
    courseName:  { type: String, default: "", trim: true },
    terms:       { type: Number, default: 1, min: 1, max: 60 },
    institution: { type: String, default: "", trim: true },
  }],
  updatedById: { type: String, default: "" },
}, { timestamps: true })

/* ── per-course requirement (managed by the HOD) ─────────────────────────── */
const requirementSchema = new Schema({
  department:  { type: String, required: true },
  courseRef:   { type: Schema.Types.ObjectId, ref: "Course", required: true },
  subjectTags: { type: [String], default: [] },                       // topics the teacher should know
  minQualification:    { type: String, enum: ["", "Diploma", "Bachelors", "Masters", "PhD"], default: "" },
  requireSubjectMatch: { type: Boolean, default: false },             // make "no subject match" a hard stop
  updatedById: { type: String, default: "" },
}, { timestamps: true })
requirementSchema.index({ department: 1, courseRef: 1 }, { unique: true })

module.exports = {
  QUALIFICATION_LEVELS,
  CourseAllocation:   define("CourseAllocation",   allocationSchema),
  AllocationSettings: define("AllocationSettings", settingsSchema),
  FacultyProfile:     define("FacultyProfile",     profileSchema),
  CourseRequirement:  define("CourseRequirement",  requirementSchema),
}
