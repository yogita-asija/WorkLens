require("dotenv").config({ path: require("path").join(__dirname, "../.env") })
const mongoose = require("mongoose")
const bcrypt   = require("bcryptjs")
const User     = require("../models/User")

const connectDB = require("../config/db")

const USERS = [
  {
    name: "Dr. Sarah Chen",
    email: "teaching@gmail.com",
    password: "123456",
    role: "teaching",
    department: "Computer Science",
    phone: "+91-9876543210",
    bio: "Associate Professor specializing in Advanced Algorithms and Machine Learning.",
  },
  {
    name: "Mr. Raj Sharma",
    email: "staff@gmail.com",
    password: "123456",
    role: "non-teaching",
    department: "Administration",
    phone: "+91-9876543211",
    bio: "Administrative staff handling faculty records and academic operations.",
  },
]

async function seed() {
  await connectDB()
  console.log("🌱 Seeding users...")

  for (const u of USERS) {
    const existing = await User.findOne({ email: u.email })
    if (existing) {
      console.log(`  ↩ Skipping ${u.email} (already exists)`)
      continue
    }
    const hashed = await bcrypt.hash(u.password, 10)
    await User.create({ ...u, password: hashed })
    console.log(`  ✅ Created: ${u.email} (${u.role})`)
  }

  console.log("✅ Users seeded!")
  process.exit(0)
}

seed().catch(err => { console.error(err); process.exit(1) })
