/**
 * Notification client (replaces the old Mongoose model).
 *
 * Notifications now live in notification-service. This file keeps the same `Notification.create(...)`,
 * `Notification.insertMany([...])` and `Notification.deleteMany(...)` calls the controllers already use,
 * so no controller needed to change: each call becomes an HTTP request to notification-service.
 *
 * Fire-and-forget: if the service is down or slow, the call logs a warning and returns instead of throwing,
 * so a failed notification never breaks the request that triggered it (leave, assignment, HOD actions...).
 *
 * Config (backend/.env):  NOTIFICATION_URL=http://localhost:8006   (default)
 *                         JWT_SECRET must be the same value the notification-service has.
 */
// Not hosted with a notification-service (e.g. the Render deploy of the monolith)? Leave NOTIFICATION_URL unset and the
// original in-database model is used, exactly as before the microservices split.
if (!process.env.NOTIFICATION_URL) {
  module.exports = require("./NotificationLocal")
  return
}

const crypto = require("crypto")

const BASE = () => (process.env.NOTIFICATION_URL || "http://localhost:8006").replace(/\/$/, "")
const TIMEOUT_MS = Number(process.env.NOTIFICATION_TIMEOUT_MS) || 2500
const internalKey = () => crypto.createHmac("sha256", process.env.JWT_SECRET || "").update("worklens-internal").digest("hex")

let warnedNoSecret = false
async function post(path, body) {
  if (!process.env.JWT_SECRET && !warnedNoSecret) {
    warnedNoSecret = true
    console.warn("⚠️  JWT_SECRET is not set: notification-service will reject notifications. Set it in backend/.env")
  }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${BASE()}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-key": internalKey() },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { console.warn(`[notifications] ${path} -> ${res.status} ${data.message || ""}`); return null }
    return data
  } catch (e) {
    console.warn(`[notifications] notification-service unreachable (${e.name === "AbortError" ? "timeout" : e.message}); notification skipped`)
    return null
  } finally {
    clearTimeout(timer)
  }
}

const Notification = {
  /** create(doc) or create([docs]) */
  async create(doc) {
    if (Array.isArray(doc)) return this.insertMany(doc)
    const r = await post("/internal/notifications", doc)
    return r ? { ...doc, _id: r.id } : null
  },
  async insertMany(docs) {
    if (!docs || !docs.length) return []
    const r = await post("/internal/notifications", docs)
    return r ? docs : []
  },
  /** Only {} or { userId } (used by seed scripts). */
  async deleteMany(filter = {}) {
    const r = await post("/internal/notifications/delete-many", filter)
    return { deletedCount: r ? r.deleted : 0 }
  },
}

// Reading notifications moved to notification-service. Fail loudly (not silently) if old code tries the old API.
module.exports = new Proxy(Notification, {
  get(target, prop) {
    if (prop in target || typeof prop === "symbol" || prop === "then") return target[prop]
    return () => { throw new Error(`Notification.${String(prop)}() is not available here: notifications moved to notification-service`) }
  },
})
