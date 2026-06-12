import React, { useState, useEffect, useCallback, useMemo } from "react"
import useAppStore from "../store/useAppStore"
import { getCourses } from "../services/api"

// ── API helpers ────────────────────────────────────────────────────────────────
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000"
async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.message || `Error ${res.status}`)
  }
  return res.json()
}

// ── Icons ──────────────────────────────────────────────────────────────────────
const SearchIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)
const CloseIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
const BackIcon = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
)
const RefreshIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
)
const EditIcon = () => (
  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)
const SaveIcon = () => (
  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)
const CancelIcon = () => (
  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
const UsersIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)
const BookIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>
)
const LayersIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
    <polygon points="12 2 2 7 12 12 22 7 12 2"/>
    <polyline points="2 17 12 22 22 17"/>
    <polyline points="2 12 12 17 22 12"/>
  </svg>
)

// ── Spinner ────────────────────────────────────────────────────────────────────
function Spinner({ size = 28 }) {
  return (
    <div style={{
      width: size, height: size,
      border: "2px solid #2D2D2D",
      borderTopColor: "#227e44",
      borderRadius: "50%",
      animation: "spin 0.7s linear infinite",
    }} />
  )
}

// ── TYPE badge colors ──────────────────────────────────────────────────────────
const TYPE_COLORS = {
  ASSIGNMENT: { bg: "rgba(59,130,246,0.15)",  color: "#60a5fa", label: "Assignment" },
  QUIZ:       { bg: "rgba(168,85,247,0.15)",  color: "#c084fc", label: "Quiz" },
  EXAM:       { bg: "rgba(239,68,68,0.15)",   color: "#f87171", label: "Exam" },
  CODING:     { bg: "rgba(34,197,94,0.15)",   color: "#4ade80", label: "Coding" },
  PROJECT:    { bg: "rgba(245,158,11,0.15)",  color: "#fbbf24", label: "Project" },
}

// ── Batch chip colors (cycles through a palette) ──────────────────────────────
const BATCH_PALETTE = [
  { bg: "rgba(74,222,128,0.15)",  border: "rgba(74,222,128,0.35)",  color: "#4ade80"  },
  { bg: "rgba(96,165,250,0.15)",  border: "rgba(96,165,250,0.35)",  color: "#60a5fa"  },
  { bg: "rgba(251,191,36,0.15)",  border: "rgba(251,191,36,0.35)",  color: "#fbbf24"  },
  { bg: "rgba(192,132,252,0.15)", border: "rgba(192,132,252,0.35)", color: "#c084fc"  },
  { bg: "rgba(251,113,133,0.15)", border: "rgba(251,113,133,0.35)", color: "#fb7185"  },
  { bg: "rgba(45,212,191,0.15)",  border: "rgba(45,212,191,0.35)",  color: "#2dd4bf"  },
]
function batchColor(idx) { return BATCH_PALETTE[idx % BATCH_PALETTE.length] }

