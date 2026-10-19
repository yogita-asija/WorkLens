/**
 * Shared rules for HOD <-> faculty messaging (used by the controller AND the socket layer),
 * so "who may talk to whom" is defined in exactly one place.
 */
const mongoose = require("mongoose")
const DeptConversation = require("../models/DeptConversation")
const DeptAnnouncement = require("../models/DeptAnnouncement")

// Roles that count as "faculty" for the HOD. Add "non-teaching" here if your HOD should reach them too.
const FACULTY_ROLES = ["teaching"]
const ALLOWED_ROLES = ["hod", ...FACULTY_ROLES]

const deptKey  = (d) => String(d || "").trim().toLowerCase()
const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const deptRegex = (d) => new RegExp(`^\\s*${escapeRe(String(d || "").trim())}\\s*$`, "i")
const isId = (v) => mongoose.Types.ObjectId.isValid(String(v)) && String(new mongoose.Types.ObjectId(String(v))) === String(v)

/** "hod" for the HOD, "faculty" for everyone else -> which side of a conversation the user is on */
const sideOf = (role) => (role === "hod" ? "hod" : "faculty")

/** Sidebar badge: unread chat messages + (for faculty) unread announcements. */
async function unreadTotal(user) {
  const side = sideOf(user.role)
  const uid = new mongoose.Types.ObjectId(String(user._id))
  const rows = await DeptConversation.aggregate([
    { $match: { [side]: uid } },
    { $group: { _id: null, n: { $sum: `$unread.${side}` } } },
  ])
  const chat = rows[0]?.n || 0
  const ann = side === "hod" ? 0 : await DeptAnnouncement.countDocuments({ recipients: uid, deletedAt: null, "readBy.user": { $ne: uid } })
  return chat + ann
}

module.exports = { FACULTY_ROLES, ALLOWED_ROLES, deptKey, deptRegex, escapeRe, isId, sideOf, unreadTotal }
