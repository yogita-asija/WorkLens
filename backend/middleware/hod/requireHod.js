const { authenticate } = require("../auth")

/**
 * HOD-only guard: valid JWT + role "hod". Sets req.user and req.dept (the HOD's department name).
 * (Previously trusted an `x-user-id` header that anyone could forge.)
 */
function requireHod(req, res, next) {
  authenticate(req, res, (err) => {
    if (err) return next(err)
    if (!req.user) return // authenticate already responded
    if (req.user.role !== "hod") return res.status(403).json({ success: false, message: "HOD access only" })
    req.dept = (req.user.department || "").trim()
    next()
  })
}

module.exports = requireHod