// ── Inline editable cell ───────────────────────────────────────────────────────
function EditableCell({ value, maxValue, onSave, placeholder = "Add" }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal]         = useState(value !== null && value !== undefined ? String(value) : "")
  const [saving, setSaving]   = useState(false)

  function startEdit() { setVal(value !== null && value !== undefined ? String(value) : ""); setEditing(true) }

  async function commitSave() {
    if (val.trim() === "" || isNaN(Number(val)) || Number(val) < 0) { setEditing(false); return }
    setSaving(true)
    try { await onSave(Number(val)) } catch {}
    finally { setSaving(false); setEditing(false) }
  }

  function handleKey(e) {
    if (e.key === "Enter") commitSave()
    if (e.key === "Escape") setEditing(false)
  }

  if (editing) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 90 }}>
        <input autoFocus type="number" min="0" max={maxValue} value={val}
          onChange={e => setVal(e.target.value)} onKeyDown={handleKey}
          style={{ width: 54, padding: "3px 6px", borderRadius: 6, background: "#111",
            border: "1px solid #227e44", color: "#fff", fontSize: 12, outline: "none" }}
        />
        <button onClick={commitSave} disabled={saving}
          style={{ background: "rgba(34,126,68,0.18)", border: "none", borderRadius: 5,
            padding: "3px 5px", cursor: "pointer", color: "#4ade80" }} title="Save">
          {saving ? <Spinner size={10} /> : <SaveIcon />}
        </button>
        <button onClick={() => setEditing(false)}
          style={{ background: "rgba(255,255,255,0.05)", border: "none", borderRadius: 5,
            padding: "3px 5px", cursor: "pointer", color: "#9CA3AF" }} title="Cancel">
          <CancelIcon />
        </button>
      </div>
    )
  }

  const display = value !== null && value !== undefined ? String(value) : null
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer",
      minWidth: 60, justifyContent: "center" }} onClick={startEdit} title="Click to edit">
      {display !== null
        ? <span style={{ color: "#fff", fontSize: 13 }}>{display}{maxValue ? `/${maxValue}` : ""}</span>
        : <span style={{ color: "#4D4D4D", fontSize: 12 }}>{placeholder}</span>
      }
      <span style={{ color: "#2D5A3D", opacity: 0.7 }}><EditIcon /></span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COURSE GROUP CARD  (one per unique course name, with batch chips inside)
