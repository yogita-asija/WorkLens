require("dotenv").config({ path: require("path").join(__dirname, "../.env") })
const connectDB  = require("../config/db")
const Admission  = require("../models/Admission")

const DEFAULT_DOCS = [
  { docType: "tenth_marksheet",      label: "10th Marksheet"       },
  { docType: "twelfth_marksheet",    label: "12th Marksheet"       },
  { docType: "id_proof",             label: "ID Proof (Aadhar)"    },
  { docType: "passport_photo",       label: "Passport Photo"       },
  { docType: "transfer_certificate", label: "Transfer Certificate" },
  { docType: "character_certificate",label: "Character Certificate"},
]

function makeDocs(uploaded = 0, verified = 0) {
  return DEFAULT_DOCS.map((d, i) => ({
    ...d,
    uploaded: i < uploaded,
    verified: i < verified,
  }))
}

const ADMISSIONS = [
  {
    applicantName: "Aarav Mehta",      email: "aarav.mehta@gmail.com",
    phone: "+91-9876541001",           program: "B.Tech CSE",   batch: "2025-29",
    dateOfBirth: new Date("2007-04-12"), gender: "male",
    address: "42, Sector 15, Noida, UP - 201301",
    tenthPercent: 93.4, twelfthPercent: 89.2, entranceExam: "JEE Main", entranceScore: 97.4,
    admissionType: "regular", category: "general", status: "enrolled",
    remarks: "Excellent record. Admitted under merit quota.",
    documents: makeDocs(6, 6),
    timeline: [
      { stage: "applied",      note: "Application received online.",       addedByName: "System",      addedAt: new Date("2025-04-01") },
      { stage: "under_review", note: "Documents under review.",            addedByName: "Dr. Admin",   addedAt: new Date("2025-04-10") },
      { stage: "accepted",     note: "Admitted under merit quota.",        addedByName: "Dr. Admin",   addedAt: new Date("2025-05-10") },
      { stage: "enrolled",     note: "Enrollment completed. ID issued.",   addedByName: "Dr. Admin",   addedAt: new Date("2025-06-01") },
    ],
  },
  {
    applicantName: "Priya Sharma",     email: "priya.sharma@gmail.com",
    phone: "+91-9876541002",           program: "BCA",          batch: "2025-28",
    dateOfBirth: new Date("2006-09-23"), gender: "female",
    address: "7, Pali Hill, Bandra West, Mumbai - 400050",
    tenthPercent: 88.7, twelfthPercent: 84.0, entranceExam: "CET", entranceScore: 82,
    admissionType: "regular", category: "general", status: "accepted",
    remarks: "Documents verified. Offer letter sent.",
    documents: makeDocs(6, 5),
    timeline: [
      { stage: "applied",      note: "Application received.",              addedByName: "System",      addedAt: new Date("2025-04-03") },
      { stage: "under_review", note: "Documents submitted for review.",    addedByName: "Dr. Admin",   addedAt: new Date("2025-04-12") },
      { stage: "accepted",     note: "Admitted. Documents verified.",      addedByName: "Dr. Admin",   addedAt: new Date("2025-05-12") },
    ],
  },
  {
    applicantName: "Rohan Verma",      email: "rohan.verma@yahoo.com",
    phone: "+91-9876541004",           program: "M.Tech CSE",   batch: "2025-27",
    dateOfBirth: new Date("2001-01-30"), gender: "male",
    address: "Flat 3B, Green Park Apts, Pune - 411001",
    tenthPercent: 79.2, twelfthPercent: 76.5, entranceExam: "GATE", entranceScore: 612,
    admissionType: "regular", category: "obc", status: "under_review",
    remarks: "GATE score verification in progress.",
    documents: makeDocs(4, 2),
    timeline: [
      { stage: "applied",      note: "Application submitted.",             addedByName: "System",      addedAt: new Date("2025-04-05") },
      { stage: "under_review", note: "GATE score verification pending.",   addedByName: "Dr. Admin",   addedAt: new Date("2025-04-20") },
    ],
  },
  {
    applicantName: "Sneha Patel",      email: "sneha.patel@outlook.com",
    phone: "+91-9876541006",           program: "MBA",           batch: "2025-27",
    dateOfBirth: new Date("2002-07-18"), gender: "female",
    address: "12, Navrangpura, Ahmedabad - 380009",
    tenthPercent: 81.5, twelfthPercent: 79.0, entranceExam: "CAT", entranceScore: 84,
    admissionType: "management_quota", category: "general", status: "applied",
    remarks: "Awaiting entrance test score submission.",
    documents: makeDocs(2, 0),
    timeline: [
      { stage: "applied", note: "Online application form submitted.", addedByName: "System", addedAt: new Date("2025-04-08") },
    ],
  },
  {
    applicantName: "Karan Singh",      email: "karan.singh@gmail.com",
    phone: "+91-9876541008",           program: "B.Tech ECE",   batch: "2025-29",
    dateOfBirth: new Date("2007-11-05"), gender: "male",
    address: "344, Sector 21C, Chandigarh - 160022",
    tenthPercent: 71.3, twelfthPercent: 69.8, entranceExam: "JEE Main", entranceScore: 78,
    admissionType: "regular", category: "sc", status: "enquiry",
    remarks: "Score slightly below cutoff. Counselling scheduled.",
    documents: makeDocs(0, 0),
    timeline: [
      { stage: "enquiry", note: "Enquiry received via website. Counselling scheduled.", addedByName: "System", addedAt: new Date("2025-04-15") },
    ],
  },
  {
    applicantName: "Nisha Joshi",      email: "nisha.joshi@gmail.com",
    phone: "+91-9876541010",           program: "B.Sc IT",       batch: "2025-28",
    dateOfBirth: new Date("2006-03-27"), gender: "female",
    address: "56, Malviya Nagar, Jaipur - 302017",
    tenthPercent: 90.1, twelfthPercent: 87.3, admissionType: "regular", category: "general",
    status: "enrolled", remarks: "Admitted under science excellence scholarship.",
    documents: makeDocs(6, 6),
    timeline: [
      { stage: "applied",  note: "Application submitted.",    addedByName: "System",    addedAt: new Date("2025-03-28") },
      { stage: "accepted", note: "Admitted.",                 addedByName: "Dr. Admin", addedAt: new Date("2025-05-11") },
      { stage: "enrolled", note: "Enrollment complete.",      addedByName: "Dr. Admin", addedAt: new Date("2025-06-02") },
    ],
  },
  {
    applicantName: "Aditya Kumar",     email: "aditya.kumar@gmail.com",
    phone: "+91-9876541012",           program: "B.Tech ME",    batch: "2025-29",
    dateOfBirth: new Date("2007-06-14"), gender: "male",
    address: "88, Boring Road, Patna - 800001",
    tenthPercent: 68.5, twelfthPercent: 65.2, admissionType: "regular", category: "st",
    status: "rejected", remarks: "Does not meet the minimum 70% criterion for B.Tech ME.",
    documents: makeDocs(3, 0),
    timeline: [
      { stage: "applied",  note: "Application received.",                addedByName: "System",    addedAt: new Date("2025-04-09") },
      { stage: "rejected", note: "Below minimum 70% cutoff for B.Tech.", addedByName: "Dr. Admin", addedAt: new Date("2025-05-14") },
    ],
  },
  {
    applicantName: "Divya Nair",       email: "divya.nair@gmail.com",
    phone: "+91-9876541014",           program: "MCA",           batch: "2025-27",
    dateOfBirth: new Date("2002-12-09"), gender: "female",
    address: "TC 22/1334, Pattom, Thiruvananthapuram - 695004",
    tenthPercent: 84.3, twelfthPercent: 80.0, admissionType: "regular", category: "general",
    status: "under_review", remarks: "",
    documents: makeDocs(5, 3),
    timeline: [
      { stage: "applied",      note: "Application submitted.",        addedByName: "System",    addedAt: new Date("2025-04-06") },
      { stage: "under_review", note: "Documents under verification.", addedByName: "Dr. Admin", addedAt: new Date("2025-04-22") },
    ],
  },
  {
    applicantName: "Sahil Gupta",      email: "sahil.gupta@outlook.com",
    phone: "+91-9876541016",           program: "B.Tech CSE",   batch: "2025-29",
    dateOfBirth: new Date("2007-02-20"), gender: "male",
    address: "C-47, Vasant Kunj, New Delhi - 110070",
    tenthPercent: 95.6, twelfthPercent: 93.0, entranceExam: "JEE Advanced", entranceScore: 99.1,
    admissionType: "regular", category: "general", status: "enrolled",
    remarks: "Top merit seat. All documents verified.",
    documents: makeDocs(6, 6),
    timeline: [
      { stage: "applied",  note: "Application submitted.",        addedByName: "System",    addedAt: new Date("2025-03-25") },
      { stage: "accepted", note: "Top merit. All docs verified.", addedByName: "Dr. Admin", addedAt: new Date("2025-05-09") },
      { stage: "enrolled", note: "Enrollment complete.",          addedByName: "Dr. Admin", addedAt: new Date("2025-06-01") },
    ],
  },
  {
    applicantName: "Meera Iyer",       email: "meera.iyer@gmail.com",
    phone: "+91-9876541018",           program: "B.Sc IT",      batch: "2025-28",
    dateOfBirth: new Date("2006-08-03"), gender: "female",
    address: "15, Anna Nagar East, Chennai - 600102",
    tenthPercent: 86.0, twelfthPercent: 83.5, admissionType: "regular", category: "obc",
    status: "applied", remarks: "Character certificate pending.",
    documents: makeDocs(3, 1),
    timeline: [
      { stage: "applied", note: "Online application received. Character certificate pending.", addedByName: "System", addedAt: new Date("2025-04-11") },
    ],
  },
  {
    applicantName: "Farhan Ansari",    email: "farhan.ansari@gmail.com",
    phone: "+91-9876541024",           program: "B.Tech ECE",   batch: "2025-29",
    dateOfBirth: new Date("2007-07-07"), gender: "male",
    address: "22, Civil Lines, Aligarh - 202001",
    tenthPercent: 82.2, twelfthPercent: 78.9, entranceExam: "JEE Main", entranceScore: 86,
    admissionType: "regular", category: "general", status: "under_review",
    remarks: "",
    documents: makeDocs(4, 2),
    timeline: [
      { stage: "applied",      note: "Application submitted.",    addedByName: "System",    addedAt: new Date("2025-04-07") },
      { stage: "under_review", note: "Documents under review.",   addedByName: "Dr. Admin", addedAt: new Date("2025-04-25") },
    ],
  },
  {
    applicantName: "Tanvi Bhatt",      email: "tanvi.bhatt@gmail.com",
    phone: "+91-9876541026",           program: "MCA",           batch: "2025-27",
    dateOfBirth: new Date("2003-03-11"), gender: "female",
    address: "9, Navjivan Society, Paldi, Ahmedabad - 380007",
    tenthPercent: 80.9, twelfthPercent: 77.4, admissionType: "regular", category: "general",
    status: "accepted", remarks: "Admitted. Merit rank 3 in programme.",
    documents: makeDocs(6, 4),
    timeline: [
      { stage: "applied",  note: "Application submitted.",      addedByName: "System",    addedAt: new Date("2025-04-04") },
      { stage: "accepted", note: "Admitted. Merit rank 3.",     addedByName: "Dr. Admin", addedAt: new Date("2025-05-13") },
    ],
  },
]

async function seed() {
  await connectDB()
  console.log("🌱 Seeding admissions with document checklists...")
  let created = 0, skipped = 0

  for (const a of ADMISSIONS) {
    const existing = await Admission.findOne({ email: a.email })
    if (existing) { console.log(`  ↩ Skip ${a.email}`); skipped++; continue }
    await Admission.create(a)
    const prog = a.documents.filter(d=>d.verified).length
    console.log(`  ✅ ${a.applicantName} — ${a.program} [${a.status}] — ${prog}/${a.documents.length} docs verified`)
    created++
  }

  console.log(`\n✅ Done! Created: ${created}, Skipped: ${skipped}`)
  process.exit(0)
}

seed().catch(err => { console.error("❌ Seed failed:", err.message); process.exit(1) })
