require("dotenv").config({ path: require("path").join(__dirname, "../.env") })
const mongoose = require("mongoose")
const connectDB = require("../config/db")
const Department = require("../models/Department")
const SystemSettings = require("../models/SystemSettings")

const DEPARTMENTS = [
  { name: "Computer Science",       code: "CS",   description: "Department of Computer Science and Engineering" },
  { name: "Electronics & Comm.",    code: "ECE",  description: "Electronics and Communication Engineering" },
  { name: "Mechanical Engineering", code: "ME",   description: "Department of Mechanical Engineering" },
  { name: "Civil Engineering",      code: "CE",   description: "Department of Civil Engineering" },
  { name: "Mathematics",            code: "MATH", description: "Department of Mathematics and Statistics" },
  { name: "Physics",                code: "PHY",  description: "Department of Physics" },
  { name: "Administration",         code: "ADMIN",description: "Administrative and Non-Teaching Staff" },
]

const SETTINGS = [
  { key: "university_name",    value: "WorkLens University",       group: "general" },
  { key: "university_email",   value: "admin@worklens.edu",        group: "general" },
  { key: "university_phone",   value: "+91-9876543200",            group: "general" },
  { key: "university_address", value: "123 University Road, New Delhi, India", group: "general" },
  { key: "academic_year",      value: "2025-2026",                 group: "academic" },
  { key: "current_semester",   value: "Even",                      group: "academic" },
  { key: "max_leave_days",     value: 12,                          group: "academic" },
  { key: "email_notifications",value: true,                        group: "notification" },
  { key: "leave_auto_approve", value: false,                       group: "notification" },
]

async function seed() {
  await connectDB()
  console.log("🌱 Seeding admin data...")

  // Departments
  for (const d of DEPARTMENTS) {
    const ex = await Department.findOne({ code: d.code })
    if (ex) { console.log(`  ↩ Skipping dept ${d.code}`); continue }
    await Department.create(d)
    console.log(`  ✅ Dept: ${d.name}`)
  }

  // System settings
  for (const s of SETTINGS) {
    await SystemSettings.findOneAndUpdate({ key: s.key }, { value: s.value, group: s.group }, { upsert: true })
    console.log(`  ✅ Setting: ${s.key}`)
  }

  console.log("✅ Admin seed complete!")
  process.exit(0)
}

seed().catch(err => { console.error(err); process.exit(1) })
