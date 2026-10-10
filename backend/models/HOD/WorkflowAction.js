const mongoose = require("mongoose")
const { Schema } = mongoose

// An improvement action the HOD starts in response to anonymous workflow feedback.
// It stores NOTHING about who submitted feedback — only the category it addresses.
const workflowActionSchema = new Schema({
  department:  { type: String, default: "", index: true },
  category:    { type: String, required: true },            // e.g. "Approval Delays" (same label faculty pick)
  steps:       [{ type: String }],                          // what the HOD decided to do
  note:        { type: String, default: "" },
  targetDate:  { type: String, default: "" },               // YYYY-MM-DD (optional review date)
  status:      { type: String, enum: ["In Progress", "Resolved"], default: "In Progress" },
  startedAt:   { type: Date, default: Date.now },           // start of the "before" comparison
  resolvedAt:  { type: Date },                              // start of the "after" comparison
  outcomeNote: { type: String, default: "" },
  createdById: { type: String, default: "" },
}, { timestamps: true })

workflowActionSchema.index({ department: 1, category: 1, startedAt: -1 })

module.exports = mongoose.models.WorkflowAction || mongoose.model("WorkflowAction", workflowActionSchema)
