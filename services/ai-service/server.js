/**
 * ai-service: lesson-plan generation with Google Gemini. Port 8007, no database.
 *
 *   POST /api/ai/generate-lesson-plan     needs a valid login token
 *
 * Only this service holds GEMINI_API_KEY.
 */
require("dotenv").config()
const express = require("express")
const { verifyJwt } = require("./src/auth")
const { generateLessonPlan } = require("./src/lessonPlan")

const app = express()
app.disable("x-powered-by")
app.use(express.json({ limit: "1mb" }))

app.get("/health", (_req, res) => res.json({ status: "ok", service: "ai-service", gemini: !!process.env.GEMINI_API_KEY }))
app.post("/api/ai/generate-lesson-plan", verifyJwt, generateLessonPlan)

app.use((req, res) => res.status(404).json({ message: "Not found" }))
app.use((err, _req, res, _next) => {
  console.error(err.stack)
  res.status(err.status || 500).json({ message: err.status ? err.message : "Internal server error" })
})

module.exports = app

if (require.main === module) {
  const PORT = process.env.PORT || 8007
  app.listen(PORT, () => {
    console.log(`✅ ai-service on http://localhost:${PORT}`)
    if (!process.env.GEMINI_API_KEY) console.warn("⚠️  GEMINI_API_KEY is not set: lesson-plan generation will return an error")
  })
}
