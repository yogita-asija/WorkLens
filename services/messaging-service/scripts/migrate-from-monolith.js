/**
 * One-time: copy the existing chat data from the old shared database into messaging-service's own database.
 *
 *   OLD_MONGO_URI="<the backend's MONGO_URI>" npm run migrate        (the destination is MONGO_URI from .env)
 *
 * Copies: deptconversations, deptmessages, deptannouncements (HOD <-> faculty chat) and messages (student messages).
 * User ids are unchanged, so every conversation and message keeps pointing at the right people.
 *
 * Safety
 *  - The old database is only READ, never changed. Rolling back is just removing MESSAGING_URL from gateway/.env.
 *  - RUN THIS BEFORE you switch the gateway to messaging-service (and before anyone chats through it). If the new
 *    service has already created its own conversations, they would clash with the old ones, so the script refuses.
 *  - Re-running is safe: documents that were already copied are skipped, so an interrupted run can simply be repeated.
 *    The script stops (and changes nothing) if the destination holds anything that is NOT a copy of the old data.
 */
require("dotenv").config()
const mongoose = require("mongoose")

const COLLECTIONS = ["deptconversations", "deptmessages", "deptannouncements", "messages"]
const BATCH = 500

const isDup = (e) => e && (e.code === 11000 || (Array.isArray(e.writeErrors) && e.writeErrors.length && e.writeErrors.every((w) => w.code === 11000)))
const fail = (msg) => { console.error(`\n❌ ${msg}\n`); process.exit(1) }

;(async () => {
  const from = process.env.OLD_MONGO_URI
  const to = process.env.MONGO_URI
  if (!from || !to) fail("Set OLD_MONGO_URI (the old database) and MONGO_URI (this service's database, in .env).")

  const src = await mongoose.createConnection(from).asPromise()
  const dst = await mongoose.createConnection(to).asPromise()
  if (src.name === dst.name && src.host === dst.host) {
    fail(`Source and destination are the same database (${src.name}). MONGO_URI must end with a different name, for example /worklens_messaging.`)
  }
  console.log(`From: ${src.name}   To: ${dst.name}\n`)

  // 1. Look before touching anything
  const plan = []
  for (const name of COLLECTIONS) {
    const s = src.collection(name), d = dst.collection(name)
    const srcCount = await s.countDocuments()
    const dstCount = await d.countDocuments()
    if (dstCount) {
      const ids = (await d.find({}, { projection: { _id: 1 } }).toArray()).map((x) => x._id)
      const copied = await s.countDocuments({ _id: { $in: ids } })
      if (copied !== dstCount) {
        fail(`The destination already has ${dstCount - copied} ${name} that are not in the old database, so the new service has been used already.\n` +
             `   Copying now would mix the two histories. If this is a test, drop the ${dst.name} database and run again.`)
      }
    }
    plan.push({ name, s, d, srcCount, dstCount })
  }

  // 2. Copy
  for (const p of plan) {
    let added = 0
    if (p.srcCount) {
      const cursor = p.s.find({}).sort({ _id: 1 })
      let batch = []
      const flush = async () => {
        if (!batch.length) return
        try { const r = await p.d.insertMany(batch, { ordered: false }); added += r.insertedCount }
        catch (e) { if (!isDup(e)) throw e; added += (e.result?.insertedCount ?? e.insertedCount ?? 0) }
        batch = []
      }
      for await (const doc of cursor) { batch.push(doc); if (batch.length >= BATCH) await flush() }
      await flush()
    }
    p.after = await p.d.countDocuments()
    console.log(`${p.name.padEnd(20)} old: ${String(p.srcCount).padStart(6)}   new: ${String(p.after).padStart(6)}   (${p.dstCount} already there before this run)`)
  }

  // 3. Verify
  const bad = plan.filter((p) => p.after !== p.srcCount)
  if (bad.length) {
    console.warn(`\n⚠️  Counts differ for: ${bad.map((p) => p.name).join(", ")}. If people chatted on the old backend while this ran, run it once more.`)
    process.exitCode = 2
  } else {
    console.log("\n✅ Done. Every collection has the same number of documents as before. Now set MESSAGING_URL in gateway/.env and restart the gateway.")
  }
  await src.close(); await dst.close()
})().catch((e) => fail(e.message))
