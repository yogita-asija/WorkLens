/**
 * One-time, optional: copy existing notifications from the old shared database into this service's database.
 * The old data is only read, never changed. Safe to run twice (documents that already exist are skipped).
 *
 *   OLD_MONGO_URI="mongodb+srv://.../Worklens" npm run migrate      (MONGO_URI in .env is the destination)
 */
require("dotenv").config()
const mongoose = require("mongoose")

;(async () => {
  const from = process.env.OLD_MONGO_URI
  const to = process.env.MONGO_URI
  if (!from || !to) { console.error("Set OLD_MONGO_URI (source) and MONGO_URI (destination)"); process.exit(1) }

  const src = await mongoose.createConnection(from).asPromise()
  const dst = await mongoose.createConnection(to).asPromise()
  if (src.name === dst.name && src.host === dst.host) { console.error("Source and destination are the same database. Stopping."); process.exit(1) }

  const docs = await src.collection("notifications").find({}).toArray()
  console.log(`Found ${docs.length} notifications in ${src.name}`)
  if (docs.length) {
    try { await dst.collection("notifications").insertMany(docs, { ordered: false }) }
    catch (e) { if (e.code !== 11000 && !e.writeErrors) throw e }   // 11000 = already copied
  }
  console.log(`Destination ${dst.name} now has ${await dst.collection("notifications").countDocuments()} notifications`)
  await src.close(); await dst.close()
})().catch((e) => { console.error(e.message); process.exit(1) })
