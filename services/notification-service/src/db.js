const mongoose = require("mongoose")

module.exports = async function connectDB() {
  const uri = process.env.MONGO_URI
  if (!uri) throw new Error("MONGO_URI is required (for example mongodb://127.0.0.1:27017/worklens_notification)")
  await mongoose.connect(uri)
  console.log(`MongoDB connected (${mongoose.connection.name})`)
}
