/**
 * notification-service: stores and serves in-app notifications. Port 8006, database worklens_notification.
 *
 *   Public (through the gateway):   /api/notifications...        needs a valid login token
 *   Internal (other services only): /internal/notifications...   needs the internal key
 */
require("dotenv").config()
const express = require("express")
const { verifyJwt, requireInternal } = require("./src/auth")
const ctrl = require("./src/controller")

const app = express()
app.disable("x-powered-by")
app.use(express.json({ limit: "2mb" }))

app.get("/health", (_req, res) => res.json({ status: "ok", service: "notification-service" }))

// public
const api = express.Router()
api.use(verifyJwt)
api.get("/", ctrl.getNotifications)
api.post("/", ctrl.createNotification)
api.patch("/read-all", ctrl.markAllRead)
api.patch("/:id/read", ctrl.markRead)
api.delete("/:id", ctrl.deleteNotification)
app.use("/api/notifications", api)

// internal
const internal = express.Router()
internal.use(requireInternal)
internal.post("/notifications", ctrl.internalCreate)
internal.post("/notifications/delete-many", ctrl.internalDeleteMany)
app.use("/internal", internal)

app.use((req, res) => res.status(404).json({ message: "Not found" }))
app.use((err, _req, res, _next) => {
  console.error(err.stack)
  res.status(err.status || 500).json({ message: err.status ? err.message : "Internal server error" })
})

module.exports = app

if (require.main === module) {
  const PORT = process.env.PORT || 8006
  require("./src/db")()
    .then(() => app.listen(PORT, () => console.log(`✅ notification-service on http://localhost:${PORT}`)))
    .catch((e) => { console.error("❌ Could not start:", e.message); process.exit(1) })
}
