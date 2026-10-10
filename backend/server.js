require("dotenv").config()
const express   = require("express")
const cors      = require("cors")
const connectDB = require("./config/db")

const app = express()
connectDB()

const allowed = (process.env.CORS_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean)
app.use(cors(allowed.length ? { origin: allowed } : undefined))   // set CORS_ORIGIN=https://your-site.com in production
app.use(express.json({ limit: "50mb" }))
app.use(express.urlencoded({ extended: true, limit: "50mb" }))

app.use("/api/auth",           require("./routes/authRoutes"))
const { authenticate } = require("./middleware/auth")
app.use("/api", authenticate)   // everything below this line now requires a valid login token
app.use("/api/settings",       require("./routes/settingsRoutes"))
// app.use("/api/analytics",      require("./routes/analyticsRoutes"))
app.use("/api/dashboard",      require("./routes/dashboardRoutes"))
app.use("/api/workflow",       require("./routes/workflowRoutes"))
app.use("/api/leaves",         require("./routes/leaveRoutes"))
app.use("/api/attendance",     require("./routes/attendanceRoutes"))
app.use("/api/activity-logs",  require("./routes/activityLogRoutes"))
app.use("/api/courses",        require("./routes/courseRoutes"))
app.use("/api/assignments",    require("./routes/assignmentRoutes"))
app.use("/api/duties",         require("./routes/extraDutyRoutes"))
app.use("/api/notifications",  require("./routes/notificationRoutes"))
app.use("/api/study-materials", require("./routes/studyMaterialRoutes"))
app.use("/api/syllabus",       require("./routes/syllabusRoutes"))
app.use("/api/online-classes", require("./routes/onlineClassRoutes"))
app.use("/api/timetable",     require("./routes/timetableRoutes"))
app.use("/api/messages",       require("./routes/messageRoutes"))
app.use("/api/lesson-plans",  require("./routes/lessonPlanRoutes"))
app.use("/api/ai",            require("./routes/aiRoutes"))
app.use("/api/hod",           require("./routes/HOD/hodRoutes")) 

app.get("/", (req, res) => res.json({ status: "WorkLens API running ✅" }))

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ message: err.message || "Internal server error" })
})

const PORT = process.env.PORT || 8000
app.listen(PORT, () => console.log(`✅ Server on http://localhost:${PORT}`))
