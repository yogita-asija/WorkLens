const mongoose = require("mongoose")

// Same fields as the old monolith model. `userId` is just an id now (the User collection belongs to auth-service).
const notificationSchema = new mongoose.Schema({
  userId:  { type: mongoose.Schema.Types.ObjectId, index: true },
  type:    { type: String, enum: ["assignment", "submission", "enrollment", "course", "system", "grade"], default: "system" },
  title:   { type: String, required: true },
  message: { type: String, required: true },
  read:    { type: Boolean, default: false, index: true },
  link:    { type: String, default: "" },
  meta:    { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true })

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 })

module.exports = mongoose.model("Notification", notificationSchema)
