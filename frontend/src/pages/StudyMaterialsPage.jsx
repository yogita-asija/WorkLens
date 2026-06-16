import React, { useState, useMemo, useEffect, useRef, useCallback } from "react"
import {
  Search, Plus, Upload, Edit2, Trash2, X, Download, ExternalLink,
  BookOpen, FileText, File, Beaker, HelpCircle, Clock, Video,
  Filter, ChevronDown, Eye, FolderOpen, Link2, MoreVertical,
  CheckCircle, AlertCircle, Loader2, Tag, Calendar, Users,
} from "lucide-react"
import { useC } from "../components/UI"
import useAppStore from "../store/useAppStore"
import { useCourses } from "../hooks/useData"
import * as api from "../services/api"

// ── Constants ──────────────────────────────────────────────────────────────
const TYPES = [
  { value: "notes",          label: "Notes",              icon: FileText,  color: "#60a5fa", bg: "rgba(96,165,250,0.12)" },
  { value: "ppt",            label: "PPT",                icon: File,      color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  { value: "pdf",            label: "PDF",                icon: FileText,  color: "#f87171", bg: "rgba(248,113,113,0.12)" },
  { value: "lab_manual",     label: "Lab Manual",         icon: Beaker,    color: "#34d399", bg: "rgba(52,211,153,0.12)" },
  { value: "question_bank",  label: "Question Bank",      icon: HelpCircle,color: "#fbbf24", bg: "rgba(251,191,36,0.12)"  },
  { value: "previous_paper", label: "Previous Paper",     icon: Clock,     color: "#fb923c", bg: "rgba(251,146,60,0.12)"  },
  { value: "video_link",     label: "Video / Link",       icon: Video,     color: "#e879f9", bg: "rgba(232,121,249,0.12)" },
  { value: "other",          label: "Other",              icon: FolderOpen,color: "#94a3b8", bg: "rgba(148,163,184,0.12)" },
]
const TYPE_MAP = Object.fromEntries(TYPES.map(t => [t.value, t]))

const ACCEPT_MAP = {
  notes: ".pdf,.doc,.docx,.txt,.md",
  ppt:   ".ppt,.pptx,.pdf",
  pdf:   ".pdf",
  lab_manual:     ".pdf,.doc,.docx",
  question_bank:  ".pdf,.doc,.docx,.xlsx,.xls",
  previous_paper: ".pdf,.doc,.docx",
  other: "*",
}

function formatBytes(bytes) {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return "Today"
  if (d === 1) return "Yesterday"
  if (d < 7)  return `${d} days ago`
  if (d < 30) return `${Math.floor(d / 7)} wk ago`
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

// ── Form field helper ─────────────────────────────────────────────────────
function Field({ label, required, children, C }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.sub, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}{required && <span style={{ color: "#ef4444" }}> *</span>}
      </label>
      {children}
    </div>
  )
}

