const bcrypt = require("bcryptjs")
const User   = require("../models/User")

exports.loginUser = async (req, res) => {
  const { email, password, role } = req.body

  if (!email || !password || !role) {
    return res.status(400).json({ message: "All fields are required" })
  }

 const roleMap = {
  "Teaching Staff":     "teaching",
  "Non-Teaching Staff": "non-teaching",
  "HOD":                "hod",   
}
  const dbRole = roleMap[role] || role

  try {
    const user = await User.findOne({ email, role: dbRole })
    if (!user) return res.status(400).json({ message: "Invalid credentials" })

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" })

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
    return res.status(500).json({ message: "Server error" })
  }
}
