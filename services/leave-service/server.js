/**
 * leave-service: leave applications, balances, monthly stats, holidays and HOD approval.
 * Port 8003. Uses the same MongoDB database as the backend for now (see README), so no data is copied.
 *
 *   /api/leaves
 */
require("dotenv").config()
const express = require("express")
const { authenticate } = require("./src/middleware/auth")

const app = express()
app.disable("x-powered-by")
app.set("trust proxy", 1)                       // the gateway is one hop in front
app.use(express.json({ limit: "50mb" }))        // same limit as the backend (file uploads arrive as base64)
app.use(express.urlencoded({ extended: true, limit: "50mb" }))

app.get("/health", (_req, res) => res.json({ status: "ok", service: "leave-service" }))

// Everything under /api needs a valid login token, exactly like the backend
app.use("/api", authenticate)

app.use("/api/leaves", require("./src/routes/leaveRoutes"))

app.use((req, res) => res.status(404).json({ message: "Not found" }))
app.use((err, _req, res, _next) => {
  console.error(err.stack)
  res.status(err.status || 500).json({ message: err.status ? err.message : (err.message || "Internal server error") })
})

module.exports = app

if (require.main === module) {
  const PORT = process.env.PORT || 8003
  require("./src/db")()
    .then(() => app.listen(PORT, () => console.log(`✅ leave-service on http://localhost:${PORT}`)))
    .catch((e) => { console.error("❌ Could not start:", e.message); process.exit(1) })
}
