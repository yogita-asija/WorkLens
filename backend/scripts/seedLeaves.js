require("dotenv").config({ path: require("path").join(__dirname, "../.env") })
const mongoose = require("mongoose")
const { Leave, LeaveBalance, Holiday } = require("../models/Leave")

async function seedLeaves() {
  try {
    await mongoose.connect(process.env.MONGO_URI)
    console.log("Connected to MongoDB")

    // Clear old leave data
    await Promise.all([
      Leave.deleteMany({}),
      LeaveBalance.deleteMany({}),
      Holiday.deleteMany({}),
    ])
    console.log("Cleared old leave data")

    // ── Leave Balance ───────────────────────────────────────────────────────
    await LeaveBalance.create({
      facultyId:   "faculty_001",
      year:        2026,
      totalLeaves: 12,
      taken:       0,   // will be recomputed dynamically from approved leaves
      holidays:    8,
    })
    console.log("Seeded: LeaveBalance")

    // ── Public Holidays 2026 ────────────────────────────────────────────────
    await Holiday.insertMany([
      { name: "New Year's Day",        date: new Date("2026-01-01"), type: "National" },
      { name: "Republic Day",          date: new Date("2026-01-26"), type: "National" },
      { name: "Holi",                  date: new Date("2026-03-03"), type: "National" },
      { name: "Good Friday",           date: new Date("2026-04-03"), type: "National" },
      { name: "Eid ul-Fitr",           date: new Date("2026-03-30"), type: "National" },
      { name: "Independence Day",      date: new Date("2026-08-15"), type: "National" },
      { name: "Gandhi Jayanti",        date: new Date("2026-10-02"), type: "National" },
      { name: "Diwali",                date: new Date("2026-10-29"), type: "National" },
      { name: "Christmas Day",         date: new Date("2026-12-25"), type: "National" },
      { name: "Guru Nanak Jayanti",    date: new Date("2026-11-14"), type: "Regional" },
    ])
    console.log("Seeded: Holidays")

    // ── Sample Leave Applications ───────────────────────────────────────────
    await Leave.insertMany([
      {
        facultyId:   "faculty_001",
        facultyName: "Dr. Naman",
        type:        "Casual",
        fromDate:    new Date("2026-02-15"),
        toDate:      new Date("2026-02-15"),
        duration:    1,
        reason:      "Personal work",
        status:      "Approved",
        appliedAt:   new Date("2026-02-10"),
      },
      {
        facultyId:   "faculty_001",
        facultyName: "Dr. Naman",
        type:        "Sick",
        fromDate:    new Date("2026-01-20"),
        toDate:      new Date("2026-01-21"),
        duration:    2,
        reason:      "Fever and cold",
        status:      "Approved",
        appliedAt:   new Date("2026-01-19"),
      },
      {
        facultyId:   "faculty_001",
        facultyName: "Dr. Naman",
        type:        "Earned",
        fromDate:    new Date("2026-03-10"),
        toDate:      new Date("2026-03-12"),
        duration:    3,
        reason:      "Family vacation",
        status:      "Pending",
        appliedAt:   new Date("2026-02-28"),
      },
    ])
    console.log("Seeded: Leave Applications")

    console.log("\nLeave data seeded successfully!")
    process.exit(0)
  } catch (err) {
    console.error("Seed error:", err.message)
    process.exit(1)
  }
}

seedLeaves()