// ── Material Card ─────────────────────────────────────────────────────────
function MaterialCard({ material, onEdit, onDelete, onView, onDownload, C }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const typeInfo = TYPE_MAP[material.type] || TYPE_MAP.other
  const Icon = typeInfo.icon

  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: "16px 18px",
        position: "relative",
        transition: "border-color 0.2s, box-shadow 0.2s",
        cursor: "default",
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = typeInfo.color + "60"; e.currentTarget.style.boxShadow = `0 4px 20px ${typeInfo.color}15` }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = "none" }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
        {/* Type icon */}
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: typeInfo.bg, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={18} color={typeInfo.color} />
        </div>

        {/* Title + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: C.txt, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {material.title}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 5,
              background: typeInfo.bg, color: typeInfo.color, textTransform: "uppercase", letterSpacing: "0.04em",
            }}>{typeInfo.label}</span>
            {material.courseCode && (
              <span style={{ fontSize: 11, color: C.sub }}>{material.courseCode}</span>
            )}
          </div>
        </div>

        {/* Menu */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setMenuOpen(p => !p)}
            style={{ background: "none", border: "none", cursor: "pointer", color: C.sub, padding: "2px 4px", borderRadius: 6 }}
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <div
              style={{
                position: "absolute", right: 0, top: "100%", marginTop: 4, zIndex: 50,
                background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
                minWidth: 130, boxShadow: "0 8px 24px rgba(0,0,0,0.3)", overflow: "hidden",
              }}
              onMouseLeave={() => setMenuOpen(false)}
            >
              {[
                { label: "View", icon: Eye, action: () => { onView(material); setMenuOpen(false) } },
                ...(material.type === "video_link"
                  ? [{ label: "Open Link", icon: ExternalLink, action: () => { window.open(material.link, "_blank"); setMenuOpen(false) } }]
                  : [{ label: "Download", icon: Download, action: () => { onDownload(material); setMenuOpen(false) } }]
                ),
                { label: "Edit", icon: Edit2, action: () => { onEdit(material); setMenuOpen(false) } },
                { label: "Delete", icon: Trash2, action: () => { onDelete(material); setMenuOpen(false) }, danger: true },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={item.action}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, width: "100%",
                    padding: "9px 14px", background: "none", border: "none",
                    fontSize: 13, color: item.danger ? "#f87171" : C.txt, cursor: "pointer",
                    textAlign: "left",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = item.danger ? "rgba(248,113,113,0.1)" : "rgba(255,255,255,0.05)"}
                  onMouseLeave={e => e.currentTarget.style.background = "none"}
                >
                  <item.icon size={13} />{item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {material.description && (
        <p style={{ fontSize: 12, color: C.sub, marginBottom: 10, lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
          {material.description}
        </p>
      )}

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: C.muted, display: "flex", alignItems: "center", gap: 4 }}>
            <Calendar size={11} />{timeAgo(material.createdAt)}
          </span>
          {material.fileSize > 0 && (
            <span style={{ fontSize: 11, color: C.muted }}>{formatBytes(material.fileSize)}</span>
          )}
          {material.downloads > 0 && (
            <span style={{ fontSize: 11, color: C.muted, display: "flex", alignItems: "center", gap: 3 }}>
              <Download size={11} />{material.downloads}
            </span>
          )}
        </div>
        {/* Course chip */}
        <span style={{
          fontSize: 10, padding: "3px 8px", borderRadius: 20, maxWidth: 120,
          background: "rgba(34,197,94,0.1)", color: "#22c55e",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {material.courseName || "—"}
        </span>
      </div>
    </div>
  )
}

// ── Upload Modal ──────────────────────────────────────────────────────────
function UploadModal({ courses, editTarget, onClose, onSaved, C }) {
  const { user } = useAppStore()
  const isEdit = !!editTarget
  const [form, setForm] = useState({
    title: editTarget?.title || "",
    description: editTarget?.description || "",
    type: editTarget?.type || "notes",
    courseId: editTarget?.courseId || "",
    link: editTarget?.link || "",
    tags: (editTarget?.tags || []).join(", "),
  })
  const [file, setFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const fileRef = useRef()
  const isLink = form.type === "video_link"

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleFile = (f) => {
    if (!f) return
    if (f.size > 30 * 1024 * 1024) { setError("File too large (max 30 MB)"); return }
    setFile(f)
    setError("")
    if (!form.title) set("title", f.name.replace(/\.[^/.]+$/, ""))
  }

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const handleSave = async () => {
    if (!form.title.trim()) { setError("Title is required"); return }
    if (!form.courseId) { setError("Select a course"); return }
    if (!isLink && !file && !isEdit) { setError("Please attach a file"); return }
    if (isLink && !form.link.trim()) { setError("Please enter a link"); return }

    setSaving(true); setError("")
    try {
      let payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        type: form.type,
        courseId: form.courseId,
        link: form.link.trim(),
        tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
        teacherId: user?._id,
        teacherName: user?.name || "",
      }

      if (file) {
        // Read as base64
        const b64 = await new Promise((res, rej) => {
          const r = new FileReader()
          r.onload = () => res(r.result.split(",")[1])
          r.onerror = rej
          r.readAsDataURL(file)
        })
        payload.fileData = b64
        payload.fileName = file.name
        payload.fileSize = file.size
        payload.mimeType = file.type
      }

      if (isEdit) {
        await api.updateStudyMaterial(editTarget._id, payload)
      } else {
        await api.createStudyMaterial(payload)
      }
      onSaved()
    } catch (err) {
      setError(err.message || "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    width: "100%", background: C.inner, border: `1px solid ${C.border}`,
    borderRadius: 8, padding: "9px 12px", color: C.txt, fontSize: 13,
    outline: "none", transition: "border-color 0.2s",
  }
  const selectStyle = { ...inputStyle, cursor: "pointer" }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
      zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
      animation: "fadeIn 0.15s ease",
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
        padding: 28, width: "90%", maxWidth: 540,
        maxHeight: "90vh", overflowY: "auto",
        animation: "slideUp 0.2s ease",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: C.txt, margin: 0 }}>
              {isEdit ? "Edit Material" : "Upload Material"}
            </h2>
            <p style={{ fontSize: 12, color: C.sub, marginTop: 3 }}>
              {isEdit ? "Update details for this study material" : "Add new study material for your students"}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.sub, padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* Type selector */}
        <Field label="Material Type" required C={C}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
            {TYPES.map(t => {
              const Icon = t.icon
              const active = form.type === t.value
              return (
                <button key={t.value} onClick={() => set("type", t.value)} style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  padding: "8px 4px", borderRadius: 8, cursor: "pointer",
                  border: `1px solid ${active ? t.color : C.border}`,
                  background: active ? t.bg : C.inner,
                  transition: "all 0.15s",
                }}>
                  <Icon size={14} color={active ? t.color : C.sub} />
                  <span style={{ fontSize: 9, fontWeight: 600, color: active ? t.color : C.sub, textAlign: "center", lineHeight: 1.2 }}>
                    {t.label}
                  </span>
                </button>
              )
            })}
          </div>
        </Field>

        {/* Course */}
        <Field label="Course" required C={C}>
          <select value={form.courseId} onChange={e => set("courseId", e.target.value)} style={selectStyle}>
            <option value="">— Select course —</option>
            {courses.map(c => (
              <option key={c._id} value={c._id}>{c.courseCode} — {c.courseName}</option>
            ))}
          </select>
        </Field>

        {/* Title */}
        <Field label="Title" required C={C}>
          <input
            value={form.title} onChange={e => set("title", e.target.value)}
            placeholder="e.g. Unit 2 – Linked Lists Notes"
            style={inputStyle}
          />
        </Field>

        {/* Description */}
        <Field label="Description" C={C}>
          <textarea
            value={form.description} onChange={e => set("description", e.target.value)}
            placeholder="Brief description (optional)"
            rows={2}
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
          />
        </Field>

        {/* File upload or link */}
        {isLink ? (
          <Field label="Video / Resource Link" required C={C}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Link2 size={16} color={C.sub} style={{ flexShrink: 0 }} />
              <input
                value={form.link} onChange={e => set("link", e.target.value)}
                placeholder="https://youtube.com/..."
                style={{ ...inputStyle, flex: 1 }}
              />
            </div>
          </Field>
        ) : (
          <Field label={isEdit ? "Replace File (optional)" : "File"} required={!isEdit} C={C}>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? "#22c55e" : file ? "#22c55e88" : C.border}`,
                borderRadius: 10, padding: "20px 16px", textAlign: "center", cursor: "pointer",
                background: dragOver ? "rgba(34,197,94,0.07)" : file ? "rgba(34,197,94,0.04)" : C.inner,
                transition: "all 0.2s",
              }}
            >
              {file ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <CheckCircle size={16} color="#22c55e" />
                  <span style={{ fontSize: 13, color: "#22c55e", fontWeight: 500 }}>{file.name}</span>
                  <span style={{ fontSize: 11, color: C.muted }}>({formatBytes(file.size)})</span>
                  <button onClick={e => { e.stopPropagation(); setFile(null) }} style={{ background: "none", border: "none", cursor: "pointer", color: C.sub }}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div>
                  <Upload size={22} color={C.muted} style={{ margin: "0 auto 6px" }} />
                  <p style={{ fontSize: 12, color: C.sub, marginBottom: 2 }}>Drag & drop or click to browse</p>
                  <p style={{ fontSize: 11, color: C.muted }}>Max 30 MB · {ACCEPT_MAP[form.type]?.replace(/\*/g, "any") || "any"}</p>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept={ACCEPT_MAP[form.type]} style={{ display: "none" }}
              onChange={e => handleFile(e.target.files[0])} />
          </Field>
        )}

        {/* Tags */}
        <Field label="Tags (comma separated)" C={C}>
          <input
            value={form.tags} onChange={e => set("tags", e.target.value)}
            placeholder="e.g. unit-2, important, exam"
            style={inputStyle}
          />
        </Field>

        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "9px 12px", marginBottom: 14 }}>
            <AlertCircle size={14} color="#ef4444" />
            <span style={{ fontSize: 12, color: "#ef4444" }}>{error}</span>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
          <button onClick={onClose} style={{
            padding: "9px 18px", borderRadius: 8, border: `1px solid ${C.border}`,
            background: "none", color: C.sub, fontSize: 13, cursor: "pointer", fontWeight: 500,
          }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: "9px 22px", borderRadius: 8, border: "none",
            background: saving ? "#166534" : "#22c55e", color: "#000",
            fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", gap: 7, transition: "background 0.2s",
          }}>
            {saving && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Upload Material"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── View Modal ────────────────────────────────────────────────────────────
function ViewModal({ material, onClose, onDownload, C }) {
  const typeInfo = TYPE_MAP[material.type] || TYPE_MAP.other
  const Icon = typeInfo.icon
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
      zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
        padding: 28, width: "90%", maxWidth: 480,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: typeInfo.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon size={22} color={typeInfo.color} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: C.txt, marginBottom: 3 }}>{material.title}</h2>
            <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 5, background: typeInfo.bg, color: typeInfo.color }}>
              {typeInfo.label}
            </span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.sub }}>
            <X size={20} />
          </button>
        </div>

        {[
          ["Course", `${material.courseCode || ""} ${material.courseName || "—"}`],
          ["Description", material.description || "—"],
          ...(material.fileName ? [["File", `${material.fileName} (${formatBytes(material.fileSize)})`]] : []),
          ...(material.link ? [["Link", material.link]] : []),
          ["Uploaded", new Date(material.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })],
          ["Downloads", String(material.downloads || 0)],
          ...(material.tags?.length ? [["Tags", material.tags.join(", ")]] : []),
        ].map(([label, value]) => (
          <div key={label} style={{ display: "flex", gap: 12, marginBottom: 10, fontSize: 13 }}>
            <span style={{ color: C.sub, width: 90, flexShrink: 0, fontWeight: 500 }}>{label}</span>
            <span style={{ color: label === "Link" ? "#60a5fa" : C.txt, wordBreak: "break-all" }}>
              {label === "Link" ? (
                <a href={value} target="_blank" rel="noreferrer" style={{ color: "#60a5fa" }}>{value}</a>
              ) : value}
            </span>
          </div>
        ))}

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          {material.type === "video_link" && material.link ? (
            <a href={material.link} target="_blank" rel="noreferrer" style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "10px 0", borderRadius: 8, background: "#22c55e", color: "#000",
              fontSize: 13, fontWeight: 700, textDecoration: "none",
            }}>
              <ExternalLink size={15} /> Open Link
            </a>
          ) : (
            <button onClick={() => onDownload(material)} style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "10px 0", borderRadius: 8, background: "#22c55e", color: "#000",
              fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none",
            }}>
              <Download size={15} /> Download
            </button>
          )}
          <button onClick={onClose} style={{
            padding: "10px 18px", borderRadius: 8, border: `1px solid ${C.border}`,
            background: "none", color: C.sub, fontSize: 13, cursor: "pointer",
          }}>Close</button>
        </div>
      </div>
    </div>
  )
}

// ── Delete Confirm ─────────────────────────────────────────────────────────
function DeleteModal({ material, onClose, onConfirm, loading, C }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 26, width: "90%", maxWidth: 380 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
          <Trash2 size={20} color="#ef4444" />
        </div>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: C.txt, marginBottom: 6 }}>Delete Material</h3>
        <p style={{ fontSize: 13, color: C.sub, marginBottom: 20, lineHeight: 1.5 }}>
          Are you sure you want to delete <strong style={{ color: C.txt }}>{material.title}</strong>? This action cannot be undone.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: `1px solid ${C.border}`, background: "none", color: C.sub, fontSize: 13, cursor: "pointer" }}>Cancel</button>
          <button onClick={onConfirm} disabled={loading} style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "none", background: "#ef4444", color: "#fff", fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            {loading && <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />}
            {loading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function StudyMaterialsPage() {
  const C = useC()
  const { user, showToast } = useAppStore()
  const { courses } = useCourses()

  const [materials, setMaterials]     = useState([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState("")
  const [typeFilter, setTypeFilter]   = useState("all")
  const [courseFilter, setCourseFilter] = useState("all")
  const [modal, setModal]             = useState(null)  // "upload" | "view" | "edit" | "delete"
  const [target, setTarget]           = useState(null)
  const [deleting, setDeleting]       = useState(false)
  const [stats, setStats]             = useState({ total: 0, byType: {} })

  const loadMaterials = useCallback(async () => {
    setLoading(true)
    try {
      const params = { teacherId: user?._id }
      const [matRes, statRes] = await Promise.all([
        api.getStudyMaterials(params),
        api.getStudyMaterialStats({ teacherId: user?._id }),
      ])
      setMaterials(matRes.data || [])
      setStats(statRes.data || { total: 0, byType: {} })
    } catch (err) {
      showToast?.("Failed to load materials", "error")
    } finally {
      setLoading(false)
    }
  }, [user?._id])

  useEffect(() => { loadMaterials() }, [loadMaterials])

  // Filter materials
  const filtered = useMemo(() => {
    let list = materials
    if (typeFilter !== "all") list = list.filter(m => m.type === typeFilter)
    if (courseFilter !== "all") list = list.filter(m => m.courseId === courseFilter || m.courseId?._id === courseFilter)
    if (search.trim()) {
      const s = search.toLowerCase()
      list = list.filter(m =>
        m.title?.toLowerCase().includes(s) ||
        m.courseName?.toLowerCase().includes(s) ||
        m.description?.toLowerCase().includes(s) ||
        m.tags?.some(t => t.toLowerCase().includes(s))
      )
    }
    return list
  }, [materials, typeFilter, courseFilter, search])

  // Group by course
  const grouped = useMemo(() => {
    const map = {}
    filtered.forEach(m => {
      const key = m.courseId || "unknown"
      const cname = m.courseName || "Unknown Course"
      const ccode = m.courseCode || ""
      if (!map[key]) map[key] = { courseId: key, courseName: cname, courseCode: ccode, items: [] }
      map[key].items.push(m)
    })
    return Object.values(map)
  }, [filtered])

  const handleDownload = async (material) => {
    try {
      const res = await api.getStudyMaterialById(material._id)
      const data = res.data
      if (!data.fileData) { showToast?.("No file attached", "error"); return }
      const byteStr = atob(data.fileData)
      const ab = new ArrayBuffer(byteStr.length)
      const ia = new Uint8Array(ab)
      for (let i = 0; i < byteStr.length; i++) ia[i] = byteStr.charCodeAt(i)
      const blob = new Blob([ab], { type: data.mimeType || "application/octet-stream" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a"); a.href = url; a.download = data.fileName || "material"
      a.click(); URL.revokeObjectURL(url)
      showToast?.("Download started!", "success")
      // Update count in state
      setMaterials(prev => prev.map(m => m._id === material._id ? { ...m, downloads: (m.downloads || 0) + 1 } : m))
    } catch { showToast?.("Download failed", "error") }
  }

  const handleDelete = async () => {
    if (!target) return
    setDeleting(true)
    try {
      await api.deleteStudyMaterial(target._id)
      showToast?.("Material deleted", "success")
      setModal(null); setTarget(null)
      loadMaterials()
    } catch { showToast?.("Delete failed", "error") }
    finally { setDeleting(false) }
  }

  const handleSaved = () => {
    setModal(null); setTarget(null)
    showToast?.(target ? "Material updated!" : "Material uploaded!", "success")
    loadMaterials()
  }

  // ── Render ──
  const inputStyle = {
    background: C.inner, border: `1px solid ${C.border}`,
    borderRadius: 8, padding: "8px 12px", color: C.txt, fontSize: 13,
    outline: "none", transition: "border-color 0.2s",
  }
  const selectStyle = { ...inputStyle, cursor: "pointer", paddingRight: 30 }

  return (
    <div style={{ minHeight: "100%", paddingBottom: 40 }}>

      {/* ── Page Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 14, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.txt, marginBottom: 4, letterSpacing: "-0.02em" }}>
            Study Materials
          </h1>
          <p style={{ fontSize: 13, color: C.sub }}>Upload and manage lecture notes, slides, and resources for your courses</p>
        </div>
        <button
          onClick={() => { setTarget(null); setModal("upload") }}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 20px", borderRadius: 10, border: "none",
            background: "#22c55e", color: "#000", fontSize: 13, fontWeight: 700,
            cursor: "pointer", transition: "all 0.2s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "#16a34a"; e.currentTarget.style.transform = "translateY(-1px)" }}
          onMouseLeave={e => { e.currentTarget.style.background = "#22c55e"; e.currentTarget.style.transform = "translateY(0)" }}
        >
          <Plus size={15} /> Upload Material
        </button>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px,1fr))", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Total", value: stats.total, color: C.txt },
          ...TYPES.slice(0, 5).map(t => ({
            label: t.label, value: stats.byType?.[t.value] || 0, color: t.color,
          })),
        ].map(s => (
          <div key={s.label} style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
            padding: "12px 16px", textAlign: "center",
          }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 2 }}>{s.value}</p>
            <p style={{ fontSize: 10, color: C.sub, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Search + Filters ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 22 }}>
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 220px", minWidth: 200 }}>
          <Search size={14} color={C.muted} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by title, course, tags…"
            style={{ ...inputStyle, paddingLeft: 32, width: "100%" }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.sub }}>
              <X size={13} />
            </button>
          )}
        </div>

        {/* Course filter */}
        <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} style={{ ...selectStyle, flex: "0 1 220px", minWidth: 160 }}>
          <option value="all">All Courses</option>
          {courses.map(c => (
            <option key={c._id} value={c._id}>{c.courseCode} — {c.courseName}</option>
          ))}
        </select>

        {/* Type filter */}
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ ...selectStyle, flex: "0 1 160px", minWidth: 140 }}>
          <option value="all">All Types</option>
          {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, gap: 10, color: C.sub }}>
          <Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} />
          <span style={{ fontSize: 14 }}>Loading materials…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, background: "rgba(34,197,94,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
          }}>
            <BookOpen size={24} color="#22c55e" />
          </div>
          <p style={{ fontSize: 16, fontWeight: 600, color: C.txt, marginBottom: 6 }}>
            {materials.length === 0 ? "No materials yet" : "No results found"}
          </p>
          <p style={{ fontSize: 13, color: C.sub, maxWidth: 300, margin: "0 auto 20px" }}>
            {materials.length === 0
              ? "Start by uploading notes, PPTs, PDFs, or sharing links to resources."
              : "Try adjusting your search or filters."}
          </p>
          {materials.length === 0 && (
            <button onClick={() => { setTarget(null); setModal("upload") }} style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "10px 20px", borderRadius: 8, border: "none",
              background: "#22c55e", color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}>
              <Upload size={14} /> Upload First Material
            </button>
          )}
        </div>
      ) : (
        // Grouped by course
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {grouped.map(group => (
            <div key={group.courseId}>
              {/* Course header */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(34,197,94,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <BookOpen size={15} color="#22c55e" />
                </div>
                <div>
                  <h2 style={{ fontSize: 14, fontWeight: 700, color: C.txt, margin: 0 }}>{group.courseName}</h2>
                  {group.courseCode && <p style={{ fontSize: 11, color: C.sub, margin: 0 }}>{group.courseCode} · {group.items.length} material{group.items.length !== 1 ? "s" : ""}</p>}
                </div>
              </div>

              {/* Materials grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                {group.items.map(m => (
                  <MaterialCard
                    key={m._id}
                    material={m}
                    C={C}
                    onView={mat => { setTarget(mat); setModal("view") }}
                    onEdit={mat => { setTarget(mat); setModal("edit") }}
                    onDelete={mat => { setTarget(mat); setModal("delete") }}
                    onDownload={handleDownload}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modals ── */}
      {(modal === "upload" || modal === "edit") && (
        <UploadModal
          courses={courses}
          editTarget={modal === "edit" ? target : null}
          onClose={() => { setModal(null); setTarget(null) }}
          onSaved={handleSaved}
          C={C}
        />
      )}
      {modal === "view" && target && (
        <ViewModal material={target} onClose={() => { setModal(null); setTarget(null) }} onDownload={handleDownload} C={C} />
      )}
      {modal === "delete" && target && (
        <DeleteModal material={target} onClose={() => { setModal(null); setTarget(null) }} onConfirm={handleDelete} loading={deleting} C={C} />
      )}

      <style>{`
        @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(12px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        @keyframes spin    { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
