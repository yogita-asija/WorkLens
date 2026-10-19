import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import {
  MessageSquare, Send, Search, Bell, Clock, CheckCheck, Check, Megaphone, X, Reply,
  Pencil, Trash2, ArrowLeft, Zap, Loader, MailOpen, AlertTriangle, Calendar, FileText, Users, Wifi, WifiOff,
} from "lucide-react"
import useAppStore from "../../store/useAppStore"
import * as api from "../services/deptMessagesApi"

// ─── Design tokens (same as Student Messages) ────────────────────────────────
const T = {
  bg: "#0A0A0A", card: "#141414", card2: "#1c1c1c", border: "#262626",
  accent: "#22C55E", warn: "#F59E0B", danger: "#EF4444", blue: "#3B82F6", purple: "#8B5CF6",
  txt: "#FFFFFF", sub: "#9CA3AF", muted: "#6B7280",
}

const CATEGORIES = [
  { value: "General", color: T.sub }, { value: "Announcement", color: T.blue }, { value: "Reminder", color: T.warn },
  { value: "Meeting", color: T.purple }, { value: "Deadline", color: T.danger }, { value: "Query", color: T.accent },
  { value: "Warning", color: T.danger },
]
const PRIORITIES = ["Normal", "Important", "Urgent"]
const EDIT_WINDOW_MS = 15 * 60 * 1000

const HOD_TEMPLATES = [
  { label: "Call a meeting", icon: Calendar, color: T.purple, category: "Meeting", priority: "Important",
    body: "Dear Faculty,\n\nThere will be a department meeting on [date] at [time] in [venue]. Please be present with your updates.\n\nRegards,\nHOD" },
  { label: "Submission deadline", icon: Clock, color: T.danger, category: "Deadline", priority: "Important",
    body: "Dear Faculty,\n\nA gentle reminder that [question papers / internal marks / documents] are due by [date]. Kindly submit before the deadline.\n\nRegards,\nHOD" },
  { label: "Request a report", icon: FileText, color: T.blue, category: "Reminder", priority: "Normal",
    body: "Dear Faculty,\n\nPlease share your [syllabus progress / course file / activity] report at the earliest.\n\nRegards,\nHOD" },
  { label: "Urgent notice", icon: AlertTriangle, color: T.danger, category: "Warning", priority: "Urgent",
    body: "Dear Faculty,\n\nThis is urgent: [details]. Please acknowledge and act immediately.\n\nRegards,\nHOD" },
]
const FACULTY_TEMPLATES = [
  { label: "Request a meeting", icon: Calendar, color: T.purple, category: "Meeting", priority: "Normal",
    body: "Respected Sir/Madam,\n\nMay I request a few minutes of your time to discuss [topic]? Please let me know a suitable time.\n\nRegards" },
  { label: "Leave / duty query", icon: Clock, color: T.warn, category: "Query", priority: "Normal",
    body: "Respected Sir/Madam,\n\nI have a query regarding [leave / duty allocation / substitution]. Kindly guide me.\n\nRegards" },
  { label: "Submission done", icon: FileText, color: T.accent, category: "General", priority: "Normal",
    body: "Respected Sir/Madam,\n\nI have completed and submitted [item]. Kindly review and let me know if anything more is needed.\n\nRegards" },
  { label: "Urgent help", icon: AlertTriangle, color: T.danger, category: "Query", priority: "Urgent",
    body: "Respected Sir/Madam,\n\nI need your urgent help with [issue]. Kindly contact me at the earliest.\n\nRegards" },
]

// ─── helpers ─────────────────────────────────────────────────────────────────
const cat = (v) => CATEGORIES.find((c) => c.value === v) || CATEGORIES[0]
const priColor = (p) => (p === "Urgent" ? T.danger : p === "Important" ? T.warn : T.accent)
const initials = (n = "") => n.replace(/^(dr|prof|mr|mrs|ms)\.?\s+/i, "").split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() || "").join("") || "?"
const clock = (d) => new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
const dayKey = (d) => new Date(d).toDateString()
function dayLabel(d) {
  const dt = new Date(d), today = new Date(), y = new Date(); y.setDate(today.getDate() - 1)
  if (dt.toDateString() === today.toDateString()) return "Today"
  if (dt.toDateString() === y.toDateString()) return "Yesterday"
  return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}
function listTime(d) {
  if (!d) return ""
  const dt = new Date(d)
  if (dt.toDateString() === new Date().toDateString()) return clock(d)
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
}
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)

/** insert/replace a message in a list (dedupes by _id, and swaps an optimistic bubble for the real one via clientId) */
function upsert(list, msg) {
  const i = list.findIndex((m) => m._id === msg._id || (msg.clientId && m.clientId === msg.clientId))
  if (i >= 0) { const next = list.slice(); next[i] = msg; return next }
  return [...list, msg]
}

