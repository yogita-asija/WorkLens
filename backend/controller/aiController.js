const Course = require("../models/course");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function safeParseJSON(text) {
  let cleaned = text.trim();
  cleaned = cleaned
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  return JSON.parse(cleaned);
}

exports.generateLessonPlan = async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        message: "Set GEMINI_API_KEY in backend/.env",
      });
    }

const {
  courseId,
  planType = "standard",
  durationWeeks,
  topics,
  extraInstructions,
} = req.body

    let courseName = "";
    let courseCode = "";
    let description = "";

    if (courseId) {
      const course = await Course.findById(courseId).lean();

      if (course) {
        courseName = course.courseName || "";
        courseCode = course.courseCode || "";
        description = course.description || "";
      }
    }

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
`;
    const model = genAI.getGenerativeModel({
     model: "gemini-2.0-flash-lite",
    });

    const result = await model.generateContent(prompt);

    const text = result.response.text();
    console.log("========= GEMINI RESPONSE =========");
console.log(text);
console.log("==================================");

    let parsed;

    try {
      parsed = safeParseJSON(text);
    } catch (err) {
      return res.status(500).json({
        message: "Could not parse AI response",
      });
    }

    if (!parsed.units || !Array.isArray(parsed.units)) {
  return res.status(500).json({
    message: "AI returned invalid format",
  });
}

const units = parsed.units.map((u) => ({
      title: u.title,
      topics: (u.topics || []).map((t) => ({
        title: t.title,
        description: t.description || "",
        date: "",
        status: "pending",
      })),
    }));

    return res.json({
      units,
      courseName,
      courseCode,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: err.message,
    });
  }
};