const mongoose = require("mongoose")

/**
 * A saved copy of a department report, frozen at the moment it was generated.
 * Read-only on purpose: the numbers can never be edited afterwards, and `checksum` (SHA-256 of `data`)
 * lets anyone verify that. This is the evidence trail for accreditation / audits.
 */
const ReportSnapshotSchema = new mongoose.Schema({
  department: { type: String, default: "", index: true },
  title:      { type: String, required: true, trim: true, maxlength: 120 },
  note:       { type: String, default: "", trim: true, maxlength: 500 },
  period:     { from: String, to: String },
  createdBy:  { id: String, name: String },
  data:       { type: mongoose.Schema.Types.Mixed, required: true },
  checksum:   { type: String, required: true },
}, { timestamps: { createdAt: true, updatedAt: false } })

const readOnly = function (next) { next(new Error("Saved reports are read-only")) }
ReportSnapshotSchema.pre(["updateOne", "updateMany", "findOneAndUpdate", "replaceOne"], readOnly)
ReportSnapshotSchema.pre("save", function (next) { if (!this.isNew) return next(new Error("Saved reports are read-only")); next() })

module.exports = mongoose.model("ReportSnapshot", ReportSnapshotSchema)