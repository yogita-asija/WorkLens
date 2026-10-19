/**
 * End-to-end smoke test for HOD <-> Faculty messaging (REST + realtime).
 *
 *   1. npm install                       (adds socket.io + socket.io-client)
 *   2. npm run seed:all && npm run seed:hod
 *   3. npm start                         (in another terminal)
 *   4. npm run test:dept-messages
 *
 * Uses the seeded accounts  hod@gmail.com / teaching@gmail.com / staff@gmail.com  (password 123456).
 * It leaves a few test messages in the database (harmless).
 */
const { io } = require("socket.io-client")
const BASE = process.env.API_URL || "http://localhost:8000"

let pass = 0, fail = 0
const ok = (cond, name, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "  ✅" : "  ❌"} ${name}${cond ? "" : "  " + extra}`) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function login(email, role) {
  const r = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "123456", role }) })
  const j = await r.json(); if (!r.ok) throw new Error(`login ${email}: ${j.message}`)
  return { ...j.user, token: j.token }
}
const call = (user, method, path, body) =>
  fetch(`${BASE}/api/dept-messages${path}`, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` }, body: body ? JSON.stringify(body) : undefined })
    .then(async (r) => ({ status: r.status, json: await r.json().catch(() => ({})) }))

function connect(user) {
  return new Promise((resolve, reject) => {
    const s = io(BASE, { auth: { token: user.token }, transports: ["websocket"] })
    s.events = []
    for (const e of ["dm:new", "dm:read", "dm:updated", "dm:deleted", "dm:unread", "typing", "ann:new", "ann:read", "ann:deleted"]) s.on(e, (p) => s.events.push({ e, p }))
    s.on("connect", () => resolve(s)); s.on("connect_error", reject)
  })
}
const got = (s, e, pred = () => true) => s.events.find((x) => x.e === e && pred(x.p))

