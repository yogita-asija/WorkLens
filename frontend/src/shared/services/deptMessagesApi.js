/**
 * HOD <-> Faculty messaging: REST client + realtime (Socket.IO) + unread-badge store.
 * Used by pages/DeptMessages.jsx and by both sidebars (unread badge).
 */
import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { io } from "socket.io-client"
import useAppStore from "../../store/useAppStore"
import { getToken } from "./authFetch"

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000"

// ─── REST ────────────────────────────────────────────────────────────────────
async function req(path, opts = {}) {
  const res = await fetch(`${BASE}/api/dept-messages${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json" },   // login token is added automatically by services/authFetch.js
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.success === false) throw new Error(json.message || `Request failed (${res.status})`)
  return json.data
}
const send = (method, b) => ({ method, body: JSON.stringify(b ?? {}) })
const qs = (p = {}) => {
  const s = new URLSearchParams()
  Object.entries(p).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "" && v !== "All") s.set(k, v) })
  const t = s.toString()
  return t ? `?${t}` : ""
}

export const getContacts   = ()              => req("/contacts")
export const getStats      = ()              => req("/stats")
export const getUnreadCount = ()             => req("/unread-count")
export const getThread     = (id, params)    => req(`/conversations/${id}/messages${qs(params)}`)
export const sendMessage   = (id, payload)   => req(`/conversations/${id}/messages`, send("POST", payload))
export const markThreadRead = (id)           => req(`/conversations/${id}/read`, send("PATCH"))
export const markAllRead   = ()              => req("/read-all", send("PATCH"))
export const editMessage   = (id, body)      => req(`/messages/${id}`, send("PATCH", { body }))
export const deleteMessage = (id)            => req(`/messages/${id}`, { method: "DELETE" })

// announcements (HOD notice board)
export const getAnnouncements        = ()        => req("/announcements")
export const createAnnouncement      = (payload) => req("/announcements", send("POST", payload))
export const markAnnouncementRead    = (id)      => req(`/announcements/${id}/read`, send("PATCH"))
export const markAllAnnouncementsRead = ()       => req("/announcements/read-all", send("PATCH"))
export const deleteAnnouncement      = (id)      => req(`/announcements/${id}`, { method: "DELETE" })

// ─── Socket singleton (ref-counted: sidebar badge + page share one connection) ─
let socket = null
let socketUser = null
let refs = 0
let connected = false
const connListeners = new Set()
const setConnected = (v) => { connected = v; connListeners.forEach((f) => f()) }

export function acquireSocket(userId) {
  refs++
  if (!socket || socketUser !== userId) {
    socket?.disconnect()
    socketUser = userId
    socket = io(BASE, { auth: { token: getToken() }, transports: ["websocket", "polling"], reconnectionDelayMax: 5000 })
    socket.on("connect", () => setConnected(true))
    socket.on("disconnect", () => setConnected(false))
    socket.on("dm:unread", ({ total }) => setUnread(total))
  }
  return socket
}

export function releaseSocket() {
  refs = Math.max(0, refs - 1)
  if (refs === 0 && socket) { socket.disconnect(); socket = null; socketUser = null; setConnected(false) }
}

// ─── unread badge store ──────────────────────────────────────────────────────
let unread = 0
const unreadListeners = new Set()
function setUnread(n) { if (n !== unread) { unread = n; unreadListeners.forEach((f) => f()) } }
const subUnread = (f) => { unreadListeners.add(f); return () => unreadListeners.delete(f) }

/** Unread count for the sidebar badge. Keeps the realtime connection alive while mounted. */
export function useDeptUnread() {
  const userId = useAppStore((s) => s.user?._id)
  useEffect(() => {
    if (!userId) return
    acquireSocket(userId)
    getUnreadCount().then((d) => setUnread(d.total)).catch(() => {})
    const t = setInterval(() => { getUnreadCount().then((d) => setUnread(d.total)).catch(() => {}) }, 60000) // fallback if WebSockets are blocked
    return () => { clearInterval(t); releaseSocket() }
  }, [userId])
  return useSyncExternalStore(subUnread, () => unread)
}

/**
 * Subscribe to realtime events from a component.
 *   useDeptSocket({ "dm:new": fn, "dm:read": fn, ... })  -> { connected }
 * Handlers may change every render; the latest ones are always called.
 */
export function useDeptSocket(handlers) {
  const userId = useAppStore((s) => s.user?._id)
  const ref = useRef(handlers)
  ref.current = handlers
  const isConnected = useSyncExternalStore((f) => { connListeners.add(f); return () => connListeners.delete(f) }, () => connected)

  useEffect(() => {
    if (!userId) return
    const s = acquireSocket(userId)
    const events = ["dm:new", "dm:read", "dm:updated", "dm:deleted", "typing", "presence", "presence:list", "connect", "ann:new", "ann:read", "ann:deleted"]
    const fns = events.map((e) => [e, (...a) => ref.current[e]?.(...a)])
    fns.forEach(([e, f]) => s.on(e, f))
    return () => { fns.forEach(([e, f]) => s.off(e, f)); releaseSocket() }
  }, [userId])

  return { connected: isConnected, emitTyping: (to, typing) => socket?.emit("typing", { to, typing }) }
}
