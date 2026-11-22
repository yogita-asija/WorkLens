/**
 * Client for auth-service's /internal/users endpoints. This replaces every direct read of the `User` model
 * (the users belong to auth-service, not to messaging).
 *
 *   getById(id)                  -> user | null
 *   list({ dept, role, ids })    -> users   (role may be one role or an array)
 *   byIds([ids])                 -> users
 *
 * Users come back trimmed to what messaging needs: { _id, name, email, role, department, phone }.
 *
 * Lookups by id are cached for 30 s (USER_CACHE_TTL_MS) because every chat request, and every socket
 * handshake, needs the caller. The only effect is that a role or department change takes up to 30 s to be
 * noticed here. If auth-service is down, callers get HttpError(503) instead of a confusing 401/500.
 *
 * Config: AUTH_URL (default http://localhost:8001), JWT_SECRET (the internal key is derived from it).
 */
const crypto = require("crypto")
const { HttpError } = require("./httpError")

const OBJECT_ID = /^[0-9a-fA-F]{24}$/
const TIMEOUT_MS = 4000
const CHUNK = 80          // ids per request, keeps URLs short
const CACHE_MAX = 2000

const baseUrl = () => (process.env.AUTH_URL || "http://localhost:8001").replace(/\/$/, "")
const ttl = () => (process.env.USER_CACHE_TTL_MS !== undefined ? Number(process.env.USER_CACHE_TTL_MS) : 30000)
const internalKey = () => crypto.createHmac("sha256", process.env.JWT_SECRET || "").update("worklens-internal").digest("hex")

const slim = (u) => ({
  _id: String(u._id),
  name: u.name,
  email: u.email,
  role: u.role,
  department: u.department || "",
  phone: u.phone || "",
})

const cache = new Map() // id -> { user, exp }
const remember = (user) => {
  if (ttl() <= 0) return
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value)
  cache.set(user._id, { user, exp: Date.now() + ttl() })
}

async function call(path) {
  let res
  try {
    res = await fetch(`${baseUrl()}${path}`, { headers: { "x-internal-key": internalKey() }, signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch (e) {
    console.warn(`[users] auth-service unreachable: ${e.name === "TimeoutError" ? "timeout" : e.message}`)
    throw new HttpError(503, "User service is unavailable. Please try again shortly.")
  }
  if (res.status === 404) return null
  if (!res.ok) {
    console.warn(`[users] auth-service answered ${res.status} for ${path.split("?")[0]}`)
    throw new HttpError(503, "User service is unavailable. Please try again shortly.")
  }
  return res.json()
}

async function getById(id) {
  const key = String(id)
  if (!OBJECT_ID.test(key)) return null
  const hit = cache.get(key)
  if (hit && hit.exp > Date.now()) return hit.user
  const raw = await call(`/internal/users/${key}`)
  if (!raw) { cache.delete(key); return null }
  const user = slim(raw)
  remember(user)
  return user
}

async function list({ dept, role, ids } = {}) {
  const params = new URLSearchParams()
  if (dept) params.set("dept", String(dept))
  if (role) params.set("role", Array.isArray(role) ? role.join(",") : String(role))

  const fetchPage = async (idChunk) => {
    const p = new URLSearchParams(params)
    if (idChunk) p.set("ids", idChunk.join(","))
    const rows = (await call(`/internal/users?${p}`)) || []
    return rows.map(slim)
  }

  let out
  if (ids && ids.length) {
    const clean = [...new Set(ids.map(String).filter((s) => OBJECT_ID.test(s)))]
    out = []
    for (let i = 0; i < clean.length; i += CHUNK) out.push(...(await fetchPage(clean.slice(i, i + CHUNK))))
  } else {
    out = await fetchPage(null)
  }
  out.forEach(remember)
  return out
}

const byIds = (ids) => (ids && ids.length ? list({ ids }) : Promise.resolve([]))

module.exports = { getById, list, byIds, _cache: cache }
