require("dotenv").config()
const http      = require("http")
const express   = require("express")
const cors      = require("cors")
const connectDB = require("./config/db")
const { initSocket } = require("./shared/utils/socket")

const app = express()
connectDB()

const allowed = (process.env.CORS_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean)
app.use(cors(allowed.length ? { origin: allowed } : undefined))   // set CORS_ORIGIN=https://your-site.com in production
app.use(express.json({ limit: "50mb" }))
app.use(express.urlencoded({ extended: true, limit: "50mb" }))

app.use("/api/auth",           require("./shared/routes/authRoutes"))
const { authenticate } = require("./shared/middleware/auth")
app.use("/api", authenticate)   // everything below this line now requires a valid login token
app.use("/api/settings",       require("./shared/routes/settingsRoutes"))
app.use("/api/faculty-profile", require("./shared/routes/facultyProfileRoutes"))   // faculty's own academic profile (mandatory)
// app.use("/api/analytics",      require("./routes/analyticsRoutes"))
app.use("/api/dashboard",      require("./portals/teaching/routes/dashboardRoutes"))
app.use("/api/workflow",       require("./portals/teaching/routes/workflowRoutes"))
app.use("/api/leaves",         require("./portals/teaching/routes/leaveRoutes"))
app.use("/api/attendance",     require("./portals/teaching/routes/attendanceRoutes"))
app.use("/api/activity-logs",  require("./portals/teaching/routes/activityLogRoutes"))
app.use("/api/courses",        require("./portals/teaching/routes/courseRoutes"))
app.use("/api/assignments",    require("./portals/teaching/routes/assignmentRoutes"))
app.use("/api/duties",         require("./portals/teaching/routes/extraDutyRoutes"))
app.use("/api/notifications",  require("./shared/routes/notificationRoutes"))
app.use("/api/study-materials", require("./portals/teaching/routes/studyMaterialRoutes"))
app.use("/api/syllabus",       require("./portals/teaching/routes/syllabusRoutes"))
app.use("/api/online-classes", require("./portals/teaching/routes/onlineClassRoutes"))
app.use("/api/timetable",     require("./portals/teaching/routes/timetableRoutes"))
app.use("/api/messages",       require("./portals/teaching/routes/messageRoutes"))
app.use("/api/lesson-plans",  require("./portals/teaching/routes/lessonPlanRoutes"))
app.use("/api/ai",            require("./portals/teaching/routes/aiRoutes"))
app.use("/api/hod",           require("./portals/hod/routes/hodRoutes")) 
app.use("/api/dept-messages", require("./shared/routes/deptMessageRoutes"))   // HOD <-> Faculty messaging

app.get("/", (req, res) => res.json({ status: "WorkLens API running ✅" }))

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ message: err.message || "Internal server error" })
})

const PORT = process.env.PORT || 8000
// http.Server (not app.listen) so Socket.IO can share the same port
const server = http.createServer(app)
initSocket(server)
server.listen(PORT, () => console.log(`✅ Server on http://localhost:${PORT} (REST + realtime)`))
