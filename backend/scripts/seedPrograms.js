require("dotenv").config({ path: require("path").join(__dirname, "../.env") })
const mongoose  = require("mongoose")
const connectDB = require("../config/db")
const Program   = require("../models/Program")
const Course    = require("../models/course")

const PROGRAMS = [
  {
    programId:   "BTECH-CSE",
    name:        "Bachelor of Technology in Computer Science",
    shortName:   "B.Tech CSE",
    department:  "Computer Science & Engineering",
    duration:    4,
    totalSems:   8,
    level:       "UG",
    status:      "active",
    description: "Four-year undergraduate program covering algorithms, data structures, OS, networks, AI, and software engineering.",
    intake:      60,
  },
  {
    programId:   "BTECH-ECE",
    name:        "Bachelor of Technology in Electronics & Communication",
    shortName:   "B.Tech ECE",
    department:  "Electronics & Communication",
    duration:    4,
    totalSems:   8,
    level:       "UG",
    status:      "active",
    description: "Covers analog/digital circuits, signal processing, VLSI, embedded systems and communication engineering.",
    intake:      60,
  },
  {
    programId:   "BTECH-ME",
    name:        "Bachelor of Technology in Mechanical Engineering",
    shortName:   "B.Tech ME",
    department:  "Mechanical Engineering",
    duration:    4,
    totalSems:   8,
    level:       "UG",
    status:      "active",
    description: "Focuses on thermodynamics, fluid mechanics, manufacturing processes, CAD/CAM and robotics.",
    intake:      60,
  },
  {
    programId:   "BCA",
    name:        "Bachelor of Computer Applications",
    shortName:   "BCA",
    department:  "Computer Science",
    duration:    3,
    totalSems:   6,
    level:       "UG",
    status:      "active",
    description: "Three-year program in computer applications, programming, database management and web technologies.",
    intake:      60,
  },
  {
    programId:   "MCA",
    name:        "Master of Computer Applications",
    shortName:   "MCA",
    department:  "Computer Science",
    duration:    2,
    totalSems:   4,
    level:       "PG",
    status:      "active",
    description: "Two-year postgraduate program in advanced computing, cloud, AI, and software project management.",
    intake:      30,
  },
  {
    programId:   "MBA",
    name:        "Master of Business Administration",
    shortName:   "MBA",
    department:  "Management Studies",
    duration:    2,
    totalSems:   4,
    level:       "PG",
    status:      "active",
    description: "Covers marketing, finance, HR, operations, strategy and entrepreneurship.",
    intake:      60,
  },
  {
    programId:   "MTECH-CSE",
    name:        "Master of Technology in Computer Science",
    shortName:   "M.Tech CSE",
    department:  "Computer Science & Engineering",
    duration:    2,
    totalSems:   4,
    level:       "PG",
    status:      "active",
    description: "Research-oriented PG program in machine learning, distributed systems and advanced algorithms.",
    intake:      20,
  },
  {
    programId:   "BSC-PHY",
    name:        "Bachelor of Science in Physics",
    shortName:   "B.Sc Physics",
    department:  "Physics",
    duration:    3,
    totalSems:   6,
    level:       "UG",
    status:      "active",
    description: "Classical mechanics, quantum physics, electrodynamics, optics and modern physics.",
    intake:      40,
  },
]

// Courses to link per program (by courseId)
const PROGRAM_COURSE_LINKS = {
  "BTECH-CSE":  ["CS401", "CS402", "CS301"],
  "BTECH-ECE":  ["EC301", "EC401"],
  "MCA":        ["MCA101", "MCA201"],
  "MBA":        ["MBA101"],
}

async function seed() {
  await connectDB()
  console.log("🌱 Seeding programs…")

  let created = 0, skipped = 0

  for (const prog of PROGRAMS) {
    const existing = await Program.findOne({ programId: prog.programId })
    if (existing) {
      console.log(`  ↩ Skipping ${prog.programId} (exists)`)
      skipped++
      continue
    }
    await Program.create(prog)
    console.log(`  ✅ ${prog.shortName} [${prog.level}]`)
    created++
  }

  // Link courses that already exist in DB
  console.log("\n🔗 Linking courses to programs…")
  for (const [programId, courseIds] of Object.entries(PROGRAM_COURSE_LINKS)) {
    for (const cId of courseIds) {
      const course = await Course.findOne({ courseId: cId })
      if (!course) continue
      if (course.program === programId) {
        console.log(`  ↩ ${cId} already linked to ${programId}`)
        continue
      }
      course.program = programId
      await course.save()
      console.log(`  🔗 ${cId} → ${programId}`)
    }
  }

  console.log(`\n✅ Done! Created: ${created}, Skipped: ${skipped}`)
  process.exit(0)
}

seed().catch(err => {
  console.error("❌ Seed failed:", err.message)
  process.exit(1)
})