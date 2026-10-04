/**
 * Seeds the HOD portal with demo data.
 *   node scripts/seedHod.js
 * Login:  hod@gmail.com / 123456   (choose the "HOD" tab)
 * Safe to re-run — it refreshes its own demo data only.
 */
require("dotenv").config({ path: require("path").join(__dirname, "../../.env") })
const bcrypt = require("bcryptjs")
const connectDB = require("../../config/db")
const User = require("../../models/User")
const Course = require("../../models/course")
const Attendance = require("../../models/Attendance")
const Notification = require("../../models/Notification")
const { Leave } = require("../../models/Leave")
const { HodTask, QuestionPaper, Escalation, Substitution, Deadline, FacultyStatus } = require("../../models/HOD/HodModels")

const DEPT = "Computer Science"
const day = (n, h = 0) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, 0, 0, 0); return d }
const utcDay = (n) => { const d = new Date(); return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() + n)) }
const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

async function upsertUser(u) {
  let doc = await User.findOne({ email: u.email })
  if (!doc) doc = await User.create({ ...u, password: await bcrypt.hash("123456", 10) })
  else if (doc.department !== u.department || doc.role !== u.role) { doc.department = u.department; doc.role = u.role; await doc.save() }
  return doc
}

const students = (from, n) => Array.from({ length: n }, (_, i) => ({
  id: `CS2024${String(from + i).padStart(3, "0")}`, name: `Student ${from + i}`,
}))

