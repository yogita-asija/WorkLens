/**
 * WorkLens API gateway: the only public entry point.
 *
 *   browser -> gateway (:8000) -> owning service (see routes.js)
 *
 * What it does
 *   1. CORS (CORS_ORIGIN), the upstream services' own CORS headers are removed so they never double up
 *   2. Verifies the login token (JWT) once, rejects bad/missing tokens with 401
 *   3. Forwards the verified identity as x-user-id / x-user-role (client-supplied copies are stripped first)
 *   4. Proxies REST and WebSocket (Socket.IO) traffic to the right service
 *   5. Never exposes /internal/* (service-to-service endpoints)
 *   6. Returns a clean 502 JSON error when a service is down, instead of hanging
 *
 * It does NOT parse request bodies, so large uploads stream straight through.
 */
require("dotenv").config()
const http = require("http")
const express = require("express")
const cors = require("cors")
const jwt = require("jsonwebtoken")
const { createProxyMiddleware } = require("http-proxy-middleware")
const { routes, socket, fallback } = require("./routes")

const PORT = process.env.PORT || 8000
const JWT_SECRET = process.env.JWT_SECRET
const PROXY_TIMEOUT_MS = Number(process.env.PROXY_TIMEOUT_MS) || 120000 // AI lesson-plan generation can be slow

const app = express()
app.disable("x-powered-by")

// ── 1. CORS ────────────────────────────────────────────────────────────────
const allowed = (process.env.CORS_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean)
app.use(cors(allowed.length ? { origin: allowed } : undefined)) // same behaviour as the monolith: no CORS_ORIGIN = allow all

// ── 2. Never trust identity headers coming from the outside ────────────────
app.use((req, _res, next) => {
  delete req.headers["x-user-id"]
  delete req.headers["x-user-role"]
  delete req.headers["x-user-dept"]
  next()
})

// ── 3. Health + hide internal endpoints ────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "api-gateway",
    jwtCheck: !!JWT_SECRET,
    upstreams: Object.fromEntries([...routes, socket, fallback].map((r) => [r.name, r.target])),
  })
})
app.use("/internal", (_req, res) => res.status(404).json({ success: false, message: "Not found" }))

// ── 4. Verify the token once for everything under /api ─────────────────────
const PUBLIC = [{ method: "POST", path: "/api/auth/login" }]

if (!JWT_SECRET) {
  console.warn("⚠️  JWT_SECRET not set: the gateway will NOT check tokens (each service still does). Set the same JWT_SECRET as the backend.")
}

app.use("/api", (req, res, next) => {
  if (!JWT_SECRET) return next()
  if (req.method === "OPTIONS") return next()
  const fullPath = req.baseUrl + req.path
  if (PUBLIC.some((p) => p.method === req.method && p.path === fullPath)) return next()

  const [scheme, token] = (req.headers.authorization || "").split(" ")
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ success: false, message: "Authentication required" })
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.headers["x-user-id"] = String(payload.sub)
    req.headers["x-user-role"] = String(payload.role || "")
    if (payload.dept) req.headers["x-user-dept"] = String(payload.dept)
    next()
  } catch (e) {
    const expired = e.name === "TokenExpiredError"
    res.status(401).json({ success: false, message: expired ? "Session expired, please log in again" : "Invalid token" })
  }
})

// ── 5. Proxies ─────────────────────────────────────────────────────────────
const onError = (name) => (err, _req, res) => {
  console.error(`[gateway] ${name} unreachable: ${err.code || err.message}`)
  if (res && typeof res.writeHead === "function" && !res.headersSent) {
    res.writeHead(502, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ success: false, message: `Service unavailable (${name}). Please try again shortly.` }))
  } else if (res && typeof res.destroy === "function") {
    res.destroy() // websocket upgrade failed
  }
}

// the gateway owns CORS, so drop whatever the upstream sent (otherwise the browser sees duplicate headers and refuses)
const stripUpstreamCors = (proxyRes) => {
  for (const h of Object.keys(proxyRes.headers)) if (h.toLowerCase().startsWith("access-control-")) delete proxyRes.headers[h]
}

const makeProxy = ({ name, target }, extra = {}) =>
  createProxyMiddleware({
    target,
    changeOrigin: true,
    proxyTimeout: PROXY_TIMEOUT_MS,
    timeout: PROXY_TIMEOUT_MS,
    on: { proxyRes: stripUpstreamCors, error: onError(name) },
    ...extra,
  })

// WebSocket / Socket.IO (long-polling requests also arrive here)
const socketProxy = makeProxy(socket, { pathFilter: socket.prefix, ws: true })
app.use(socketProxy)

// one proxy per service, matched by URL prefix, in the order given in routes.js
for (const route of routes) app.use(makeProxy(route, { pathFilter: route.prefixes }))

// everything else (GET / and anything not claimed above)
app.use(makeProxy(fallback))

const server = http.createServer(app)
server.on("upgrade", socketProxy.upgrade) // WebSocket upgrades are not seen by Express middleware
server.listen(PORT, () => {
  console.log(`✅ API gateway on http://localhost:${PORT}`)
  for (const r of routes) console.log(`   ${r.prefixes.join(", ")}  ->  ${r.name} (${r.target})`)
  console.log(`   ${socket.prefix} (ws)  ->  ${socket.name} (${socket.target})`)
  console.log(`   everything else  ->  ${fallback.name} (${fallback.target})`)
})
