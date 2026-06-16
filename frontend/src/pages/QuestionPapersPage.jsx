import React, { useState, useEffect, useMemo, useCallback } from "react"
import {
  Search, Plus, Filter, Eye, Edit2, Trash2, Download,
  FileText, Clock, BookOpen, ChevronDown, X, CheckCircle,
  AlertCircle, BookMarked, Printer,
} from "lucide-react"
import { T, useC } from "../components/UI"
import useAppStore from "../store/useAppStore"
import { useCourses } from "../hooks/useData"
import * as api from "../services/api"

/* ─── helpers ─── */
const EXAM_TYPES = ["Quiz", "Mid Semester", "End Semester"]

const EXAM_COLORS = {
  "Quiz":         { color: "#06B6D4", bg: "rgba(6,182,212,0.12)",  border: "rgba(6,182,212,0.3)"  },
  "Mid Semester": { color: "#F59E0B", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)" },
  "End Semester": { color: "#EF4444", bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.3)"  },
}

const STATUS_COLORS = {
  "Published": { color: "#22C55E", bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.3)"  },
  "Draft":     { color: "#9CA3AF", bg: "rgba(156,163,175,0.10)", border: "rgba(156,163,175,0.25)" },
}

function fmt(d) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

const EMPTY_FORM = {
  title: "", courseId: "", semester: "", examType: "Mid Semester",
  duration: "", totalMarks: "", instructions: "", content: "", status: "Draft",
}

/* ─── Field wrapper ─── */
function F({ label, children, required, C }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, color: C.sub, marginBottom: 5, fontWeight: 500 }}>
        {label}{required && <span style={{ color: "#ef4444" }}> *</span>}
      </label>
      {children}
    </div>
  )
}

/* ─── Input ─── */
function Inp({ value, onChange, placeholder, type = "text", C, style }) {
  return (
    <input
      type={type} value={value} onChange={onChange} placeholder={placeholder}
      style={{
        width: "100%", background: C.inner, border: `1px solid ${C.border}`,
        borderRadius: 8, padding: "9px 12px", color: C.txt, fontSize: 13,
        outline: "none", ...style,
      }}
    />
  )
}

/* ─── Select ─── */
function Sel({ value, onChange, children, C, style }) {
  return (
    <select
      value={value} onChange={onChange}
      style={{
        width: "100%", background: C.inner, border: `1px solid ${C.border}`,
        borderRadius: 8, padding: "9px 12px", color: C.txt, fontSize: 13,
        outline: "none", ...style,
      }}
    >
      {children}
    </select>
  )
}

/* ─── Textarea ─── */
function Txt({ value, onChange, placeholder, rows = 4, C }) {
  return (
    <textarea
      value={value} onChange={onChange} placeholder={placeholder} rows={rows}
      style={{
        width: "100%", background: C.inner, border: `1px solid ${C.border}`,
        borderRadius: 8, padding: "9px 12px", color: C.txt, fontSize: 13,
        outline: "none", resize: "vertical", fontFamily: "inherit",
      }}
    />
  )
}

/* ─── Badge ─── */
function Chip({ label, color, bg, border }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, letterSpacing: "0.06em",
      padding: "3px 9px", borderRadius: 5,
      background: bg, color, border: `1px solid ${border}`,
      textTransform: "uppercase", whiteSpace: "nowrap",
    }}>{label}</span>
  )
}

/* ─── Icon Button ─── */
function IBtn({ icon: Icon, onClick, title, color = "#9CA3AF", hoverColor = "#fff" }) {
  const [h, sH] = useState(false)
  return (
    <button
      onClick={onClick} title={title}
      onMouseEnter={() => sH(true)} onMouseLeave={() => sH(false)}
      style={{
        background: "none", border: "none", cursor: "pointer",
        color: h ? hoverColor : color, padding: 6, borderRadius: 6,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "color 0.15s",
      }}
    >
      <Icon size={15} />
    </button>
  )
}

