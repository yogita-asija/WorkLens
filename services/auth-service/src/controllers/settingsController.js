const User = require("../models/User")

// GET /api/settings/:userId
exports.getSettings = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select("-password")
    if (!user) return res.status(404).json({ message: "User not found" })

    return res.json({
      fullName:      user.name,
      email:         user.email,
      department:    user.department,
      phone:         user.phone,
      bio:           user.bio,
      notifications: user.notifications,
      role:          user.role,
      memberSince:   user.createdAt
        ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })
        : "Jan 2024",
    })
  } catch (err) {
    return res.status(500).json({ message: err.message })
  }
}

// PUT /api/settings/:userId
exports.updateSettings = async (req, res) => {
  const { fullName, email, department, phone, bio, notifications } = req.body
  try {
    const updated = await User.findByIdAndUpdate(
      req.params.userId,
      { name: fullName, email, department, phone, bio, notifications },
      { new: true, runValidators: true }
    ).select("-password")

    if (!updated) return res.status(404).json({ message: "User not found" })
    return res.json({ message: "Settings saved successfully", user: updated })
  } catch (err) {
    return res.status(500).json({ message: err.message })
  }
}
