/**
 * Route table: which service owns which URL prefix.
 *
 * PHASE 1: every service URL falls back to MONOLITH_URL, so the whole API still goes to the existing backend.
 * Later phases: when a service is extracted, just set its URL in gateway/.env (for example AUTH_URL=http://localhost:8001)
 * and its prefixes automatically start going there. No code change needed.
 *
 * Order matters: more specific prefixes must come before general ones
 * (/api/hod/leaves must be listed before /api/hod).
 */
const env = process.env

const MONOLITH = env.MONOLITH_URL || "http://localhost:9000"
const urlFor = (name) => env[name] || MONOLITH

const routes = [
  { name: "auth",         target: urlFor("AUTH_URL"),         prefixes: ["/api/auth", "/api/settings"] },
  { name: "leave",        target: urlFor("LEAVE_URL"),        prefixes: ["/api/leaves", "/api/hod/leaves"] },
  { name: "hod",          target: urlFor("HOD_URL"),          prefixes: ["/api/hod", "/api/faculty-profile"] }, // FacultyProfile model lives with HOD course allocation, so it moves with HOD
  { name: "messaging",    target: urlFor("MESSAGING_URL"),    prefixes: ["/api/dept-messages", "/api/messages"] },
  { name: "notification", target: urlFor("NOTIFICATION_URL"), prefixes: ["/api/notifications"] },
  { name: "ai",           target: urlFor("AI_URL"),           prefixes: ["/api/ai"] },
  {
    name: "academic",
    target: urlFor("ACADEMIC_URL"),
    prefixes: [
      "/api/courses", "/api/attendance", "/api/assignments", "/api/syllabus", "/api/timetable",
      "/api/lesson-plans", "/api/study-materials", "/api/online-classes", "/api/dashboard",
      "/api/activity-logs", "/api/duties", "/api/workflow",
    ],
  },
]

// Real-time (Socket.IO) goes to the service that owns messaging.
const socket = { name: "messaging-socket", target: urlFor("MESSAGING_URL"), prefix: "/socket.io" }

// Anything not matched above (for example GET /) goes to the monolith until Phase 5.
const fallback = { name: "monolith", target: MONOLITH }

module.exports = { routes, socket, fallback, MONOLITH }