/* ─── PDF Download ─── */
function downloadPDF(paper) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>${paper.title}</title>
  <style>
    body { font-family: 'Times New Roman', serif; margin: 40px; color: #000; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 20px; }
    .header h1 { font-size: 16px; margin: 0 0 6px; text-transform: uppercase; }
    .header h2 { font-size: 14px; margin: 0 0 4px; }
    .meta { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 16px; }
    .instructions { border: 1px solid #000; padding: 10px; margin-bottom: 20px; font-size: 12px; }
    .instructions strong { display: block; margin-bottom: 4px; }
    .content { font-size: 13px; white-space: pre-wrap; line-height: 1.7; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${paper.courseName || paper.courseId} ${paper.courseCode ? `(${paper.courseCode})` : ""}</h1>
    <h2>${paper.examType} Examination</h2>
    <div style="font-size:12px">Semester: ${paper.semester || "—"} &nbsp;|&nbsp; ${paper.title}</div>
  </div>
  <div class="meta">
    <span>Duration: ${paper.duration} minutes</span>
    <span>Total Marks: ${paper.totalMarks}</span>
    <span>Date: ${fmt(paper.publishedAt || paper.createdAt)}</span>
  </div>
  ${paper.instructions ? `<div class="instructions"><strong>Instructions:</strong>${paper.instructions}</div>` : ""}
  <div class="content">${paper.content || "(No content)"}</div>
</body>
</html>`

  const blob = new Blob([html], { type: "text/html" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  a.href = url
  a.download = `${paper.title.replace(/\s+/g, "_")}.html`
  a.click()
  URL.revokeObjectURL(url)
}

function printPaper(paper) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>${paper.title}</title>
  <style>
    body { font-family: 'Times New Roman', serif; margin: 40px; color: #000; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 20px; }
    .header h1 { font-size: 16px; margin: 0 0 6px; text-transform: uppercase; }
    .header h2 { font-size: 14px; margin: 0 0 4px; }
    .meta { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 16px; }
    .instructions { border: 1px solid #000; padding: 10px; margin-bottom: 20px; font-size: 12px; }
    .instructions strong { display: block; margin-bottom: 4px; }
    .content { font-size: 13px; white-space: pre-wrap; line-height: 1.7; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${paper.courseName || paper.courseId} ${paper.courseCode ? `(${paper.courseCode})` : ""}</h1>
    <h2>${paper.examType} Examination</h2>
    <div style="font-size:12px">Semester: ${paper.semester || "—"} &nbsp;|&nbsp; ${paper.title}</div>
  </div>
  <div class="meta">
    <span>Duration: ${paper.duration} minutes</span>
    <span>Total Marks: ${paper.totalMarks}</span>
    <span>Date: ${fmt(paper.publishedAt || paper.createdAt)}</span>
  </div>
  ${paper.instructions ? `<div class="instructions"><strong>Instructions:</strong>${paper.instructions}</div>` : ""}
  <div class="content">${paper.content || "(No content)"}</div>
</body>
</html>`

  const w = window.open("", "_blank")
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => { w.print() }, 300)
}

/* ─── View Modal ─── */
function ViewModal({ paper, onClose, C }) {
  const ec = EXAM_COLORS[paper.examType] || {}
  const sc = STATUS_COLORS[paper.status] || {}
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 60,
      background: "rgba(0,0,0,0.7)", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 24,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 16, width: "100%", maxWidth: 760,
        maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px", borderBottom: `1px solid ${C.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        }}>
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <Chip label={paper.examType} {...ec} />
              <Chip label={paper.status} {...sc} />
            </div>
            <h2 style={{ color: C.txt, fontSize: 18, fontWeight: 700, margin: 0 }}>{paper.title}</h2>
            <p style={{ color: C.sub, fontSize: 13, marginTop: 4 }}>
              {paper.courseName || paper.courseId} {paper.courseCode ? `(${paper.courseCode})` : ""}
              {paper.semester ? ` · Sem ${paper.semester}` : ""}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => downloadPDF(paper)} title="Download"
              style={{ background: C.inner, border: `1px solid ${C.border}`, borderRadius: 8,
                color: C.sub, cursor: "pointer", padding: "7px 12px", display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
              <Download size={13} /> Download
            </button>
            <button onClick={() => printPaper(paper)} title="Print"
              style={{ background: C.inner, border: `1px solid ${C.border}`, borderRadius: 8,
                color: C.sub, cursor: "pointer", padding: "7px 12px", display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
              <Printer size={13} /> Print
            </button>
            <button onClick={onClose}
              style={{ background: "none", border: "none", cursor: "pointer", color: C.sub }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Meta strip */}
        <div style={{
          padding: "12px 24px", borderBottom: `1px solid ${C.border}`,
          display: "flex", gap: 32, background: C.inner, flexWrap: "wrap",
        }}>
          <div><p style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>DURATION</p>
            <p style={{ fontSize: 13, color: C.txt, fontWeight: 600 }}>{paper.duration} min</p></div>
          <div><p style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>TOTAL MARKS</p>
            <p style={{ fontSize: 13, color: C.txt, fontWeight: 600 }}>{paper.totalMarks}</p></div>
          <div><p style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>PUBLISHED</p>
            <p style={{ fontSize: 13, color: C.txt, fontWeight: 600 }}>{fmt(paper.publishedAt || paper.createdAt)}</p></div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {paper.instructions && (
            <div style={{
              background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)",
              borderRadius: 10, padding: "12px 16px", marginBottom: 20,
            }}>
              <p style={{ fontSize: 11, color: "#F59E0B", fontWeight: 600, marginBottom: 6, textTransform: "uppercase" }}>Instructions</p>
              <p style={{ fontSize: 13, color: C.sub, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{paper.instructions}</p>
            </div>
          )}
          <div style={{ fontSize: 13, color: C.txt, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
            {paper.content || <span style={{ color: C.muted, fontStyle: "italic" }}>No content added.</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Create / Edit Modal ─── */
function PaperModal({ mode, form, setForm, courses, onSave, onClose, saving, C }) {
  const title = mode === "create" ? "Create Question Paper" : "Edit Question Paper"

  const inp = (field) => ({
    value: form[field],
    onChange: e => setForm(f => ({ ...f, [field]: e.target.value })),
    C,
  })

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 60,
      background: "rgba(0,0,0,0.75)", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 24,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 16, width: "100%", maxWidth: 720,
        maxHeight: "92vh", display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px", borderBottom: `1px solid ${C.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <h2 style={{ color: C.txt, fontSize: 16, fontWeight: 700, margin: 0 }}>{title}</h2>
          <button onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: C.sub }}>
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          <F label="Paper Title" required C={C}>
            <Inp {...inp("title")} placeholder="e.g. Unit 1 Quiz - Data Structures" />
          </F>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <F label="Course" required C={C}>
              <Sel value={form.courseId} onChange={e => setForm(f => ({ ...f, courseId: e.target.value }))} C={C}>
                <option value="">Select course</option>
                {courses.map(c => (
                  <option key={c.courseId || c._id} value={c.courseId || c._id}>
                    {c.courseName} {c.courseCode ? `(${c.courseCode})` : ""}
                  </option>
                ))}
              </Sel>
            </F>

            <F label="Semester" C={C}>
              <Inp {...inp("semester")} placeholder="e.g. 3, 5, Even 2024" />
            </F>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <F label="Exam Type" required C={C}>
              <Sel value={form.examType} onChange={e => setForm(f => ({ ...f, examType: e.target.value }))} C={C}>
                {EXAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </Sel>
            </F>

            <F label="Duration (minutes)" required C={C}>
              <Inp {...inp("duration")} type="number" placeholder="180" />
            </F>

            <F label="Total Marks" required C={C}>
              <Inp {...inp("totalMarks")} type="number" placeholder="100" />
            </F>
          </div>

          <F label="Instructions" C={C}>
            <Txt {...inp("instructions")}
              placeholder="1. All questions are compulsory.&#10;2. Attempt any 5 from Section B.&#10;..." rows={3} />
          </F>

          <F label="Question Paper Content" C={C}>
            <Txt {...inp("content")}
              placeholder={"Section A: Short Answer (20 Marks)\n\nQ1. Define data structure...\nQ2. Explain types of linked list...\n\nSection B: Long Answer (50 Marks)\n\nQ3. Explain sorting algorithms with examples...\n\n..."} rows={12} />
          </F>

          <F label="Status" C={C}>
            <div style={{ display: "flex", gap: 10 }}>
              {["Draft", "Published"].map(s => (
                <button key={s}
                  onClick={() => setForm(f => ({ ...f, status: s }))}
                  style={{
                    padding: "8px 18px", borderRadius: 8, cursor: "pointer",
                    fontSize: 12, fontWeight: 600, border: "1px solid",
                    ...(form.status === s
                      ? { background: T.accent, borderColor: T.accent, color: "#000" }
                      : { background: C.inner, borderColor: C.border, color: C.sub }),
                  }}>
                  {s}
                </button>
              ))}
            </div>
          </F>
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 24px", borderTop: `1px solid ${C.border}`,
          display: "flex", justifyContent: "flex-end", gap: 10,
        }}>
          <button onClick={onClose}
            style={{ padding: "9px 20px", borderRadius: 8, background: "none",
              border: `1px solid ${C.border}`, color: C.sub, cursor: "pointer", fontSize: 13 }}>
            Cancel
          </button>
          <button onClick={onSave} disabled={saving}
            style={{ padding: "9px 24px", borderRadius: 8,
              background: saving ? "#14532d" : T.accent, color: "#000",
              border: "none", cursor: saving ? "not-allowed" : "pointer",
              fontSize: 13, fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving…" : mode === "create" ? "Create Paper" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Paper Card ─── */
function PaperCard({ paper, onView, onEdit, onDelete, C }) {
  const ec = EXAM_COLORS[paper.examType] || {}
  const sc = STATUS_COLORS[paper.status] || {}
  return (
    <div style={{
      background: C.inner, border: `1px solid ${C.border}`,
      borderRadius: 12, padding: "16px 18px",
      display: "flex", flexDirection: "column", gap: 10,
      transition: "border-color 0.15s",
    }}>
      {/* Top row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
            <Chip label={paper.examType} {...ec} />
            <Chip label={paper.status} {...sc} />
          </div>
          <p style={{ color: C.txt, fontSize: 13, fontWeight: 600, lineHeight: 1.4,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {paper.title}
          </p>
        </div>
      </div>

      {/* Meta */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: C.muted, display: "flex", alignItems: "center", gap: 4 }}>
          <Clock size={11} /> {paper.duration} min
        </span>
        <span style={{ fontSize: 11, color: C.muted, display: "flex", alignItems: "center", gap: 4 }}>
          <FileText size={11} /> {paper.totalMarks} marks
        </span>
        <span style={{ fontSize: 11, color: C.muted }}>
          {fmt(paper.publishedAt || paper.createdAt)}
        </span>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 2, borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 2 }}>
        <IBtn icon={Eye}      onClick={() => onView(paper)}  title="View"         color={C.muted} hoverColor={T.accent} />
        <IBtn icon={Edit2}    onClick={() => onEdit(paper)}  title="Edit"         color={C.muted} hoverColor="#3B82F6" />
        <IBtn icon={Download} onClick={() => downloadPDF(paper)} title="Download" color={C.muted} hoverColor="#06B6D4" />
        <IBtn icon={Printer}  onClick={() => printPaper(paper)}  title="Print"    color={C.muted} hoverColor="#A78BFA" />
        <IBtn icon={Trash2}   onClick={() => onDelete(paper)} title="Delete"      color={C.muted} hoverColor="#EF4444" />
      </div>
    </div>
  )
}

/* ─── Main Page ─── */
export default function QuestionPapersPage() {
  const C = useC()
  const { courses } = useCourses()
  const { showToast } = useAppStore()

  const [papers,    setPapers]   = useState([])
  const [stats,     setStats]    = useState({ total: 0, mid: 0, end: 0, draft: 0 })
  const [loading,   setLoading]  = useState(true)
  const [search,    setSearch]   = useState("")
  const [typeFilter,setTypeF]    = useState("All")
  const [statusF,   setStatusF]  = useState("All")
  const [courseF,   setCourseF]  = useState("All")
  const [modal,     setModal]    = useState(null) // "create" | "edit" | "view" | "delete"
  const [target,    setTarget]   = useState(null)
  const [form,      setForm]     = useState(EMPTY_FORM)
  const [saving,    setSaving]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [docs, s] = await Promise.all([
        api.getQuestionPapers(),
        api.getQuestionPaperStats(),
      ])
      setPapers(Array.isArray(docs) ? docs : [])
      setStats(s || { total: 0, mid: 0, end: 0, draft: 0 })
    } catch (err) {
      showToast("Failed to load question papers", "error")
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { load() }, [load])

  /* ── filtered list ── */
  const filtered = useMemo(() => {
    let list = papers
    if (typeFilter !== "All")   list = list.filter(p => p.examType === typeFilter)
    if (statusF !== "All")      list = list.filter(p => p.status   === statusF)
    if (courseF !== "All")      list = list.filter(p => p.courseId === courseF)
    if (search.trim()) {
      const s = search.toLowerCase()
      list = list.filter(p =>
        p.title?.toLowerCase().includes(s) ||
        p.courseName?.toLowerCase().includes(s) ||
        p.courseCode?.toLowerCase().includes(s)
      )
    }
    return list
  }, [papers, typeFilter, statusF, courseF, search])

  /* ── group by course ── */
  const grouped = useMemo(() => {
    const map = {}
    filtered.forEach(p => {
      const key = p.courseId || "unknown"
      if (!map[key]) map[key] = { courseId: key, courseName: p.courseName || key, courseCode: p.courseCode || "", papers: [] }
      map[key].papers.push(p)
    })
    return Object.values(map)
  }, [filtered])

  /* ── unique courses in papers ── */
  const paperCourses = useMemo(() => {
    const seen = {}
    papers.forEach(p => { if (p.courseId) seen[p.courseId] = p.courseName || p.courseId })
    return Object.entries(seen).map(([id, name]) => ({ id, name }))
  }, [papers])

  /* ── handlers ── */
  const openCreate = () => { setForm(EMPTY_FORM); setModal("create") }
  const openEdit   = (p) => {
    setTarget(p)
    setForm({
      title: p.title, courseId: p.courseId, semester: p.semester || "",
      examType: p.examType, duration: p.duration, totalMarks: p.totalMarks,
      instructions: p.instructions || "", content: p.content || "", status: p.status,
    })
    setModal("edit")
  }
  const openView   = (p) => { setTarget(p); setModal("view") }
  const openDelete = (p) => { setTarget(p); setModal("delete") }
  const closeModal = ()  => { setModal(null); setTarget(null) }

  const handleSave = async () => {
    if (!form.title.trim())    return showToast("Title is required", "error")
    if (!form.courseId)        return showToast("Course is required", "error")
    if (!form.examType)        return showToast("Exam type is required", "error")
    if (!form.duration)        return showToast("Duration is required", "error")
    if (!form.totalMarks)      return showToast("Total marks is required", "error")

    setSaving(true)
    try {
      if (modal === "create") {
        const created = await api.createQuestionPaper(form)
        setPapers(prev => [created, ...prev])
        showToast("Question paper created!")
      } else {
        const updated = await api.updateQuestionPaper(target._id, form)
        setPapers(prev => prev.map(p => p._id === updated._id ? updated : p))
        showToast("Question paper updated!")
      }
      // refresh stats
      const s = await api.getQuestionPaperStats()
      setStats(s)
      closeModal()
    } catch (err) {
      showToast(err.message || "Failed to save", "error")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!target) return
    try {
      await api.deleteQuestionPaper(target._id)
      setPapers(prev => prev.filter(p => p._id !== target._id))
      const s = await api.getQuestionPaperStats()
      setStats(s)
      showToast("Paper deleted")
      closeModal()
    } catch (err) {
      showToast(err.message || "Failed to delete", "error")
    }
  }

  /* ─── Stats cards config ─── */
  const statCards = [
    { label: "Total Papers",        value: stats.total, icon: <FileText size={16} />,    color: T.accent },
    { label: "Mid Semester Papers", value: stats.mid,   icon: <BookOpen size={16} />,    color: "#F59E0B" },
    { label: "End Semester Papers", value: stats.end,   icon: <BookMarked size={16} />,  color: "#EF4444" },
    { label: "Draft Papers",        value: stats.draft, icon: <AlertCircle size={16} />, color: "#9CA3AF" },
  ]

  /* ─── Render ─── */
  return (
    <div style={{ color: C.txt }}>

      {/* Page header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Question Papers</h1>
          <p style={{ fontSize: 13, color: C.sub, marginTop: 4 }}>
            Create, manage, and organize exam papers by course
          </p>
        </div>
        <button onClick={openCreate}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            background: T.accent, color: "#000", border: "none",
            borderRadius: 10, padding: "10px 18px",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>
          <Plus size={16} /> Create Paper
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        {statCards.map(sc => (
          <div key={sc.label} style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 12, padding: "18px 20px",
            display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          }}>
            <div>
              <p style={{ fontSize: 11, color: C.sub, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>{sc.label}</p>
              <p style={{ fontSize: 28, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{sc.value}</p>
            </div>
            <div style={{
              width: 34, height: 34, borderRadius: 8, background: C.inner,
              display: "flex", alignItems: "center", justifyContent: "center", color: sc.color,
            }}>{sc.icon}</div>
          </div>
        ))}
      </div>

      {/* Search + Filters */}
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 12, padding: "14px 18px", marginBottom: 24,
        display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center",
      }}>
        {/* Search */}
        <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.muted }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search papers, courses…"
            style={{
              width: "100%", background: C.inner, border: `1px solid ${C.border}`,
              borderRadius: 8, padding: "8px 10px 8px 32px",
              color: C.txt, fontSize: 13, outline: "none",
            }}
          />
        </div>

        {/* Type filter */}
        <select value={typeFilter} onChange={e => setTypeF(e.target.value)}
          style={{ background: C.inner, border: `1px solid ${C.border}`, borderRadius: 8,
            padding: "8px 12px", color: C.txt, fontSize: 12, outline: "none" }}>
          <option value="All">All Types</option>
          {EXAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        {/* Status filter */}
        <select value={statusF} onChange={e => setStatusF(e.target.value)}
          style={{ background: C.inner, border: `1px solid ${C.border}`, borderRadius: 8,
            padding: "8px 12px", color: C.txt, fontSize: 12, outline: "none" }}>
          <option value="All">All Status</option>
          <option value="Published">Published</option>
          <option value="Draft">Draft</option>
        </select>

        {/* Course filter */}
        <select value={courseF} onChange={e => setCourseF(e.target.value)}
          style={{ background: C.inner, border: `1px solid ${C.border}`, borderRadius: 8,
            padding: "8px 12px", color: C.txt, fontSize: 12, outline: "none", maxWidth: 200 }}>
          <option value="All">All Courses</option>
          {paperCourses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: C.muted }}>Loading papers…</div>
      ) : grouped.length === 0 ? (
        <div style={{
          textAlign: "center", padding: 60,
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
        }}>
          <FileText size={40} style={{ color: C.muted, marginBottom: 12 }} />
          <p style={{ color: C.sub, fontSize: 15, fontWeight: 500 }}>No question papers found</p>
          <p style={{ color: C.muted, fontSize: 13, marginTop: 6 }}>
            {search || typeFilter !== "All" || statusF !== "All" || courseF !== "All"
              ? "Try adjusting your filters"
              : "Click \"Create Paper\" to add your first question paper"}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {grouped.map(group => (
            <div key={group.courseId}
              style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>

              {/* Course header */}
              <div style={{
                padding: "16px 20px", borderBottom: `1px solid ${C.border}`,
                display: "flex", alignItems: "center", gap: 12, background: C.inner,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 9, background: "rgba(34,197,94,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <BookOpen size={17} color={T.accent} />
                </div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: C.txt, margin: 0 }}>
                    {group.courseName}
                    {group.courseCode && <span style={{ color: C.muted, fontSize: 12, marginLeft: 8 }}>({group.courseCode})</span>}
                  </p>
                  <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>
                    {group.papers.length} paper{group.papers.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {/* Paper cards grid */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: 14, padding: 16,
              }}>
                {group.papers.map(p => (
                  <PaperCard
                    key={p._id} paper={p} C={C}
                    onView={openView} onEdit={openEdit} onDelete={openDelete}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {(modal === "create" || modal === "edit") && (
        <PaperModal
          mode={modal} form={form} setForm={setForm}
          courses={courses} onSave={handleSave} onClose={closeModal}
          saving={saving} C={C}
        />
      )}

      {modal === "view" && target && (
        <ViewModal paper={target} onClose={closeModal} C={C} />
      )}

      {modal === "delete" && target && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={closeModal}>
          <div onClick={e => e.stopPropagation()} style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
            padding: 32, maxWidth: 380, width: "100%", textAlign: "center",
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14, background: "rgba(239,68,68,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px",
            }}>
              <Trash2 size={22} color="#EF4444" />
            </div>
            <p style={{ color: C.txt, fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Delete Paper?</p>
            <p style={{ color: C.sub, fontSize: 13, marginBottom: 24 }}>
              "{target.title}" will be permanently removed.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={closeModal}
                style={{ padding: "9px 24px", borderRadius: 9, background: "none",
                  border: `1px solid ${C.border}`, color: C.sub, cursor: "pointer", fontSize: 13 }}>
                Cancel
              </button>
              <button onClick={handleDelete}
                style={{ padding: "9px 24px", borderRadius: 9, background: "#EF4444",
                  border: "none", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
