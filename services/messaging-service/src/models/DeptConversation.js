const mongoose = require("mongoose")

/**
 * One conversation per (HOD, faculty) pair  ->  the "thread" shown in both portals.
 * Messages live in DeptMessage; this document only keeps what the contact list needs
 * (last message preview + per-side unread counters) so listing is a single cheap query.
 */
const deptConversationSchema = new mongoose.Schema(
  {
    hod:        { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    faculty:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    department: { type: String, default: "" },

    lastMessage: {
      messageId: { type: mongoose.Schema.Types.ObjectId, ref: "DeptMessage" },
      text:      { type: String, default: "" },
      sender:    { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      category:  { type: String, default: "General" },
      priority:  { type: String, default: "Normal" },
      isBroadcast: { type: Boolean, default: false },
    },
    lastMessageAt: { type: Date, default: null },

    // unread counters: how many messages the HOD / the faculty has not opened yet
    unread: {
      hod:     { type: Number, default: 0, min: 0 },
      faculty: { type: Number, default: 0, min: 0 },
    },
  },
  { timestamps: true }
)

// exactly one thread per pair (this is what makes get-or-create safe under concurrency)
deptConversationSchema.index({ hod: 1, faculty: 1 }, { unique: true })
deptConversationSchema.index({ hod: 1, lastMessageAt: -1 })
deptConversationSchema.index({ faculty: 1, lastMessageAt: -1 })

module.exports = mongoose.model("DeptConversation", deptConversationSchema)
