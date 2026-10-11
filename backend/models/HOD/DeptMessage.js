const mongoose = require("mongoose")

const CATEGORIES = ["General", "Announcement", "Reminder", "Meeting", "Deadline", "Query", "Warning"]
const PRIORITIES = ["Normal", "Important", "Urgent"]

const deptMessageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: "DeptConversation", required: true },

    sender:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    senderRole: { type: String, enum: ["hod", "teaching"], required: true },
    senderName: { type: String, required: true },

    body:     { type: String, trim: true, maxlength: 5000, default: "" }, // emptied when deleted
    category: { type: String, enum: CATEGORIES, default: "General" },
    priority: { type: String, enum: PRIORITIES, default: "Normal" },

    // HOD -> many faculty. Each faculty gets their own copy inside their own thread;
    // all copies share the same broadcastId so the HOD can retract the whole broadcast.
    isBroadcast: { type: Boolean, default: false },
    broadcastId: { type: String, default: null },

    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "DeptMessage", default: null },

    readAt:    { type: Date, default: null },   // set when the OTHER side opened the thread
    editedAt:  { type: Date, default: null },
    deletedAt: { type: Date, default: null },   // soft delete ("delete for everyone")

    // client-generated id -> retrying a failed/duplicated request never creates a 2nd message
    clientId: { type: String, default: null, maxlength: 64 },
  },
  { timestamps: true }
)

deptMessageSchema.index({ conversation: 1, _id: -1 })
deptMessageSchema.index({ sender: 1, broadcastId: 1 })
deptMessageSchema.index(
  { sender: 1, clientId: 1 },
  { unique: true, partialFilterExpression: { clientId: { $type: "string" } } }
)

module.exports = mongoose.model("DeptMessage", deptMessageSchema)
module.exports.CATEGORIES = CATEGORIES
module.exports.PRIORITIES = PRIORITIES
