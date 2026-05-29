require("dotenv").config({ path: require("path").join(__dirname, "../.env") })
const mongoose = require("mongoose")
const connectDB = require("../config/db")
const Notification = require("../models/Notification")
const User = require("../models/User")

async function seed() {
  await connectDB()
  const users = await User.find({})
  if (!users.length) { console.log("No users found. Run seed:users first."); process.exit() }

  await Notification.deleteMany({})
  const sample = [
    { type: "assignment", title: "New Assignment Posted", message: "Advanced Algorithms — Problem Set 4 due in 3 days" },
    { type: "submission", title: "Submission Received", message: "Alice Johnson submitted Problem Set 3" },
    { type: "course",     title: "Course Update",       message: "CS401 schedule changed to Mon/Wed 10AM" },
    { type: "grade",      title: "Grading Reminder",    message: "5 submissions in Data Structures are ungraded" },
    { type: "system",     title: "System Notice",       message: "Semester report generation is available" },
  ]
  for (const u of users) {
    for (const n of sample) {
      await Notification.create({ ...n, userId: u._id, read: false })
    }
  }
  console.log(`✅ Seeded ${sample.length * users.length} notifications`)
  process.exit()
}
seed().catch(e => { console.error(e); process.exit(1) })
