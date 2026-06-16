const mongoose = require("mongoose")

// ── Per-stage timeline note (CAMU-style counselling log) ─────────────────────
const timelineNoteSchema = new mongoose.Schema({
  stage:     { type: String, required: true },   // pipeline stage at time of note
  note:      { type: String, required: true },
  addedBy:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  addedByName: { type: String, default: "" },
  addedAt:   { type: Date, default: Date.now },
}, { _id: true })

const admissionSchema = new mongoose.Schema({

  // ── Applicant personal info ───────────────────────────────────────────────
  applicantName: { type: String, required: true },
  email:         { type: String, required: true },
  phone:         { type: String, default: "" },
  dateOfBirth:   { type: Date,   default: undefined },
  gender: {
    type: String,
    enum: ["male", "female", "other", ""],
    default: "",
  },
  address:       { type: String, default: "" },

  // ── Academic background (merit fields — CAMU-inspired) ─────────────────────
  tenthPercent:     { type: Number, default: undefined },   // 10th board %
  twelfthPercent:   { type: Number, default: undefined },   // 12th board %
  entranceScore:    { type: Number, default: undefined },   // JEE / NEET / MAT etc.
  entranceExam:     { type: String, default: "" },          // exam name
  previousDegree:   { type: String, default: "" },          // for PG / lateral entry
  previousCollege:  { type: String, default: "" },

  // ── Admission metadata ────────────────────────────────────────────────────
  program:       { type: String, required: true },
  batch:         { type: String, default: "" },
  department:    { type: String, default: "" },
  admissionType: {
    // CAMU distinguishes these as separate intake categories
    type: String,
    enum: ["regular", "lateral_entry", "management_quota", "nri_quota", "sports_quota", ""],
    default: "regular",
  },
  category: {
    // Reservation categories per Indian higher-ed norms
    type: String,
    enum: ["general", "obc", "sc", "st", "ews", "pwd", ""],
    default: "general",
  },

  // ── Pipeline status ───────────────────────────────────────────────────────
  // enquiry → applied → under_review → accepted → rejected → enrolled
  status: {
    type:    String,
    enum:    ["enquiry", "applied", "under_review", "accepted", "rejected", "enrolled"],
    default: "applied",
    index:   true,
  },

  // ── Document checklist (CAMU tracks required docs per applicant) ──────────
  // Each entry: { docType, label, uploaded: bool, verified: bool }
  documents: [{
    docType:    { type: String },   // e.g. "tenth_marksheet"
    label:      { type: String },   // e.g. "10th Marksheet"
    uploaded:   { type: Boolean, default: false },
    verified:   { type: Boolean, default: false },
  }],

  // ── Offer letter ──────────────────────────────────────────────────────────
  offerLetterSentAt: { type: Date, default: undefined },

  // ── Per-stage timeline notes (replaces single remarks field) ─────────────
  // CAMU calls this "Counselling log" — timestamped notes per stage transition
  timeline: [timelineNoteSchema],

  // ── Flat remarks field kept for quick inline notes ────────────────────────
  remarks: { type: String, default: "" },

  // ── Review metadata ───────────────────────────────────────────────────────
  appliedAt:  { type: Date, default: Date.now },
  reviewedAt: { type: Date, default: undefined },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: undefined },

  // ── Enrollment ────────────────────────────────────────────────────────────
  enrolledStudentId: {
    type:   mongoose.Schema.Types.ObjectId,
    ref:    "User",
    sparse: true,
    default: undefined,
  },
  enrolledAt: { type: Date, default: undefined },

}, { timestamps: true })

admissionSchema.index({ status: 1, program: 1 })
admissionSchema.index({ email: 1 })
admissionSchema.index({ program: 1, batch: 1, status: 1 })

module.exports = mongoose.model("Admission", admissionSchema)