const { FacultyProfile } = require("../../portals/hod/models/CourseAllocation")
const { missingFields, validateProfileInput } = require("../utils/facultyProfile")

const shape = (p) => ({
  qualifications: (p && p.qualifications) || [],
  specializations: (p && p.specializations) || [],
  researchAreas: (p && p.researchAreas) || [],
  academicExperienceYears: p && typeof p.academicExperienceYears === "number" ? p.academicExperienceYears : null,
  practicalExperience: (p && p.practicalExperience) || [],
  noPracticalExperience: !!(p && p.noPracticalExperience),
  teachingHistory: (p && p.teachingHistory) || [],
  noPriorTeaching: !!(p && p.noPriorTeaching),
})

const status = (p) => { const missing = missingFields(p); return { complete: missing.length === 0, missing } }

// GET /api/faculty-profile/me
exports.getMine = async (req, res) => {
  try {
    const p = await FacultyProfile.findOne({ facultyId: String(req.user._id) }).lean()
    res.json({ success: true, data: { profile: shape(p), ...status(p), updatedAt: p ? p.updatedAt : null } })
  } catch (err) { res.status(500).json({ success: false, message: err.message }) }
}

// PUT /api/faculty-profile/me
exports.saveMine = async (req, res) => {
  try {
    const { errors, value } = validateProfileInput(req.body)
    if (errors.length) return res.status(400).json({ success: false, message: errors.join(". ") })
    const id = String(req.user._id)
    const p = await FacultyProfile.findOneAndUpdate(
      { facultyId: id },
      { $set: { ...value, department: (req.user.department || "").trim(), updatedById: id }, $setOnInsert: { facultyId: id } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean()
    res.json({ success: true, data: { profile: shape(p), ...status(p), updatedAt: p.updatedAt } })
  } catch (err) { res.status(500).json({ success: false, message: err.message }) }
}
