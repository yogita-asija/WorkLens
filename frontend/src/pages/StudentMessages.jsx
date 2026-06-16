import { useState, useEffect, useMemo, useCallback } from "react"
import {
  MessageSquare, Send, Inbox, Plus, X, Search, Filter,
  Bell, AlertTriangle, Info, Bookmark, User, ChevronDown,
  ChevronUp, Reply, Eye, Clock, CheckCheck, Zap, BookOpen,
  Calendar, FileText, Package, Trash2, RefreshCw, Check,
  MailOpen, Loader,
} from "lucide-react"
import useAppStore from "../store/useAppStore"

// ─── API base ────────────────────────────────────────────────────────────────
const BASE = `${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/messages`
const COURSES_BASE = `${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/courses`

// ─── Design tokens (matches existing project) ────────────────────────────────
const T = {
  bg:     "#0A0A0A",
  card:   "#141414",
  card2:  "#1c1c1c",
  border: "#262626",
  accent: "#22C55E",
  warn:   "#F59E0B",
  danger: "#EF4444",
  blue:   "#3B82F6",
  purple: "#8B5CF6",
  txt:    "#FFFFFF",
  sub:    "#9CA3AF",
  muted:  "#6B7280",
}

// ─── Category config ─────────────────────────────────────────────────────────
const CATEGORIES = [
  { value: "Announcement",     color: T.blue,   icon: Bell },
  { value: "Reminder",         color: T.warn,   icon: Clock },
  { value: "Warning",          color: T.danger, icon: AlertTriangle },
  { value: "Information",      color: T.purple, icon: Info },
  { value: "Personal Message", color: T.accent, icon: User },
]

