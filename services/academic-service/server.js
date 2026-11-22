/**
 * academic-service: courses, attendance, assignments, syllabus, timetable, lesson plans, study materials, online classes, extra duties, dashboard and activity logs.
 * Port 8002. Uses the same MongoDB database as the backend for now (see README), so no data is copied.
 *
 *   /api/dashboard
 *   /api/workflow
 *   /api/attendance
 *   /api/activity-logs
 *   /api/courses
 *   /api/assignments
 *   /api/duties
 *   /api/study-materials
 *   /api/syllabus
 *   /api/online-classes
 *   /api/timetable
 *   /api/lesson-plans
 */
require("dotenv").config()
const express = require("express")
const { authenticate } = require("./src/middleware/auth")

const app = express()
app.disable("x-powered-by")
app.set("trust proxy", 1)                       // the gateway is one hop in front
app.use(express.json({ limit: "50mb" }))        // same limit as the backend (file uploads arrive as base64)
app.use(express.urlencoded({ extended: true, limit: "50mb" }))

app.get("/health", (_req, res) => res.json({ status: "ok", service: "academic-service" }))

// Everything under /api needs a valid login token, exactly like the backend
app.use("/api", authenticate)

app.use("/api/dashboard", require("./src/routes/dashboardRoutes"))
app.use("/api/workflow", require("./src/routes/workflowRoutes"))
app.use("/api/attendance", require("./src/routes/attendanceRoutes"))
app.use("/api/activity-logs", require("./src/routes/activityLogRoutes"))
app.use("/api/courses", require("./src/routes/courseRoutes"))
app.use("/api/assignments", require("./src/routes/assignmentRoutes"))
app.use("/api/duties", require("./src/routes/extraDutyRoutes"))
app.use("/api/study-materials", require("./src/routes/studyMaterialRoutes"))
app.use("/api/syllabus", require("./src/routes/syllabusRoutes"))
app.use("/api/online-classes", require("./src/routes/onlineClassRoutes"))
app.use("/api/timetable", require("./src/routes/timetableRoutes"))
app.use("/api/lesson-plans", require("./src/routes/lessonPlanRoutes"))

app.use((req, res) => res.status(404).json({ message: "Not found" }))
app.use((err, _req, res, _next) => {
  console.error(err.stack)
  res.status(err.status || 500).json({ message: err.status ? err.message : (err.message || "Internal server error") })
})

module.exports = app

if (require.main === module) {
  const PORT = process.env.PORT || 8002
  require("./src/db")()
    .then(() => app.listen(PORT, () => console.log(`✅ academic-service on http://localhost:${PORT}`)))
    .catch((e) => { console.error("❌ Could not start:", e.message); process.exit(1) })
}
