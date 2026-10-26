/**
 * HOD · Course Allocation endpoints  (all under /api/hod/course-allocation, HOD-only — see hodRoutes.js)
 *
 *   GET    /courses                     courses the HOD can allocate (own department + unclaimed)
 *   POST   /recommendations             { courseId, batchId?, term, startDate, endDate } → ranked faculty
 *   POST   /assign                      confirm one assignment (re-validated on the server)
 *   GET    /history                     allocation history  (?courseId= &facultyId= &status=)
 *   POST   /history/:id/cancel          { reason? }
 *   GET    /settings    PUT /settings   weights, workload limits, policies
 *   GET    /faculty-profiles            read-only view of what faculty entered in Settings
 *   POST   /faculty-profiles/remind     notify faculty whose profile is incomplete
 *   GET    /courses/:id/requirement     PUT /courses/:id/requirement
 *
 * The business logic lives in services/courseAllocationService.js and utils/courseAllocationEngine.js.
 */
const S = require("../services/courseAllocationService")

const wrap = (fn) => async (req, res) => {
  try {
    const data = await fn(req)
    res.json({ success: true, data })
  } catch (err) {
    if (err instanceof S.AllocationError) {
      return res.status(err.status).json({ success: false, message: err.message, ...err.extra })
    }
    console.error("Course allocation error:", err)
    res.status(500).json({ success: false, message: err.message || "Course allocation failed" })
  }
}

exports.listCourses       = wrap((req) => S.listCourses(req.dept))
exports.recommend         = wrap((req) => S.recommend(req.dept, req.body || {}))
exports.assign            = wrap((req) => S.confirmAllocation(req, req.body || {}))
exports.history           = wrap((req) => S.listHistory(req.dept, req.query || {}))
exports.cancel            = wrap((req) => S.cancelAllocation(req, req.params.id, (req.body || {}).reason))
exports.getSettings       = wrap((req) => S.getSettings(req.dept))
exports.saveSettings      = wrap((req) => S.saveSettings(req, req.body || {}))
exports.listProfiles      = wrap((req) => S.listFacultyProfiles(req.dept))
exports.remindProfiles    = wrap((req) => S.remindIncomplete(req))
exports.getRequirement    = wrap((req) => S.getRequirement(req.dept, req.params.id))
exports.saveRequirement   = wrap((req) => S.saveRequirement(req, req.params.id, req.body || {}))
