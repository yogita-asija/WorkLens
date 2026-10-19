/**
 * HOD <-> Faculty messaging.
 *
 * Unlike Student Messages (one-sided log owned by a single faculty), this is a real two-sided
 * conversation between two real users, so every operation is authorised against the PAIR:
 *   - exactly one side must be a HOD, the other a faculty member
 *   - both must belong to the same department
 *   - you can only edit / delete your own messages, and only mark the OTHER side's messages as read
 */
const mongoose = require("mongoose")
const User = require("../../models/User")
const Notification = require("../../models/Notification")
const DeptConversation = require("../../models/HOD/DeptConversation")
const DeptMessage = require("../../models/HOD/DeptMessage")
const DeptAnnouncement = require("../../models/HOD/DeptAnnouncement")
const { CATEGORIES, PRIORITIES } = DeptMessage
const { emitToUser, isOnline } = require("../../utils/HOD/socket")
const { FACULTY_ROLES, deptRegex, isId, sideOf, unreadTotal } = require("../../utils/HOD/deptChat")

const MAX_BODY = 5000
const EDIT_WINDOW_MS = 15 * 60 * 1000
const PAGE_DEFAULT = 30
const PAGE_MAX = 50

// ─── small helpers ───────────────────────────────────────────────────────────
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

const wrap = (fn) => async (req, res) => {
  try { await fn(req, res) }
  catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ success: false, message: err.message })
    console.error("dept-messages error:", err)
    res.status(500).json({ success: false, message: "Something went wrong. Please try again." })
  }
}

