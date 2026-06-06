import React, { useState, useEffect, useCallback } from "react"
import useAppStore from "../store/useAppStore"
import { getCourses, getAttendanceRoster } from "../services/api"

// ── API helpers (internal marks) ───────────────────────────────────────────────
const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000"
async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { headers: { "Content-Type": "application/json" }, ...opts })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || `Error ${res.status}`) }
  return res.json()
}

// ── Icons ──────────────────────────────────────────────────────────────────────
const UserIcon = () => (
  <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </svg>
)
const BackIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
)
const PlusIcon = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)
const TrashIcon = () => (
  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
)
const EditIcon = () => (
  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)
const CloseIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
const AwardIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
  </svg>
)
const SearchIcon = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)
const ChevronIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
)
const RefreshIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
)

// ── Helpers ────────────────────────────────────────────────────────────────────
function getInitials(name = "") {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "??"
}
const AVATAR_COLORS = [
  "#227e44","#1d6fa8","#7c3aed","#c2410c","#0e7490",
  "#be185d","#065f46","#92400e","#1e40af","#5b21b6",
]
function avatarColor(name = "") {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}
function pct(marks, maxMarks) { return maxMarks ? Math.min(100, Math.round((marks / maxMarks) * 100)) : 0 }
function gradeLabel(p) {
  if (p >= 90) return { label: "A+", color: "#4ade80" }
  if (p >= 80) return { label: "A",  color: "#a3e635" }
  if (p >= 70) return { label: "B",  color: "#facc15" }
  if (p >= 60) return { label: "C",  color: "#fb923c" }
  return             { label: "D",  color: "#f87171" }
}

