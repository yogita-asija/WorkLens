require("dotenv").config({ path: require("path").join(__dirname, "../.env") })
const mongoose = require("mongoose")
const Course   = require("../models/course")
const ExtraDuty = require("../models/ExtraDuty");

const students = (prefix, count) =>
  Array.from({ length: count }, (_, i) => {
    const id = `${prefix}${String(i + 1).padStart(3, "0")}`
    const names = ["Alice Johnson","Bob Smith","Carol White","David Brown","Emma Davis",
      "Frank Miller","Grace Wilson","Henry Taylor","Ivy Martinez","Jack Anderson",
      "Karen White","Liam Harris","Maya Patel","Nathan Clark","Olivia Lewis",
      "Peter Scott","Quinn Hall","Rachel Young","Samuel King","Tara Wright",
      "Felix Carter","Gina Moore","Hiro Tanaka","Isla Reed","Julian Torres",
      "Kira Phillips","Logan Perry","Mara Long","Noel Patterson","Ora Hughes"]
    return { id, name: names[i % names.length] }
  })

const data = [
  {
    courseId: "CS401", courseCode: "CS401",
    courseName: "Advanced Algorithms",
    label: "CS401 — Advanced Algorithms",
    sem: "Semester 7", credits: 4, capacity: 60, status: "active",
    schedule: { days: "Mon, Wed", time: "10:00 AM", room: "Room 301" },
    progress: 78, students: students("CS2021", 20),
  },
  {
    courseId: "CS302", courseCode: "CS302",
    courseName: "Operating Systems",
    label: "CS302 — Operating Systems",
    sem: "Semester 5", credits: 3, capacity: 60, status: "active",
    schedule: { days: "Tue, Thu", time: "2:00 PM", room: "Room 205" },
    progress: 65, students: students("CS2020", 20),
  },
  {
    courseId: "CS215", courseCode: "CS215",
    courseName: "Data Structures",
    label: "CS215 — Data Structures",
    sem: "Semester 3", credits: 4, capacity: 60, status: "active",
    schedule: { days: "Mon, Wed, Fri", time: "9:00 AM", room: "Room 102" },
    progress: 85, students: students("CS2022", 20),
  },
  {
    courseId: "CS510", courseCode: "CS510",
    courseName: "Machine Learning",
    label: "CS510 — Machine Learning",
    sem: "Semester 8", credits: 4, capacity: 45, status: "active",
    schedule: { days: "Wed, Fri", time: "11:00 AM", room: "Lab 401" },
    progress: 55, students: students("CS2023", 20),
  },
  {
    courseId: "CS480", courseCode: "CS480",
    courseName: "Computer Networks",
    label: "CS480 — Computer Networks",
    sem: "Semester 6", credits: 3, capacity: 50, status: "active",
    schedule: { days: "Tue, Thu", time: "4:00 PM", room: "Room 310" },
    progress: 72, students: students("CS2019", 20),
  },
]




async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI)
    console.log("✅ Connected to MongoDB")
    await Course.deleteMany({})
await Course.insertMany(data)

console.log("✅ Courses seeded — 5 courses × 20 students")

await ExtraDuty.deleteMany({})

await ExtraDuty.insertMany([
  {
    date: new Date("2026-02-20"),
    type: "Substitution Class",
    course: "CS201 - Programming II",
    reason: "Dr. Rahul on medical leave",
    hours: "2h"
  },
  {
    date: new Date("2026-02-18"),
    type: "Extra Class",
    course: "CS401 - Advanced Algorithms",
    reason: "Makeup class for mid-term preparation",
    hours: "1.5h"
  },
  {
    date: new Date("2026-02-15"),
    type: "Invigilation",
    course: "CS301 - Data Structures",
    reason: "Mid-semester examination",
    hours: "3h"
  }
  // add remaining records here
])

console.log("✅ Extra Duties seeded")
    await mongoose.disconnect()
  } catch (err) {
    console.error("❌ Seed failed:", err.message)
    process.exit(1)
  }
}
seed()
