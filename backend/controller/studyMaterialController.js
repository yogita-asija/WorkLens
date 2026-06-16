const StudyMaterial = require("../models/StudyMaterial")
const Course        = require("../models/course")

// GET /api/study-materials?courseId=&type=&search=&teacherId=
exports.getMaterials = async (req, res) => {
  try {
    const { courseId, type, search, teacherId } = req.query
    const filter = {}

    if (courseId && courseId !== "all") filter.courseId = courseId
    if (type && type !== "all") filter.type = type
    if (teacherId) filter["teacher.id"] = teacherId
    if (search) {
      filter.$or = [
        { title:       { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { courseName:  { $regex: search, $options: "i" } },
      ]
    }

    const materials = await StudyMaterial.find(filter)
      .select("-fileData")          // exclude heavy base64 from list
      .sort({ createdAt: -1 })
      .lean()

    res.json({ success: true, data: materials })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// GET /api/study-materials/:id  (include fileData for download)
exports.getMaterialById = async (req, res) => {
  try {
    const material = await StudyMaterial.findById(req.params.id).lean()
    if (!material) return res.status(404).json({ success: false, message: "Not found" })
    // increment download count
    await StudyMaterial.findByIdAndUpdate(req.params.id, { $inc: { downloads: 1 } })
    res.json({ success: true, data: material })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// POST /api/study-materials
exports.createMaterial = async (req, res) => {
  try {
    const {
      title, description, type, courseId,
      fileData, fileName, fileSize, mimeType,
      link, tags, teacherId, teacherName,
    } = req.body

    if (!title || !type || !courseId) {
      return res.status(400).json({ success: false, message: "title, type, courseId are required" })
    }

    // Fetch course info
    const course = await Course.findById(courseId).lean()
    if (!course) return res.status(404).json({ success: false, message: "Course not found" })

    const material = await StudyMaterial.create({
      title, description, type, courseId,
      courseName: course.courseName || course.label || "",
      courseCode: course.courseCode || course.courseId || "",
      fileData: fileData || "",
      fileName: fileName || "",
      fileSize: fileSize || 0,
      mimeType: mimeType || "",
      link: link || "",
      tags: tags || [],
      teacher: { id: teacherId, name: teacherName || "" },
    })

    const { fileData: _, ...safe } = material.toObject()
    res.status(201).json({ success: true, data: safe })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// PUT /api/study-materials/:id
exports.updateMaterial = async (req, res) => {
  try {
    const { title, description, type, link, tags, fileData, fileName, fileSize, mimeType } = req.body
    const update = {}
    if (title !== undefined) update.title = title
    if (description !== undefined) update.description = description
    if (type !== undefined) update.type = type
    if (link !== undefined) update.link = link
    if (tags !== undefined) update.tags = tags
    if (fileData) {
      update.fileData = fileData
      update.fileName = fileName || ""
      update.fileSize = fileSize || 0
      update.mimeType = mimeType || ""
    }

    const material = await StudyMaterial.findByIdAndUpdate(
      req.params.id, update, { new: true }
    ).select("-fileData").lean()

    if (!material) return res.status(404).json({ success: false, message: "Not found" })
    res.json({ success: true, data: material })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// DELETE /api/study-materials/:id
exports.deleteMaterial = async (req, res) => {
  try {
    const material = await StudyMaterial.findByIdAndDelete(req.params.id)
    if (!material) return res.status(404).json({ success: false, message: "Not found" })
    res.json({ success: true, message: "Material deleted" })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// GET /api/study-materials/stats?teacherId=
exports.getMaterialStats = async (req, res) => {
  try {
    const { teacherId } = req.query
    const filter = teacherId ? { "teacher.id": teacherId } : {}

    const [total, byType] = await Promise.all([
      StudyMaterial.countDocuments(filter),
      StudyMaterial.aggregate([
        { $match: filter },
        { $group: { _id: "$type", count: { $sum: 1 } } },
      ]),
    ])

    const typeMap = {}
    byType.forEach(t => { typeMap[t._id] = t.count })

    res.json({ success: true, data: { total, byType: typeMap } })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}