const oid = (v) => new mongoose.Types.ObjectId(String(v))
const preview = (s, n = 140) => { const t = String(s || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t }
const otherSideOf = (side) => (side === "hod" ? "faculty" : "hod")
const pathFor = (side) => (side === "hod" ? "/faculty-messages" : "/hod-messages") // where the RECIPIENT reads it

/** Validate + normalise the user-supplied message fields. */
function cleanPayload(b = {}) {
  const body = typeof b.body === "string" ? b.body.trim() : ""
  if (!body) throw new HttpError(400, "Message cannot be empty")
  if (body.length > MAX_BODY) throw new HttpError(400, `Message is too long (max ${MAX_BODY} characters)`)
  const category = CATEGORIES.includes(b.category) ? b.category : "General"
  const priority = PRIORITIES.includes(b.priority) ? b.priority : "Normal"
  return { body, category, priority }
}

/** What goes over the wire for a message (deleted messages never leak their text). */
function toMessage(m) {
  const deleted = !!m.deletedAt
  let replyTo = null
  if (m.replyTo && typeof m.replyTo === "object" && m.replyTo.senderName) { // only when populated
    replyTo = {
      _id: m.replyTo._id,
      sender: m.replyTo.sender,
      senderName: m.replyTo.senderName,
      body: m.replyTo.deletedAt ? "" : preview(m.replyTo.body, 160),
      deleted: !!m.replyTo.deletedAt,
    }
  }
  return {
    _id: m._id,
    conversation: m.conversation,
    sender: m.sender,
    senderRole: m.senderRole,
    senderName: m.senderName,
    body: deleted ? "" : m.body,
    category: m.category,
    priority: m.priority,
    isBroadcast: !!m.isBroadcast,
    broadcastId: m.broadcastId || null,
    replyTo,
    readAt: m.readAt || null,
    editedAt: m.editedAt || null,
    deleted,
    clientId: m.clientId || null,
    createdAt: m.createdAt,
  }
}

const REPLY_POPULATE = { path: "replyTo", select: "sender senderName body deletedAt" }

const toConversation = (c) => ({
  _id: c._id, hod: c.hod, faculty: c.faculty,
  lastMessage: c.lastMessage, lastMessageAt: c.lastMessageAt, unread: c.unread,
})

/** Resolve + authorise the other person of a conversation. */
async function resolveContact(me, contactId) {
  if (!isId(contactId)) throw new HttpError(400, "Invalid contact")
  if (String(me._id) === String(contactId)) throw new HttpError(400, "You cannot message yourself")

  const other = await User.findById(contactId).select("name email role department phone").lean()
  if (!other) throw new HttpError(404, "Contact not found")

  const meSide = sideOf(me.role)
  const okRole = meSide === "hod" ? FACULTY_ROLES.includes(other.role) : other.role === "hod"
  if (!okRole) throw new HttpError(403, meSide === "hod" ? "You can only message faculty of your department" : "You can only message your HOD")
  if (!deptRegex(me.department).test(other.department || "")) throw new HttpError(403, "You can only message people in your own department")

  return {
    other, meSide, otherSide: otherSideOf(meSide),
    hodId: meSide === "hod" ? me._id : other._id,
    facultyId: meSide === "hod" ? other._id : me._id,
  }
}

/** get-or-create the one conversation of a pair; safe if two requests race (unique index + retry). */
async function getOrCreateConversation(hodId, facultyId, department) {
  const filter = { hod: hodId, faculty: facultyId }
  const found = await DeptConversation.findOne(filter)
  if (found) return found
  try {
    return await DeptConversation.create({ ...filter, department: String(department || "").trim() })
  } catch (err) {
    if (err?.code === 11000) return DeptConversation.findOne(filter)
    throw err
  }
}

const findConversation = (hodId, facultyId) => DeptConversation.findOne({ hod: hodId, faculty: facultyId })

/** Messages from `otherId` that I have not read yet -> mark read, zero my counter, tell both parties. */
async function markConversationRead(conv, me) {
  const meSide = sideOf(me.role)
  const otherId = String(meSide === "hod" ? conv.faculty : conv.hod)
  const now = new Date()
  const res = await DeptMessage.updateMany(
    { conversation: conv._id, sender: otherId, readAt: null },
    { $set: { readAt: now } }
  )
  await DeptConversation.updateOne({ _id: conv._id }, { $set: { [`unread.${meSide}`]: 0 } })

  const payload = { conversationId: String(conv._id), readerId: String(me._id), readAt: now }
  if (res.modifiedCount > 0) emitToUser(otherId, "dm:read", payload) // sender's ticks turn blue
  emitToUser(me._id, "dm:read", payload)                              // my other tabs clear their badge
  emitToUser(me._id, "dm:unread", { total: await unreadTotal(me) })
  return res.modifiedCount
}

async function notify(userId, { title, message, link, meta }) {
  try { await Notification.create({ userId, type: "system", title, message, link, meta }) } catch (e) { /* never block a message on this */ }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/dept-messages/contacts
// HOD -> every faculty of the department.  Faculty -> the HOD(s) of the department.
// Includes people you have never talked to (so the first message can be started from here).
// ═══════════════════════════════════════════════════════════════════════════
exports.getContacts = wrap(async (req, res) => {
  const me = req.user
  const meSide = sideOf(me.role)
  const dept = deptRegex(me.department)

  const people = meSide === "hod"
    ? await User.find({ role: { $in: FACULTY_ROLES }, department: dept }).select("name email role department phone").lean()
    : await User.find({ role: "hod", department: dept }).select("name email role department phone").lean()

  const convs = await DeptConversation.find({ [meSide]: me._id }).lean()
  const byOther = new Map(convs.map((c) => [String(meSide === "hod" ? c.faculty : c.hod), c]))

  const data = people.map((p) => {
    const c = byOther.get(String(p._id))
    return {
      id: p._id, name: p.name, email: p.email, phone: p.phone || "", role: p.role, department: p.department,
      online: isOnline(p._id),
      conversationId: c?._id || null,
      lastMessage: c?.lastMessage?.messageId && !c.lastMessage.isBroadcast ? c.lastMessage : null,
      lastMessageAt: c?.lastMessageAt || null,
      unread: c?.unread?.[meSide] || 0,
    }
  })

  data.sort((a, b) => {
    const ta = a.lastMessageAt ? +new Date(a.lastMessageAt) : 0
    const tb = b.lastMessageAt ? +new Date(b.lastMessageAt) : 0
    return tb - ta || a.name.localeCompare(b.name)
  })

  res.json({ success: true, data })
})

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/dept-messages/stats      (same four cards as Student Messages)
// ═══════════════════════════════════════════════════════════════════════════
exports.getStats = wrap(async (req, res) => {
  const me = req.user
  const meSide = sideOf(me.role)
  const convs = await DeptConversation.find({ [meSide]: me._id }).select("_id unread").lean()
  const ids = convs.map((c) => c._id)
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
  const chat = { conversation: { $in: ids }, deletedAt: null, isBroadcast: { $ne: true } } // personal chats only

  const annFilter = meSide === "hod" ? { sender: me._id, deletedAt: null } : { recipients: me._id, deletedAt: null }
  const [total, today, announcements, annUnread] = await Promise.all([
    DeptMessage.countDocuments(chat),
    DeptMessage.countDocuments({ ...chat, createdAt: { $gte: startOfDay } }),
    DeptAnnouncement.countDocuments(annFilter),
    meSide === "hod" ? 0 : DeptAnnouncement.countDocuments({ ...annFilter, "readBy.user": { $ne: me._id } }),
  ])

  res.json({
    success: true,
    data: {
      total, today, announcements,
      unread: convs.reduce((s, c) => s + (c.unread?.[meSide] || 0), 0), // unread chat messages
      announcementsUnread: annUnread,
    },
  })
})

exports.getUnreadCount = wrap(async (req, res) => {
  res.json({ success: true, data: { total: await unreadTotal(req.user) } })
})

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/dept-messages/conversations/:contactId/messages
//     ?limit=30&before=<messageId>&search=&category=&priority=
// Newest page first from the DB, returned oldest -> newest. `before` pages backwards.
// ═══════════════════════════════════════════════════════════════════════════
exports.getThread = wrap(async (req, res) => {
  const me = req.user
  const { other, hodId, facultyId } = await resolveContact(me, req.params.contactId)
  const conv = await findConversation(hodId, facultyId)
  if (!conv) return res.json({ success: true, data: { conversation: null, contact: other, messages: [], hasMore: false } })

  const limit = Math.min(PAGE_MAX, Math.max(1, parseInt(req.query.limit, 10) || PAGE_DEFAULT))
  const filter = { conversation: conv._id, isBroadcast: { $ne: true } } // announcements live in their own section
  if (req.query.before) {
    if (!isId(req.query.before)) throw new HttpError(400, "Invalid cursor")
    filter._id = { $lt: oid(req.query.before) }
  }
  if (CATEGORIES.includes(req.query.category)) filter.category = req.query.category
  if (PRIORITIES.includes(req.query.priority)) filter.priority = req.query.priority
  if (typeof req.query.search === "string" && req.query.search.trim()) {
    const esc = req.query.search.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    filter.body = { $regex: esc, $options: "i" }
    filter.deletedAt = null
  }

  const rows = await DeptMessage.find(filter).sort({ _id: -1 }).limit(limit + 1).populate(REPLY_POPULATE).lean()
  const hasMore = rows.length > limit
  const page = rows.slice(0, limit).reverse().map(toMessage)

  res.json({ success: true, data: { conversation: toConversation(conv), contact: other, messages: page, hasMore } })
})

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/dept-messages/conversations/:contactId/messages
//   { body, category?, priority?, replyTo?, clientId? }
// ═══════════════════════════════════════════════════════════════════════════
exports.sendMessage = wrap(async (req, res) => {
  const me = req.user
  const { body, category, priority } = cleanPayload(req.body)
  const { other, meSide, otherSide, hodId, facultyId } = await resolveContact(me, req.params.contactId)

  const clientId = typeof req.body.clientId === "string" && req.body.clientId ? req.body.clientId.slice(0, 64) : null

  // idempotency: a retried request returns the message that was already stored
  if (clientId) {
    const dup = await DeptMessage.findOne({ sender: me._id, clientId }).populate(REPLY_POPULATE).lean()
    if (dup) return res.status(200).json({ success: true, data: toMessage(dup), duplicate: true })
  }

  const conv = await getOrCreateConversation(hodId, facultyId, me.department)

  let replyTo = null
  if (req.body.replyTo) {
    if (!isId(req.body.replyTo)) throw new HttpError(400, "Invalid reply target")
    const target = await DeptMessage.findOne({ _id: req.body.replyTo, conversation: conv._id }).select("_id").lean()
    if (!target) throw new HttpError(400, "The message you are replying to does not exist in this conversation")
    replyTo = target._id
  }

  let doc
  try {
    doc = await DeptMessage.create({
      conversation: conv._id, sender: me._id, senderRole: me.role, senderName: me.name,
      body, category, priority, replyTo, clientId,
    })
  } catch (err) {
    if (err?.code === 11000 && clientId) { // lost a race with the same clientId
      const dup = await DeptMessage.findOne({ sender: me._id, clientId }).populate(REPLY_POPULATE).lean()
      if (dup) return res.status(200).json({ success: true, data: toMessage(dup), duplicate: true })
    }
    throw err
  }

  const updated = await DeptConversation.findByIdAndUpdate(
    conv._id,
    {
      $set: {
        lastMessage: { messageId: doc._id, text: preview(body), sender: me._id, category, priority, isBroadcast: false },
        lastMessageAt: doc.createdAt,
      },
      $inc: { [`unread.${otherSide}`]: 1 },
    },
    { new: true }
  ).lean()

  const full = await DeptMessage.findById(doc._id).populate(REPLY_POPULATE).lean()
  const message = toMessage(full)
  const conversation = toConversation(updated)

  // real-time: both parties (all their tabs/devices) get the message + fresh counters
  emitToUser(other._id, "dm:new", { message, conversation })
  emitToUser(me._id, "dm:new", { message, conversation })
  emitToUser(other._id, "dm:unread", { total: await unreadTotal(other) })

  // bell notification only when it matters (first unread, or urgent) so a chat doesn't flood it
  if (priority === "Urgent" || updated.unread?.[otherSide] === 1) {
    notify(other._id, {
      title: `${priority === "Urgent" ? "🚨 Urgent message" : "New message"} from ${me.name}`,
      message: preview(body, 100),
      link: pathFor(otherSide),
      meta: { kind: "dept-message", conversationId: String(conv._id) },
    })
  }

  res.status(201).json({ success: true, data: message })
})

// ═══════════════════════════════════════════════════════════════════════════
// PATCH /api/dept-messages/conversations/:contactId/read
// ═══════════════════════════════════════════════════════════════════════════
exports.markThreadRead = wrap(async (req, res) => {
  const me = req.user
  const { hodId, facultyId } = await resolveContact(me, req.params.contactId)
  const conv = await findConversation(hodId, facultyId)
  const marked = conv ? await markConversationRead(conv, me) : 0
  res.json({ success: true, data: { marked } })
})

// PATCH /api/dept-messages/read-all
exports.markAllRead = wrap(async (req, res) => {
  const me = req.user
  const meSide = sideOf(me.role)
  const convs = await DeptConversation.find({ [meSide]: me._id, [`unread.${meSide}`]: { $gt: 0 } })
  let marked = 0
  for (const c of convs) marked += await markConversationRead(c, me)
  res.json({ success: true, data: { marked } })
})

// ═══════════════════════════════════════════════════════════════════════════
// PATCH /api/dept-messages/messages/:id     { body }      (own message, within 15 min)
// ═══════════════════════════════════════════════════════════════════════════
exports.editMessage = wrap(async (req, res) => {
  const me = req.user
  if (!isId(req.params.id)) throw new HttpError(400, "Invalid message")
  const { body } = cleanPayload(req.body)

  const msg = await DeptMessage.findById(req.params.id)
  if (!msg || String(msg.sender) !== String(me._id)) throw new HttpError(404, "Message not found")
  if (msg.deletedAt) throw new HttpError(400, "This message was deleted")
  if (msg.isBroadcast) throw new HttpError(400, "Broadcast messages cannot be edited — delete and send a new one")
  if (Date.now() - +msg.createdAt > EDIT_WINDOW_MS) throw new HttpError(400, "Messages can only be edited within 15 minutes")

  msg.body = body
  msg.editedAt = new Date()
  await msg.save()

  const conv = await DeptConversation.findById(msg.conversation)
  if (conv && String(conv.lastMessage?.messageId) === String(msg._id)) {
    conv.lastMessage.text = preview(body)
    await conv.save()
  }

  const message = toMessage(await DeptMessage.findById(msg._id).populate(REPLY_POPULATE).lean())
  if (conv) {
    emitToUser(conv.hod, "dm:updated", { message })
    emitToUser(conv.faculty, "dm:updated", { message })
  }
  res.json({ success: true, data: message })
})

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /api/dept-messages/messages/:id
// "Delete for everyone" (soft delete: the bubble stays as "message deleted").
// ═══════════════════════════════════════════════════════════════════════════
async function softDelete(msg) {
  if (msg.deletedAt) return null
  const conv = await DeptConversation.findById(msg.conversation)
  await DeptMessage.updateOne({ _id: msg._id }, { $set: { deletedAt: new Date(), body: "" } })
  if (!conv) return null

  const recipientSide = String(conv.hod) === String(msg.sender) ? "faculty" : "hod"
  if (!msg.readAt) {
    // it was never read -> shrink the recipient's badge (guard: counter never goes below zero)
    await DeptConversation.updateOne(
      { _id: conv._id, [`unread.${recipientSide}`]: { $gt: 0 } },
      { $inc: { [`unread.${recipientSide}`]: -1 } }
    )
  }
  if (String(conv.lastMessage?.messageId) === String(msg._id)) {
    await DeptConversation.updateOne({ _id: conv._id }, { $set: { "lastMessage.text": "🚫 Message deleted" } })
  }

  const payload = { messageId: String(msg._id), conversationId: String(conv._id) }
  emitToUser(conv.hod, "dm:deleted", payload)
  emitToUser(conv.faculty, "dm:deleted", payload)
  const recipientId = recipientSide === "hod" ? conv.hod : conv.faculty
  const recipient = await User.findById(recipientId).select("role").lean()
  if (recipient) emitToUser(recipientId, "dm:unread", { total: await unreadTotal({ _id: recipientId, role: recipient.role }) })
  return payload
}

exports.deleteMessage = wrap(async (req, res) => {
  const me = req.user
  if (!isId(req.params.id)) throw new HttpError(400, "Invalid message")

  const msg = await DeptMessage.findById(req.params.id)
  if (!msg || String(msg.sender) !== String(me._id)) throw new HttpError(404, "Message not found")

  const count = (await softDelete(msg)) ? 1 : 0
  res.json({ success: true, data: { deleted: count } })
})

// ═══════════════════════════════════════════════════════════════════════════
// ANNOUNCEMENTS  (HOD -> faculty notice board, separate from the 1-to-1 chats)
// ═══════════════════════════════════════════════════════════════════════════
const idStr = (v) => String(v)

/** HOD sees who has / hasn't seen it; faculty sees whether THEY have read it. */
function toAnnouncement(a, me, nameById = new Map()) {
  const base = {
    _id: a._id, sender: a.sender, senderName: a.senderName, body: a.body,
    category: a.category, priority: a.priority, createdAt: a.createdAt, recipientCount: a.recipients.length,
  }
  if (idStr(a.sender) === idStr(me._id)) {
    const readAt = new Map((a.readBy || []).map((r) => [idStr(r.user), r.at]))
    return {
      ...base,
      readCount: readAt.size,
      recipients: a.recipients.map((id) => ({ id: idStr(id), name: nameById.get(idStr(id)) || "Faculty", read: readAt.has(idStr(id)), readAt: readAt.get(idStr(id)) || null })),
    }
  }
  return { ...base, read: (a.readBy || []).some((r) => idStr(r.user) === idStr(me._id)) }
}

async function namesFor(announcements) {
  const ids = [...new Set(announcements.flatMap((a) => a.recipients.map(idStr)))]
  if (!ids.length) return new Map()
  const users = await User.find({ _id: { $in: ids } }).select("name").lean()
  return new Map(users.map((u) => [idStr(u._id), u.name]))
}

// GET /api/dept-messages/announcements
exports.getAnnouncements = wrap(async (req, res) => {
  const me = req.user
  const filter = me.role === "hod" ? { sender: me._id, deletedAt: null } : { recipients: me._id, deletedAt: null }
  const rows = await DeptAnnouncement.find(filter).sort({ createdAt: -1 }).limit(100).lean()
  const names = me.role === "hod" ? await namesFor(rows) : new Map()
  res.json({ success: true, data: rows.map((a) => toAnnouncement(a, me, names)) })
})

// POST /api/dept-messages/announcements   (HOD only)   { body, category?, priority?, recipients: "all" | [facultyId,...] }
exports.createAnnouncement = wrap(async (req, res) => {
  const me = req.user
  if (me.role !== "hod") throw new HttpError(403, "Only the HOD can post announcements")
  const { body, priority } = cleanPayload(req.body)
  const category = CATEGORIES.includes(req.body.category) ? req.body.category : "Announcement"

  const filter = { role: { $in: FACULTY_ROLES }, department: deptRegex(me.department) }
  const wanted = req.body.recipients
  if (Array.isArray(wanted)) {
    const ids = wanted.filter(isId).map(oid)
    if (!ids.length) throw new HttpError(400, "Select at least one faculty member")
    filter._id = { $in: ids }
  } else if (wanted !== undefined && wanted !== "all") {
    throw new HttpError(400, 'recipients must be "all" or a list of faculty ids')
  }
  const faculty = await User.find(filter).select("_id name").lean()
  if (!faculty.length) throw new HttpError(404, "No faculty found in your department for this announcement")

  const doc = await DeptAnnouncement.create({
    sender: me._id, senderName: me.name, department: String(me.department).trim(),
    body, category, priority, recipients: faculty.map((f) => f._id),
  })

  await Notification.insertMany(faculty.map((f) => ({
    userId: f._id, type: "system",
    title: `${priority === "Urgent" ? "🚨 " : "📢 "}Announcement from ${me.name}`,
    message: preview(body, 100), link: pathFor("faculty"),
    meta: { kind: "dept-announcement", announcementId: String(doc._id) },
  }))).catch(() => {})

  const names = new Map(faculty.map((f) => [idStr(f._id), f.name]))
  const lean = doc.toObject()
  emitToUser(me._id, "ann:new", { announcement: toAnnouncement(lean, me, names) })
  for (const f of faculty) {
    emitToUser(f._id, "ann:new", { announcement: toAnnouncement(lean, { _id: f._id }, names) })
    emitToUser(f._id, "dm:unread", { total: await unreadTotal({ _id: f._id, role: "teaching" }) })
  }

  res.status(201).json({ success: true, data: { count: faculty.length, announcement: toAnnouncement(lean, me, names) } })
})

// PATCH /api/dept-messages/announcements/:id/read      (faculty)
exports.markAnnouncementRead = wrap(async (req, res) => {
  const me = req.user
  if (!isId(req.params.id)) throw new HttpError(400, "Invalid announcement")
  const r = await DeptAnnouncement.findOneAndUpdate(
    { _id: req.params.id, recipients: me._id, deletedAt: null, "readBy.user": { $ne: me._id } },
    { $push: { readBy: { user: me._id, at: new Date() } } },
    { new: true }
  ).lean()
  if (r) {
    emitToUser(r.sender, "ann:read", { announcementId: idStr(r._id), userId: idStr(me._id), at: new Date() })
    emitToUser(me._id, "dm:unread", { total: await unreadTotal(me) })
  }
  res.json({ success: true, data: { marked: r ? 1 : 0 } })
})

// PATCH /api/dept-messages/announcements/read-all      (faculty)
exports.markAllAnnouncementsRead = wrap(async (req, res) => {
  const me = req.user
  const pending = await DeptAnnouncement.find({ recipients: me._id, deletedAt: null, "readBy.user": { $ne: me._id } }).select("_id sender").lean()
  if (pending.length) {
    const at = new Date()
    await DeptAnnouncement.updateMany({ _id: { $in: pending.map((p) => p._id) } }, { $push: { readBy: { user: me._id, at } } })
    for (const p of pending) emitToUser(p.sender, "ann:read", { announcementId: idStr(p._id), userId: idStr(me._id), at })
    emitToUser(me._id, "dm:unread", { total: await unreadTotal(me) })
  }
  res.json({ success: true, data: { marked: pending.length } })
})

// DELETE /api/dept-messages/announcements/:id          (HOD, own announcement)
exports.deleteAnnouncement = wrap(async (req, res) => {
  const me = req.user
  if (!isId(req.params.id)) throw new HttpError(400, "Invalid announcement")
  const a = await DeptAnnouncement.findOneAndUpdate(
    { _id: req.params.id, sender: me._id, deletedAt: null }, { $set: { deletedAt: new Date() } }, { new: true }
  ).lean()
  if (!a) throw new HttpError(404, "Announcement not found")
  const payload = { announcementId: idStr(a._id) }
  emitToUser(me._id, "ann:deleted", payload)
  for (const id of a.recipients) {
    emitToUser(id, "ann:deleted", payload)
    emitToUser(id, "dm:unread", { total: await unreadTotal({ _id: id, role: "teaching" }) })
  }
  res.json({ success: true, data: { deleted: 1 } })
})
