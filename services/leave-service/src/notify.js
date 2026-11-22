/**
 * Client for notification-service (same idea as backend/shared/models/Notification.js).
 * The chat controllers call `Notification.create(...)` and `Notification.insertMany([...])`; here those calls are HTTP requests.
 *
 * Fire-and-forget: if notification-service is down or slow (2.5 s), a warning is logged and the chat message
 * is still sent. It never throws.
 *
 * Config: NOTIFICATION_URL (default http://localhost:8006), JWT_SECRET (the internal key is derived from it).
 */
const crypto = require("crypto")

const baseUrl = () => (process.env.NOTIFICATION_URL || "http://localhost:8006").replace(/\/$/, "")
const TIMEOUT_MS = Number(process.env.NOTIFICATION_TIMEOUT_MS) || 2500
const internalKey = () => crypto.createHmac("sha256", process.env.JWT_SECRET || "").update("worklens-internal").digest("hex")

async function post(path, body) {
  try {
    const res = await fetch(`${baseUrl()}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-key": internalKey() },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { console.warn(`[notifications] ${path} -> ${res.status} ${data.message || ""}`); return null }
    return data
  } catch (e) {
    console.warn(`[notifications] notification-service unreachable (${e.name === "TimeoutError" ? "timeout" : e.message}); notification skipped`)
    return null
  }
}

module.exports = {
  async create(doc) {
    const r = await post("/internal/notifications", doc)
    return r ? { ...doc, _id: r.id } : null
  },
  async insertMany(docs) {
    if (!docs || !docs.length) return []
    const r = await post("/internal/notifications", docs)
    return r ? docs : []
  },
}