// ─── Quick templates (pre-fills compose form) ────────────────────────────────
const TEMPLATES = [
  {
    label: "Attendance Warning",
    icon: AlertTriangle, color: T.danger,
    subject:  "Attendance Warning Notice",
    message:  "Dear Students,\n\nYour attendance has fallen below the required 75% threshold. Students with attendance below 75% may not be permitted to appear in examinations.\n\nPlease ensure regular attendance henceforth.\n\nRegards,\nFaculty",
    category: "Warning",   priority: "Urgent",
  },
  {
    label: "Assignment Reminder",
    icon: FileText, color: T.warn,
    subject:  "Assignment Submission Reminder",
    message:  "Dear Students,\n\nThis is a reminder that your assignment is due soon. Please ensure you submit your work before the deadline. Late submissions will not be accepted without prior approval.\n\nRegards,\nFaculty",
    category: "Reminder",  priority: "Important",
  },
  {
    label: "Exam Notification",
    icon: BookOpen, color: T.blue,
    subject:  "Upcoming Examination Notice",
    message:  "Dear Students,\n\nAn examination is scheduled in the coming days. Kindly prepare accordingly and bring all required materials. Syllabus and instructions will be shared shortly.\n\nRegards,\nFaculty",
    category: "Announcement", priority: "Important",
  },
  {
    label: "Class Rescheduled",
    icon: Calendar, color: T.purple,
    subject:  "Class Schedule Change",
    message:  "Dear Students,\n\nAn upcoming class has been rescheduled. The revised schedule will be communicated shortly. Please check your timetable for updates.\n\nApologies for any inconvenience.\n\nRegards,\nFaculty",
    category: "Information", priority: "Normal",
  },
  {
    label: "Study Material Available",
    icon: Package, color: T.accent,
    subject:  "Study Materials Uploaded",
    message:  "Dear Students,\n\nNew study materials have been uploaded to the portal. Kindly download and review them at your earliest convenience. Feel free to reach out if you have any questions.\n\nRegards,\nFaculty",
    category: "Information", priority: "Normal",
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtTime(dateStr) {
  const date = new Date(dateStr)
  const diff = Date.now() - date
  if (diff < 60 * 60 * 1000)       return `${Math.floor(diff / 60000)}m ago`
  if (diff < 24 * 60 * 60 * 1000)  return `${Math.floor(diff / 3600000)}h ago`
  if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / 86400000)}d ago`
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
}

function priorityStyle(p) {
  if (p === "Urgent")    return { bg: "#7f1d1d", color: T.danger }
  if (p === "Important") return { bg: "#451a03", color: T.warn }
  return                        { bg: "#052e16", color: T.accent }
}

function catConfig(cat) {
  return CATEGORIES.find(c => c.value === cat) || CATEGORIES[3]
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ label, color, bg }) {
  return (
    <span style={{
      background: bg || `${color}22`, color,
      border: `1px solid ${color}44`,
      borderRadius: 99, fontSize: 10, fontWeight: 600,
      padding: "2px 8px", letterSpacing: "0.04em", textTransform: "uppercase",
    }}>{label}</span>
  )
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
      <Loader size={24} color={T.accent} style={{ animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ─── COMPOSE MODAL ────────────────────────────────────────────────────────────
function ComposeModal({ open, onClose, onSend, prefill, loading }) {
  const empty = {
    recipient: "Entire Course", course: "", semester: "",
    batches: [], recipients: [],
    subject: "", message: "", priority: "Normal", category: "Announcement",
  }
  const [form, setForm]   = useState(empty)
  const [err, setErr]     = useState("")

  // Course list (from Course feature)
  const [courses, setCourses]       = useState([])
  const [coursesLoading, setCoursesLoading] = useState(false)

  // Batches for selected course
  const [batchOptions, setBatchOptions] = useState([])

  // Students for selected course (for "Specific Student")
  const [studentOptions, setStudentOptions] = useState([])
  const [studentsLoading, setStudentsLoading] = useState(false)

  useEffect(() => {
    if (open) { setForm(prefill ? { ...empty, ...prefill } : empty); setErr("") }
    // eslint-disable-next-line
  }, [open, prefill])

  // Load all active courses when modal opens
  useEffect(() => {
    if (!open) return
    setCoursesLoading(true)
    fetch(`${COURSES_BASE}?status=active`)
      .then(res => res.json())
      .then(data => setCourses(Array.isArray(data) ? data : []))
      .catch(() => setCourses([]))
      .finally(() => setCoursesLoading(false))
  }, [open])

  // When course changes, load its batches + students
  useEffect(() => {
    if (!form.course) { setBatchOptions([]); setStudentOptions([]); return }
    const selected = courses.find(c => c.courseId === form.course)
    setBatchOptions(selected?.batches || [])

    setStudentsLoading(true)
    fetch(`${COURSES_BASE}/${selected?._id || form.course}/enrolled-students`)
      .then(res => res.json())
      .then(data => setStudentOptions(data?.students || []))
      .catch(() => setStudentOptions([]))
      .finally(() => setStudentsLoading(false))
    // eslint-disable-next-line
  }, [form.course])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function setCourse(courseId) {
    setForm(f => ({ ...f, course: courseId, batches: [], recipients: [] }))
  }

  function toggleBatch(batchName) {
    setForm(f => ({
      ...f,
      batches: f.batches.includes(batchName)
        ? f.batches.filter(b => b !== batchName)
        : [...f.batches, batchName],
    }))
  }

  function toggleStudent(student) {
    setForm(f => {
      const exists = f.recipients.some(r => r.id === student.id)
      return {
        ...f,
        recipients: exists
          ? f.recipients.filter(r => r.id !== student.id)
          : [...f.recipients, { id: student.id, name: student.name }],
      }
    })
  }

  function handleSend() {
    if (!form.subject.trim() || !form.message.trim()) {
      setErr("Subject and Message are required."); return
    }
    if (!form.course) {
      setErr("Please select a course."); return
    }
    if (form.recipient === "Specific Batches" && form.batches.length === 0) {
      setErr("Please select at least one batch."); return
    }
    if (form.recipient === "Specific Student" && form.recipients.length === 0) {
      setErr("Please select at least one student."); return
    }
    setErr("")
    onSend({
      ...form,
      batch: form.batches.join(", "), // legacy field for back-compat
    })
  }

  if (!open) return null
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: T.card2, border: `1px solid ${T.border}`,
        borderRadius: 16, width: "100%", maxWidth: 620,
        maxHeight: "92vh", overflow: "auto", padding: 28, position: "relative",
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${T.accent}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Send size={16} color={T.accent} />
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: T.txt, margin: 0 }}>New Message</p>
              <p style={{ fontSize: 11, color: T.muted, margin: 0 }}>Send message to students</p>
            </div>
          </div>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>

        {err && <p style={{ color: T.danger, fontSize: 12, marginBottom: 12, background: "#7f1d1d44", borderRadius: 8, padding: "8px 12px" }}>{err}</p>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

          {/* Course */}
          <div>
            <label style={lbl}>Course</label>
            <select value={form.course} onChange={e => setCourse(e.target.value)} style={sel} disabled={coursesLoading}>
              <option value="">{coursesLoading ? "Loading…" : "Select course"}</option>
              {courses.map(c => (
                <option key={c.courseId} value={c.courseId}>{c.label || c.courseName}</option>
              ))}
            </select>
          </div>

          {/* Semester */}
          <div>
            <label style={lbl}>Semester</label>
            <input placeholder="e.g. 5th" value={form.semester}
              onChange={e => set("semester", e.target.value)} style={inp} />
          </div>

          {/* Recipients */}
          <div style={{ gridColumn: "span 2" }}>
            <label style={lbl}>Recipients</label>
            <select value={form.recipient} onChange={e => set("recipient", e.target.value)} style={sel}>
              <option value="Entire Course">Entire Course — send to all students of course</option>
              <option value="Specific Batches">Specific Batches — send to selected batches</option>
              <option value="Specific Student">Specific Student — send to selected students</option>
            </select>
          </div>

          {/* Batch selection (when Specific Batches) */}
          {form.recipient === "Specific Batches" && (
            <div style={{ gridColumn: "span 2" }}>
              <label style={lbl}>Batches</label>
              {!form.course ? (
                <p style={{ fontSize: 12, color: T.muted }}>Select a course first.</p>
              ) : batchOptions.length === 0 ? (
                <p style={{ fontSize: 12, color: T.muted }}>No batches found for this course.</p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "10px 12px", background: "#0d0d0d", border: `1px solid ${T.border}`, borderRadius: 8 }}>
                  {batchOptions.map(b => {
                    const active = form.batches.includes(b.batchName)
                    return (
                      <button key={b._id || b.batchName} onClick={() => toggleBatch(b.batchName)} style={{
                        padding: "6px 12px", borderRadius: 99, cursor: "pointer", fontSize: 12, fontWeight: 600,
                        border: `1px solid ${active ? T.accent : T.border}`,
                        background: active ? `${T.accent}22` : "transparent",
                        color: active ? T.accent : T.sub,
                      }}>{b.batchName}</button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Student selection (when Specific Student) */}
          {form.recipient === "Specific Student" && (
            <div style={{ gridColumn: "span 2" }}>
              <label style={lbl}>Students</label>
              {!form.course ? (
                <p style={{ fontSize: 12, color: T.muted }}>Select a course first.</p>
              ) : studentsLoading ? (
                <p style={{ fontSize: 12, color: T.muted }}>Loading students…</p>
              ) : studentOptions.length === 0 ? (
                <p style={{ fontSize: 12, color: T.muted }}>No students enrolled in this course.</p>
              ) : (
                <div style={{ maxHeight: 160, overflow: "auto", display: "flex", flexDirection: "column", gap: 4, padding: "10px 12px", background: "#0d0d0d", border: `1px solid ${T.border}`, borderRadius: 8 }}>
                  {studentOptions.map(s => {
                    const active = form.recipients.some(r => r.id === s.id)
                    return (
                      <label key={s.id} style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "6px 8px",
                        borderRadius: 6, cursor: "pointer", fontSize: 12,
                        background: active ? `${T.accent}15` : "transparent",
                        color: active ? T.accent : T.sub,
                      }}>
                        <input type="checkbox" checked={active} onChange={() => toggleStudent(s)} />
                        {s.name} <span style={{ color: T.muted, fontSize: 11 }}>({s.id})</span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Category */}
          <div>
            <label style={lbl}>Category</label>
            <select value={form.category} onChange={e => set("category", e.target.value)} style={sel}>
              {CATEGORIES.map(c => <option key={c.value}>{c.value}</option>)}
            </select>
          </div>

          {/* Subject */}
          <div style={{ gridColumn: "span 2" }}>
            <label style={lbl}>Subject *</label>
            <input placeholder="Message subject…" value={form.subject}
              onChange={e => set("subject", e.target.value)} style={inp} />
          </div>

          {/* Message */}
          <div style={{ gridColumn: "span 2" }}>
            <label style={lbl}>Message *</label>
            <textarea placeholder="Type your message here…" value={form.message}
              onChange={e => set("message", e.target.value)} rows={5}
              style={{ ...inp, resize: "vertical" }} />
          </div>

          {/* Priority */}
          <div style={{ gridColumn: "span 2" }}>
            <label style={lbl}>Priority</label>
            <div style={{ display: "flex", gap: 10 }}>
              {["Normal", "Important", "Urgent"].map(p => {
                const ps = priorityStyle(p)
                const active = form.priority === p
                return (
                  <button key={p} onClick={() => set("priority", p)} style={{
                    flex: 1, padding: "8px 0", borderRadius: 8, cursor: "pointer",
                    border: `1.5px solid ${active ? ps.color : T.border}`,
                    background: active ? ps.bg : "transparent",
                    color: active ? ps.color : T.muted,
                    fontWeight: active ? 700 : 400, fontSize: 13, transition: "all 0.15s",
                  }}>{p}</button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btnGhost} disabled={loading}>Cancel</button>
          <button onClick={handleSend} style={{ ...btnPrimary, opacity: loading ? 0.7 : 1 }} disabled={loading}>
            {loading ? <Loader size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={13} />}
            {loading ? "Sending…" : "Send Message"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── REPLY MODAL ──────────────────────────────────────────────────────────────
function ReplyModal({ open, msg, onClose, onReply, loading }) {
  const [reply, setReply] = useState("")
  useEffect(() => { if (open) setReply("") }, [open])

  if (!open || !msg) return null

  function handleSend() {
    if (!reply.trim()) return
    onReply({
      recipient: "Specific Student",
      course: msg.course, semester: msg.semester, batch: msg.batch,
      subject: `Re: ${msg.subject}`,
      message: reply,
      category: "Personal Message",
      priority: "Normal",
    })
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 110,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: T.card2, border: `1px solid ${T.border}`,
        borderRadius: 16, width: "100%", maxWidth: 540, padding: 26,
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: T.txt, margin: 0 }}>
            Reply to {msg.from || "Student"}
          </p>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>

        {/* Quoted original */}
        <div style={{
          background: "#0d0d0d", borderLeft: `3px solid ${T.accent}`,
          borderRadius: "0 8px 8px 0", padding: "10px 14px", marginBottom: 14,
        }}>
          <p style={{ fontSize: 11, color: T.muted, marginBottom: 4 }}>Re: {msg.subject}</p>
          <p style={{ fontSize: 12, color: T.sub, lineHeight: 1.6, maxHeight: 72, overflow: "hidden" }}>
            {msg.message}
          </p>
        </div>

        <textarea placeholder="Type your reply…" value={reply}
          onChange={e => setReply(e.target.value)} rows={4}
          style={{ ...inp, resize: "vertical" }} autoFocus />

        <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btnGhost} disabled={loading}>Cancel</button>
          <button onClick={handleSend} disabled={!reply.trim() || loading}
            style={{ ...btnPrimary, opacity: (!reply.trim() || loading) ? 0.6 : 1 }}>
            {loading ? <Loader size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Reply size={13} />}
            {loading ? "Sending…" : "Send Reply"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── INBOX ROW ────────────────────────────────────────────────────────────────
function InboxRow({ msg, onRead, onReply, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const cc = catConfig(msg.category)
  const ps = priorityStyle(msg.priority)

  function toggleExpand() {
    setExpanded(e => !e)
    if (!msg.isRead) onRead(msg._id)
  }

  return (
    <div style={{
      background: msg.isRead ? T.card : `${T.accent}08`,
      border: `1px solid ${msg.isRead ? T.border : T.accent + "44"}`,
      borderRadius: 12, marginBottom: 8, overflow: "hidden", transition: "all 0.2s",
    }}>
      <div onClick={toggleExpand} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer" }}>
        {/* Unread dot */}
        <div style={{
          width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
          background: msg.isRead ? "transparent" : T.accent,
          border: msg.isRead ? `1px solid ${T.muted}` : "none",
        }} />

        {/* Avatar */}
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: `${cc.color}22`, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, fontWeight: 700, color: cc.color,
        }}>
          {(msg.from || "S").charAt(0).toUpperCase()}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <p style={{ fontWeight: msg.isRead ? 500 : 700, color: T.txt, fontSize: 13, margin: 0 }}>
              {msg.from || "Student"}
            </p>
            <Badge label={msg.category} color={cc.color} />
            <Badge label={msg.priority} color={ps.color} bg={ps.bg} />
          </div>
          <p style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>
            {msg.subject}
            {msg.course && <span style={{ color: T.muted }}> — {msg.course}{msg.semester ? ` · ${msg.semester} sem` : ""}{msg.batch ? ` · ${msg.batch}` : ""}</span>}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <p style={{ fontSize: 11, color: T.muted }}>{fmtTime(msg.createdAt)}</p>
          {expanded ? <ChevronUp size={14} color={T.muted} /> : <ChevronDown size={14} color={T.muted} />}
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: `1px solid ${T.border}`, padding: "14px 16px 16px" }}>
          <p style={{ fontSize: 13, color: T.sub, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{msg.message}</p>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            {!msg.isRead && (
              <button onClick={() => onRead(msg._id)} style={btnSmall(T.accent)}>
                <Eye size={12} /> Mark Read
              </button>
            )}
            <button onClick={() => onReply(msg)} style={btnSmall(T.blue)}>
              <Reply size={12} /> Reply
            </button>
            <button onClick={() => onDelete(msg._id)} style={btnSmall(T.danger)}>
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── SENT ROW ─────────────────────────────────────────────────────────────────
function SentRow({ msg, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const cc = catConfig(msg.category)
  const ps = priorityStyle(msg.priority)

  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderRadius: 12, marginBottom: 8, overflow: "hidden",
    }}>
      <div onClick={() => setExpanded(e => !e)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer" }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: `${cc.color}22`, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Send size={15} color={cc.color} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <p style={{ fontWeight: 600, color: T.txt, fontSize: 13, margin: 0 }}>
              To: {msg.recipient || "Entire Course"}
            </p>
            <Badge label={msg.category} color={cc.color} />
            <Badge label={msg.priority} color={ps.color} bg={ps.bg} />
          </div>
          <p style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>
            {msg.subject}
            {msg.course && <span style={{ color: T.muted }}> — {msg.course}{msg.semester ? ` · ${msg.semester} sem` : ""}</span>}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <p style={{ fontSize: 11, color: T.muted }}>{fmtTime(msg.createdAt)}</p>
          <CheckCheck size={14} color={T.accent} />
          {expanded ? <ChevronUp size={14} color={T.muted} /> : <ChevronDown size={14} color={T.muted} />}
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: `1px solid ${T.border}`, padding: "14px 16px 16px" }}>
          <p style={{ fontSize: 13, color: T.sub, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{msg.message}</p>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={() => onDelete(msg._id)} style={btnSmall(T.danger)}>
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function StudentMessages() {
  const user   = useAppStore(s => s.user)
  const userId = user?._id

  const headers = useMemo(() => ({
    "Content-Type": "application/json",
    "x-user-id": userId || "",
  }), [userId])

  // ─ State ─
  const [messages,     setMessages]     = useState([])
  const [stats,        setStats]        = useState({ total: 0, unread: 0, announcementsSent: 0, today: 0 })
  const [tab,          setTab]          = useState("inbox")
  const [loading,      setLoading]      = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error,        setError]        = useState("")
  const [toast,        setToast]        = useState(null)
  const [search,       setSearch]       = useState("")
  const [filterCat,    setFilterCat]    = useState("All")
  const [filterPri,    setFilterPri]    = useState("All")
  const [filterOpen,   setFilterOpen]   = useState(false)
  const [composeOpen,  setComposeOpen]  = useState(false)
  const [composePre,   setComposePre]   = useState(null)
  const [replyOpen,    setReplyOpen]    = useState(false)
  const [replyMsg,     setReplyMsg]     = useState(null)

  function showToast(msg, color = T.accent) {
    setToast({ msg, color })
    setTimeout(() => setToast(null), 3000)
  }

  // ─ Fetch ─
  const fetchMessages = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({
        direction: tab === "inbox" ? "inbox" : "sent",
        ...(filterCat !== "All" && { category: filterCat }),
        ...(filterPri !== "All" && { priority: filterPri }),
        ...(search && { search }),
      })
      const res  = await fetch(`${BASE}?${params}`, { headers })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || "Failed to load messages")
      setMessages(json.data || [])
      setStats(json.stats || { total: 0, unread: 0, announcementsSent: 0, today: 0 })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [userId, tab, filterCat, filterPri, search, headers])

  useEffect(() => { fetchMessages() }, [fetchMessages])

  // ─ Send new message ─
  async function handleSend(form) {
    setActionLoading(true)
    try {
      const res  = await fetch(BASE, { method: "POST", headers, body: JSON.stringify(form) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || "Failed to send")
      setComposeOpen(false)
      showToast("Message sent successfully!")
      // Switch to sent tab and refresh
      setTab("sent")
      fetchMessages()
    } catch (err) {
      showToast(err.message, T.danger)
    } finally {
      setActionLoading(false)
    }
  }

  // ─ Reply ─
  async function handleReply(form) {
    setActionLoading(true)
    try {
      const res  = await fetch(BASE, { method: "POST", headers, body: JSON.stringify(form) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || "Failed to send reply")
      setReplyOpen(false)
      showToast("Reply sent!")
      setTab("sent")
      fetchMessages()
    } catch (err) {
      showToast(err.message, T.danger)
    } finally {
      setActionLoading(false)
    }
  }

  // ─ Mark single read ─
  async function handleRead(id) {
    // Optimistic update
    setMessages(prev => prev.map(m => m._id === id ? { ...m, isRead: true } : m))
    setStats(s => ({ ...s, unread: Math.max(0, s.unread - 1) }))
    try {
      await fetch(`${BASE}/${id}/read`, { method: "PATCH", headers })
    } catch { /* silently refresh */ fetchMessages() }
  }

  // ─ Mark all read ─
  async function handleMarkAllRead() {
    setActionLoading(true)
    try {
      const res = await fetch(`${BASE}/read-all`, { method: "PATCH", headers })
      if (!res.ok) throw new Error("Failed")
      showToast("All messages marked as read.")
      fetchMessages()
    } catch (err) {
      showToast(err.message, T.danger)
    } finally {
      setActionLoading(false)
    }
  }

  // ─ Delete ─
  async function handleDelete(id) {
    // Optimistic
    setMessages(prev => prev.filter(m => m._id !== id))
    try {
      await fetch(`${BASE}/${id}`, { method: "DELETE", headers })
      showToast("Message deleted.", T.danger)
      fetchMessages()  // refresh stats
    } catch { fetchMessages() }
  }

  // ─ Open template ─
  function openTemplate(t) {
    setComposePre({ subject: t.subject, message: t.message, category: t.category, priority: t.priority })
    setComposeOpen(true)
  }

  // ─ Filtered list (client-side search already done server-side, this is instant) ─
  const filtered = useMemo(() => messages, [messages])

  const unreadCount = stats.unread || 0

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.txt }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 200,
          background: toast.color === T.danger ? "#7f1d1d" : "#052e16",
          border: `1px solid ${toast.color}55`,
          color: toast.color, borderRadius: 10,
          padding: "12px 20px", fontSize: 13, fontWeight: 600,
          boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
          animation: "slideUp 0.3s ease",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <Check size={14} />{toast.msg}
        </div>
      )}

      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${T.accent}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MessageSquare size={20} color={T.accent} />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: T.txt, margin: 0 }}>Student Messages</h1>
              <p style={{ fontSize: 12, color: T.muted, margin: 0 }}>Communicate with your students</p>
            </div>
          </div>
          <button onClick={() => { setComposePre(null); setComposeOpen(true) }} style={btnPrimary}>
            <Plus size={15} /> New Message
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Total Messages",     value: stats.total,             color: T.blue,   icon: MessageSquare },
          { label: "Unread Messages",    value: stats.unread,            color: T.warn,   icon: MailOpen },
          { label: "Announcements Sent", value: stats.announcementsSent, color: T.accent, icon: Bell },
          { label: "Today's Messages",   value: stats.today,             color: T.purple, icon: Clock },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} style={{
            background: T.card, border: `1px solid ${T.border}`,
            borderRadius: 12, padding: "18px 20px",
            display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          }}>
            <div>
              <p style={{ fontSize: 11, color: T.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
              <p style={{ fontSize: 28, fontWeight: 700,color: "#FFFFFF", lineHeight: 1, margin: 0 }}>{value}</p>
            </div>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon size={16} color={color} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20, alignItems: "start" }}>

        {/* Main panel */}
        <div>
          {/* Tabs + search + filter */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16, marginBottom: 16 }}>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
              {[
                { id: "inbox", label: "Inbox", icon: Inbox, badge: unreadCount },
                { id: "sent",  label: "Sent",  icon: Send,  badge: null },
              ].map(({ id, label, icon: Icon, badge }) => (
                <button key={id} onClick={() => setTab(id)} style={{
                  padding: "7px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600,
                  border: "none", background: tab === id ? T.accent : "transparent",
                  color: tab === id ? "#000" : T.muted,
                  display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s",
                }}>
                  <Icon size={13} /> {label}
                  {badge > 0 && (
                    <span style={{
                      background: tab === id ? "#000" : T.accent,
                      color: tab === id ? T.accent : "#000",
                      borderRadius: 99, fontSize: 10, fontWeight: 700, padding: "1px 6px",
                    }}>{badge}</span>
                  )}
                </button>
              ))}

              {/* refresh */}
              <button onClick={fetchMessages} disabled={loading} style={{ ...btnGhost, marginLeft: "auto", padding: "7px 12px" }}>
                <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
              </button>
            </div>

            {/* Search + filter row */}
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ flex: 1, position: "relative" }}>
                <Search size={14} color={T.muted} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input placeholder="Search messages…" value={search}
                  onChange={e => setSearch(e.target.value)} style={{ ...inp, paddingLeft: 36 }} />
              </div>

              <button onClick={() => setFilterOpen(f => !f)} style={{
                ...btnGhost,
                background: filterOpen ? `${T.accent}22` : "transparent",
                borderColor: filterOpen ? T.accent : T.border,
                color: filterOpen ? T.accent : T.muted,
                position: "relative",
              }}>
                <Filter size={13} /> Filter
                {(filterCat !== "All" || filterPri !== "All") && (
                  <span style={{ position: "absolute", top: -4, right: -4, width: 8, height: 8, borderRadius: "50%", background: T.accent }} />
                )}
              </button>

              {tab === "inbox" && unreadCount > 0 && (
                <button onClick={handleMarkAllRead} disabled={actionLoading} style={btnGhost}>
                  <CheckCheck size={13} /> Mark All Read
                </button>
              )}
            </div>

            {/* Filter panel */}
            {filterOpen && (
              <div style={{ marginTop: 12, padding: "14px 16px", background: "#0d0d0d", borderRadius: 10, border: `1px solid ${T.border}` }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <label style={lbl}>Category</label>
                    <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={sel}>
                      <option value="All">All Categories</option>
                      {CATEGORIES.map(c => <option key={c.value}>{c.value}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Priority</label>
                    <select value={filterPri} onChange={e => setFilterPri(e.target.value)} style={sel}>
                      <option value="All">All Priorities</option>
                      {["Normal","Important","Urgent"].map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                  <button onClick={() => { setFilterCat("All"); setFilterPri("All") }} style={{ ...btnGhost, fontSize: 12 }}>
                    <RefreshCw size={11} /> Clear Filters
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: "#7f1d1d44", border: `1px solid ${T.danger}55`, borderRadius: 10, padding: "12px 16px", marginBottom: 12, color: T.danger, fontSize: 13 }}>
              {error} — <button onClick={fetchMessages} style={{ background: "none", border: "none", color: T.danger, cursor: "pointer", textDecoration: "underline", fontSize: 13 }}>Retry</button>
            </div>
          )}

          {/* List */}
          {loading ? <Spinner /> : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0", background: T.card, border: `1px solid ${T.border}`, borderRadius: 14 }}>
              <MessageSquare size={32} color={T.muted} style={{ marginBottom: 12 }} />
              <p style={{ color: T.sub, fontSize: 14 }}>No messages found</p>
              <p style={{ color: T.muted, fontSize: 12, marginTop: 4 }}>
                {tab === "inbox" ? "No messages received yet" : "You haven't sent any messages yet"}
              </p>
              <button onClick={() => { setComposePre(null); setComposeOpen(true) }} style={{ ...btnPrimary, marginTop: 16 }}>
                <Plus size={13} /> New Message
              </button>
            </div>
          ) : tab === "inbox" ? (
            filtered.map(m => (
              <InboxRow key={m._id} msg={m}
                onRead={handleRead}
                onReply={msg => { setReplyMsg(msg); setReplyOpen(true) }}
                onDelete={handleDelete}
              />
            ))
          ) : (
            filtered.map(m => (
              <SentRow key={m._id} msg={m} onDelete={handleDelete} />
            ))
          )}
        </div>

        {/* Right sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Quick Templates */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Zap size={14} color={T.warn} />
              <p style={{ fontSize: 13, fontWeight: 700, color: T.txt, margin: 0 }}>Quick Templates</p>
            </div>
            <p style={{ fontSize: 11, color: T.muted, marginBottom: 12 }}>One-click message creation</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {TEMPLATES.map(t => {
                const Icon = t.icon
                return (
                  <button key={t.label} onClick={() => openTemplate(t)} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                    background: `${t.color}10`, border: `1px solid ${t.color}30`,
                    color: t.color, width: "100%", textAlign: "left", transition: "all 0.15s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = `${t.color}20` }}
                    onMouseLeave={e => { e.currentTarget.style.background = `${t.color}10` }}
                  >
                    <Icon size={14} />
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{t.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Message Categories */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Bookmark size={14} color={T.blue} />
              <p style={{ fontSize: 13, fontWeight: 700, color: T.txt, margin: 0 }}>Message Categories</p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {CATEGORIES.map(cat => {
                const Icon = cat.icon
                // Count from current data
                const count = messages.filter(m => m.category === cat.value).length
                const active = filterCat === cat.value
                return (
                  <button key={cat.value}
                    onClick={() => { setFilterCat(active ? "All" : cat.value); setFilterOpen(false) }}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "8px 12px", borderRadius: 8, cursor: "pointer",
                      background: active ? `${cat.color}15` : "transparent",
                      border: `1px solid ${active ? cat.color + "44" : "transparent"}`,
                      transition: "all 0.15s", width: "100%",
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#1a1a1a" }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Icon size={13} color={cat.color} />
                      <span style={{ fontSize: 12, color: T.sub }}>{cat.value}</span>
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: cat.color,
                      background: `${cat.color}20`, borderRadius: 99, padding: "1px 7px",
                    }}>{count}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ComposeModal
        open={composeOpen}
        prefill={composePre}
        onClose={() => setComposeOpen(false)}
        onSend={handleSend}
        loading={actionLoading}
      />
      <ReplyModal
        open={replyOpen}
        msg={replyMsg}
        onClose={() => setReplyOpen(false)}
        onReply={handleReply}
        loading={actionLoading}
      />

      <style>{`
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        @keyframes spin    { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const lbl = {
  display: "block", fontSize: 11, color: "#9CA3AF",
  marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em",
}
const inp = {
  width: "100%", background: "#0d0d0d", border: "1px solid #333",
  borderRadius: 8, padding: "9px 12px", color: "#fff", fontSize: 13,
  outline: "none", boxSizing: "border-box",
}
const sel = { ...inp, appearance: "none", cursor: "pointer" }
const iconBtn = { background: "none", border: "none", cursor: "pointer", color: "#6B7280" }
const btnPrimary = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "9px 18px", borderRadius: 9, cursor: "pointer",
  background: "#22C55E", border: "none", color: "#000", fontWeight: 700, fontSize: 13,
}
const btnGhost = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "8px 14px", borderRadius: 9, cursor: "pointer",
  background: "transparent", border: "1px solid #333", color: "#9CA3AF", fontSize: 13,
}
function btnSmall(color) {
  return {
    display: "inline-flex", alignItems: "center", gap: 5,
    padding: "5px 12px", borderRadius: 7, cursor: "pointer",
    background: `${color}18`, border: `1px solid ${color}44`,
    color, fontSize: 11, fontWeight: 600,
  }
}
