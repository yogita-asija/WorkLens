const Program  = require("../models/Program")
const Course   = require("../models/course")
const logAudit = require("../utils/logAudit")

// ── GET /api/admin/programs/stats ─────────────────────────────────────────────
exports.getProgramStats = async (_req, res) => {
  try {
    const [total, active, inactive, ug, pg] = await Promise.all([
      Program.countDocuments(),
      Program.countDocuments({ status: "active" }),
      Program.countDocuments({ status: "inactive" }),
      Program.countDocuments({ level: "UG" }),
      Program.countDocuments({ level: "PG" }),
    ])
    res.json({ success: true, data: { total, active, inactive, ug, pg } })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ── GET /api/admin/programs ───────────────────────────────────────────────────
exports.getPrograms = async (req, res) => {
  try {
    const { search, status, level, department, page = 1, limit = 20 } = req.query

    const filter = {}
    if (status)     filter.status     = status
    if (level)      filter.level      = level
    if (department) filter.department = new RegExp(department, "i")
    if (search) {
      const re = new RegExp(search, "i")
      filter.$or = [{ name: re }, { shortName: re }, { programId: re }, { department: re }]
    }

    const skip  = (Number(page) - 1) * Number(limit)
    const total = await Program.countDocuments(filter)
    const data  = await Program.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean()

    // Attach live course count for each program
    const withCounts = await Promise.all(
      data.map(async p => ({
        ...p,
        courseCount: await Course.countDocuments({ "program": p.programId }),
      }))
    )

    res.json({ success: true, data: withCounts, total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ── GET /api/admin/programs/:id ───────────────────────────────────────────────
exports.getProgramById = async (req, res) => {
  try {
    const program = await Program.findById(req.params.id).lean()
    if (!program) return res.status(404).json({ success: false, message: "Program not found" })

    // Attach linked courses
    const courses = await Course.find({ program: program.programId })
      .select("courseId courseName sem status teacher credits")
      .lean()

    res.json({ success: true, data: { ...program, linkedCourses: courses } })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ── POST /api/admin/programs ──────────────────────────────────────────────────
exports.createProgram = async (req, res) => {
  try {
    const { programId, name, shortName, department, duration, totalSems, level, status, description, intake } = req.body

    if (!programId || !name) {
      return res.status(400).json({ success: false, message: "programId and name are required" })
    }

    const program = await Program.create({
      programId, name,
      shortName:   shortName   || "",
      department:  department  || "",
      duration:    duration    || 4,
      totalSems:   totalSems   || 8,
      level:       level       || "UG",
      status:      status      || "active",
      description: description || "",
      intake:      intake      || 60,
    })

    await logAudit({
      adminId:    req.admin._id,
      adminName:  req.admin.name,
      action:     "CREATE_PROGRAM",
      module:     "program",
      targetId:   String(program._id),
      targetName: name,
      detail:     `Created program ${programId}`,
      ip:         req.ip,
    })

    res.status(201).json({ success: true, message: "Program created", data: program })
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, message: "Program ID already exists" })
    res.status(500).json({ success: false, message: err.message })
  }
}

// ── PUT /api/admin/programs/:id ───────────────────────────────────────────────
exports.updateProgram = async (req, res) => {
  try {
    const allowed = ["name", "shortName", "department", "duration", "totalSems", "level", "status", "description", "intake"]
    const update  = {}
    for (const k of allowed) {
      if (req.body[k] !== undefined) update[k] = req.body[k]
    }

    const program = await Program.findByIdAndUpdate(req.params.id, update, { new: true }).lean()
    if (!program) return res.status(404).json({ success: false, message: "Program not found" })

    await logAudit({
      adminId:    req.admin._id,
      adminName:  req.admin.name,
      action:     "UPDATE_PROGRAM",
      module:     "program",
      targetId:   String(program._id),
      targetName: program.name,
      detail:     "Updated program",
      ip:         req.ip,
    })

    res.json({ success: true, message: "Program updated", data: program })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ── DELETE /api/admin/programs/:id ───────────────────────────────────────────
exports.deleteProgram = async (req, res) => {
  try {
    const program = await Program.findById(req.params.id)
    if (!program) return res.status(404).json({ success: false, message: "Program not found" })

    // Check if courses are linked
    const linked = await Course.countDocuments({ program: program.programId })
    if (linked > 0) {
      return res.status(400).json({ success: false, message: `Cannot delete — ${linked} course(s) linked to this program. Unlink them first.` })
    }

    const { name } = program
    await program.deleteOne()

    await logAudit({
      adminId:    req.admin._id,
      adminName:  req.admin.name,
      action:     "DELETE_PROGRAM",
      module:     "program",
      targetId:   req.params.id,
      targetName: name,
      detail:     "Deleted program",
      ip:         req.ip,
    })

    res.json({ success: true, message: "Program deleted" })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ── PATCH /api/admin/programs/:id/link-course ─────────────────────────────────
exports.linkCourse = async (req, res) => {
  try {
    const { courseId } = req.body
    const program = await Program.findById(req.params.id)
    if (!program) return res.status(404).json({ success: false, message: "Program not found" })

    const course = await Course.findById(courseId)
    if (!course) return res.status(404).json({ success: false, message: "Course not found" })

    // Store programId string on the course for easy lookup
    course.program = program.programId
    await course.save()

    res.json({ success: true, message: `Course "${course.courseName}" linked to ${program.name}` })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ── PATCH /api/admin/programs/:id/unlink-course ───────────────────────────────
exports.unlinkCourse = async (req, res) => {
  try {
    const { courseId } = req.body
    const course = await Course.findById(courseId)
    if (!course) return res.status(404).json({ success: false, message: "Course not found" })

    course.program = ""
    await course.save()

    res.json({ success: true, message: `Course "${course.courseName}" unlinked` })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}