;(async () => {
  const hod = await login("hod@gmail.com", "HOD")
  const fac = await login("teaching@gmail.com", "Teaching Staff")
  const staff = await login("staff@gmail.com", "Non-Teaching Staff")

  console.log("\n— access control")
  ok((await call(staff, "GET", "/contacts")).status === 403, "non-teaching/other-dept user is refused")
  ok((await call({ token: "forged.token.value" }, "GET", "/contacts")).status === 401, "forged token is refused")
  ok((await fetch(`${BASE}/api/dept-messages/contacts`, { headers: { "x-user-id": hod._id } })).status === 401, "old x-user-id header no longer works")
  ok((await call(hod, "POST", `/conversations/${hod._id}/messages`, { body: "hi me" })).status === 400, "cannot message yourself")
  ok((await call(hod, "POST", `/conversations/${staff._id}/messages`, { body: "x" })).status === 403, "HOD cannot message a non-faculty / other-dept user")
  
  console.log("\n— contacts")
  const hc = (await call(hod, "GET", "/contacts")).json.data
  ok(hc.some((c) => c.id === fac._id), "HOD sees the faculty member as a contact")
  const fc = (await call(fac, "GET", "/contacts")).json.data
  ok(fc.length >= 1 && fc.every((c) => c.role === "hod"), "faculty sees only the HOD")

  const sHod = await connect(hod), sFac = await connect(fac)
  await sleep(300)
  ok(!!got(sFac, "dm:unread"), "socket handshake works + initial unread pushed")

  console.log("\n— send + realtime")
  const before = (await call(fac, "GET", "/unread-count")).json.data.total
  const cid = "smoke-" + Date.now()
  const s1 = await call(hod, "POST", `/conversations/${fac._id}/messages`, { body: "Meeting at 4pm", category: "Meeting", priority: "Important", clientId: cid })
  ok(s1.status === 201 && s1.json.data.category === "Meeting", "HOD sends a message", JSON.stringify(s1.json))
  await sleep(300)
  ok(!!got(sFac, "dm:new", (p) => p.message.body === "Meeting at 4pm"), "faculty receives it in real time")
  ok(!!got(sHod, "dm:new", (p) => p.message.body === "Meeting at 4pm"), "sender's other tabs get it too")
  const after = (await call(fac, "GET", "/unread-count")).json.data.total
  ok(after === before + 1, "faculty unread count +1", `${before} -> ${after}`)
  const dup = await call(hod, "POST", `/conversations/${fac._id}/messages`, { body: "Meeting at 4pm", clientId: cid })
  ok(dup.status === 200 && dup.json.duplicate && dup.json.data._id === s1.json.data._id, "retry with same clientId does not duplicate")
  ok((await call(hod, "POST", `/conversations/${fac._id}/messages`, { body: "   " })).status === 400, "empty message rejected")
  ok((await call(hod, "POST", `/conversations/${fac._id}/messages`, { body: "x".repeat(5001) })).status === 400, "oversize message rejected")

  console.log("\n— typing + read receipts")
  sFac.emit("typing", { to: hod._id, typing: true }); await sleep(250)
  ok(!!got(sHod, "typing", (p) => p.from === fac._id && p.typing), "typing indicator reaches the HOD")
  const rd = await call(fac, "PATCH", `/conversations/${hod._id}/read`)
  await sleep(300)
  ok(rd.status === 200 && rd.json.data.marked >= 1, "faculty marks thread read")
  ok(!!got(sHod, "dm:read", (p) => p.readerId === fac._id), "HOD gets read receipt in real time")
  ok((await call(fac, "GET", "/unread-count")).json.data.total === before, "faculty unread back to previous value")

  console.log("\n— reply, edit, delete")
  const reply = await call(fac, "POST", `/conversations/${hod._id}/messages`, { body: "Will be there", replyTo: s1.json.data._id })
  ok(reply.status === 201 && reply.json.data.replyTo?.body === "Meeting at 4pm", "reply carries a quote of the original")
  ok((await call(fac, "PATCH", `/messages/${s1.json.data._id}`, { body: "hack" })).status === 404, "cannot edit someone else's message")
  const ed = await call(hod, "PATCH", `/messages/${s1.json.data._id}`, { body: "Meeting at 5pm" })
  ok(ed.status === 200 && ed.json.data.editedAt, "sender edits own message")
  await sleep(250)
  ok(!!got(sFac, "dm:updated", (p) => p.message.body === "Meeting at 5pm"), "edit pushed live")
  ok((await call(fac, "DELETE", `/messages/${s1.json.data._id}`)).status === 404, "cannot delete someone else's message")
  const del = await call(hod, "DELETE", `/messages/${s1.json.data._id}`)
  ok(del.status === 200 && del.json.data.deleted === 1, "sender deletes own message")
  const th = (await call(hod, "GET", `/conversations/${fac._id}/messages`)).json.data
  const tomb = th.messages.find((m) => m._id === s1.json.data._id)
  ok(tomb && tomb.deleted && tomb.body === "", "deleted text never leaks")

  console.log("\n— pagination + search")
  for (let i = 0; i < 5; i++) await call(hod, "POST", `/conversations/${fac._id}/messages`, { body: `page-test ${i}` })
  const p1 = (await call(hod, "GET", `/conversations/${fac._id}/messages?limit=3`)).json.data
  ok(p1.messages.length === 3 && p1.hasMore, "page 1 (limit 3) has more")
  const p2 = (await call(hod, "GET", `/conversations/${fac._id}/messages?limit=3&before=${p1.messages[0]._id}`)).json.data
  ok(p2.messages.length >= 1 && p2.messages.every((m) => m._id < p1.messages[0]._id), "cursor pages backwards without overlap")
  const se = (await call(hod, "GET", `/conversations/${fac._id}/messages?search=${encodeURIComponent("page-test (")}`)).json
  ok(se.success === true, "regex characters in search cannot break the query")
  const se2 = (await call(hod, "GET", `/conversations/${fac._id}/messages?search=page-test`)).json.data
  ok(se2.messages.length >= 5, "search finds messages")

  console.log("\n— announcements (separate from chats) + stats")
  const sfBefore = (await call(fac, "GET", "/stats")).json.data
  const b = await call(hod, "POST", "/announcements", { body: "Submit marks by Friday", category: "Deadline", priority: "Urgent", recipients: "all" })
  ok(b.status === 201 && b.json.data.count >= 1, "HOD posts an announcement to all faculty", JSON.stringify(b.json))
  await sleep(300)
  ok(!!got(sFac, "ann:new", (p) => p.announcement.body === "Submit marks by Friday"), "announcement arrives live for faculty")
  const th2 = (await call(fac, "GET", `/conversations/${hod._id}/messages?limit=50`)).json.data
  ok(!th2.messages.some((m) => m.body === "Submit marks by Friday"), "announcement does NOT appear inside the personal chat")
  const fl = (await call(fac, "GET", "/announcements")).json.data
  const mine = fl.find((a) => a.body === "Submit marks by Friday")
  ok(mine && mine.read === false, "faculty sees it in Announcements, unread")
  const fst = (await call(fac, "GET", "/stats")).json.data
  ok(fst.announcementsUnread === sfBefore.announcementsUnread + 1 && fst.total === sfBefore.total, "stats: announcement counted separately from chat messages", JSON.stringify(fst))
  ok((await call(fac, "GET", "/unread-count")).json.data.total >= 1, "sidebar badge includes unread announcements")
  ok((await call(fac, "PATCH", `/announcements/${mine._id}/read`)).status === 200, "faculty marks announcement read")
  await sleep(300)
  ok(!!got(sHod, "ann:read", (p) => p.userId === fac._id), "HOD sees the 'seen' update live")
  const hl = (await call(hod, "GET", "/announcements")).json.data.find((a) => a._id === mine._id)
  ok(hl && hl.readCount >= 1 && hl.recipients.some((r) => r.id === fac._id && r.read), "HOD tracker shows who has seen it", JSON.stringify(hl))
  ok((await call(fac, "POST", "/announcements", { body: "x" })).status === 403, "faculty cannot post announcements")
  ok((await call(fac, "DELETE", `/announcements/${mine._id}`)).status === 404, "faculty cannot delete an announcement")
  const rt = await call(hod, "DELETE", `/announcements/${mine._id}`)
  ok(rt.status === 200, "HOD retracts the announcement")
  ok(!(await call(fac, "GET", "/announcements")).json.data.some((a) => a._id === mine._id), "retracted announcement disappears for faculty")
  ok((await call(fac, "PATCH", "/read-all")).status === 200, "mark-all-read works")

  sHod.close(); sFac.close()
  console.log(`\n${fail ? "❌" : "✅"} ${pass} passed, ${fail} failed\n`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error("Test crashed:", e.message); process.exit(1) })