// ─────────────────────────────────────────────────────────────────────────────
function CourseGroupCard({ courseName, batches, onSelectBatch }) {
  // batches = array of course objects that share this courseName
  const totalStudents = batches.reduce((s, c) => {
    return s + (Array.isArray(c.students) ? c.students.length : (c.students || 0))
  }, 0)
  const hasBatches = batches.some(c => c.batch && c.batch.trim())

  return (
    <div style={{
      background: "#1c1c1c",
      border: "1px solid #2D2D2D",
      borderRadius: 16,
      padding: "18px 18px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 14,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 11, flexShrink: 0,
          background: "rgba(34,126,68,0.12)", border: "1px solid rgba(34,126,68,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center", color: "#4ade80",
        }}>
          <BookIcon />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: "0 0 3px",
            lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {courseName}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, color: "#9CA3AF", background: "rgba(156,163,175,0.08)",
              border: "1px solid #2D2D2D", padding: "2px 8px", borderRadius: 5 }}>
              {batches[0]?.courseCode || batches[0]?.courseId}
            </span>
            {batches[0]?.sem && batches[0].sem !== "N/A" && (
              <span style={{ fontSize: 10, color: "#6B7280" }}>{batches[0].sem}</span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#6B7280", flexShrink: 0 }}>
          <UsersIcon />
          <span style={{ fontSize: 11 }}>{totalStudents}</span>
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: "1px solid #222" }} />

      {/* Batch chips / single button */}
      {hasBatches ? (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
            <span style={{ color: "#4D7055" }}><LayersIcon /></span>
            <span style={{ fontSize: 10, color: "#6B7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Batches
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {batches.map((course, i) => {
              const bc = batchColor(i)
              const sc = Array.isArray(course.students) ? course.students.length : (course.students || 0)
              return (
                <button
                  key={course._id || course.courseId}
                  onClick={() => onSelectBatch(course)}
                  style={{
                    background: bc.bg, border: `1px solid ${bc.border}`,
                    borderRadius: 10, padding: "8px 14px",
                    cursor: "pointer", textAlign: "left",
                    display: "flex", flexDirection: "column", gap: 2,
                    transition: "all 0.15s",
                    minWidth: 80,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.2)"; e.currentTarget.style.transform = "translateY(-1px)" }}
                  onMouseLeave={e => { e.currentTarget.style.filter = ""; e.currentTarget.style.transform = "" }}
                  title={`Open ${course.batch} batch marks`}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: bc.color }}>
                    {course.batch}
                  </span>
                  <span style={{ fontSize: 10, color: "#6B7280" }}>
                    {sc} student{sc !== 1 ? "s" : ""}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        /* No batches defined — single "View Marks" button */
        <button
          onClick={() => onSelectBatch(batches[0])}
          style={{
            background: "rgba(34,126,68,0.1)", border: "1px solid rgba(34,126,68,0.25)",
            borderRadius: 10, padding: "9px 14px", cursor: "pointer",
            color: "#4ade80", fontSize: 13, fontWeight: 600,
            width: "100%", textAlign: "center",
            transition: "all 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(34,126,68,0.18)" }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(34,126,68,0.1)" }}
        >
          View Marks →
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function InternalMarksPage() {
  const { user, showToast } = useAppStore()

  // "grid" = course group grid, "table" = student marks table
  const [view, setView]                 = useState("grid")
  const [selectedCourse, setSelectedCourse] = useState(null)

  // Grid state
  const [courses, setCourses]           = useState([])
  const [coursesLoading, setCoursesLoading] = useState(true)
  const [coursesError, setCoursesError] = useState(false)
  const [gridSearch, setGridSearch]     = useState("")

  // Table state
  const [tableData, setTableData]       = useState(null)
  const [tableLoading, setTableLoading] = useState(false)
  const [tableError, setTableError]     = useState(false)
  const [tableSearch, setTableSearch]   = useState("")

  // ── Fetch courses ─────────────────────────────────────────────────────────
  const fetchCourses = useCallback(() => {
    setCoursesLoading(true)
    setCoursesError(false)
    getCourses()
      .then(data => setCourses(data))
      .catch(() => setCoursesError(true))
      .finally(() => setCoursesLoading(false))
  }, [])

  useEffect(() => { fetchCourses() }, [fetchCourses])

  // ── Fetch marks table ─────────────────────────────────────────────────────
  const fetchTable = useCallback((courseId) => {
    if (!courseId) return
    setTableLoading(true)
    setTableError(false)
    const teacherParam = user?._id ? `?teacherId=${user._id}` : ""
    apiFetch(`/api/internal-marks/course-table/${courseId}${teacherParam}`)
      .then(data => setTableData(data))
      .catch(() => setTableError(true))
      .finally(() => setTableLoading(false))
  }, [user])

  // ── Open a specific batch/course ─────────────────────────────────────────
  function openBatch(course) {
    setSelectedCourse(course)
    setTableData(null)
    setTableSearch("")
    setView("table")
    fetchTable(course.courseId)
  }

  // ── Back to grid ──────────────────────────────────────────────────────────
  function backToGrid() {
    setView("grid")
    setSelectedCourse(null)
  }

  // ── Save free mark ────────────────────────────────────────────────────────
  async function saveFreeMarkForStudent(student, category, marks) {
    const row = tableData?.rows?.find(r => r.studentId === student.studentId)
    const existing = row?.freeMarks?.[category]

    if (existing?._id) {
      await apiFetch(`/api/internal-marks/${existing._id}`, {
        method: "PUT",
        body: JSON.stringify({ marks, maxMarks: existing.maxMarks }),
      })
    } else {
      await apiFetch("/api/internal-marks", {
        method: "POST",
        body: JSON.stringify({
          studentId:   student.studentId,
          studentName: student.studentName,
          courseId:    selectedCourse?.courseId,
          courseName:  selectedCourse?.courseName,
          teacherId:   user?._id,
          category,
          marks,
          maxMarks: 100,
        }),
      })
    }
    showToast("Marks saved")
    fetchTable(selectedCourse.courseId)
  }

  // ── Group courses by courseName for grid ──────────────────────────────────
  const courseGroups = useMemo(() => {
    const filtered = courses.filter(c => {
      if (!gridSearch.trim()) return true
      const s = gridSearch.toLowerCase()
      return (
        c.courseName?.toLowerCase().includes(s) ||
        c.courseId?.toLowerCase().includes(s) ||
        c.batch?.toLowerCase().includes(s) ||
        c.sem?.toLowerCase().includes(s)
      )
    })

    // Group by courseName
    const map = {}
    for (const c of filtered) {
      const key = c.courseName?.trim() || c.courseId
      if (!map[key]) map[key] = []
      map[key].push(c)
    }

    // Sort batches within each group
    return Object.entries(map).map(([name, batches]) => ({
      courseName: name,
      batches: batches.sort((a, b) => (a.batch || "").localeCompare(b.batch || "")),
    }))
  }, [courses, gridSearch])

  // ── Table data ────────────────────────────────────────────────────────────
  const rows = tableData?.rows || []
  const filteredRows = rows.filter(r =>
    r.studentName.toLowerCase().includes(tableSearch.toLowerCase()) ||
    r.studentId.toLowerCase().includes(tableSearch.toLowerCase())
  )
  const assignmentCols = tableData?.assignmentCols || []
  const freeCategories = tableData?.categories || []

  // Shared styles
  const cellStyle = {
    padding: "10px 12px",
    borderBottom: "1px solid #1A1A1A",
    fontSize: 13, color: "#fff", whiteSpace: "nowrap",
  }
  const headerCellStyle = {
    ...cellStyle,
    fontSize: 10, fontWeight: 700,
    textTransform: "uppercase", letterSpacing: "0.06em",
    color: "#9CA3AF", background: "#141414",
    borderBottom: "1px solid #2D2D2D",
    position: "sticky", top: 0, zIndex: 2,
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GRID VIEW
  // ══════════════════════════════════════════════════════════════════════════
  if (view === "grid") {
    return (
      <div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-white text-xl font-bold">Internal Marks</h1>
            <p className="text-neutral-500 text-sm mt-0.5">
              Select a course — batches are shown as chips inside each card
            </p>
          </div>
          <button onClick={fetchCourses}
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid #2D2D2D",
              padding: "7px 14px", borderRadius: 10, display: "flex", alignItems: "center",
              gap: 6, color: "#9CA3AF", fontSize: 13, cursor: "pointer" }}
            className="hover:text-white hover:bg-neutral-800 transition">
            <RefreshIcon /> Refresh
          </button>
        </div>

        {/* Search */}
        {!coursesLoading && courses.length > 0 && (
          <div style={{ background: "#1c1c1c", border: "1px solid #2D2D2D", borderRadius: 12,
            display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", marginBottom: 20 }}>
            <span className="text-neutral-500"><SearchIcon /></span>
            <input value={gridSearch} onChange={e => setGridSearch(e.target.value)}
              placeholder="Search by course name, ID, batch, or semester…"
              style={{ background: "transparent", border: "none", outline: "none",
                color: "#fff", flex: 1, fontSize: 13 }} />
            {gridSearch && (
              <button onClick={() => setGridSearch("")} className="text-neutral-500 hover:text-white transition">
                <CloseIcon />
              </button>
            )}
          </div>
        )}

        {/* States */}
        {coursesLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Spinner size={32} /><p className="text-neutral-500 text-sm">Loading courses…</p>
          </div>
        ) : coursesError ? (
          <div style={{ background: "#1c1c1c", border: "1px solid #2D2D2D", borderRadius: 16 }}
            className="flex flex-col items-center justify-center py-16 gap-3">
            <p style={{ color: "#f87171", fontSize: 14, fontWeight: 500 }}>Failed to load courses</p>
            <button onClick={fetchCourses}
              style={{ padding: "7px 16px", borderRadius: 10, background: "rgba(255,255,255,0.06)",
                color: "#9CA3AF", fontSize: 13, border: "1px solid #2D2D2D", cursor: "pointer" }}
              className="hover:text-white transition">Retry</button>
          </div>
        ) : courses.length === 0 ? (
          <div style={{ background: "#1c1c1c", border: "1px solid #2D2D2D", borderRadius: 16 }}
            className="flex flex-col items-center justify-center py-16 gap-2">
            <p className="text-neutral-400 text-sm font-medium">No courses found</p>
            <p className="text-neutral-600 text-xs">Add courses via the Course Management page</p>
          </div>
        ) : courseGroups.length === 0 ? (
          <div style={{ background: "#1c1c1c", border: "1px solid #2D2D2D", borderRadius: 16 }}
            className="flex flex-col items-center justify-center py-16 gap-2">
            <p className="text-neutral-400 text-sm font-medium">No courses match your search</p>
            <button onClick={() => setGridSearch("")}
              className="text-neutral-500 hover:text-neutral-300 text-xs transition">
              Clear search
            </button>
          </div>
        ) : (
          <>
            <p className="text-neutral-500 text-xs mb-4">
              {courseGroups.length} course{courseGroups.length !== 1 ? "s" : ""}
              {" "}({courses.length} section{courses.length !== 1 ? "s" : ""} total)
              {gridSearch ? ` matching "${gridSearch}"` : ""}
              {" · "}Click a batch chip to open student marks
            </p>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 16,
            }}>
              {courseGroups.map(group => (
                <CourseGroupCard
                  key={group.courseName}
                  courseName={group.courseName}
                  batches={group.batches}
                  onSelectBatch={openBatch}
                />
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TABLE VIEW
  // ══════════════════════════════════════════════════════════════════════════
  const batchLabel = selectedCourse?.batch ? `Batch ${selectedCourse.batch}` : ""

  return (
    <div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button onClick={backToGrid}
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid #2D2D2D",
              borderRadius: 10, padding: "7px 10px", cursor: "pointer",
              display: "flex", alignItems: "center", color: "#9CA3AF" }}
            className="hover:text-white hover:bg-neutral-800 transition" title="Back to courses">
            <BackIcon />
          </button>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h1 className="text-white text-xl font-bold">{selectedCourse?.courseName}</h1>
              {batchLabel && (
                <span style={{
                  fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 20,
                  background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.3)",
                  color: "#4ade80",
                }}>
                  {batchLabel}
                </span>
              )}
            </div>
            <p className="text-neutral-500 text-sm mt-0.5">
              {selectedCourse?.courseId}
              {selectedCourse?.sem && selectedCourse.sem !== "N/A" ? ` · ${selectedCourse.sem}` : ""}
              {" · "}Internal Marks
            </p>
          </div>
        </div>
        <button onClick={() => fetchTable(selectedCourse?.courseId)}
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid #2D2D2D",
            padding: "7px 14px", borderRadius: 10, display: "flex", alignItems: "center",
            gap: 6, color: "#9CA3AF", fontSize: 13, cursor: "pointer" }}
          className="hover:text-white hover:bg-neutral-800 transition">
          <RefreshIcon /> Refresh
        </button>
      </div>

      {/* Search */}
      {!tableLoading && rows.length > 0 && (
        <div style={{ background: "#1c1c1c", border: "1px solid #2D2D2D", borderRadius: 12,
          display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", marginBottom: 16 }}>
          <span className="text-neutral-500"><SearchIcon /></span>
          <input value={tableSearch} onChange={e => setTableSearch(e.target.value)}
            placeholder="Search students by name or ID…"
            style={{ background: "transparent", border: "none", outline: "none",
              color: "#fff", flex: 1, fontSize: 13 }} />
          {tableSearch && (
            <button onClick={() => setTableSearch("")} className="text-neutral-500 hover:text-white transition">
              <CloseIcon />
            </button>
          )}
        </div>
      )}

      {/* Count badge */}
      {!tableLoading && rows.length > 0 && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-neutral-500 text-xs">
            Showing {filteredRows.length} of {rows.length} student{rows.length !== 1 ? "s" : ""}
            {tableSearch ? ` matching "${tableSearch}"` : ""}
          </p>
          <span style={{ background: "rgba(34,126,68,0.12)", border: "1px solid rgba(34,126,68,0.25)",
            borderRadius: 20, padding: "3px 12px", color: "#4ade80", fontSize: 11, fontWeight: 600 }}>
            {rows.length} enrolled
          </span>
        </div>
      )}

      {/* States */}
      {tableLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Spinner size={32} /><p className="text-neutral-500 text-sm">Loading marks…</p>
        </div>
      ) : tableError ? (
        <div style={{ background: "#1c1c1c", border: "1px solid #2D2D2D", borderRadius: 16 }}
          className="flex flex-col items-center justify-center py-16 gap-3">
          <p style={{ color: "#f87171", fontSize: 14, fontWeight: 500 }}>Failed to load marks</p>
          <button onClick={() => fetchTable(selectedCourse?.courseId)}
            style={{ padding: "7px 16px", borderRadius: 10, background: "rgba(255,255,255,0.06)",
              color: "#9CA3AF", fontSize: 13, border: "1px solid #2D2D2D", cursor: "pointer" }}
            className="hover:text-white transition">Retry</button>
        </div>
      ) : rows.length === 0 ? (
        <div style={{ background: "#1c1c1c", border: "1px solid #2D2D2D", borderRadius: 16 }}
          className="flex flex-col items-center justify-center py-16 gap-2">
          <p className="text-neutral-400 text-sm font-medium">No students enrolled in this course</p>
          <p className="text-neutral-600 text-xs">Enroll students via the Courses page</p>
        </div>
      ) : filteredRows.length === 0 && tableSearch ? (
        <div style={{ background: "#1c1c1c", border: "1px solid #2D2D2D", borderRadius: 16 }}
          className="flex flex-col items-center justify-center py-16 gap-2">
          <p className="text-neutral-400 text-sm font-medium">No students match your search</p>
          <button onClick={() => setTableSearch("")}
            className="text-neutral-500 hover:text-neutral-300 text-xs transition">Clear search</button>
        </div>
      ) : (
        <div style={{ background: "#1c1c1c", border: "1px solid #2D2D2D", borderRadius: 16, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...headerCellStyle, width: 44, textAlign: "center" }}>S.No</th>
                  <th style={{ ...headerCellStyle, minWidth: 110 }}>Student ID</th>
                  <th style={{ ...headerCellStyle, minWidth: 160 }}>Student Name</th>

                  {/* Individual assignment columns */}
                  {assignmentCols.map(col => {
                    const tc = TYPE_COLORS[col.type] || TYPE_COLORS.ASSIGNMENT
                    return (
                      <th key={col.assignmentId} style={{ ...headerCellStyle, minWidth: 120, textAlign: "center" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                          <span style={{ background: tc.bg, color: tc.color, fontSize: 9,
                            padding: "1px 6px", borderRadius: 4, fontWeight: 700, letterSpacing: "0.05em" }}>
                            {tc.label}
                          </span>
                          <span style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 600,
                            maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis",
                            whiteSpace: "nowrap", textTransform: "none", letterSpacing: 0 }}>
                            {col.title}
                          </span>
                          <span style={{ fontSize: 9, color: "#4D4D4D", textTransform: "none", letterSpacing: 0 }}>
                            Max: {col.maxGrade}
                          </span>
                        </div>
                      </th>
                    )
                  })}

                  {/* Free-text mark columns */}
                  {freeCategories.map(cat => (
                    <th key={cat} style={{ ...headerCellStyle, minWidth: 110, textAlign: "center" }}>
                      {cat}
                    </th>
                  ))}

                  {/* Attendance */}
                  <th style={{ ...headerCellStyle, minWidth: 100, textAlign: "center" }}>
                    Attendance
                    <div style={{ fontSize: 9, color: "#4D7055", marginTop: 1, textTransform: "none", letterSpacing: 0 }}>
                      (synced)
                    </div>
                  </th>

                  {/* Total */}
                  <th style={{ ...headerCellStyle, minWidth: 100, textAlign: "center" }}>Total</th>

                  {/* Edit */}
                  <th style={{ ...headerCellStyle, width: 60, textAlign: "center" }}>Edit</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, idx) => (
                  <TableRow
                    key={row.studentId}
                    row={row} idx={idx}
                    assignmentCols={assignmentCols}
                    freeCategories={freeCategories}
                    onSaveFreeMark={(cat, marks) => saveFreeMarkForStudent(row, cat, marks)}
                    cellStyle={cellStyle}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div style={{ padding: "10px 16px", borderTop: "1px solid #1E1E1E",
            display: "flex", gap: 18, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "#4D4D4D" }}>
              <span style={{ color: "#4ade80" }}>●</span> Click Edit → then a free-mark cell to enter marks
            </span>
            <span style={{ fontSize: 11, color: "#4D4D4D" }}>
              <span style={{ color: "#60a5fa" }}>●</span> Assignment columns auto-sync from Assignments feature
            </span>
            <span style={{ fontSize: 11, color: "#4D4D4D" }}>
              <span style={{ color: "#9CA3AF" }}>—</span> Not yet graded / no submission
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Table Row ─────────────────────────────────────────────────────────────────
function TableRow({ row, idx, assignmentCols, freeCategories, onSaveFreeMark, cellStyle }) {
  const [editMode, setEditMode] = useState(false)

  return (
    <tr style={{
      background: editMode ? "rgba(34,126,68,0.04)" : (idx % 2 === 0 ? "transparent" : "#181818"),
      transition: "background 0.15s",
    }}>
      <td style={{ ...cellStyle, textAlign: "center", color: "#6B7280" }}>{row.sno}</td>
      <td style={{ ...cellStyle, color: "#9CA3AF", fontSize: 12 }}>{row.studentId}</td>
      <td style={{ ...cellStyle, fontWeight: 500 }}>{row.studentName}</td>

      {/* Per-assignment grade — "-" if not graded */}
      {assignmentCols.map(col => {
        const grade = row.assignmentGrades?.[col.assignmentId]
        return (
          <td key={col.assignmentId} style={{ ...cellStyle, textAlign: "center" }}>
            {grade !== null && grade !== undefined
              ? <span style={{ color: "#fff", fontSize: 13 }}>{grade}/{col.maxGrade}</span>
              : <span style={{ color: "#3D3D3D", fontSize: 13 }}>—</span>
            }
          </td>
        )
      })}

      {/* Free-text marks (editable in edit mode) */}
      {freeCategories.map(cat => {
        const d = row.freeMarks?.[cat]
        return (
          <td key={cat} style={{ ...cellStyle, textAlign: "center" }}>
            {editMode
              ? <EditableCell value={d?.marks ?? null} maxValue={d?.maxMarks ?? 100}
                  onSave={marks => onSaveFreeMark(cat, marks)} placeholder="Add" />
              : d
                ? <span style={{ color: "#fff", fontSize: 13 }}>{d.marks}/{d.maxMarks}</span>
                : <span style={{ color: "#3D3D3D", fontSize: 13 }}>—</span>
            }
          </td>
        )
      })}

      {/* Attendance */}
      <td style={{ ...cellStyle, textAlign: "center" }}>
        {row.attendance !== null && row.attendance !== undefined
          ? <span style={{
              color: row.attendance >= 75 ? "#4ade80" : row.attendance >= 60 ? "#fbbf24" : "#f87171",
              fontSize: 13,
            }}>{row.attendance}%</span>
          : <span style={{ color: "#3D3D3D", fontSize: 13 }}>—</span>
        }
      </td>

      {/* Total */}
      <td style={{ ...cellStyle, textAlign: "center" }}>
        {row.totalMax !== null && row.totalMax !== undefined
          ? <span style={{ color: "#4ade80", fontSize: 13, fontWeight: 600 }}>
              {Math.round(row.totalObtained)}/{row.totalMax}
            </span>
          : <span style={{ color: "#3D3D3D", fontSize: 13 }}>—</span>
        }
      </td>

      {/* Edit toggle */}
      <td style={{ ...cellStyle, textAlign: "center" }}>
        <button onClick={() => setEditMode(p => !p)}
          style={{
            padding: "5px 8px", borderRadius: 7,
            background: editMode ? "rgba(34,126,68,0.18)" : "rgba(255,255,255,0.04)",
            border: editMode ? "1px solid rgba(34,126,68,0.4)" : "1px solid #2D2D2D",
            color: editMode ? "#4ade80" : "#6B7280",
            cursor: "pointer", fontSize: 11,
            display: "inline-flex", alignItems: "center", gap: 4,
          }}
          title={editMode ? "Done editing" : "Edit marks"}>
          {editMode ? <SaveIcon /> : <EditIcon />}
          {editMode ? "Done" : "Edit"}
        </button>
      </td>
    </tr>
  )
}
