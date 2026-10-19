const mongoose = require("mongoose")
const { Schema } = mongoose

const define = (name, schema) =>
  mongoose.models[name] || mongoose.model(name, schema)

// Task assigned by the HOD to a faculty member
const HodTask = define("HodTask", new Schema({
  title:          { type: String, required: true },
  description:    { type: String, default: "" },
  department:     { type: String, default: "", index: true },
  assignedToId:   { type: String, required: true },
  assignedToName: { type: String, default: "" },
  assignedById:   { type: String, default: "" },
  dueDate:        { type: Date, required: true },
  priority:       { type: String, enum: ["Low", "Medium", "High"], default: "Medium" },
  status:         { type: String, enum: ["Pending", "In Progress", "Completed"], default: "Pending" },
  completedAt:    { type: Date },
}, { timestamps: true }))

// Question paper submitted by faculty for HOD review
const QuestionPaper = define("QuestionPaper", new Schema({
  department:  { type: String, default: "", index: true },
  courseName:  { type: String, required: true },
  courseCode:  { type: String, default: "" },
  examType:    { type: String, default: "Internal" },
  facultyId:   { type: String, required: true },
  facultyName: { type: String, default: "" },
  status:      { type: String, enum: ["Pending", "Submitted", "Approved", "Changes Requested"], default: "Pending" },
  dueDate:     { type: Date },
  submittedAt: { type: Date },
  reviewNote:  { type: String, default: "" },
  reviewedAt:  { type: Date },
}, { timestamps: true }))

// Student escalation raised to the department
const Escalation = define("Escalation", new Schema({
  department:   { type: String, default: "", index: true },
  studentName:  { type: String, required: true },
  studentId:    { type: String, default: "" },
  course:       { type: String, default: "" },
  subject:      { type: String, required: true },
  description:  { type: String, default: "" },
  priority:     { type: String, enum: ["Low", "Medium", "High"], default: "Medium" },
  assignedToId: { type: String, default: "" },
  status:       { type: String, enum: ["Open", "Resolved"], default: "Open" },
  resolution:   { type: String, default: "" },
  resolvedAt:   { type: Date },
}, { timestamps: true }))

// A substitute assigned to cover one class on one date
const substitutionSchema = new Schema({
  department:          { type: String, default: "" },
  leaveId:             { type: String, required: true },
  courseId:            { type: String, required: true },
  courseName:          { type: String, default: "" },
  dateKey:             { type: String, required: true },   // YYYY-MM-DD
  time:                { type: String, default: "" },
  originalFacultyId:   { type: String, required: true },
  originalFacultyName: { type: String, default: "" },
  substituteId:        { type: String, required: true },
  substituteName:      { type: String, default: "" },
  status:              { type: String, enum: ["Assigned"], default: "Assigned" },
}, { timestamps: true })
substitutionSchema.index({ leaveId: 1, courseId: 1, dateKey: 1 }, { unique: true })
const Substitution = define("Substitution", substitutionSchema)

// Department-level deadline (question paper, internal marks, NBA, meeting …)
const Deadline = define("Deadline", new Schema({
  department:  { type: String, default: "", index: true },
  title:       { type: String, required: true },
  type:        { type: String, enum: ["question-paper", "internal-marks", "nba", "meeting", "other"], default: "other" },
  dueDate:     { type: Date, required: true },
  completed:   { type: Boolean, default: false },
  completedAt: { type: Date },
}, { timestamps: true }))

// HOD-set availability override for one faculty on one day
const facultyStatusSchema = new Schema({
  facultyId: { type: String, required: true },
  dateKey:   { type: String, required: true },
  status:    { type: String, enum: ["Other Duty", "Unavailable"], required: true },
  note:      { type: String, default: "" },
}, { timestamps: true })
facultyStatusSchema.index({ facultyId: 1, dateKey: 1 }, { unique: true })
const FacultyStatus = define("FacultyStatus", facultyStatusSchema)

module.exports = { HodTask, QuestionPaper, Escalation, Substitution, Deadline, FacultyStatus }
