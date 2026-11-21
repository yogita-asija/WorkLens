/**
 * messaging-service: HOD <-> faculty chat, announcements, student messages and the real-time (Socket.IO) layer.
 * Port 8005, own database worklens_messaging.
 *
 *   REST  /api/dept-messages/*   HOD <-> faculty chat and announcements
 *         /api/messages/*        faculty "student messages"
 *   WS    /socket.io             typing, presence, live delivery (REST and sockets share this one process,
 *                                which is why they had to move together)
 */
require("dotenv").config()
const http = require("http")
const express = require("express")
const { initSocket } = require("./src/utils/socket")

const app = express()
app.disable("x-powered-by")
app.set("trust proxy", 1)                       // the gateway is one hop in front
app.use(express.json({ limit: "5mb" }))

app.get("/health", (_req, res) => res.json({ status: "ok", service: "messaging-service" }))

app.use("/api/dept-messages", require("./src/routes/deptMessageRoutes"))
app.use("/api/messages", require("./src/routes/messageRoutes"))

app.use((req, res) => res.status(404).json({ message: "Not found" }))
app.use((err, _req, res, _next) => {
  console.error(err.stack)
  res.status(err.status || 500).json({ message: err.status ? err.message : "Internal server error" })
})

// http.Server (not app.listen) so Socket.IO shares the port
const server = http.createServer(app)
initSocket(server)

module.exports = server

if (require.main === module) {
  const PORT = process.env.PORT || 8005
  require("./src/db")()
    .then(() => server.listen(PORT, () => console.log(`✅ messaging-service on http://localhost:${PORT} (REST + realtime)`)))
    .catch((e) => { console.error("❌ Could not start:", e.message); process.exit(1) })
}
