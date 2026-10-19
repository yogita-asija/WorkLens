const mongoose = require("mongoose")
const { CATEGORIES, PRIORITIES } = require("./DeptMessage")

/**
 * HOD -> faculty announcement (the "notice board"). NOT part of the 1-to-1 chats.
 * One document per announcement; `readBy` powers the "seen by 3 of 5" tracker for the HOD.
 */
const deptAnnouncementSchema = new mongoose.Schema(
  {
    sender:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    senderName: { type: String, required: true },
    department: { type: String, default: "" },

    body:     { type: String, required: true, trim: true, maxlength: 5000 },
    category: { type: String, enum: CATEGORIES, default: "Announcement" },
    priority: { type: String, enum: PRIORITIES, default: "Normal" },

    recipients: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    readBy: [{ _id: false, user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, at: { type: Date, default: Date.now } }],

    deletedAt: { type: Date, default: null },   // HOD retracted it
  },
  { timestamps: true }
)

deptAnnouncementSchema.index({ sender: 1, createdAt: -1 })
deptAnnouncementSchema.index({ recipients: 1, createdAt: -1 })

module.exports = mongoose.model("DeptAnnouncement", deptAnnouncementSchema)
