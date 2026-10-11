/**
 * Socket.IO layer (real-time delivery, typing indicator, online presence).
 *
 *   rooms:   user:<id>   -> every open tab/device of one user
 *            dept:<key>  -> everybody of one department (presence only)
 *
 *   server -> client:  dm:new | dm:read | dm:updated | dm:deleted | dm:unread
 *                      typing | presence | presence:list
 *   client -> server:  typing { to, typing }
 *
 * Auth: the handshake must carry the same signed login token the REST API uses (middleware/auth.js).
 */
const { Server } = require("socket.io")
const User = require("../../models/User")
const { verifyToken } = require("../../middleware/auth")
const { ALLOWED_ROLES, deptKey, isId, sideOf, unreadTotal } = require("./deptChat")

let io = null
const online = new Map() // userId -> { sockets:Set<string>, role, dept }

function initSocket(httpServer) {
  const origins = (process.env.CLIENT_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean)
  io = new Server(httpServer, { cors: { origin: origins.length ? origins : "*" } })

  // ── handshake: only real HOD / faculty users with a department get in ──────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token
      if (typeof token !== "string" || !token) return next(new Error("unauthorized"))
      const payload = verifyToken(token)            // throws if forged / expired
      if (!isId(payload.sub)) return next(new Error("unauthorized"))
      const user = await User.findById(payload.sub).select("name role department").lean()
      if (!user || !ALLOWED_ROLES.includes(user.role) || !deptKey(user.department)) return next(new Error("unauthorized"))
      socket.data.user = { _id: String(user._id), role: user.role, dept: deptKey(user.department) }
      next()
    } catch { next(new Error("unauthorized")) }
  })

  io.on("connection", async (socket) => {
    const me = socket.data.user
    socket.join(`user:${me._id}`)
    socket.join(`dept:${me.dept}`)

    const entry = online.get(me._id) || { sockets: new Set(), role: me.role, dept: me.dept }
    const wasOffline = entry.sockets.size === 0
    entry.sockets.add(socket.id)
    online.set(me._id, entry)
    if (wasOffline) socket.to(`dept:${me.dept}`).emit("presence", { userId: me._id, online: true })

    // initial state for this socket
    socket.emit("presence:list", { ids: onlineIdsForDept(me.dept) })
    try { socket.emit("dm:unread", { total: await unreadTotal(me) }) } catch { /* non-fatal */ }

    // typing indicator: relayed only between a HOD and a faculty of the SAME department
    let lastTyping = 0
    socket.on("typing", ({ to, typing } = {}) => {
      if (!isId(to)) return
      const now = Date.now()
      if (typing && now - lastTyping < 1000) return // flood guard
      lastTyping = now
      const target = online.get(String(to))
      if (!target || target.dept !== me.dept) return
      if (sideOf(target.role) === sideOf(me.role)) return
      io.to(`user:${to}`).emit("typing", { from: me._id, typing: !!typing })
    })

    socket.on("disconnect", () => {
      const e = online.get(me._id)
      if (!e) return
      e.sockets.delete(socket.id)
      if (e.sockets.size === 0) {
        online.delete(me._id)
        socket.to(`dept:${me.dept}`).emit("presence", { userId: me._id, online: false })
      }
    })
  })

  return io
}

function onlineIdsForDept(dept) {
  const ids = []
  for (const [id, e] of online) if (e.dept === dept) ids.push(id)
  return ids
}

/** Emit to every open tab/device of a user. Silent no-op if sockets are not initialised (e.g. in tests). */
function emitToUser(userId, event, payload) {
  if (io) io.to(`user:${String(userId)}`).emit(event, payload)
}

const isOnline = (userId) => online.has(String(userId))

module.exports = { initSocket, emitToUser, isOnline }