async function run() {
  await connectDB()
  console.log("🌱 Seeding HOD portal…")

  const hod = await upsertUser({ name: "Dr. Meera Iyer", email: "hod@gmail.com", role: "hod", department: DEPT, phone: "+91-9876543299", bio: "Head of Department, Computer Science." })
  const sarah = await User.findOne({ email: "teaching@gmail.com" })
  if (sarah && sarah.department !== DEPT) { sarah.department = DEPT; await sarah.save() }

  const fac = {}
  for (const [k, name, email] of [
    ["anil",  "Dr. Anil Verma",    "anil@gmail.com"],
    ["neha",  "Prof. Neha Kapoor", "neha@gmail.com"],
    ["rohan", "Dr. Rohan Mehta",   "rohan@gmail.com"],
    ["kavita","Prof. Kavita Rao",  "kavita@gmail.com"],
    ["imran", "Dr. Imran Qureshi", "imran@gmail.com"],
    ["divya", "Prof. Divya Nair",  "divya@gmail.com"],
  ]) fac[k] = await upsertUser({ name, email, role: "teaching", department: DEPT })
  if (sarah) fac.sarah = sarah
  const all = Object.values(fac)
  const allIds = all.map((f) => String(f._id))

  // ── clean previous demo data ──
  await Promise.all([
    Course.deleteMany({ courseId: /^HOD-/ }),
    Leave.deleteMany({ facultyId: { $in: allIds }, reason: /\(demo\)$/ }),
    HodTask.deleteMany({ department: DEPT }), QuestionPaper.deleteMany({ department: DEPT }),
    Escalation.deleteMany({ department: DEPT }), Substitution.deleteMany({ department: DEPT }),
    Deadline.deleteMany({ department: DEPT }), FacultyStatus.deleteMany({ facultyId: { $in: allIds } }),
    Attendance.deleteMany({ courseId: /^HOD-/ }),
  ])

  // ── courses (Mon–Sat so something is always scheduled; one deliberate room clash) ──
  const mk = (id, name, t, days, time, room, s) => ({
    courseId: `HOD-${id}`, courseCode: id, courseName: name, status: "active", sem: "5", credits: 4,
    teacher: { id: t._id, name: t.name }, schedule: { days, time, room }, students: students(s, 45),
  })
  const courses = await Course.insertMany([
    mk("CS501", "Advanced Algorithms",   fac.anil,   "Mon,Tue,Wed,Thu,Fri,Sat", "09:00 AM - 10:00 AM", "LH-101", 1),
    mk("CS502", "Database Systems",      fac.neha,   "Mon,Wed,Fri",             "10:00 AM - 11:00 AM", "LH-101", 20),   // ← clashes with CS503 on Mon (room LH-101)
    mk("CS503", "Operating Systems",     fac.rohan,  "Mon,Thu",                 "10:30 AM - 11:30 AM", "LH-101", 30),
    mk("CS504", "Machine Learning",      fac.kavita, "Tue,Thu,Sat",             "11:00 AM - 12:00 PM", "LH-204", 10),
    mk("CS505", "Computer Networks",     fac.imran,  "Mon,Tue,Wed,Thu,Fri,Sat", "02:00 PM - 03:00 PM", "LH-110", 25),
    mk("CS506", "Software Engineering",  fac.divya,  "Mon,Wed,Fri,Sat",         "03:00 PM - 04:00 PM", "LH-112", 5),
    ...(fac.sarah ? [mk("CS507", "Theory of Computation", fac.sarah, "Tue,Thu", "01:00 PM - 02:00 PM", "LH-208", 15)] : []),
  ])

  // attendance for last 5 days
  for (let i = 1; i <= 5; i++) {
    for (const c of courses) {
      await Attendance.create({
        courseId: c.courseId, courseName: c.courseName, date: key(day(-i)), topic: "Lecture",
        students: c.students.map((s, idx) => ({ id: s.id, name: s.name, status: (idx + i) % 9 === 0 ? "absent" : "present", notes: "" })),
      })
    }
  }

  // ── leaves ──
  const lv = (f, type, a, b, reason, status = "Pending") => ({
    facultyId: String(f._id), facultyName: f.name, type, fromDate: utcDay(a), toDate: utcDay(b),
    duration: b - a + 1, reason: `${reason} (demo)`, status,
  })
  await Leave.insertMany([
    lv(fac.neha,   "Casual", 2, 3, "Family function"),
    lv(fac.kavita, "Sick",   1, 2, "Fever and rest advised"),
    lv(fac.divya,  "Earned", 5, 9, "Out-of-town trip"),
    lv(fac.anil,   "Sick",   0, 2, "Medical procedure", "Approved"),   // on leave today → needs substitutes
    lv(fac.imran,  "Casual", 0, 0, "Personal work", "Approved"),
  ])

  // ── other duty / unavailable today ──
  await FacultyStatus.create([
    { facultyId: String(fac.rohan._id), dateKey: key(new Date()), status: "Other Duty", note: "Invigilation — exam cell" },
  ])

  // ── tasks (4 overdue) ──
  const task = (f, title, due, priority = "Medium") => ({
    title, department: DEPT, assignedToId: String(f._id), assignedToName: f.name,
    assignedById: String(hod._id), dueDate: day(due), priority,
  })
  await HodTask.insertMany([
    task(fac.neha,   "Submit CO-PO attainment sheet", -3, "High"),
    task(fac.rohan,  "Upload lab manual revision",     -2),
    task(fac.kavita, "Update course file",             -5, "High"),
    task(fac.divya,  "Project allocation list",        -1),
    task(fac.anil,   "Syllabus coverage report",        1),
  ])

  // ── question papers ──
  await QuestionPaper.insertMany([
    { department: DEPT, courseName: "Database Systems", courseCode: "CS502", examType: "Internal 1", facultyId: String(fac.neha._id),  facultyName: fac.neha.name,  status: "Submitted", dueDate: day(2), submittedAt: day(-1) },
    { department: DEPT, courseName: "Operating Systems", courseCode: "CS503", examType: "Internal 1", facultyId: String(fac.rohan._id), facultyName: fac.rohan.name, status: "Submitted", dueDate: day(2), submittedAt: day(0) },
    { department: DEPT, courseName: "Machine Learning", courseCode: "CS504", examType: "Internal 1", facultyId: String(fac.kavita._id), facultyName: fac.kavita.name, status: "Pending", dueDate: day(2) },
  ])

  // ── escalations ──
  await Escalation.insertMany([
    { department: DEPT, studentName: "Aarav Singh", studentId: "CS2024004", course: "Database Systems", subject: "Internal marks re-evaluation request", description: "Student believes Q3 of the internal test was marked incorrectly.", priority: "High", assignedToId: String(fac.neha._id) },
  ])

  // ── department deadlines ──
  await Deadline.insertMany([
    { department: DEPT, title: "Question paper submission", type: "question-paper", dueDate: day(2) },
    { department: DEPT, title: "Internal marks entry",      type: "internal-marks", dueDate: day(5) },
    { department: DEPT, title: "NBA documentation",         type: "nba",            dueDate: day(7) },
    { department: DEPT, title: "Department meeting",        type: "meeting",        dueDate: day(0, 16) },
    { department: DEPT, title: "Lab equipment audit report", type: "other",         dueDate: day(-2) },
  ])

  await Notification.create({ userId: hod._id, type: "system", title: "Welcome, HOD", message: "Your department dashboard is ready." })

  console.log("✅ HOD seeded.  Login → hod@gmail.com / 123456  (HOD tab)")
  process.exit(0)
}
run().catch((e) => { console.error(e); process.exit(1) })
