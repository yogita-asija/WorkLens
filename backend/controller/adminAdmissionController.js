const bcrypt    = require("bcryptjs")
const Admission = require("../models/Admission")
const User      = require("../models/User")
const logAudit  = require("../utils/logAudit")

// ─── GET /api/admin/admissions ────────────────────────────────────────────────
exports.getAdmissions = async (req, res) => {
  try {
    const { status, program, batch, admissionType, category, search, page = 1, limit = 20 } = req.query
    const filter = {}
    if (status)        filter.status        = status
    if (program)       filter.program       = program
    if (batch)         filter.batch         = batch
    if (admissionType) filter.admissionType = admissionType
    if (category)      filter.category      = category
    if (search) {
      const re = new RegExp(search, "i")
      filter.$or = [{ applicantName: re }, { email: re }, { phone: re }]
    }
    const skip  = (Number(page) - 1) * Number(limit)
    const total = await Admission.countDocuments(filter)
    const data  = await Admission.find(filter)
      .sort({ appliedAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean()
    res.json({ success: true, data, total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
  } catch (err) { res.status(500).json({ success: false, message: err.message }) }
}

// ─── GET /api/admin/admissions/stats ─────────────────────────────────────────
// Returns stage counts + program breakdown + conversion rate
exports.getAdmissionStats = async (req, res) => {
  try {
    const [stageCounts, programBreakdown, total] = await Promise.all([
      Admission.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Admission.aggregate([
        { $group: { _id: { program: "$program", status: "$status" }, count: { $sum: 1 } } },
        { $group: { _id: "$_id.program", statuses: { $push: { status: "$_id.status", count: "$count" } }, total: { $sum: "$count" } } },
        { $sort: { total: -1 } },
        { $limit: 8 },
      ]),
      Admission.countDocuments(),
    ])

    const stages = { enquiry: 0, applied: 0, under_review: 0, accepted: 0, rejected: 0, enrolled: 0 }
    for (const r of stageCounts) stages[r._id] = r.count

    const enrolled   = stages.enrolled
    const totalApplied = stages.applied + stages.under_review + stages.accepted + stages.rejected + stages.enrolled
    const conversionRate = totalApplied > 0 ? Math.round((enrolled / totalApplied) * 100) : 0

    res.json({ success: true, data: { stages, programBreakdown, total, conversionRate } })
  } catch (err) { res.status(500).json({ success: false, message: err.message }) }
}

// ─── GET /api/admin/admissions/:id ───────────────────────────────────────────
exports.getAdmissionById = async (req, res) => {
  try {
    const admission = await Admission.findById(req.params.id)
      .populate("reviewedBy",        "name email")
      .populate("enrolledStudentId", "name email rollNumber")
      .populate("timeline.addedBy",  "name")
      .lean()
    if (!admission) return res.status(404).json({ success: false, message: "Admission not found" })
    res.json({ success: true, data: admission })
  } catch (err) { res.status(500).json({ success: false, message: err.message }) }
}

// ─── POST /api/admin/admissions ──────────────────────────────────────────────
exports.createAdmission = async (req, res) => {
  try {
    const {
      applicantName, email, phone, program, batch, department,
      dateOfBirth, gender, address,
      tenthPercent, twelfthPercent, entranceScore, entranceExam,
      previousDegree, previousCollege,
      admissionType, category, remarks, status = "applied",
    } = req.body

    if (!applicantName || !email || !program)
      return res.status(400).json({ success: false, message: "applicantName, email and program are required" })

    const dup = await Admission.findOne({ email, program, status: { $nin: ["rejected", "enrolled"] } })
    if (dup) return res.status(409).json({ success: false, message: "An active application already exists for this email and program" })

    // Default document checklist based on admission type
    const defaultDocs = [
      { docType: "tenth_marksheet",    label: "10th Marksheet",     uploaded: false, verified: false },
      { docType: "twelfth_marksheet",  label: "12th Marksheet",     uploaded: false, verified: false },
      { docType: "id_proof",           label: "ID Proof (Aadhar)",  uploaded: false, verified: false },
      { docType: "passport_photo",     label: "Passport Photo",     uploaded: false, verified: false },
    ]
    if (admissionType === "lateral_entry") {
      defaultDocs.push({ docType: "diploma_certificate", label: "Diploma Certificate", uploaded: false, verified: false })
    }

    const admission = await Admission.create({
      applicantName, email, phone, program,
      batch:           batch          || "",
      department:      department     || "",
      dateOfBirth:     dateOfBirth    || undefined,
      gender:          gender         || "",
      address:         address        || "",
      tenthPercent:    tenthPercent   || undefined,
      twelfthPercent:  twelfthPercent || undefined,
      entranceScore:   entranceScore  || undefined,
      entranceExam:    entranceExam   || "",
      previousDegree:  previousDegree || "",
      previousCollege: previousCollege|| "",
      admissionType:   admissionType  || "regular",
      category:        category       || "general",
      remarks:         remarks        || "",
      status,
      documents: defaultDocs,
      timeline: remarks ? [{
        stage: status, note: remarks,
        addedBy: req.admin._id, addedByName: req.admin.name,
      }] : [],
    })

    await logAudit({ adminId: req.admin._id, adminName: req.admin.name, action: "CREATE_ADMISSION",
      module: "admission", targetId: String(admission._id), targetName: admission.applicantName,
      detail: `Created application for ${email} — ${program}`, ip: req.ip })

    res.status(201).json({ success: true, message: "Admission created", data: admission })
  } catch (err) { res.status(500).json({ success: false, message: err.message }) }
}

// ─── PUT /api/admin/admissions/:id ───────────────────────────────────────────
// Edit applicant profile / merit data without changing pipeline status
exports.updateAdmission = async (req, res) => {
  try {
    const allowed = [
      "applicantName","email","phone","dateOfBirth","gender","address",
      "tenthPercent","twelfthPercent","entranceScore","entranceExam",
      "previousDegree","previousCollege","batch","department","admissionType","category","remarks",
    ]
    const update = {}
    for (const k of allowed) { if (req.body[k] !== undefined) update[k] = req.body[k] }

    const admission = await Admission.findByIdAndUpdate(req.params.id, update, { new: true })
    if (!admission) return res.status(404).json({ success: false, message: "Admission not found" })

    res.json({ success: true, message: "Admission updated", data: admission })
  } catch (err) { res.status(500).json({ success: false, message: err.message }) }
}

// ─── PATCH /api/admin/admissions/:id/status ───────────────────────────────────
exports.updateStatus = async (req, res) => {
  try {
    const { status, note } = req.body
    const allowed = ["enquiry", "applied", "under_review", "accepted", "rejected"]
    if (!status || !allowed.includes(status))
      return res.status(400).json({ success: false, message: `status must be one of: ${allowed.join(", ")}` })

    const admission = await Admission.findById(req.params.id)
    if (!admission) return res.status(404).json({ success: false, message: "Admission not found" })
    if (admission.status === "enrolled")
      return res.status(400).json({ success: false, message: "Cannot change status of an enrolled applicant" })

    const prevStatus    = admission.status
    admission.status    = status
    admission.reviewedAt = new Date()
    admission.reviewedBy = req.admin._id

    // Always append a timeline entry for full audit trail (CAMU-style counselling log)
    admission.timeline.push({
      stage:       status,
      note:        note || `Status changed from ${prevStatus} to ${status}`,
      addedBy:     req.admin._id,
      addedByName: req.admin.name,
    })

    await admission.save()

    await logAudit({ adminId: req.admin._id, adminName: req.admin.name, action: "UPDATE_ADMISSION_STATUS",
      module: "admission", targetId: String(admission._id), targetName: admission.applicantName,
      detail: `${prevStatus} → ${status}`, ip: req.ip })

    res.json({ success: true, message: `Application moved to ${status}`, data: admission })
  } catch (err) { res.status(500).json({ success: false, message: err.message }) }
}

// ─── PATCH /api/admin/admissions/:id/document ─────────────────────────────────
// Mark a document as uploaded or verified
exports.updateDocument = async (req, res) => {
  try {
    const { docType, uploaded, verified } = req.body
    const admission = await Admission.findById(req.params.id)
    if (!admission) return res.status(404).json({ success: false, message: "Admission not found" })

    const doc = admission.documents.find(d => d.docType === docType)
    if (!doc) return res.status(404).json({ success: false, message: "Document type not found in checklist" })

    if (uploaded !== undefined) doc.uploaded = uploaded
    if (verified !== undefined) doc.verified = verified
    await admission.save()

    res.json({ success: true, message: "Document status updated", data: admission.documents })
  } catch (err) { res.status(500).json({ success: false, message: err.message }) }
}

// ─── POST /api/admin/admissions/:id/note ──────────────────────────────────────
// Add a counselling / review note to timeline (without changing status)
exports.addTimelineNote = async (req, res) => {
  try {
    const { note } = req.body
    if (!note?.trim()) return res.status(400).json({ success: false, message: "note is required" })

    const admission = await Admission.findById(req.params.id)
    if (!admission) return res.status(404).json({ success: false, message: "Admission not found" })

    admission.timeline.push({
      stage:       admission.status,
      note:        note.trim(),
      addedBy:     req.admin._id,
      addedByName: req.admin.name,
    })
    await admission.save()

    res.json({ success: true, message: "Note added", data: admission.timeline })
  } catch (err) { res.status(500).json({ success: false, message: err.message }) }
}

// ─── PATCH /api/admin/admissions/:id/offer-letter ─────────────────────────────
// Mark offer letter as sent (in a real app this would trigger email)
exports.sendOfferLetter = async (req, res) => {
  try {
    const admission = await Admission.findById(req.params.id)
    if (!admission) return res.status(404).json({ success: false, message: "Admission not found" })
    if (admission.status !== "accepted")
      return res.status(400).json({ success: false, message: "Offer letter can only be sent to accepted applicants" })

    admission.offerLetterSentAt = new Date()
    admission.timeline.push({
      stage: "accepted", note: "Offer letter sent to applicant",
      addedBy: req.admin._id, addedByName: req.admin.name,
    })
    await admission.save()

    await logAudit({ adminId: req.admin._id, adminName: req.admin.name, action: "SEND_OFFER_LETTER",
      module: "admission", targetId: String(admission._id), targetName: admission.applicantName,
      detail: "Offer letter marked as sent", ip: req.ip })

    res.json({ success: true, message: "Offer letter marked as sent", data: admission })
  } catch (err) { res.status(500).json({ success: false, message: err.message }) }
}

// ─── POST /api/admin/admissions/:id/convert ───────────────────────────────────
exports.convertToStudent = async (req, res) => {
  try {
    const admission = await Admission.findById(req.params.id)
    if (!admission) return res.status(404).json({ success: false, message: "Admission not found" })
    if (admission.status !== "accepted")
      return res.status(400).json({ success: false, message: "Application must be 'accepted' before enrolling" })
    if (admission.enrolledStudentId)
      return res.status(409).json({ success: false, message: "This applicant has already been enrolled" })

    const existing = await User.findOne({ email: admission.email })
    if (existing) return res.status(409).json({ success: false, message: `User with email ${admission.email} already exists` })

    const year       = new Date().getFullYear()
    const progCode   = admission.program.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 4)
    const count      = await User.countDocuments({ role: "student" })
    const rollNumber = `${progCode}-${year}-${String(count + 1).padStart(4, "0")}`

    const student = await User.create({
      name:           admission.applicantName,
      email:          admission.email,
      password:       await bcrypt.hash("Welcome@123", 10),
      role:           "student",
      rollNumber,
      program:        admission.program,
      batch:          admission.batch       || "",
      department:     admission.department  || "",
      phone:          admission.phone       || "",
      dateOfBirth:    admission.dateOfBirth || undefined,
      enrollmentDate: new Date(),
      studentStatus:  "active",
    })

    admission.status            = "enrolled"
    admission.enrolledStudentId = student._id
    admission.enrolledAt        = new Date()
    admission.reviewedAt        = new Date()
    admission.reviewedBy        = req.admin._id
    admission.timeline.push({
      stage: "enrolled", note: `Enrolled as student. Roll number: ${rollNumber}`,
      addedBy: req.admin._id, addedByName: req.admin.name,
    })
    await admission.save()

    await logAudit({ adminId: req.admin._id, adminName: req.admin.name, action: "ENROLL_STUDENT",
      module: "admission", targetId: String(student._id), targetName: student.name,
      detail: `Admission ${admission._id} → student ${rollNumber}`, ip: req.ip })

    res.status(201).json({
      success: true,
      message: `Enrolled. Roll number: ${rollNumber}. Default password: Welcome@123`,
      data: { admission, student: { _id: student._id, name: student.name, email: student.email, rollNumber } },
    })
  } catch (err) { res.status(500).json({ success: false, message: err.message }) }
}

// ─── DELETE /api/admin/admissions/:id ────────────────────────────────────────
exports.deleteAdmission = async (req, res) => {
  try {
    const admission = await Admission.findById(req.params.id)
    if (!admission) return res.status(404).json({ success: false, message: "Admission not found" })
    if (!["rejected"].includes(admission.status))
      return res.status(400).json({ success: false, message: "Only rejected applications can be deleted" })
    await admission.deleteOne()
    await logAudit({ adminId: req.admin._id, adminName: req.admin.name, action: "DELETE_ADMISSION",
      module: "admission", targetId: req.params.id, targetName: admission.applicantName,
      detail: "Deleted rejected application", ip: req.ip })
    res.json({ success: true, message: "Application deleted" })
  } catch (err) { res.status(500).json({ success: false, message: err.message }) }
}
// ─── GET /api/admin/documents/stats ──────────────────────────────────────────
exports.getDocumentStats = async (req, res) => {
  try {
    const all = await Admission.find({ "documents.0": { $exists: true } }, "documents status").lean()
    let totalDocs = 0, uploadedDocs = 0, verifiedDocs = 0
    let pendingUpload = 0, pendingVerify = 0, fullyVerified = 0

    for (const a of all) {
      const docs = a.documents || []
      totalDocs    += docs.length
      uploadedDocs += docs.filter(d => d.uploaded).length
      verifiedDocs += docs.filter(d => d.verified).length
      if (docs.every(d => d.verified))         fullyVerified++
      else if (docs.some(d => d.uploaded && !d.verified)) pendingVerify++
      else                                     pendingUpload++
    }

    res.json({ success: true, data: {
      applicantsWithDocs: all.length, totalDocs, uploadedDocs, verifiedDocs,
      pendingUpload, pendingVerify, fullyVerified,
    }})
  } catch (err) { res.status(500).json({ success: false, message: err.message }) }
}

// ─── GET /api/admin/documents ─────────────────────────────────────────────────
// Returns applicants with document checklist + filter by doc status
exports.getDocumentQueue = async (req, res) => {
  try {
    const { status, search, docStatus, program, page = 1, limit = 20 } = req.query
    const filter = { "documents.0": { $exists: true } }
    if (status)  filter.status  = status
    if (program) filter.program = program
    if (search) {
      const re = new RegExp(search, "i")
      filter.$or = [{ applicantName: re }, { email: re }]
    }

    const skip  = (Number(page) - 1) * Number(limit)
    let data    = await Admission.find(filter).sort({ appliedAt: -1 }).skip(skip).lean()
    const total = await Admission.countDocuments(filter)

    // Client-side filter by doc completeness
    if (docStatus === "pending_upload") {
      data = data.filter(a => a.documents.some(d => !d.uploaded))
    } else if (docStatus === "pending_verify") {
      data = data.filter(a => a.documents.some(d => d.uploaded && !d.verified))
    } else if (docStatus === "complete") {
      data = data.filter(a => a.documents.length > 0 && a.documents.every(d => d.verified))
    }

    res.json({ success: true, data, total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
  } catch (err) { res.status(500).json({ success: false, message: err.message }) }
}

// ─── POST /api/admin/admissions/:id/documents ─────────────────────────────────
exports.addDocumentToChecklist = async (req, res) => {
  try {
    const { docType, label } = req.body
    if (!docType || !label)
      return res.status(400).json({ success: false, message: "docType and label are required" })

    const admission = await Admission.findById(req.params.id)
    if (!admission) return res.status(404).json({ success: false, message: "Admission not found" })

    const exists = admission.documents.find(d => d.docType === docType)
    if (exists) return res.status(409).json({ success: false, message: "Document type already in checklist" })

    admission.documents.push({ docType, label, uploaded: false, verified: false })
    await admission.save()

    res.json({ success: true, message: "Document added to checklist", data: admission.documents })
  } catch (err) { res.status(500).json({ success: false, message: err.message }) }
}
