const mongoose = require("mongoose")

module.exports = async function connectDB() {
  const uri = process.env.MONGO_URI
  if (!uri) throw new Error("MONGO_URI is required (the database that holds the `users` collection)")
  await mongoose.connect(uri)
  console.log(`MongoDB connected (${mongoose.connection.name})`)
}