function Badge({ label, color }) {
  return <span style={{ background: `${color}22`, color, border: `1px solid ${color}44`, borderRadius: 99, fontSize: 9, fontWeight: 700, padding: "1px 7px", letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</span>
}
function Avatar({ name, size = 38, online }) {
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <div style={{ width: size, height: size, borderRadius: 12, background: `${T.accent}22`, color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: size * 0.36 }}>{initials(name)}</div>
      {online !== undefined && (
        <span style={{ position: "absolute", right: -2, bottom: -2, width: 11, height: 11, borderRadius: "50%", background: online ? T.accent : T.muted, border: `2px solid ${T.card}` }} />
      )}
    </div>
  )
}

// ─── Broadcast modal (HOD) ───────────────────────────────────────────────────
function AnnouncementModal({ open, onClose, faculty, onSend, loading }) {
  const [form, setForm] = useState({ body: "", category: "Announcement", priority: "Normal", mode: "all", ids: [] })
  const [err, setErr] = useState("")
  useEffect(() => { if (open) { setForm({ body: "", category: "Announcement", priority: "Normal", mode: "all", ids: [] }); setErr("") } }, [open])
  if (!open) return null
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const toggle = (id) => setForm((f) => ({ ...f, ids: f.ids.includes(id) ? f.ids.filter((x) => x !== id) : [...f.ids, id] }))
  const submit = () => {
    if (!form.body.trim()) return setErr("Write a message first.")
    if (form.mode === "selected" && !form.ids.length) return setErr("Select at least one faculty member.")
    setErr("")
    onSend({ body: form.body, category: form.category, priority: form.priority, recipients: form.mode === "all" ? "all" : form.ids })
  }
  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${T.blue}22`, display: "flex", alignItems: "center", justifyContent: "center" }}><Megaphone size={16} color={T.blue} /></div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>New announcement</p>
              <p style={{ fontSize: 11, color: T.muted, margin: 0 }}>Shown on every selected faculty member's Announcements board — you can see who has read it</p>
            </div>
          </div>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>
        {err && <p style={{ color: T.danger, fontSize: 12, background: "#7f1d1d44", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>{err}</p>}

        <label style={lbl}>Recipients</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {[["all", `All faculty (${faculty.length})`], ["selected", "Select faculty"]].map(([v, l]) => (
            <button key={v} onClick={() => set("mode", v)} style={{ ...pill, flex: 1, borderColor: form.mode === v ? T.accent : T.border, background: form.mode === v ? `${T.accent}22` : "transparent", color: form.mode === v ? T.accent : T.sub }}>{l}</button>
          ))}
        </div>
        {form.mode === "selected" && (
          <div style={{ maxHeight: 150, overflow: "auto", background: "#0d0d0d", border: `1px solid ${T.border}`, borderRadius: 8, padding: 8, marginBottom: 12 }}>
            {faculty.map((f) => (
              <label key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 6px", fontSize: 12, color: form.ids.includes(f.id) ? T.accent : T.sub, cursor: "pointer" }}>
                <input type="checkbox" checked={form.ids.includes(f.id)} onChange={() => toggle(f.id)} /> {f.name}
              </label>
            ))}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div><label style={lbl}>Category</label>
            <select value={form.category} onChange={(e) => set("category", e.target.value)} style={sel}>{CATEGORIES.map((c) => <option key={c.value}>{c.value}</option>)}</select></div>
          <div><label style={lbl}>Priority</label>
            <select value={form.priority} onChange={(e) => set("priority", e.target.value)} style={sel}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></div>
        </div>
        <label style={lbl}>Message</label>
        <textarea rows={6} maxLength={5000} value={form.body} onChange={(e) => set("body", e.target.value)} placeholder="Write your announcement…" style={{ ...inp, resize: "vertical" }} />

        <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btnGhost} disabled={loading}>Cancel</button>
          <button onClick={submit} style={{ ...btnPrimary, opacity: loading ? 0.7 : 1 }} disabled={loading}>
            {loading ? <Loader size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Megaphone size={13} />} {loading ? "Posting…" : "Post announcement"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Announcements board ─────────────────────────────────────────────────────
function AnnouncementsPanel({ isHod, items, loading, onRead, onDelete, onNew }) {
  const [open, setOpen] = useState(null) // HOD: which card shows its "seen by" list
  if (loading) return <div style={{ ...panel, padding: 20 }}><Spin /></div>
  if (!items.length) {
    return (
      <div style={{ ...panel, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 48, color: T.muted }}>
        <Megaphone size={34} />
        <p style={{ fontSize: 14, color: T.sub, margin: 0 }}>No announcements yet</p>
        <p style={{ fontSize: 12, margin: 0 }}>{isHod ? "Post a notice for all your faculty or a selected few." : "Announcements from your HOD will appear here."}</p>
        {isHod && <button onClick={onNew} style={{ ...btnPrimary, marginTop: 8 }}><Megaphone size={14} /> New announcement</button>}
      </div>
    )
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {items.map((a) => {
        const c = cat(a.category)
        const unread = !isHod && !a.read
        return (
          <div key={a._id} onClick={() => unread && onRead(a._id)} style={{ background: unread ? `${T.accent}08` : T.card, border: `1px solid ${unread ? T.accent + "55" : T.border}`, borderRadius: 14, padding: "16px 18px", cursor: unread ? "pointer" : "default" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: `${c.color}22`, display: "flex", alignItems: "center", justifyContent: "center" }}><Megaphone size={15} color={c.color} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{isHod ? "You" : a.senderName}</p>
                <p style={{ margin: 0, fontSize: 11, color: T.muted }}>{new Date(a.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
              </div>
              {unread && <Badge label="New" color={T.accent} />}
              <Badge label={a.category} color={c.color} />
              {a.priority !== "Normal" && <Badge label={a.priority} color={priColor(a.priority)} />}
            </div>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: T.txt, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{a.body}</p>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              {isHod ? (
                <>
                  <button onClick={(e) => { e.stopPropagation(); setOpen(open === a._id ? null : a._id) }} style={btnSmall(T.blue)}>
                    <CheckCheck size={12} /> Seen by {a.readCount} of {a.recipientCount}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onDelete(a) }} style={btnSmall(T.danger)}><Trash2 size={12} /> Delete</button>
                </>
              ) : unread ? (
                <button onClick={(e) => { e.stopPropagation(); onRead(a._id) }} style={btnSmall(T.accent)}><Check size={12} /> Mark as read</button>
              ) : (
                <span style={{ fontSize: 11, color: T.muted, display: "inline-flex", alignItems: "center", gap: 4 }}><CheckCheck size={13} color={T.blue} /> Read</span>
              )}
            </div>

            {isHod && open === a._id && (
              <div style={{ marginTop: 12, background: "#0d0d0d", border: `1px solid ${T.border}`, borderRadius: 10, padding: 10, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 6 }}>
                {a.recipients.map((r) => (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: r.read ? T.accent : T.muted }}>
                    {r.read ? <CheckCheck size={13} color={T.blue} /> : <Clock size={13} />} {r.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Message bubble ──────────────────────────────────────────────────────────
function Bubble({ m, mine, onReply, onEdit, onDelete, onRetry, onJump }) {
  const c = cat(m.category)
  const canEdit = mine && !m.deleted && !m.status && Date.now() - +new Date(m.createdAt) < EDIT_WINDOW_MS
  return (
    <div id={`msg-${m._id}`} className="dm-bubble-row" style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 8 }}>
      <div style={{ maxWidth: "76%", position: "relative" }}>
        <div style={{
          background: m.deleted ? "transparent" : mine ? "#14532d" : T.card2,
          border: `1px solid ${m.deleted ? T.border : mine ? "#166534" : T.border}`,
          borderRadius: mine ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
          padding: "9px 12px", opacity: m.status === "sending" ? 0.7 : 1,
        }}>
          {m.deleted ? (
            <p style={{ margin: 0, fontSize: 12, fontStyle: "italic", color: T.muted }}>🚫 This message was deleted</p>
          ) : (
            <>
              {(m.category !== "General" || m.priority !== "Normal") && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                  {m.category !== "General" && <Badge label={m.category} color={c.color} />}
                  {m.priority !== "Normal" && <Badge label={m.priority} color={priColor(m.priority)} />}
                </div>
              )}
              {m.replyTo && (
                <div onClick={() => onJump(m.replyTo._id)} style={{ cursor: "pointer", background: "#00000055", borderLeft: `3px solid ${T.accent}`, borderRadius: "0 6px 6px 0", padding: "5px 9px", marginBottom: 6 }}>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: T.accent }}>{m.replyTo.senderName}</p>
                  <p style={{ margin: 0, fontSize: 11, color: T.sub }}>{m.replyTo.deleted ? "🚫 Message deleted" : m.replyTo.body}</p>
                </div>
              )}
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: T.txt, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.body}</p>
            </>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 5, marginTop: 4 }}>
            {m.editedAt && !m.deleted && <span style={{ fontSize: 9, color: T.muted }}>edited</span>}
            <span style={{ fontSize: 10, color: T.muted }}>{clock(m.createdAt)}</span>
            {mine && !m.deleted && (
              m.status === "sending" ? <Clock size={11} color={T.muted} />
                : m.status === "failed" ? <AlertTriangle size={11} color={T.danger} />
                : m.readAt ? <CheckCheck size={13} color={T.blue} />
                : <Check size={13} color={T.muted} />
            )}
          </div>
        </div>

        {m.status === "failed" && (
          <button onClick={() => onRetry(m)} style={{ ...btnSmall(T.danger), marginTop: 4 }}>Failed to send — tap to retry</button>
        )}

        {!m.deleted && !m.status && (
          <div className="dm-actions" style={{ position: "absolute", top: -12, [mine ? "left" : "right"]: -4, display: "none", gap: 4, background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: 3 }}>
            <button title="Reply" onClick={() => onReply(m)} style={miniBtn}><Reply size={12} /></button>
            {canEdit && <button title="Edit" onClick={() => onEdit(m)} style={miniBtn}><Pencil size={12} /></button>}
            {mine && <button title="Delete" onClick={() => onDelete(m)} style={{ ...miniBtn, color: T.danger }}><Trash2 size={12} /></button>}
          </div>
        )}
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
export default function DeptMessages() {
  const user = useAppStore((s) => s.user)
  const myId = user?._id
  const isHod = user?.role === "hod"
  const TEMPLATES = isHod ? HOD_TEMPLATES : FACULTY_TEMPLATES

  const [contacts, setContacts] = useState([])
  const [stats, setStats] = useState({ total: 0, unread: 0, announcements: 0, announcementsUnread: 0, today: 0 })
  const [loadingContacts, setLoadingContacts] = useState(true)
  const [error, setError] = useState("")
  const [activeId, setActiveId] = useState(null)
  const [mobileThread, setMobileThread] = useState(false)
  const [contactSearch, setContactSearch] = useState("")
  const [unreadOnly, setUnreadOnly] = useState(false)

  const [messages, setMessages] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [loadingThread, setLoadingThread] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [threadSearch, setThreadSearch] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)

  const [text, setText] = useState("")
  const [category, setCategory] = useState("General")
  const [priority, setPriority] = useState("Normal")
  const [replyTo, setReplyTo] = useState(null)
  const [editing, setEditing] = useState(null)
  const [tplOpen, setTplOpen] = useState(false)

  const [typingFrom, setTypingFrom] = useState({})
  const [online, setOnline] = useState(new Set())
  const [broadcastOpen, setBroadcastOpen] = useState(false)
  const [view, setView] = useState("chats")          // "chats" | "announcements"
  const [anns, setAnns] = useState([])
  const [annLoading, setAnnLoading] = useState(true)
  const autoOpened = useRef(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [toast, setToast] = useState(null)

  const activeRef = useRef(null); activeRef.current = activeId
  const scrollRef = useRef(null)
  const stickBottom = useRef(true)
  const typingTimers = useRef({})
  const lastTypingSent = useRef(0)
  const idleTimer = useRef(null)
  const textRef = useRef(null)

  const showToast = (msg, color = T.accent) => { setToast({ msg, color }); setTimeout(() => setToast(null), 3000) }
  const active = useMemo(() => contacts.find((c) => c.id === activeId) || null, [contacts, activeId])
  const activeOnline = active ? online.has(active.id) : false

  // ── data loading ──
  const loadContacts = useCallback(async () => {
    try { const d = await api.getContacts(); setContacts(d); setError("") }
    catch (e) { setError(e.message) }
    finally { setLoadingContacts(false) }
  }, [])
  const loadStats = useCallback(() => { api.getStats().then(setStats).catch(() => {}) }, [])
  const loadAnns = useCallback(async () => {
    try { setAnns(await api.getAnnouncements()) } catch (e) { setError(e.message) }
    finally { setAnnLoading(false) }
  }, [])
  useEffect(() => { loadContacts(); loadStats(); loadAnns() }, [loadContacts, loadStats, loadAnns])

  // faculty has exactly one HOD usually -> open it straight away
  useEffect(() => {
    if (!isHod && !autoOpened.current && contacts.length === 1) { autoOpened.current = true; setActiveId(contacts[0].id) }
  }, [contacts, isHod])

  const scrollToBottom = (smooth = false) => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" })
  }

  const markRead = useCallback((id) => {
    api.markThreadRead(id).catch(() => {})
    setContacts((cs) => cs.map((c) => (c.id === id ? { ...c, unread: 0 } : c)))
  }, [])

  const loadThread = useCallback(async (id, search = "") => {
    setLoadingThread(true)
    try {
      const d = await api.getThread(id, { limit: 30, search })
      setMessages(d.messages); setHasMore(d.hasMore)
      stickBottom.current = true
      if (!search) markRead(id)
      setTimeout(() => scrollToBottom(), 30)
    } catch (e) { showToast(e.message, T.danger) }
    finally { setLoadingThread(false) }
  }, [markRead])

  useEffect(() => {
    setMessages([]); setReplyTo(null); setEditing(null); setText(""); setThreadSearch(""); setSearchOpen(false)
    if (activeId) loadThread(activeId)
  }, [activeId, loadThread])

  // debounced in-thread search
  useEffect(() => {
    if (!activeId || !searchOpen) return
    const t = setTimeout(() => loadThread(activeId, threadSearch.trim()), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line
  }, [threadSearch])

  async function loadOlder() {
    if (!messages.length || loadingOlder) return
    setLoadingOlder(true)
    const el = scrollRef.current, prevH = el?.scrollHeight || 0
    try {
      const d = await api.getThread(activeId, { limit: 30, before: messages[0]._id, search: threadSearch.trim() })
      stickBottom.current = false
      setMessages((m) => [...d.messages, ...m]); setHasMore(d.hasMore)
      setTimeout(() => { if (el) el.scrollTop = el.scrollHeight - prevH }, 0)
    } catch (e) { showToast(e.message, T.danger) }
    finally { setLoadingOlder(false) }
  }

  // ── realtime ──
  const { connected, emitTyping } = api.useDeptSocket({
    connect: () => { loadContacts(); loadStats(); loadAnns(); if (activeRef.current) loadThread(activeRef.current) }, // catch up after a reconnect
    "presence:list": ({ ids }) => setOnline(new Set(ids)),
    presence: ({ userId, online: on }) => setOnline((s) => { const n = new Set(s); on ? n.add(userId) : n.delete(userId); return n }),
    typing: ({ from, typing }) => {
      clearTimeout(typingTimers.current[from])
      setTypingFrom((t) => ({ ...t, [from]: typing }))
      if (typing) typingTimers.current[from] = setTimeout(() => setTypingFrom((t) => ({ ...t, [from]: false })), 4000)
    },
    "dm:new": ({ message, conversation }) => {
      const mine = message.sender === myId
      const otherId = mine ? (conversation.hod === myId ? conversation.faculty : conversation.hod) : message.sender
      const viewing = activeRef.current === otherId && document.visibilityState === "visible"
      setContacts((cs) => {
        if (!cs.some((c) => c.id === otherId)) return cs
        return cs.map((c) => c.id !== otherId ? c : {
          ...c, conversationId: conversation._id, lastMessage: conversation.lastMessage, lastMessageAt: conversation.lastMessageAt,
          unread: mine || viewing ? 0 : (c.unread || 0) + 1,
        }).sort((a, b) => (+new Date(b.lastMessageAt || 0)) - (+new Date(a.lastMessageAt || 0)))
      })
      if (activeRef.current === otherId) {
        const el = scrollRef.current
        stickBottom.current = mine || (el ? el.scrollHeight - el.scrollTop - el.clientHeight < 140 : true)
        setMessages((m) => upsert(m, message))
        if (!mine && viewing) markRead(otherId)
      }
      loadStats()
    },
    "ann:new": ({ announcement }) => { setAnns((l) => (l.some((a) => a._id === announcement._id) ? l : [announcement, ...l])); loadStats() },
    "ann:read": ({ announcementId, userId, at }) => setAnns((l) => l.map((a) => {
      if (a._id !== announcementId || !a.recipients) return a
      const rec = a.recipients.map((r) => (r.id === userId && !r.read ? { ...r, read: true, readAt: at } : r))
      return { ...a, recipients: rec, readCount: rec.filter((r) => r.read).length }
    })),
    "ann:deleted": ({ announcementId }) => { setAnns((l) => l.filter((a) => a._id !== announcementId)); loadStats() },
    "dm:read": ({ conversationId, readerId, readAt }) => {
      if (readerId === myId) return
      setMessages((ms) => ms.map((m) => (m.conversation === conversationId && m.sender === myId && !m.readAt ? { ...m, readAt } : m)))
    },
    "dm:updated": ({ message }) => setMessages((ms) => ms.map((m) => (m._id === message._id ? message : m))),
    "dm:deleted": ({ messageId }) => {
      setMessages((ms) => ms.map((m) => (m._id === messageId ? { ...m, deleted: true, body: "", readAt: m.readAt } : m)))
      loadContacts(); loadStats()
    },
  })

  // keep the view pinned to the bottom when new content arrives
  useEffect(() => { if (stickBottom.current) scrollToBottom(true) }, [messages])

  // polling fallback when the socket is down
  useEffect(() => {
    if (connected) return
    const t = setInterval(() => { loadContacts(); loadStats(); loadAnns(); if (activeRef.current && !threadSearch) loadThread(activeRef.current) }, 20000)
    return () => clearInterval(t)
    // eslint-disable-next-line
  }, [connected])

  // ── sending ──
  async function deliver(temp) {
    try {
      const saved = await api.sendMessage(activeRef.current, {
        body: temp.body, category: temp.category, priority: temp.priority, replyTo: temp.replyTo?._id, clientId: temp.clientId,
      })
      setMessages((m) => upsert(m, saved))
    } catch (e) {
      setMessages((m) => m.map((x) => (x.clientId === temp.clientId ? { ...x, status: "failed" } : x)))
      showToast(e.message, T.danger)
    }
  }

  async function handleSend() {
    const body = text.trim()
    if (!body || !activeId) return
    if (editing) {
      try {
        const saved = await api.editMessage(editing._id, body)
        setMessages((m) => m.map((x) => (x._id === saved._id ? saved : x)))
        setEditing(null); setText("")
        loadContacts()
      } catch (e) { showToast(e.message, T.danger) }
      return
    }
    const clientId = uid()
    const temp = {
      _id: `tmp-${clientId}`, clientId, conversation: active?.conversationId, sender: myId, senderName: user.name, body, category, priority,
      replyTo: replyTo ? { _id: replyTo._id, senderName: replyTo.senderName, body: replyTo.body.slice(0, 160), deleted: false } : null,
      createdAt: new Date().toISOString(), status: "sending",
    }
    stickBottom.current = true
    setMessages((m) => [...m, temp])
    setText(""); setReplyTo(null); setCategory("General"); setPriority("Normal")
    emitTyping(activeId, false)
    deliver(temp)
  }

  function retry(m) {
    setMessages((ms) => ms.map((x) => (x.clientId === m.clientId ? { ...x, status: "sending" } : x)))
    deliver(m)
  }

  async function handleDelete(m) {
    if (!window.confirm("Delete this message for everyone?")) return
    try { await api.deleteMessage(m._id); setMessages((ms) => ms.map((x) => (x._id === m._id ? { ...x, deleted: true, body: "" } : x))); showToast("Message deleted.", T.danger) }
    catch (e) { showToast(e.message, T.danger) }
  }

  async function handleAnnounce(payload) {
    setActionLoading(true)
    try {
      const r = await api.createAnnouncement(payload)
      setBroadcastOpen(false); setView("announcements"); showToast(`Announcement posted to ${r.count} faculty`)
      setAnns((l) => (l.some((a) => a._id === r.announcement._id) ? l : [r.announcement, ...l])); loadStats()
    } catch (e) { showToast(e.message, T.danger) }
    finally { setActionLoading(false) }
  }

  async function readAnn(id) {
    setAnns((l) => l.map((a) => (a._id === id ? { ...a, read: true } : a)))
    setStats((st) => ({ ...st, announcementsUnread: Math.max(0, st.announcementsUnread - 1) }))
    api.markAnnouncementRead(id).catch(() => loadAnns())
  }

  async function deleteAnn(a) {
    if (!window.confirm("Delete this announcement for all faculty?")) return
    try { await api.deleteAnnouncement(a._id); setAnns((l) => l.filter((x) => x._id !== a._id)); loadStats(); showToast("Announcement deleted.", T.danger) }
    catch (e) { showToast(e.message, T.danger) }
  }

  async function handleMarkAll() {
    try {
      await api.markAllRead()
      if (!isHod) { await api.markAllAnnouncementsRead(); setAnns((l) => l.map((a) => ({ ...a, read: true }))) }
      setContacts((cs) => cs.map((c) => ({ ...c, unread: 0 }))); loadStats()
    } catch (e) { showToast(e.message, T.danger) }
  }

  function onType(v) {
    setText(v)
    if (!activeId) return
    const now = Date.now()
    if (now - lastTypingSent.current > 2500) { lastTypingSent.current = now; emitTyping(activeId, true) }
    clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => { emitTyping(activeId, false); lastTypingSent.current = 0 }, 3000)
  }

  function jumpTo(id) {
    const el = document.getElementById(`msg-${id}`)
    if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.style.outline = `2px solid ${T.accent}`; setTimeout(() => (el.style.outline = "none"), 1200) }
  }

  const openContact = (id) => { setActiveId(id); setMobileThread(true) }
  const startEdit = (m) => { setEditing(m); setReplyTo(null); setText(m.body); textRef.current?.focus() }
  const useTemplate = (t) => { setText(t.body); setCategory(t.category); setPriority(t.priority); setTplOpen(false); setEditing(null); textRef.current?.focus() }

  const shown = useMemo(() => {
    const q = contactSearch.trim().toLowerCase()
    return contacts.filter((c) => (!q || c.name.toLowerCase().includes(q)) && (!unreadOnly || c.unread > 0))
  }, [contacts, contactSearch, unreadOnly])

  // group thread by day
  const grouped = useMemo(() => {
    const out = []; let last = ""
    for (const m of messages) { const k = dayKey(m.createdAt); if (k !== last) { out.push({ sep: dayLabel(m.createdAt), key: `s-${k}` }); last = k } out.push(m) }
    return out
  }, [messages])

  const title = isHod ? "Faculty Messages" : "HOD Messages"
  const subtitle = isHod ? "Talk to your department faculty — no WhatsApp groups or emails needed" : "Your direct line to your Head of Department"

  return (
    <div style={{ color: T.txt }}>
      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 200, background: toast.color === T.danger ? "#7f1d1d" : "#052e16", border: `1px solid ${toast.color}55`, color: toast.color, borderRadius: 10, padding: "12px 20px", fontSize: 13, fontWeight: 600, boxShadow: "0 4px 24px rgba(0,0,0,.5)", display: "flex", gap: 8, alignItems: "center" }}>
          <Check size={14} />{toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: `${T.accent}22`, display: "flex", alignItems: "center", justifyContent: "center" }}><MessageSquare size={20} color={T.accent} /></div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{title}</h1>
            <p style={{ fontSize: 12, color: T.muted, margin: 0 }}>{subtitle}</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span title={connected ? "Live — messages arrive instantly" : "Reconnecting… (auto-refresh active)"} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: connected ? T.accent : T.warn }}>
            {connected ? <Wifi size={13} /> : <WifiOff size={13} />}{connected ? "Live" : "Offline"}
          </span>
          {(stats.unread + stats.announcementsUnread) > 0 && <button onClick={handleMarkAll} style={btnGhost}><CheckCheck size={13} /> Mark all read</button>}
          {isHod && <button onClick={() => setBroadcastOpen(true)} style={btnPrimary}><Megaphone size={14} /> New announcement</button>}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 20 }}>
        {[
          { label: "Total Messages", value: stats.total, color: T.blue, icon: MessageSquare },
          { label: "Unread Messages", value: stats.unread, color: T.warn, icon: MailOpen },
          { label: isHod ? "Announcements Sent" : "Announcements Received", value: stats.announcements, color: T.accent, icon: Bell },
          { label: "Today's Messages", value: stats.today, color: T.purple, icon: Clock },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px 20px", display: "flex", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontSize: 11, color: T.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
              <p style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, margin: 0 }}>{value}</p>
            </div>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}22`, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={16} color={color} /></div>
          </div>
        ))}
      </div>

      {error && <div style={{ background: "#7f1d1d44", border: `1px solid ${T.danger}55`, borderRadius: 10, padding: "12px 16px", marginBottom: 12, color: T.danger, fontSize: 13 }}>{error}</div>}

      {/* Chats | Announcements */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[["chats", "Chats", MessageSquare, stats.unread], ["announcements", "Announcements", Megaphone, stats.announcementsUnread]].map(([id, label, Icon, n]) => (
          <button key={id} onClick={() => setView(id)} style={{ padding: "8px 18px", borderRadius: 9, cursor: "pointer", fontSize: 13, fontWeight: 600, border: "none", background: view === id ? T.accent : T.card, color: view === id ? "#000" : T.sub, display: "flex", alignItems: "center", gap: 7 }}>
            <Icon size={14} /> {label}
            {n > 0 && <span style={{ background: view === id ? "#000" : T.accent, color: view === id ? T.accent : "#000", borderRadius: 99, fontSize: 10, fontWeight: 700, padding: "1px 7px" }}>{n}</span>}
          </button>
        ))}
      </div>

      {view === "announcements" && (
        <AnnouncementsPanel isHod={isHod} items={anns} loading={annLoading} onRead={readAnn} onDelete={deleteAnn} onNew={() => setBroadcastOpen(true)} />
      )}

      {/* Two-pane chat (personal 1-to-1 messages only) */}
      <div style={{ display: view === "chats" ? undefined : "none" }}>
      <div className={`dm-grid ${mobileThread ? "dm-show-thread" : ""}`} style={{ height: "min(700px, calc(100vh - 330px))", minHeight: 480 }}>

        {/* Contacts */}
        <div className="dm-list" style={{ ...panel, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: 12, borderBottom: `1px solid ${T.border}` }}>
            <div style={{ position: "relative" }}>
              <Search size={14} color={T.muted} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
              <input placeholder={isHod ? "Search faculty…" : "Search…"} value={contactSearch} onChange={(e) => setContactSearch(e.target.value)} style={{ ...inp, paddingLeft: 34 }} />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 11, color: T.sub, cursor: "pointer" }}>
              <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} /> Unread only
            </label>
          </div>
          <div style={{ flex: 1, overflow: "auto" }}>
            {loadingContacts ? <Spin /> : shown.length === 0 ? (
              <p style={{ textAlign: "center", color: T.muted, fontSize: 12, padding: 28 }}>
                {contacts.length === 0 ? (isHod ? "No faculty found in your department." : "No HOD found for your department yet.") : "No matches."}
              </p>
            ) : shown.map((c) => {
              const sel = c.id === activeId
              const typing = typingFrom[c.id]
              return (
                <div key={c.id} onClick={() => openContact(c.id)} style={{ display: "flex", gap: 10, alignItems: "center", padding: "12px 14px", cursor: "pointer", background: sel ? `${T.accent}12` : "transparent", borderLeft: `3px solid ${sel ? T.accent : "transparent"}`, borderBottom: `1px solid ${T.border}` }}>
                  <Avatar name={c.name} online={online.has(c.id)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: c.unread ? 700 : 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</p>
                      <span style={{ fontSize: 10, color: c.unread ? T.accent : T.muted, flexShrink: 0 }}>{listTime(c.lastMessageAt)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 2 }}>
                      <p style={{ margin: 0, fontSize: 12, color: typing ? T.accent : c.unread ? T.txt : T.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {typing ? "typing…" : c.lastMessage ? c.lastMessage.text : "Start a conversation"}
                      </p>
                      {c.unread > 0 && <span style={{ background: T.accent, color: "#000", borderRadius: 99, fontSize: 10, fontWeight: 700, padding: "1px 7px", flexShrink: 0 }}>{c.unread}</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Thread */}
        <div className="dm-thread" style={{ ...panel, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {!active ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: T.muted, gap: 8 }}>
              <Users size={34} /><p style={{ fontSize: 14, color: T.sub, margin: 0 }}>No conversation open</p><p style={{ fontSize: 12, color: T.muted, margin: 0 }}>{isHod ? "Select a faculty member from the list to start chatting" : "Select your HOD from the list to start chatting"}</p>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: `1px solid ${T.border}` }}>
                <button title="Back to chats" onClick={() => { setActiveId(null); setMobileThread(false) }} style={iconBtn}><ArrowLeft size={18} /></button>
                <Avatar name={active.name} online={activeOnline} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{active.name}</p>
                  <p style={{ margin: 0, fontSize: 11, color: typingFrom[active.id] ? T.accent : activeOnline ? T.accent : T.muted }}>
                    {typingFrom[active.id] ? "typing…" : activeOnline ? "Online" : active.role === "hod" ? "Head of Department" : "Faculty"}{!typingFrom[active.id] && active.email ? ` · ${active.email}` : ""}
                  </p>
                </div>
                <button onClick={() => { setSearchOpen((o) => !o); if (searchOpen) { setThreadSearch(""); loadThread(activeId) } }} style={{ ...iconBtn, color: searchOpen ? T.accent : T.muted }}><Search size={16} /></button>
              </div>

              {searchOpen && (
                <div style={{ padding: "8px 16px", borderBottom: `1px solid ${T.border}` }}>
                  <input autoFocus placeholder="Search in this conversation…" value={threadSearch} onChange={(e) => setThreadSearch(e.target.value)} style={inp} />
                </div>
              )}

              <div ref={scrollRef} onScroll={(e) => { const el = e.currentTarget; stickBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140 }} style={{ flex: 1, overflow: "auto", padding: "16px 18px", background: "#0d0d0d" }}>
                {hasMore && (
                  <div style={{ textAlign: "center", marginBottom: 12 }}>
                    <button onClick={loadOlder} disabled={loadingOlder} style={btnGhost}>{loadingOlder ? "Loading…" : "Load older messages"}</button>
                  </div>
                )}
                {loadingThread ? <Spin /> : messages.length === 0 ? (
                  <p style={{ textAlign: "center", color: T.muted, fontSize: 12, padding: "40px 0" }}>{threadSearch ? "No messages match your search." : `No messages yet. Say hello to ${active.name}!`}</p>
                ) : grouped.map((x) => x.sep ? (
                  <div key={x.key} style={{ textAlign: "center", margin: "14px 0" }}>
                    <span style={{ background: T.card2, color: T.muted, fontSize: 10, fontWeight: 600, padding: "3px 12px", borderRadius: 99 }}>{x.sep}</span>
                  </div>
                ) : (
                  <Bubble key={x._id} m={x} mine={x.sender === myId} onReply={(m) => { setReplyTo(m); setEditing(null); textRef.current?.focus() }} onEdit={startEdit} onDelete={handleDelete} onRetry={retry} onJump={jumpTo} />
                ))}
              </div>

              {/* Composer */}
              <div style={{ borderTop: `1px solid ${T.border}`, padding: 12, position: "relative" }}>
                {(replyTo || editing) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#0d0d0d", borderLeft: `3px solid ${editing ? T.warn : T.accent}`, borderRadius: "0 8px 8px 0", padding: "6px 10px", marginBottom: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: editing ? T.warn : T.accent }}>{editing ? "Editing message" : `Replying to ${replyTo.senderName}`}</p>
                      <p style={{ margin: 0, fontSize: 11, color: T.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{(editing || replyTo).body}</p>
                    </div>
                    <button onClick={() => { setReplyTo(null); setEditing(null); setText("") }} style={iconBtn}><X size={14} /></button>
                  </div>
                )}

                {tplOpen && (
                  <div style={{ position: "absolute", bottom: "100%", left: 12, marginBottom: 6, background: T.card2, border: `1px solid ${T.border}`, borderRadius: 12, padding: 8, width: 250, zIndex: 5, boxShadow: "0 8px 30px rgba(0,0,0,.6)" }}>
                    {TEMPLATES.map((t) => { const I = t.icon; return (
                      <button key={t.label} onClick={() => useTemplate(t)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", background: "transparent", border: "none", borderRadius: 8, color: t.color, fontSize: 12, fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
                        <I size={14} />{t.label}
                      </button>) })}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                  <button onClick={() => setTplOpen((o) => !o)} style={{ ...btnGhost, padding: "5px 10px", fontSize: 11 }}><Zap size={11} color={T.warn} /> Templates</button>
                  {!editing && <>
                    <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...sel, width: "auto", padding: "5px 10px", fontSize: 11 }}>{CATEGORIES.map((c) => <option key={c.value}>{c.value}</option>)}</select>
                    <select value={priority} onChange={(e) => setPriority(e.target.value)} style={{ ...sel, width: "auto", padding: "5px 10px", fontSize: 11, color: priColor(priority) }}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select>
                  </>}
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                  <textarea ref={textRef} rows={Math.min(5, Math.max(1, text.split("\n").length))} maxLength={5000} value={text} placeholder="Type a message…  (Enter to send, Shift+Enter for new line)"
                    onChange={(e) => onType(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } if (e.key === "Escape") { setReplyTo(null); setEditing(null) } }}
                    style={{ ...inp, resize: "none", flex: 1 }} />
                  <button onClick={handleSend} disabled={!text.trim()} style={{ ...btnPrimary, padding: "10px 14px", opacity: text.trim() ? 1 : 0.5 }}>{editing ? <Check size={15} /> : <Send size={15} />}</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      </div>

      {isHod && <AnnouncementModal open={broadcastOpen} onClose={() => setBroadcastOpen(false)} faculty={contacts} onSend={handleAnnounce} loading={actionLoading} />}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        .dm-grid { display: grid; grid-template-columns: 320px 1fr; gap: 16px; }
        .dm-bubble-row:hover .dm-actions { display: flex !important; }
        .dm-back { display: none; }
        @media (max-width: 900px) {
          .dm-grid { grid-template-columns: 1fr; }
          .dm-grid .dm-thread { display: none !important; }
          .dm-grid.dm-show-thread .dm-list { display: none !important; }
          .dm-grid.dm-show-thread .dm-thread { display: flex !important; }
          .dm-back { display: inline-flex; }
        }
      `}</style>
    </div>
  )
}

function Spin() {
  return <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}><Loader size={22} color={T.accent} style={{ animation: "spin 1s linear infinite" }} /></div>
}

// ─── shared styles ───────────────────────────────────────────────────────────
const panel = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }
const overlay = { position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.75)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }
const modal = { background: T.card2, border: `1px solid ${T.border}`, borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "92vh", overflow: "auto", padding: 26 }
const lbl = { display: "block", fontSize: 11, color: "#9CA3AF", marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }
const inp = { width: "100%", background: "#0d0d0d", border: "1px solid #333", borderRadius: 8, padding: "9px 12px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }
const sel = { ...inp, appearance: "none", cursor: "pointer" }
const iconBtn = { background: "none", border: "none", cursor: "pointer", color: "#6B7280", display: "inline-flex", alignItems: "center" }
const miniBtn = { background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: "3px 5px", display: "inline-flex" }
const pill = { padding: "8px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600, border: "1px solid #333" }
const btnPrimary = { display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 9, cursor: "pointer", background: "#22C55E", border: "none", color: "#000", fontWeight: 700, fontSize: 13 }
const btnGhost = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, cursor: "pointer", background: "transparent", border: "1px solid #333", color: "#9CA3AF", fontSize: 13 }
const btnSmall = (color) => ({ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 7, cursor: "pointer", background: `${color}18`, border: `1px solid ${color}44`, color, fontSize: 11, fontWeight: 600 })
