const mongoose = require("mongoose")

const messageSchema = new mongoose.Schema(
  {
    // sender is always a faculty user
    senderId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    senderName: { type: String, required: true },

    // direction: "sent"  = faculty → students  |  "received" = student → faculty (inbox)
    direction: {
      type: String,
      enum: ["sent", "received"],
      required: true,
      index: true,
    },

    // who sent it (for received messages)
    from: { type: String, default: "" },

    // audience
    recipient: {
      type: String,
      enum: ["Entire Course", "Specific Batches", "Specific Student"],
      default: "Entire Course",
    },

    course:   { type: String, default: "" },
    semester: { type: String, default: "" },
    batch:    { type: String, default: "" },     // legacy single-batch (kept for back-compat)
    batches:  [{ type: String }],                 // selected batch names (Specific Batches)
    recipients: [{ id: String, name: String }],   // selected students (Specific Student)

    subject:  { type: String, required: true },
    message:  { type: String, required: true },

    category: {
      type: String,
      enum: ["Announcement", "Reminder", "Warning", "Information", "Personal Message"],
      default: "Announcement",
    },

    priority: {
      type: String,
      enum: ["Normal", "Important", "Urgent"],
      default: "Normal",
    },

    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
)

messageSchema.index({ senderId: 1, direction: 1, createdAt: -1 })

module.exports = mongoose.model("Message", messageSchema)
