require("dotenv").config()
const express   = require("express")
const cors      = require("cors")
const connectDB = require("./config/db")

const app = express()
connectDB()

app.use(cors())
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

app.use("/api/auth",           require("./routes/authRoutes"))
app.use("/api/settings",       require("./routes/settingsRoutes"))
<<<<<<< HEAD
// app.use("/api/analytics",      require("./routes/analyticsRoutes"))
=======
app.use("/api/analytics",      require("./routes/analyticsRoutes"))
>>>>>>> 09f24e068a6d5e720349f39069d3dab7860edc3b
app.use("/api/dashboard",      require("./routes/dashboardRoutes"))
app.use("/api/workflow",       require("./routes/workflowRoutes"))
app.use("/api/leaves",         require("./routes/leaveRoutes"))
app.use("/api/attendance",     require("./routes/attendanceRoutes"))
app.use("/api/activity-logs",  require("./routes/activityLogRoutes"))
app.use("/api/courses",        require("./routes/courseRoutes"))
app.use("/api/assignments",    require("./routes/assignmentRoutes"))
app.use("/api/duties",         require("./routes/extraDutyRoutes"))
app.use("/api/notifications",  require("./routes/notificationRoutes"))
<<<<<<< HEAD
app.use("/api/internal-marks", require("./routes/internalMarkRoutes"))
=======
>>>>>>> 09f24e068a6d5e720349f39069d3dab7860edc3b

app.get("/", (req, res) => res.json({ status: "WorkLens API running ✅" }))

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ message: err.message || "Internal server error" })
})

const PORT = process.env.PORT || 8000
app.listen(PORT, () => console.log(`✅ Server on http://localhost:${PORT}`))
