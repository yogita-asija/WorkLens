const mongoose = require("mongoose")

// Individual leave application
const LeaveSchema = new mongoose.Schema({
  // Who applied — set from the authenticated user, no hardcoded default
  facultyId:   { type: String, required: true },
  facultyName: { type: String, required: true },

  // Leave details
  type: {
    type: String,
    enum: ["Sick", "Casual", "Earned"],
    required: true,
  },
  fromDate:  { type: Date, required: true },
  toDate:    { type: Date, required: true },
  duration:  { type: Number, required: true }, // days (inclusive)
  reason:    { type: String, required: true },

  // Status lifecycle
  status: {
    type: String,
    enum: ["Pending", "Approved", "Rejected"],
    default: "Pending",
  },

  // Admin note when approving / rejecting
  adminNote: { type: String, default: "" },

  appliedAt:  { type: Date, default: Date.now },
  decidedAt:  { type: Date },                  // set when the HOD approves / rejects (used by HOD history + insights)
  updatedAt:  { type: Date, default: Date.now },
})

// Leave balance per faculty per year — facultyId set dynamically, no hardcoded default
const LeaveBalanceSchema = new mongoose.Schema({
  facultyId:   { type: String, required: true },
  year:        { type: Number, default: new Date().getFullYear() },
  totalLeaves: { type: Number, default: 12 },  // allocated
  taken:       { type: Number, default: 0  },   // approved + used days
  holidays:    { type: Number, default: 8  },   // public holidays availed
})

// Public holiday calendar
const HolidaySchema = new mongoose.Schema({
  name: { type: String, required: true },
  date: { type: Date,   required: true },
  type: {
    type: String,
    enum: ["National", "Regional", "Optional"],
    default: "National",
  },
})

module.exports = {
  Leave:        mongoose.model("Leave",        LeaveSchema),
  LeaveBalance: mongoose.model("LeaveBalance", LeaveBalanceSchema),
  Holiday:      mongoose.model("Holiday",      HolidaySchema),
}