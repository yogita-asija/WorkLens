import React, { useState, useEffect, useCallback, useMemo } from "react"
import {
  Video, Plus, Calendar, Clock, Users, Link2, Edit2, Trash2,
  X, CheckCircle, AlertCircle, Play, StopCircle, ChevronLeft,
  ChevronRight, ExternalLink, Copy, Search, Filter, BookOpen,
  ArrowLeft
} from "lucide-react"
import { T } from "../components/UI"
import useAppStore from "../store/useAppStore"
import * as api from "../services/api"

/* ── API helpers ───────────────────────────────────────────── */
const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000"
async function apiFetch(path, opts = {}) {
  const r = await fetch(`${BASE}${path}`, { headers: { "Content-Type": "application/json" }, ...opts })
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || `Error ${r.status}`) }
  return r.json()
}
const ocGet    = (q = "") => apiFetch(`/api/online-classes${q}`)
const ocStats  = ()       => apiFetch("/api/online-classes/stats")
const ocCreate = (b)      => apiFetch("/api/online-classes", { method: "POST", body: JSON.stringify(b) })
const ocUpdate = (id, b)  => apiFetch(`/api/online-classes/${id}`, { method: "PUT",  body: JSON.stringify(b) })
const ocStatus = (id, s)  => apiFetch(`/api/online-classes/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: s }) })
const ocDelete = (id)     => apiFetch(`/api/online-classes/${id}`, { method: "DELETE" })

/* ── Helpers ───────────────────────────────────────────────── */
const STATUS_META = {
  scheduled: { color: "#3B82F6", bg: "rgba(59,130,246,0.12)", label: "Scheduled" },
  live:      { color: "#22C55E", bg: "rgba(34,197,94,0.12)",  label: "Live Now"  },
  completed: { color: "#6B7280", bg: "rgba(107,114,128,0.1)", label: "Completed" },
  cancelled: { color: "#EF4444", bg: "rgba(239,68,68,0.1)",   label: "Cancelled" },
}
const PLATFORMS = [
  { value: "meet",  label: "Google Meet",       color: "#34A853" },
  { value: "zoom",  label: "Zoom",              color: "#2D8CFF" },
  { value: "teams", label: "Microsoft Teams",   color: "#6264A7" },
  { value: "other", label: "Other",             color: "#F59E0B" },
]
const pMeta = (p) => PLATFORMS.find(x => x.value === p) || PLATFORMS[3]

function fmtDate(d) {
  if (!d) return ""
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}
function fmtTime(d) {
  if (!d) return ""
  return new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
}
function fmtDateTime(d) { return `${fmtDate(d)}, ${fmtTime(d)}` }
function toInputVal(d) {
  if (!d) return ""
  const dt = new Date(d)
  const pad = n => String(n).padStart(2, "0")
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */
export default function OnlineClassesPage() {
  const { showToast } = useAppStore()

  // ─ state ─
  const [view,        setView]        = useState("courses")   // "courses" | "dashboard"
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [courses,     setCourses]     = useState([])
  const [classes,     setClasses]     = useState([])
  const [stats,       setStats]       = useState({ total:0, upcoming:0, completed:0, today:0, live:0, cancelled:0 })
  const [loading,     setLoading]     = useState(false)
  const [statusFilter,setStatusFilter]= useState("all")
  const [search,      setSearch]      = useState("")
  const [calMonth,    setCalMonth]    = useState(new Date())
  const [modal,       setModal]       = useState(null)   // null | "schedule" | "edit" | "view"
  const [editTarget,  setEditTarget]  = useState(null)

  // ─ load courses ─
  const loadCourses = useCallback(async () => {
    try {
      const data = await api.getCourses({ status: "active" })
      setCourses(data || [])
    } catch (e) { showToast(e.message, "error") }
  }, [])

  // ─ load classes ─
  const loadClasses = useCallback(async (courseId) => {
    setLoading(true)
    try {
      const q = courseId ? `?courseId=${courseId}` : ""
      const [data, s] = await Promise.all([ocGet(q), ocStats()])
      setClasses(data || [])
      setStats(s || {})
    } catch (e) { showToast(e.message, "error") }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadCourses() }, [])
  useEffect(() => {
    if (view === "dashboard") loadClasses(selectedCourse?._id)
  }, [view, selectedCourse])

  // ─ filtered classes ─
  const filtered = useMemo(() => {
    let list = classes
    if (statusFilter !== "all") list = list.filter(c => c.status === statusFilter)
    if (search.trim()) {
      const s = search.toLowerCase()
      list = list.filter(c => c.title?.toLowerCase().includes(s) || c.courseName?.toLowerCase().includes(s))
    }
    return list
  }, [classes, statusFilter, search])

  // ─ calendar data ─
  const calClasses = useMemo(() => {
    const map = {}
    classes.forEach(c => {
      const d = new Date(c.scheduledAt)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (!map[key]) map[key] = []
      map[key].push(c)
    })
    return map
  }, [classes])

  // ─ handlers ─
  const handleCourseClick = (c) => { setSelectedCourse(c); setView("dashboard") }
  const handleBack = () => { setView("courses"); setSelectedCourse(null); setClasses([]) }

  const handleSchedule = async (form) => {
    try {
      await ocCreate({ ...form, courseId: selectedCourse._id })
      showToast("Class scheduled & students notified!")
      setModal(null)
      loadClasses(selectedCourse._id)
    } catch (e) { showToast(e.message, "error") }
  }

  const handleEdit = async (form) => {
    try {
      await ocUpdate(editTarget._id, form)
      showToast("Class updated")
      setModal(null)
      setEditTarget(null)
      loadClasses(selectedCourse._id)
    } catch (e) { showToast(e.message, "error") }
  }

  const handleCancel = async (cls) => {
    if (!confirm(`Cancel "${cls.title}"?`)) return
    try {
      await ocStatus(cls._id, "cancelled")
      showToast("Class cancelled")
      loadClasses(selectedCourse?._id)
    } catch (e) { showToast(e.message, "error") }
  }

  const handleDelete = async (cls) => {
    if (!confirm(`Delete "${cls.title}" permanently?`)) return
    try {
      await ocDelete(cls._id)
      showToast("Class deleted")
      loadClasses(selectedCourse?._id)
    } catch (e) { showToast(e.message, "error") }
  }

  const handleMarkComplete = async (cls) => {
    try {
      await ocStatus(cls._id, "completed")
      showToast("Marked as completed")
      loadClasses(selectedCourse?._id)
    } catch (e) { showToast(e.message, "error") }
  }

  const openEdit = (cls) => { setEditTarget(cls); setModal("edit") }
  const openView = (cls) => { setEditTarget(cls); setModal("view") }

  /* ── Course Cards View ── */
  if (view === "courses") {
    return (
      <div style={{ minHeight: "100%" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: T.txt, margin: 0 }}>Online Classes</h1>
          <p style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>
            Select a course to manage its online classes
          </p>
        </div>

        {courses.length === 0 ? (
          <EmptyState icon={<BookOpen size={40} />} title="No Active Courses" desc="No active courses found. Add courses first." />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
            {courses.map(c => (
              <CourseCard key={c._id} course={c} onClick={() => handleCourseClick(c)} />
            ))}
          </div>
        )}
      </div>
    )
  }

  /* ── Dashboard View ── */
  return (
    <div style={{ minHeight: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={handleBack}
            style={{ background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: T.sub, display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <ArrowLeft size={14} /> Courses
          </button>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: T.txt, margin: 0 }}>
              {selectedCourse?.courseName}
            </h1>
            <p style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
              {selectedCourse?.courseCode} · {selectedCourse?.batch || "All Batches"} · {selectedCourse?.students || 0} students
            </p>
          </div>
        </div>
        <button onClick={() => setModal("schedule")}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 18px", background: "#22C55E", color: "#000", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          <Plus size={15} /> Schedule Class
        </button>
      </div>

      {/* Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Total Classes",    value: stats.total,     color: T.txt       },
          { label: "Upcoming Classes", value: stats.upcoming,  color: "#3B82F6"   },
          { label: "Completed",        value: stats.completed, color: "#6B7280"   },
          { label: "Today's Classes",  value: stats.today,     color: "#F59E0B"   },
        ].map(s => (
          <div key={s.label} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px 18px" }}>
            <p style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>{s.label}</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: s.color, margin: 0 }}>{s.value ?? 0}</p>
          </div>
        ))}
      </div>

      {/* Live Banner */}
      {stats.live > 0 && (
        <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 10, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22C55E", animation: "pulse 1.5s infinite" }} />
          <span style={{ fontSize: 13, color: "#22C55E", fontWeight: 600 }}>{stats.live} class{stats.live > 1 ? "es" : ""} live right now</span>
        </div>
      )}

      {/* Two-column layout: list + calendar */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>

        {/* ── Left: Class List ── */}
        <div>
          {/* Filters */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
              <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.muted }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search classes…"
                style={{ background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, padding: "7px 10px 7px 30px", color: T.txt, fontSize: 12, width: "100%", outline: "none" }} />
            </div>
            {["all","scheduled","live","completed","cancelled"].map(f => (
              <button key={f} onClick={() => setStatusFilter(f)}
                style={{ padding: "6px 13px", borderRadius: 8, fontSize: 11, fontWeight: 500, cursor: "pointer",
                  background: statusFilter === f ? "#fff" : T.card, color: statusFilter === f ? "#000" : T.sub,
                  border: `1px solid ${statusFilter === f ? "#fff" : T.border}` }}>
                {f === "all" ? "All" : STATUS_META[f]?.label || f}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: T.muted }}>
              <Video size={32} style={{ margin: "0 auto 10px", display: "block", opacity: 0.3 }} />
              <p style={{ fontSize: 13 }}>Loading classes…</p>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={<Video size={36} />}
              title={statusFilter === "all" ? "No Classes Scheduled" : `No ${STATUS_META[statusFilter]?.label} Classes`}
              desc={statusFilter === "all" ? 'Click "Schedule Class" to add your first online class.': "No classes in this status."}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.map(cls => (
                <ClassCard key={cls._id} cls={cls}
                  onView={() => openView(cls)} onEdit={() => openEdit(cls)}
                  onCancel={() => handleCancel(cls)} onDelete={() => handleDelete(cls)}
                  onComplete={() => handleMarkComplete(cls)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Calendar ── */}
        <div>
          <ClassCalendar
            month={calMonth} setMonth={setCalMonth}
            calClasses={calClasses}
            onDayClick={(classes) => { /* could filter list */ }}
          />

          {/* Upcoming quick list */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px", marginTop: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: T.txt, margin: "0 0 12px" }}>Upcoming</p>
            {classes.filter(c => c.status === "scheduled").slice(0,5).length === 0 ? (
              <p style={{ fontSize: 12, color: T.muted, textAlign: "center", padding: "16px 0" }}>No upcoming classes</p>
            ) : (
              classes.filter(c => c.status === "scheduled").slice(0,5).map(c => (
                <div key={c._id} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
                  <div style={{ width: 36, textAlign: "center", background: T.inner, borderRadius: 8, padding: "4px 0", flexShrink: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: T.txt, margin: 0 }}>{new Date(c.scheduledAt).getDate()}</p>
                    <p style={{ fontSize: 9, color: T.muted, margin: 0 }}>{new Date(c.scheduledAt).toLocaleString("en",{month:"short"})}</p>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: T.txt, margin: "0 0 1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.title}</p>
                    <p style={{ fontSize: 10, color: T.muted, margin: 0 }}>{fmtTime(c.scheduledAt)} · {c.duration}min</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {modal === "schedule" && (
        <ScheduleModal
          course={selectedCourse}
          onClose={() => setModal(null)}
          onSubmit={handleSchedule}
        />
      )}
      {modal === "edit" && editTarget && (
        <ScheduleModal
          course={selectedCourse}
          initial={editTarget}
          onClose={() => { setModal(null); setEditTarget(null) }}
          onSubmit={handleEdit}
        />
      )}
      {modal === "view" && editTarget && (
        <ViewModal
          cls={editTarget}
          onClose={() => { setModal(null); setEditTarget(null) }}
          onEdit={() => { setModal("edit") }}
        />
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   COURSE CARD
═══════════════════════════════════════════════════════════════ */
function CourseCard({ course, onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: hov ? "var(--bg-2a2a2a)" : T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px", cursor: "pointer", transition: "background 0.15s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Video size={18} color="#22C55E" />
        </div>
        <span style={{ fontSize: 10, color: "#22C55E", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", padding: "2px 8px", borderRadius: 5 }}>
          {course.status || "active"}
        </span>
      </div>
      <p style={{ fontSize: 15, fontWeight: 600, color: T.txt, margin: "0 0 4px" }}>{course.courseName}</p>
      <p style={{ fontSize: 12, color: T.muted, margin: "0 0 14px" }}>
        {course.courseCode || course.courseId} {course.sem && course.sem !== "N/A" ? `· Sem ${course.sem}` : ""}
      </p>
      <div style={{ display: "flex", gap: 16 }}>
        <span style={{ fontSize: 11, color: T.muted }}><Users size={11} style={{ display: "inline", marginRight: 4 }} />{course.students || 0} students</span>
        {course.batch && <span style={{ fontSize: 11, color: T.muted }}>Batch: {course.batch}</span>}
      </div>
      <div style={{ marginTop: 14, padding: "8px 12px", background: T.inner, borderRadius: 8, display: "flex", alignItems: "center", gap: 8 }}>
        <Video size={12} color="#22C55E" />
        <span style={{ fontSize: 11, color: T.sub }}>Click to manage online classes</span>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   CLASS CARD
═══════════════════════════════════════════════════════════════ */
function ClassCard({ cls, onView, onEdit, onCancel, onDelete, onComplete }) {
  const sm   = STATUS_META[cls.status] || STATUS_META.scheduled
  const pm   = pMeta(cls.platform)
  const past = new Date(cls.scheduledAt) < new Date()

  const copyLink = () => {
    navigator.clipboard?.writeText(cls.meetingLink)
      .then(() => alert("Link copied!"))
      .catch(() => {})
  }

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px 18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: sm.color, background: sm.bg, padding: "2px 8px", borderRadius: 5 }}>
              {cls.status === "live" && <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#22C55E", marginRight: 5, verticalAlign: "middle", animation: "pulse 1.5s infinite" }} />}
              {sm.label}
            </span>
            <span style={{ fontSize: 10, color: pm.color, background: "rgba(0,0,0,0.3)", padding: "2px 8px", borderRadius: 5 }}>{pm.label}</span>
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: T.txt, margin: "0 0 4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {cls.title}
          </p>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: T.muted, display: "flex", alignItems: "center", gap: 4 }}>
              <Calendar size={11} /> {fmtDate(cls.scheduledAt)}
            </span>
            <span style={{ fontSize: 11, color: T.muted, display: "flex", alignItems: "center", gap: 4 }}>
              <Clock size={11} /> {fmtTime(cls.scheduledAt)} ({cls.duration}min)
            </span>
            {cls.students?.length > 0 && (
              <span style={{ fontSize: 11, color: T.muted, display: "flex", alignItems: "center", gap: 4 }}>
                <Users size={11} /> {cls.students.length} students
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {cls.status !== "cancelled" && cls.status !== "completed" && (
            <a href={cls.meetingLink} target="_blank" rel="noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "#22C55E", color: "#000", borderRadius: 8, fontSize: 11, fontWeight: 700, textDecoration: "none" }}>
              <Play size={11} /> Join
            </a>
          )}
          <IBtn icon={<Eye13 />} onClick={onView} title="View details" />
          {cls.status === "scheduled" && <IBtn icon={<Edit2 size={13} />} onClick={onEdit} title="Edit" />}
          {cls.status === "scheduled" && <IBtn icon={<StopCircle size={13} />} onClick={onCancel} title="Cancel" danger />}
          {cls.status === "live" && <IBtn icon={<CheckCircle size={13} />} onClick={onComplete} title="Mark complete" />}
          <IBtn icon={<Trash2 size={13} />} onClick={onDelete} title="Delete" danger />
        </div>
      </div>

      {cls.meetingLink && cls.status !== "cancelled" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.inner, borderRadius: 8, padding: "6px 10px", marginTop: 6 }}>
          <Link2 size={11} color={T.muted} />
          <a href={cls.meetingLink} target="_blank" rel="noreferrer"
            style={{ flex: 1, fontSize: 11, color: T.sub, textDecoration: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {cls.meetingLink}
          </a>
          <button onClick={copyLink} title="Copy link"
            style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, display: "flex", padding: 0 }}>
            <Copy size={11} />
          </button>
        </div>
      )}
    </div>
  )
}
function Eye13() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> }

/* ═══════════════════════════════════════════════════════════════
   CALENDAR
═══════════════════════════════════════════════════════════════ */
function ClassCalendar({ month, setMonth, calClasses }) {
  const year  = month.getFullYear()
  const mon   = month.getMonth()
  const today = new Date()

  const firstDay  = new Date(year, mon, 1).getDay()
  const daysInMon = new Date(year, mon+1, 0).getDate()
  const cells = Array.from({ length: firstDay }, () => null).concat(
    Array.from({ length: daysInMon }, (_, i) => i+1)
  )
  while (cells.length % 7 !== 0) cells.push(null)

  const prevMonth = () => setMonth(new Date(year, mon-1, 1))
  const nextMonth = () => setMonth(new Date(year, mon+1, 1))

  const monthName = month.toLocaleString("en", { month: "long", year: "numeric" })

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <button onClick={prevMonth} style={{ background: T.inner, border: `1px solid ${T.border}`, borderRadius: 6, padding: 5, cursor: "pointer", color: T.sub, display: "flex" }}>
          <ChevronLeft size={14} />
        </button>
        <p style={{ fontSize: 13, fontWeight: 600, color: T.txt, margin: 0 }}>{monthName}</p>
        <button onClick={nextMonth} style={{ background: T.inner, border: `1px solid ${T.border}`, borderRadius: 6, padding: 5, cursor: "pointer", color: T.sub, display: "flex" }}>
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Day labels */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 4 }}>
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 10, color: T.muted, padding: "2px 0" }}>{d}</div>
        ))}
      </div>

      {/* Cells */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const key = `${year}-${mon}-${day}`
          const hasClasses = calClasses[key] || []
          const isToday = today.getFullYear() === year && today.getMonth() === mon && today.getDate() === day
          const statusColors = hasClasses.map(c => STATUS_META[c.status]?.color).filter(Boolean)

          return (
            <div key={i} title={hasClasses.map(c => c.title).join(", ")}
              style={{ textAlign: "center", borderRadius: 6, padding: "4px 2px", cursor: hasClasses.length ? "pointer" : "default",
                background: isToday ? "rgba(34,197,94,0.15)" : hasClasses.length ? "rgba(59,130,246,0.08)" : "transparent",
                border: isToday ? "1px solid rgba(34,197,94,0.3)" : "1px solid transparent",
              }}>
              <span style={{ fontSize: 11, color: isToday ? "#22C55E" : hasClasses.length ? T.txt : T.muted, fontWeight: isToday ? 700 : 400 }}>
                {day}
              </span>
              {hasClasses.length > 0 && (
                <div style={{ display: "flex", justifyContent: "center", gap: 2, marginTop: 2 }}>
                  {statusColors.slice(0,3).map((col, ci) => (
                    <div key={ci} style={{ width: 4, height: 4, borderRadius: "50%", background: col }} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        {Object.entries(STATUS_META).map(([k, v]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: v.color }} />
            <span style={{ fontSize: 10, color: T.muted }}>{v.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const scheduleInp = { background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", color: T.txt, fontSize: 13, width: "100%", outline: "none", boxSizing: "border-box" }
function FormField({ label, children, required }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, color: T.sub, marginBottom: 5, fontWeight: 500 }}>
        {label}{required && <span style={{ color: "#ef4444" }}> *</span>}
      </label>
      {children}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   SCHEDULE MODAL
═══════════════════════════════════════════════════════════════ */
function ScheduleModal({ course, initial, onClose, onSubmit }) {
  const isEdit = !!initial
  const [form, setForm] = useState({
    title:          initial?.title || "",
    scheduledAt:    initial?.scheduledAt ? toInputVal(initial.scheduledAt) : "",
    duration:       initial?.duration || 60,
    platform:       initial?.platform || "meet",
    meetingLink:    initial?.meetingLink || "",
    meetingId:      initial?.meetingId || "",
    password:       initial?.password || "",
    description:    initial?.description || "",
    notifyStudents: initial?.notifyStudents !== false,
  })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.title.trim())       { alert("Title is required");           return }
    if (!form.scheduledAt)        { alert("Date/time is required");       return }
    if (!form.meetingLink.trim()) { alert("Meeting link is required");    return }
    setSaving(true)
    try { await onSubmit(form) } finally { setSaving(false) }
  }

  const inp = scheduleInp
  const F = FormField

  return (
    <ModalWrap title={isEdit ? "Edit Class" : "Schedule Online Class"} onClose={onClose} wide>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <F label="Class Title" required>
          <input style={inp} value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. Unit 3 – Sorting Algorithms" />
        </F>
        <F label="Platform" required>
          <select style={inp} value={form.platform} onChange={e => set("platform", e.target.value)}>
            {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </F>
        <F label="Date & Time" required>
          <input type="datetime-local" style={inp} value={form.scheduledAt} onChange={e => set("scheduledAt", e.target.value)} />
        </F>
        <F label="Duration (minutes)">
          <input type="number" style={inp} value={form.duration} min={15} max={300} onChange={e => set("duration", +e.target.value)} />
        </F>
      </div>

      <F label="Meeting Link" required>
        <input style={inp} value={form.meetingLink} onChange={e => set("meetingLink", e.target.value)} placeholder="https://meet.google.com/xxx-yyy-zzz" />
      </F>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <F label="Meeting ID (optional)">
          <input style={inp} value={form.meetingId} onChange={e => set("meetingId", e.target.value)} placeholder="123 456 7890" />
        </F>
        <F label="Password (optional)">
          <input style={inp} value={form.password} onChange={e => set("password", e.target.value)} placeholder="••••••" />
        </F>
      </div>

      <F label="Description (optional)">
        <textarea style={{ ...inp, minHeight: 68, resize: "vertical" }} value={form.description} onChange={e => set("description", e.target.value)} placeholder="Topics to be covered, preparation notes…" />
      </F>

      {/* Course & batch info */}
      <div style={{ background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px", marginBottom: 14 }}>
        <p style={{ fontSize: 11, color: T.muted, margin: "0 0 4px" }}>This class will be for:</p>
        <p style={{ fontSize: 13, fontWeight: 600, color: T.txt, margin: 0 }}>
          {course?.courseName} — {course?.batch || "All Students"} ({course?.students || 0} enrolled)
        </p>
      </div>

      {/* Notify toggle */}
      <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 20 }}>
        <div onClick={() => set("notifyStudents", !form.notifyStudents)}
          style={{ width: 36, height: 20, borderRadius: 10, background: form.notifyStudents ? "#22C55E" : T.border, position: "relative", transition: "background 0.2s", cursor: "pointer" }}>
          <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: form.notifyStudents ? 18 : 2, transition: "left 0.2s" }} />
        </div>
        <span style={{ fontSize: 12, color: T.sub }}>Notify students via notification</span>
      </label>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <Btn label="Cancel" ghost onClick={onClose} />
        <Btn label={saving ? "Saving…" : isEdit ? "Update Class" : "Schedule Class"} disabled={saving} onClick={handleSubmit} />
      </div>
    </ModalWrap>
  )
}

/* ═══════════════════════════════════════════════════════════════
   VIEW MODAL
═══════════════════════════════════════════════════════════════ */
function ViewModal({ cls, onClose, onEdit }) {
  const sm = STATUS_META[cls.status] || STATUS_META.scheduled
  const pm = pMeta(cls.platform)

  const copyLink = () => { navigator.clipboard?.writeText(cls.meetingLink); alert("Link copied!") }

  return (
    <ModalWrap title="Class Details" onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: sm.color, background: sm.bg, padding: "3px 10px", borderRadius: 6 }}>{sm.label}</span>
        <span style={{ fontSize: 11, color: pm.color }}>{pm.label}</span>
      </div>

      <p style={{ fontSize: 18, fontWeight: 700, color: T.txt, margin: "0 0 16px" }}>{cls.title}</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Date",       value: fmtDate(cls.scheduledAt) },
          { label: "Time",       value: fmtTime(cls.scheduledAt) },
          { label: "Duration",   value: `${cls.duration} minutes` },
          { label: "Course",     value: `${cls.courseName} (${cls.courseCode})` },
          { label: "Batch",      value: cls.batch || "All" },
          { label: "Students",   value: cls.students?.length || 0 },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: T.inner, borderRadius: 8, padding: "10px 12px", border: `1px solid ${T.border}` }}>
            <p style={{ fontSize: 10, color: T.muted, margin: "0 0 3px" }}>{label}</p>
            <p style={{ fontSize: 13, color: T.txt, fontWeight: 500, margin: 0 }}>{value}</p>
          </div>
        ))}
      </div>

      {cls.meetingLink && (
        <div style={{ background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
          <p style={{ fontSize: 10, color: T.muted, margin: "0 0 6px" }}>Meeting Link</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <a href={cls.meetingLink} target="_blank" rel="noreferrer"
              style={{ flex: 1, fontSize: 12, color: "#3B82F6", textDecoration: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {cls.meetingLink}
            </a>
            <button onClick={copyLink} style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, display: "flex" }}><Copy size={13} /></button>
            <a href={cls.meetingLink} target="_blank" rel="noreferrer" style={{ color: T.muted, display: "flex" }}><ExternalLink size={13} /></a>
          </div>
        </div>
      )}

      {(cls.meetingId || cls.password) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {cls.meetingId && (
            <div style={{ background: T.inner, borderRadius: 8, padding: "10px 12px", border: `1px solid ${T.border}` }}>
              <p style={{ fontSize: 10, color: T.muted, margin: "0 0 3px" }}>Meeting ID</p>
              <p style={{ fontSize: 13, color: T.txt, margin: 0, fontFamily: "monospace" }}>{cls.meetingId}</p>
            </div>
          )}
          {cls.password && (
            <div style={{ background: T.inner, borderRadius: 8, padding: "10px 12px", border: `1px solid ${T.border}` }}>
              <p style={{ fontSize: 10, color: T.muted, margin: "0 0 3px" }}>Password</p>
              <p style={{ fontSize: 13, color: T.txt, margin: 0, fontFamily: "monospace" }}>{cls.password}</p>
            </div>
          )}
        </div>
      )}

      {cls.description && (
        <div style={{ background: T.inner, borderRadius: 8, padding: "12px 14px", marginBottom: 16, border: `1px solid ${T.border}` }}>
          <p style={{ fontSize: 11, color: T.muted, margin: "0 0 6px" }}>Description</p>
          <p style={{ fontSize: 13, color: T.sub, lineHeight: 1.6, margin: 0 }}>{cls.description}</p>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {cls.status !== "cancelled" && cls.status !== "completed" && (
          <a href={cls.meetingLink} target="_blank" rel="noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "#22C55E", color: "#000", borderRadius: 9, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
            <Play size={13} /> Join Class
          </a>
        )}
        <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
          {cls.status === "scheduled" && <Btn label="Edit" ghost onClick={onEdit} />}
          <Btn label="Close" ghost onClick={onClose} />
        </div>
      </div>
    </ModalWrap>
  )
}

/* ═══════════════════════════════════════════════════════════════
   SHARED PRIMITIVES
═══════════════════════════════════════════════════════════════ */
function ModalWrap({ title, children, onClose, wide }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 24, width: "100%", maxWidth: wide ? 660 : 540, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: T.txt, margin: 0 }}>{title}</p>
          <button onClick={onClose} style={{ background: T.inner, border: `1px solid ${T.border}`, borderRadius: 7, padding: 5, cursor: "pointer", color: T.sub, display: "flex" }}>
            <X size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function IBtn({ icon, onClick, title, danger }) {
  const [h, setH] = useState(false)
  return (
    <button onClick={onClick} title={title} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ background: h ? (danger ? "rgba(239,68,68,0.15)" : T.inner) : "transparent", border: "none", borderRadius: 6, padding: 5, cursor: "pointer", color: h ? (danger ? "#ef4444" : T.txt) : T.sub, display: "flex" }}>
      {icon}
    </button>
  )
}

function Btn({ label, onClick, ghost, disabled }) {
  const [h, setH] = useState(false)
  return (
    <button onClick={onClick} disabled={disabled} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ padding: "8px 18px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1,
        background: ghost ? (h ? T.inner : "transparent") : (h ? "#e5e7eb" : "#fff"),
        color: ghost ? T.sub : "#000", border: ghost ? `1px solid ${T.border}` : "none" }}>
      {label}
    </button>
  )
}

function EmptyState({ icon, title, desc }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px", color: T.muted }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 14, opacity: 0.3 }}>{icon}</div>
      <p style={{ fontSize: 15, fontWeight: 600, color: T.sub, marginBottom: 6 }}>{title}</p>
      <p style={{ fontSize: 13, color: T.muted, maxWidth: 320, margin: "0 auto" }}>{desc}</p>
    </div>
  )
}
