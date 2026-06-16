const bcrypt = require("bcryptjs")
const User   = require("../models/User")

exports.loginUser = async (req, res) => {
  const { email, password, role } = req.body

  if (!email || !password || !role) {
    return res.status(400).json({ message: "All fields are required" })
  }

  // Map frontend portal labels → DB role values
  const roleMap = {
    "Teaching Staff":     "teaching",
    "Non-Teaching Staff": "non-teaching",
    "Admin":              "admin",
  }

  const dbRole = roleMap[role]

  if (!dbRole) {
    return res.status(400).json({ message: "Invalid portal selection" })
  }

  // Role-specific error messages shown to the client
  const roleErrorMsg = {
    "teaching":     "Invalid faculty credentials.",
    "non-teaching": "Invalid faculty credentials.",
    "admin":        "Invalid admin credentials.",
  }

  try {
    // Look up user by email AND role together — cross-role auth is rejected here
    const user = await User.findOne({ email, role: dbRole })

    if (!user) {
      return res.status(401).json({ message: roleErrorMsg[dbRole] })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(401).json({ message: roleErrorMsg[dbRole] })
    }

    return res.json({
      message: "Login successful",
      user: {
        _id:        user._id,
        name:       user.name,
        email:      user.email,
        role:       user.role,
        department: user.department || "",
        phone:      user.phone || "",
        bio:        user.bio || "",
        memberSince: user.createdAt
          ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })
          : "Jan 2024",
      },
    })
  } catch (err) {
    console.error("Login error:", err.message)
    return res.status(500).json({ message: "An unexpected error occurred. Please try again." })
  }
}