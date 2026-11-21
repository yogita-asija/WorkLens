const { GoogleGenerativeAI } = require("@google/generative-ai")

// Where courses live: the monolith now, academic-service after Phase 4 (just change COURSES_URL).
const COURSES_URL = () => (process.env.COURSES_URL || "http://localhost:9000").replace(/\/$/, "")
const MODEL = () => process.env.GEMINI_MODEL || "gemini-2.0-flash-lite"

function safeParseJSON(text) {
  const cleaned = text.trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim()
  return JSON.parse(cleaned)
}

/**
 * The course name is looked up through the courses API using the CALLER'S token, so the same access rules
 * as everywhere else apply (a teacher cannot use another teacher's course). If it cannot be found the plan is
 * still generated from the topics, exactly like before.
 */
async function fetchCourse(courseId, authorization) {
  if (!courseId || typeof courseId !== "string" || courseId.length > 100) return {}
  try {
    const res = await fetch(`${COURSES_URL()}/api/courses/${encodeURIComponent(courseId)}`, {
      headers: { authorization },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return {}
    return await res.json()
  } catch (e) {
    console.warn(`[ai-service] could not load course ${courseId}: ${e.message}`)
    return {}
  }
}

// POST /api/ai/generate-lesson-plan
exports.generateLessonPlan = async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ message: "Set GEMINI_API_KEY in services/ai-service/.env" })
    }

    const { courseId, planType = "standard", durationWeeks, topics, extraInstructions } = req.body || {}

    const course = await fetchCourse(courseId, req.headers.authorization)
    const courseName = course.courseName || ""
    const courseCode = course.courseCode || ""

    const prompt = `
You are an academic curriculum planner.

Course Name: ${courseName}

Topics that MUST be covered:
${topics}

Plan Type: ${planType}

Duration: ${durationWeeks || "Not specified"} weeks.

Additional instructions:
${extraInstructions || "None"}

Use ONLY the topics provided by the teacher.

Group the topics into logical units.

Respond ONLY with valid JSON.

Use EXACTLY this format:

{
  "units": [
    {
      "title": "Unit 1: Example Unit",
      "topics": [
        {
          "title": "Topic Name",
          "description": "Short description"
        }
      ]
    }
  ]
}

Do not include markdown.
Do not include \`\`\`json.
Do not include explanations.
`
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: MODEL() })
    const result = await model.generateContent(prompt)
    const text = result.response.text()

    let parsed
    try { parsed = safeParseJSON(text) }
    catch { return res.status(500).json({ message: "Could not parse AI response" }) }

    if (!parsed.units || !Array.isArray(parsed.units)) {
      return res.status(500).json({ message: "AI returned invalid format" })
    }

    const units = parsed.units.map((u) => ({
      title: u.title,
      topics: (u.topics || []).map((t) => ({
        title: t.title,
        description: t.description || "",
        date: "",
        status: "pending",
      })),
    }))

    return res.json({ units, courseName, courseCode })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: err.message })
  }
}

exports._safeParseJSON = safeParseJSON
