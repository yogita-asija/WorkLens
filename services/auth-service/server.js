/**
 * auth-service: login, current user, settings, and internal user lookups for other services. Port 8001.
 *
 *   Public (through the gateway):   POST /api/auth/login, GET /api/auth/me, GET|PUT /api/settings/:userId
 *   Internal (other services only): GET /internal/users/:id, GET /internal/users?dept=&role=&ids=
 */
require("dotenv").config()
const express = require("express")
const { authenticate, requireInternal } = require("./src/auth")
const auth = require("./src/controllers/authController")
const settings = require("./src/controllers/settingsController")

const app = express()
app.disable("x-powered-by")
app.set("trust proxy", 1)        // the gateway is one hop in front: use its X-Forwarded-For as the client IP
app.use(express.json({ limit: "1mb" }))

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

app.get("/health", (_req, res) => res.json({ status: "ok", service: "auth-service" }))

// public
app.post("/api/auth/login", auth.loginUser)
app.get("/api/auth/me", authenticate, auth.me)
app.get("/api/settings/:userId", authenticate, settings.getSettings)
app.put("/api/settings/:userId", authenticate, settings.updateSettings)

// internal
app.get("/internal/users/:id", requireInternal, wrap(auth.internalGetUser))
app.get("/internal/users", requireInternal, wrap(auth.internalListUsers))

app.use((req, res) => res.status(404).json({ message: "Not found" }))
app.use((err, _req, res, _next) => {
  console.error(err.stack)
  res.status(err.status || 500).json({ message: err.status ? err.message : "Internal server error" })
})

module.exports = app

if (require.main === module) {
  const PORT = process.env.PORT || 8001
  require("./src/db")()
    .then(() => app.listen(PORT, () => console.log(`✅ auth-service on http://localhost:${PORT}`)))
    .catch((e) => { console.error("❌ Could not start:", e.message); process.exit(1) })
}
