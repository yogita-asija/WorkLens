const mongoose = require("mongoose")

const userSchema = new mongoose.Schema({
  // ─── Core (all roles) ────────────────────────────────────────────────────
  name:     { type: String, required: true },
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ["teaching", "non-teaching", "admin", "student"],
    required: true,
  },
  department: { type: String, default: "" },
  phone:      { type: String, default: "" },
  bio:        { type: String, default: "" },
  notifications: {
    email:       { type: Boolean, default: true },
    assignments: { type: Boolean, default: true },
    submissions: { type: Boolean, default: true },
    reports:     { type: Boolean, default: false },
  },

  // ─── Student-only fields ─────────────────────────────────────────────────
  // These are sparse — they remain undefined for non-student roles.

  rollNumber: {
    type:   String,
    sparse: true,   // unique index only applies to docs where the field exists
    unique: true,
  },

  program: {
    // e.g. "B.Tech CSE", "BCA", "MCA"
    type:    String,
    default: undefined,
  },

  semester: {
    // 1–8 for a 4-year program, 1–6 for 3-year, etc.
    type:    Number,
    min:     1,
    max:     12,
    default: undefined,
  },

  batch: {
    // Academic year span, e.g. "2024-28"
    type:    String,
    default: undefined,
  },

  section: {
    // e.g. "A", "B" — optional, for large cohorts split into sections
    type:    String,
    default: undefined,
  },

  dateOfBirth: {
    type:    Date,
    default: undefined,
  },

  enrollmentDate: {
    type:    Date,
    default: undefined,
  },

  studentStatus: {
    // Lifecycle status — separate from account active/inactive
    type:    String,
    enum:    ["active", "inactive", "graduated", "dropped"],
    default: undefined,
  },

  // Guardian / emergency contact
  guardianName:  { type: String, default: undefined },
  guardianPhone: { type: String, default: undefined },

  // Residential address (free-text; structured address adds complexity early on)
  address: { type: String, default: undefined },

}, { timestamps: true })

// ─── Indexes ─────────────────────────────────────────────────────────────────
// rollNumber sparse unique index is declared above on the field itself.
// Additional compound index for common admin list queries:
userSchema.index({ role: 1, program: 1, semester: 1, batch: 1 })
userSchema.index({ role: 1, studentStatus: 1 })

module.exports = mongoose.model("User", userSchema)