// ── Spinner ────────────────────────────────────────────────────────────────────
function Spinner({ size = 28 }) {
  return (
    <div style={{ width: size, height: size, border: "2px solid #2D2D2D", borderTopColor: "#227e44", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
  )
}

// ── Student Card ───────────────────────────────────────────────────────────────
function StudentCard({ student, onClick }) {
  const color = avatarColor(student.name)
  return (
    <button
      onClick={() => onClick(student)}
      style={{ background: "#1c1c1c", border: "1px solid #2D2D2D" }}
      className="flex flex-col items-center gap-3 p-5 rounded-2xl cursor-pointer transition-all duration-200 hover:border-neutral-500 hover:bg-neutral-800/60 hover:-translate-y-0.5 hover:shadow-lg w-full text-left"
    >
      <div style={{ background: color, width: 52, height: 52, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
        {getInitials(student.name)}
      </div>
      <div className="text-center min-w-0 w-full">
        <p className="text-white font-semibold text-sm truncate">{student.name}</p>
        <p className="text-neutral-500 text-xs mt-0.5">{student.id}</p>
      </div>
    </button>
  )
}

// ── Add / Edit Mark Modal ──────────────────────────────────────────────────────
function MarkModal({ student, editMark, onSave, onClose }) {
  const [form, setForm] = useState({
    category: editMark?.category || "",
    marks:    editMark?.marks !== undefined ? String(editMark.marks) : "",
    maxMarks: editMark?.maxMarks !== undefined ? String(editMark.maxMarks) : "100",
    courseId: editMark?.courseId || student.courses?.[0]?.courseId || "",
    remarks:  editMark?.remarks || "",
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")

  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const inputStyle = {
    background: "#111", border: "1px solid #2D2D2D", borderRadius: 10,
    color: "#fff", width: "100%", padding: "9px 12px", fontSize: 13, outline: "none",
  }

  async function handleSave() {
    if (!form.category.trim()) { setErr("Category is required"); return }
    if (form.marks === "" || isNaN(Number(form.marks))) { setErr("Marks must be a number"); return }
    if (Number(form.marks) < 0) { setErr("Marks cannot be negative"); return }
    setErr(""); setSaving(true)
    try { await onSave(form) }
    catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backdropFilter: "blur(6px)", background: "rgba(0,0,0,0.75)" }}>
      <div style={{ background: "#1c1c1c", border: "1px solid #2D2D2D", borderRadius: 20, width: "100%", maxWidth: 480, padding: 32 }} className="shadow-2xl mx-4">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-white font-semibold text-base">
            {editMark ? "Edit Mark" : "Add Mark"}&nbsp;—&nbsp;<span className="text-neutral-400">{student.name}</span>
          </h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-white transition"><CloseIcon /></button>
        </div>

        <div className="flex flex-col gap-4">
          {/* Course selector */}
          {student.courses?.length > 0 && (
            <div>
              <label className="text-neutral-400 text-xs font-medium mb-1.5 block">Course</label>
              <div style={{ position: "relative" }}>
                <select
                  value={form.courseId}
                  onChange={e => setF("courseId", e.target.value)}
                  style={{ ...inputStyle, appearance: "none", paddingRight: 32 }}
                >
                  <option value="">— Select course —</option>
                  {student.courses.map(c => (
                    <option key={c.courseId} value={c.courseId}>{c.courseId} — {c.courseName}</option>
                  ))}
                </select>
                <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#9CA3AF" }}>
                  <ChevronIcon />
                </span>
              </div>
            </div>
          )}

          {/* Category — free text, teacher decides */}
          <div>
            <label className="text-neutral-400 text-xs font-medium mb-1.5 block">
              Category <span className="text-red-400">*</span>
            </label>
            <input
              value={form.category}
              onChange={e => setF("category", e.target.value)}
              placeholder="e.g. Quiz 1, Assignment 2, Mid-term, Attendance…"
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = "#227e44")}
              onBlur={e => (e.target.style.borderColor = "#2D2D2D")}
            />
          </div>

          {/* Marks / Max */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-neutral-400 text-xs font-medium mb-1.5 block">Marks Obtained <span className="text-red-400">*</span></label>
              <input
                type="number" min="0"
                value={form.marks}
                onChange={e => setF("marks", e.target.value)}
                placeholder="0"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = "#227e44")}
                onBlur={e => (e.target.style.borderColor = "#2D2D2D")}
              />
            </div>
            <div className="flex-1">
              <label className="text-neutral-400 text-xs font-medium mb-1.5 block">Max Marks</label>
              <input
                type="number" min="1"
                value={form.maxMarks}
                onChange={e => setF("maxMarks", e.target.value)}
                placeholder="100"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = "#227e44")}
                onBlur={e => (e.target.style.borderColor = "#2D2D2D")}
              />
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="text-neutral-400 text-xs font-medium mb-1.5 block">Remarks (optional)</label>
            <input
              value={form.remarks}
              onChange={e => setF("remarks", e.target.value)}
              placeholder="Any notes…"
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = "#227e44")}
              onBlur={e => (e.target.style.borderColor = "#2D2D2D")}
            />
          </div>

          {err && <p style={{ color: "#f87171", fontSize: 12 }}>{err}</p>}

          <div className="flex gap-3 mt-1">
            <button onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: 10, background: "rgba(255,255,255,0.05)", color: "#9CA3AF", fontSize: 13, border: "1px solid #2D2D2D" }} className="hover:text-white transition">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: "10px", borderRadius: 10, background: "linear-gradient(135deg,#227e44,#1a6337)", color: "#fff", fontSize: 13, fontWeight: 600, border: "none" }} className="hover:opacity-90 transition disabled:opacity-50">
              {saving ? "Saving…" : editMark ? "Update Mark" : "Save Mark"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Student Detail View ────────────────────────────────────────────────────────
function StudentDetailView({ student, teacherId, onBack, showToast }) {
  const [marks, setMarks]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [showModal, setShowModal]   = useState(false)
  const [editMark, setEditMark]     = useState(null)
  const [delConfirm, setDelConfirm] = useState(null)

  const color = avatarColor(student.name)

  const loadMarks = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch(`/api/internal-marks/${student.id}${teacherId ? `?teacherId=${teacherId}` : ""}`)
      setMarks(data)
    } catch { setMarks([]) }
    finally { setLoading(false) }
  }, [student.id, teacherId])

  useEffect(() => { loadMarks() }, [loadMarks])

  async function handleSave(form) {
    const course = student.courses?.find(c => c.courseId === form.courseId) || {}
    const payload = {
      studentId: student.id, studentName: student.name,
      courseId: form.courseId, courseName: course.courseName || "",
      teacherId, category: form.category.trim(),
      marks: Number(form.marks), maxMarks: Number(form.maxMarks) || 100,
      remarks: form.remarks,
    }
    if (editMark) {
      await apiFetch(`/api/internal-marks/${editMark._id}`, { method: "PUT", body: JSON.stringify(payload) })
      showToast("Mark updated")
    } else {
      await apiFetch("/api/internal-marks", { method: "POST", body: JSON.stringify(payload) })
      showToast("Mark added")
    }
    setShowModal(false); setEditMark(null); loadMarks()
  }

  async function handleDelete(id) {
    await apiFetch(`/api/internal-marks/${id}`, { method: "DELETE" })
    setDelConfirm(null); showToast("Mark deleted", "error"); loadMarks()
  }

  const totalMarks = marks.length
  const avgPct     = marks.length ? Math.round(marks.reduce((s, m) => s + pct(m.marks, m.maxMarks), 0) / marks.length) : null
  const bestMark   = marks.length ? marks.reduce((b, m) => pct(m.marks, m.maxMarks) > pct(b.marks, b.maxMarks) ? m : b) : null

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid #2D2D2D", padding: "8px 12px", borderRadius: 10, display: "flex", alignItems: "center", gap: 6, color: "#9CA3AF", fontSize: 13 }} className="hover:text-white hover:bg-neutral-800 transition">
          <BackIcon /> Back
        </button>
        <div className="flex items-center gap-3">
          <div style={{ background: color, width: 42, height: 42, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#fff" }}>
            {getInitials(student.name)}
          </div>
          <div>
            <h2 className="text-white font-semibold text-base">{student.name}</h2>
            <p className="text-neutral-500 text-xs">{student.id}</p>
          </div>
        </div>
        <div className="ml-auto">
          <button
            onClick={() => { setEditMark(null); setShowModal(true) }}
            style={{ background: "linear-gradient(135deg,#227e44,#1a6337)", border: "none", padding: "9px 18px", borderRadius: 10, display: "flex", alignItems: "center", gap: 6, color: "#fff", fontSize: 13, fontWeight: 600 }}
            className="hover:opacity-90 transition"
          >
            <PlusIcon /> Add Mark
          </button>
        </div>
      </div>

      {/* Stats */}
      {marks.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Total Entries", value: totalMarks,                      color: "#818cf8" },
            { label: "Avg Score",     value: avgPct != null ? `${avgPct}%` : "—", color: avgPct >= 60 ? "#4ade80" : "#f87171" },
            { label: "Best Category", value: bestMark ? bestMark.category : "—", color: "#facc15", small: true },
          ].map(s => (
            <div key={s.label} style={{ background: "#1c1c1c", border: "1px solid #2D2D2D", borderRadius: 14, padding: "14px 16px" }}>
              <p className="text-neutral-500 text-xs mb-1">{s.label}</p>
              <p style={{ color: s.color, fontWeight: 700, fontSize: s.small ? 13 : 20, lineHeight: 1.2 }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Marks list */}
      <div style={{ background: "#1c1c1c", border: "1px solid #2D2D2D", borderRadius: 16, padding: "20px" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold text-sm flex items-center gap-2"><AwardIcon /> Internal Marks</h3>
          <span style={{ fontSize: 11, color: "#9CA3AF" }}>{marks.length} entr{marks.length === 1 ? "y" : "ies"}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10"><Spinner /></div>
        ) : marks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
            <AwardIcon />
            <p className="text-neutral-500 text-sm mt-1">No marks added yet</p>
            <p className="text-neutral-600 text-xs">Click "Add Mark" to begin entering internal marks</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {marks.map(m => {
              const p = pct(m.marks, m.maxMarks)
              const g = gradeLabel(p)
              return (
                <div key={m._id} style={{ background: "#111", border: "1px solid #2D2D2D", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }} className="hover:border-neutral-600 transition group">
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: `${g.color}18`, border: `2px solid ${g.color}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ color: g.color, fontWeight: 800, fontSize: 13 }}>{g.label}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-white font-semibold text-sm">{m.category}</p>
                      {m.courseId && (
                        <span style={{ background: "rgba(34,126,68,0.12)", color: "#4ade80", border: "1px solid rgba(34,126,68,0.25)", fontSize: 10, padding: "1px 7px", borderRadius: 20 }}>
                          {m.courseId}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 5, background: "#2D2D2D", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${p}%`, height: "100%", background: g.color, borderRadius: 3, transition: "width 0.6s ease" }} />
                      </div>
                      <span style={{ color: "#9CA3AF", fontSize: 11, whiteSpace: "nowrap" }}>{m.marks}/{m.maxMarks} ({p}%)</span>
                    </div>
                    {m.remarks && <p className="text-neutral-500 text-xs mt-1 truncate">{m.remarks}</p>}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => { setEditMark(m); setShowModal(true) }} style={{ padding: "6px 8px", borderRadius: 8, background: "rgba(255,255,255,0.05)", color: "#9CA3AF" }} className="hover:text-white hover:bg-neutral-700 transition">
                      <EditIcon />
                    </button>
                    <button onClick={() => setDelConfirm(m._id)} style={{ padding: "6px 8px", borderRadius: 8, background: "rgba(248,113,113,0.08)", color: "#f87171" }} className="hover:bg-red-500/20 transition">
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showModal && (
        <MarkModal student={student} editMark={editMark} onSave={handleSave} onClose={() => { setShowModal(false); setEditMark(null) }} />
      )}

      {delConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backdropFilter: "blur(6px)", background: "rgba(0,0,0,0.75)" }}>
          <div style={{ background: "#1c1c1c", border: "1px solid #2D2D2D", borderRadius: 20, padding: "32px 40px", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }} className="shadow-2xl mx-4">
            <p className="text-white font-medium text-center">Delete this mark entry?<br/><span className="text-neutral-400 text-sm font-normal">This cannot be undone.</span></p>
            <div className="flex gap-3">
              <button onClick={() => setDelConfirm(null)} style={{ padding: "8px 24px", borderRadius: 20, background: "rgba(255,255,255,0.06)", color: "#9CA3AF", fontSize: 13, border: "1px solid #2D2D2D" }} className="hover:text-white transition">Cancel</button>
              <button onClick={() => handleDelete(delConfirm)} style={{ padding: "8px 24px", borderRadius: 20, background: "#ef4444", color: "#fff", fontSize: 13, fontWeight: 600, border: "none" }} className="hover:bg-red-600 transition">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function InternalMarksPage() {
  const { user, showToast } = useAppStore()

  // Courses — fetched the same way as Attendance page
  const [courses, setCourses]               = useState([])
  const [coursesLoading, setCoursesLoading] = useState(true)
  const [coursesError, setCoursesError]     = useState(false)
  const [selectedCourse, setSelectedCourse] = useState("")

  // Students — fetched from roster, exactly like Attendance page
  const [students, setStudents]             = useState([])
  const [studentsLoading, setStudentsLoading] = useState(false)
  const [studentsError, setStudentsError]   = useState(false)

  const [selectedStudent, setSelectedStudent] = useState(null)
  const [search, setSearch]                   = useState("")

  // ── Fetch courses (same as Attendance) ──────────────────────────────────────
  const fetchCourses = useCallback(() => {
    setCoursesLoading(true)
    setCoursesError(false)
    getCourses()
      .then(data => {
        setCourses(data)
        if (data.length > 0) setSelectedCourse(data[0].courseId)
      })
      .catch(() => setCoursesError(true))
      .finally(() => setCoursesLoading(false))
  }, [])

  useEffect(() => { fetchCourses() }, [fetchCourses])

  // ── Fetch students from roster (same source as Attendance page) ─────────────
  const fetchStudents = useCallback((courseId) => {
    if (!courseId) return
    setStudentsLoading(true)
    setStudentsError(false)
    getAttendanceRoster(courseId)
      .then(data => {
        // getAttendanceRoster returns { students: [{id, name, status, notes}] }
        const list = (data.students || []).map(s => ({
          id:   s.id,
          name: s.name,
          // attach course info so the mark modal can show it
          courses: [{ courseId, courseName: courses.find(c => c.courseId === courseId)?.courseName || courseId }],
        }))
        setStudents(list)
      })
      .catch(() => setStudentsError(true))
      .finally(() => setStudentsLoading(false))
  }, [courses])

  useEffect(() => {
    if (selectedCourse) fetchStudents(selectedCourse)
  }, [selectedCourse, fetchStudents])

  // Enrich students with all their courses across the full course list
  // (same pattern as Attendance — just attaching context for the mark modal)
  const enrichedStudents = students.map(s => {
  const allCourses = courses
    .filter(c =>
      Array.isArray(c.students) &&
      c.students.some(cs => cs.id === s.id)
    )
    .map(c => ({
      courseId: c.courseId,
      courseName: c.courseName
    }));

  return {
    ...s,
    allCourses
  };
});

  const filtered = enrichedStudents.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.id.toLowerCase().includes(search.toLowerCase())
  )

  // ── Detail view ─────────────────────────────────────────────────────────────
  if (selectedStudent) {
    return (
      <>
        <StudentDetailView
          student={selectedStudent}
          teacherId={user?._id}
          onBack={() => setSelectedStudent(null)}
          showToast={showToast}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </>
    )
  }

  // ── List view ───────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Page Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-white text-xl font-bold">Internal Marks</h1>
          <p className="text-neutral-500 text-sm mt-0.5">
            Select a course, then click a student to manage their internal marks
          </p>
        </div>
        <button
          onClick={fetchCourses}
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid #2D2D2D", padding: "7px 14px", borderRadius: 10, display: "flex", alignItems: "center", gap: 6, color: "#9CA3AF", fontSize: 13 }}
          className="hover:text-white hover:bg-neutral-800 transition"
        >
          <RefreshIcon /> Refresh
        </button>
      </div>

      {/* Course selector — same UX as Attendance page */}
      <div style={{ background: "#1c1c1c", border: "1px solid #2D2D2D", borderRadius: 14, padding: "16px 18px", marginBottom: 20 }}>
        <label className="text-neutral-400 text-xs font-medium mb-2 block">Select Course</label>
        {coursesLoading ? (
          <div className="flex items-center gap-2 py-1"><Spinner size={20} /><span className="text-neutral-500 text-sm">Loading courses…</span></div>
        ) : coursesError ? (
          <div className="flex items-center gap-3">
            <span className="text-red-400 text-sm">Failed to load courses.</span>
            <button onClick={fetchCourses} className="text-neutral-400 hover:text-white text-sm transition">Retry</button>
          </div>
        ) : courses.length === 0 ? (
          <p className="text-neutral-500 text-sm">No active courses found.</p>
        ) : (
          <div style={{ position: "relative" }}>
            <select
              value={selectedCourse}
              onChange={e => { setSelectedCourse(e.target.value); setSearch("") }}
              style={{ background: "#111", border: "1px solid #2D2D2D", borderRadius: 10, color: "#fff", width: "100%", padding: "10px 36px 10px 12px", fontSize: 13, outline: "none", appearance: "none" }}
            >
              {courses.map(c => (
                <option key={c.courseId} value={c.courseId}>
                  {c.courseId} — {c.courseName}  ({c.students || 0} students)
                </option>
              ))}
            </select>
            <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#9CA3AF" }}>
              <ChevronIcon />
            </span>
          </div>
        )}
      </div>

      {/* Search */}
      {students.length > 0 && (
        <div style={{ background: "#1c1c1c", border: "1px solid #2D2D2D", borderRadius: 12, display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", marginBottom: 20 }}>
          <span className="text-neutral-500"><SearchIcon /></span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search students by name or ID…"
            style={{ background: "transparent", border: "none", outline: "none", color: "#fff", flex: 1, fontSize: 13 }}
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-neutral-500 hover:text-white transition"><CloseIcon /></button>
          )}
        </div>
      )}

      {/* Student count badge */}
      {!studentsLoading && students.length > 0 && (
        <div className="flex items-center justify-between mb-4">
          <p className="text-neutral-500 text-xs">
            Showing {filtered.length} of {students.length} student{students.length !== 1 ? "s" : ""}
            {search ? ` matching "${search}"` : ""}
          </p>
          <span style={{ background: "rgba(34,126,68,0.12)", border: "1px solid rgba(34,126,68,0.25)", borderRadius: 20, padding: "3px 12px", color: "#4ade80", fontSize: 11, fontWeight: 600 }}>
            {students.length} enrolled
          </span>
        </div>
      )}

      {/* States */}
      {studentsLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Spinner size={32} />
          <p className="text-neutral-500 text-sm">Loading students…</p>
        </div>
      ) : studentsError ? (
        <div style={{ background: "#1c1c1c", border: "1px solid #2D2D2D", borderRadius: 16 }} className="flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-red-400 text-sm font-medium">Failed to load students</p>
          <button onClick={() => fetchStudents(selectedCourse)} style={{ padding: "7px 16px", borderRadius: 10, background: "rgba(255,255,255,0.06)", color: "#9CA3AF", fontSize: 13, border: "1px solid #2D2D2D" }} className="hover:text-white transition">
            Retry
          </button>
        </div>
      ) : !selectedCourse ? (
        <div style={{ background: "#1c1c1c", border: "1px solid #2D2D2D", borderRadius: 16 }} className="flex flex-col items-center justify-center py-16 gap-2">
          <p className="text-neutral-500 text-sm">Select a course above to see students</p>
        </div>
      ) : filtered.length === 0 && students.length > 0 ? (
        <div style={{ background: "#1c1c1c", border: "1px solid #2D2D2D", borderRadius: 16 }} className="flex flex-col items-center justify-center py-16 gap-2">
          <p className="text-neutral-400 text-sm font-medium">No students match your search</p>
          <button onClick={() => setSearch("")} className="text-neutral-500 hover:text-neutral-300 text-xs transition">Clear search</button>
        </div>
      ) : students.length === 0 ? (
        <div style={{ background: "#1c1c1c", border: "1px solid #2D2D2D", borderRadius: 16 }} className="flex flex-col items-center justify-center py-16 gap-2">
          <UserIcon />
          <p className="text-neutral-400 text-sm font-medium">No students enrolled in this course</p>
          <p className="text-neutral-600 text-xs">Enroll students via the Courses page</p>
        </div>
      ) : (
        /* Horizontal card grid */
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
          {filtered.map(s => (
            <StudentCard key={s.id} student={s} onClick={setSelectedStudent} />
          ))}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
