import React, { useState, useEffect, useCallback } from "react"
import {
  BookOpen, CheckCircle, Clock, AlertCircle, ChevronDown, ChevronRight,
  Plus, Trash2, Edit3, Check, X, BarChart2, Circle, Save,
} from "lucide-react"
import { Card, T, useC } from "../components/UI"
import useAppStore from "../store/useAppStore"
import * as api from "../services/api"

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_CFG = {
  completed:    { label: "Completed",    color: "#22C55E", bg: "rgba(34,197,94,0.12)",   icon: CheckCircle },
  "on-track":   { label: "On Track",     color: "#3B82F6", bg: "rgba(59,130,246,0.12)",  icon: BarChart2   },
  "in-progress":{ label: "In Progress",  color: "#F59E0B", bg: "rgba(245,158,11,0.12)",  icon: Clock       },
  "not-started":{ label: "Not Started",  color: "#6B7280", bg: "rgba(107,114,128,0.12)", icon: Circle      },
}

// ── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ pct }) {
  const color = pct === 100 ? "#22C55E" : pct >= 60 ? "#3B82F6" : pct > 0 ? "#F59E0B" : "#4B5563"
  return (
    <div style={{ background: "#1f1f1f", borderRadius: 99, height: 7, overflow: "hidden" }}>
      <div style={{
        width: `${pct}%`, height: "100%", borderRadius: 99,
        background: color,
        transition: "width 0.4s ease",
      }} />
    </div>
  )
}

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG["not-started"]
  const Icon = cfg.icon
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99,
      color: cfg.color, background: cfg.bg,
    }}>
      <Icon size={11} />
      {cfg.label}
    </span>
  )
}

// ── Dashboard top cards ───────────────────────────────────────────────────────
function DashboardCards({ syllabi }) {
  const C = useC()
  const totalCourses    = syllabi.length
  const completedUnits  = syllabi.reduce((s, sy) => s + sy.completedTopics, 0)
  const pendingUnits    = syllabi.reduce((s, sy) => s + (sy.totalTopics - sy.completedTopics), 0)
  const avgProgress     = totalCourses
    ? Math.round(syllabi.reduce((s, sy) => s + sy.progress, 0) / totalCourses)
    : 0

  const cards = [
    { label: "Total Courses",   value: totalCourses,   color: T.blue,   icon: BookOpen },
    { label: "Completed Units", value: completedUnits, color: T.accent, icon: CheckCircle },
    { label: "Pending Units",   value: pendingUnits,   color: "#F59E0B", icon: Clock },
    { label: "Avg Progress",    value: `${avgProgress}%`, color: "#A78BFA", icon: BarChart2 },
  ]

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28 }}>
      {cards.map(({ label, value, color, icon: Icon }) => (
        <div key={label} style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
          padding: "20px 22px", display: "flex", alignItems: "center", gap: 16,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <Icon size={20} color={color} />
          </div>
          <div>
            <p style={{ fontSize: 11, color: C.sub, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
            <p style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1 }}>{value}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Topic row ─────────────────────────────────────────────────────────────────
function TopicRow({ topic, onToggle, saving }) {
  const C = useC()
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "9px 14px", borderRadius: 8,
      background: topic.completed ? "rgba(34,197,94,0.05)" : "transparent",
      border: `1px solid ${topic.completed ? "rgba(34,197,94,0.15)" : C.border}`,
      marginBottom: 6,
      transition: "all 0.2s",
    }}>
      <button
        onClick={() => onToggle(topic)}
        disabled={saving}
        style={{
          width: 20, height: 20, borderRadius: 6, flexShrink: 0, cursor: "pointer",
          border: `2px solid ${topic.completed ? "#22C55E" : C.border}`,
          background: topic.completed ? "#22C55E" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.2s",
        }}
      >
        {topic.completed && <Check size={11} color="#000" strokeWidth={3} />}
      </button>
      <span style={{
        flex: 1, fontSize: 13, color: topic.completed ? C.sub : C.txt,
        textDecoration: topic.completed ? "line-through" : "none",
        transition: "all 0.2s",
      }}>
        {topic.title}
      </span>
      {topic.completed && topic.completedAt && (
        <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>
          {new Date(topic.completedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
        </span>
      )}
    </div>
  )
}

// ── Module section ─────────────────────────────────────────────────────────────
function ModuleSection({ mod, onToggleTopic, saving }) {
  const C = useC()
  const [open, setOpen] = useState(true)
  const total     = mod.topics.length
  const completed = mod.topics.filter(t => t.completed).length
  const pct       = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <div style={{
      background: C.inner, border: `1px solid ${C.border}`,
      borderRadius: 10, marginBottom: 10, overflow: "hidden",
    }}>
      {/* Module header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10,
          padding: "13px 16px", background: "transparent", border: "none", cursor: "pointer",
          color: C.txt,
        }}
      >
        {open ? <ChevronDown size={15} color={C.sub} /> : <ChevronRight size={15} color={C.sub} />}
        <span style={{ flex: 1, textAlign: "left", fontSize: 14, fontWeight: 600 }}>{mod.title}</span>
        <span style={{ fontSize: 12, color: C.sub, marginRight: 12 }}>
          {completed}/{total} topics
        </span>
        <div style={{ width: 80 }}>
          <ProgressBar pct={pct} />
        </div>
        <span style={{
          marginLeft: 10, minWidth: 38, textAlign: "right",
          fontSize: 13, fontWeight: 700,
          color: pct === 100 ? "#22C55E" : pct > 0 ? "#F59E0B" : C.muted,
        }}>
          {pct}%
        </span>
      </button>

      {/* Topics */}
      {open && (
        <div style={{ padding: "4px 16px 14px" }}>
          {mod.topics.length === 0 ? (
            <p style={{ fontSize: 12, color: C.muted, padding: "6px 0" }}>No topics in this module.</p>
          ) : (
            mod.topics.map(t => (
              <TopicRow key={t._id} topic={t} onToggle={onToggleTopic} saving={saving} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── Course card (in grid) ──────────────────────────────────────────────────────
function CourseCard({ syllabus, onSelect, selected }) {
  const C = useC()
  const cfg = STATUS_CFG[syllabus.courseStatus] || STATUS_CFG["not-started"]

  return (
    <div
      onClick={() => onSelect(syllabus)}
      style={{
        background: selected ? `${cfg.color}0D` : C.card,
        border: `1.5px solid ${selected ? cfg.color : C.border}`,
        borderRadius: 14, padding: "20px 22px", cursor: "pointer",
        transition: "all 0.2s",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: `${cfg.color}18`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <BookOpen size={18} color={cfg.color} />
        </div>
        <StatusBadge status={syllabus.courseStatus} />
      </div>

      {/* Course name */}
      <p style={{ fontSize: 15, fontWeight: 600, color: C.txt, marginBottom: 4, lineHeight: 1.3 }}>
        {syllabus.courseId?.courseName || "—"}
      </p>
      <p style={{ fontSize: 11, color: C.sub, marginBottom: 16 }}>
        {syllabus.courseId?.courseCode || syllabus.courseId?.courseId || ""}{syllabus.courseId?.sem ? ` • Sem ${syllabus.courseId.sem}` : ""}
      </p>

      {/* Topics count */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: C.sub }}>
          {syllabus.completedTopics} / {syllabus.totalTopics} topics done
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: cfg.color }}>{syllabus.progress}%</span>
      </div>

      {/* Progress bar */}
      <ProgressBar pct={syllabus.progress} />
    </div>
  )
}

// ── Add Syllabus modal ─────────────────────────────────────────────────────────
function AddSyllabusModal({ courses, existingCourseIds, onClose, onSave }) {
  const C = useC()
  const [selectedCourse, setSelectedCourse] = useState("")
  const [modulesText, setModulesText] = useState(
    "Module 1: Introduction\n- Topic 1\n- Topic 2\n\nModule 2: Core Concepts\n- Topic 1\n- Topic 2"
  )
  const [saving, setSaving] = useState(false)

  const available = courses.filter(c => !existingCourseIds.includes(c._id))

  const handleSave = async () => {
    if (!selectedCourse) return
    setSaving(true)
    try {
      // Parse modules from text
      const modules = parseModulesText(modulesText)
      await onSave(selectedCourse, modules)
      onClose()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 999,
      background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
        padding: 28, width: "min(560px, 95vw)", maxHeight: "90vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: C.txt }}>Add Syllabus</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.sub }}>
            <X size={18} />
          </button>
        </div>

        {available.length === 0 ? (
          <p style={{ color: C.sub, fontSize: 13 }}>All courses already have a syllabus.</p>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: C.sub, display: "block", marginBottom: 6 }}>Select Course</label>
              <select
                value={selectedCourse}
                onChange={e => setSelectedCourse(e.target.value)}
                style={{
                  width: "100%", background: C.inner, border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: "10px 12px", color: C.txt, fontSize: 13,
                }}
              >
                <option value="">— choose course —</option>
                {available.map(c => (
                  <option key={c._id} value={c._id}>{c.courseName} ({c.courseCode || c.courseId})</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: C.sub, display: "block", marginBottom: 6 }}>
                Modules & Topics
                <span style={{ color: C.muted, marginLeft: 8, fontSize: 11 }}>
                  (Format: "Module Name:" on its own line, then "- Topic" for each topic)
                </span>
              </label>
              <textarea
                value={modulesText}
                onChange={e => setModulesText(e.target.value)}
                rows={10}
                style={{
                  width: "100%", background: C.inner, border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: "10px 12px", color: C.txt, fontSize: 12,
                  fontFamily: "monospace", resize: "vertical", boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={onClose} style={{
                padding: "9px 20px", borderRadius: 8, border: `1px solid ${C.border}`,
                background: "transparent", color: C.sub, cursor: "pointer", fontSize: 13,
              }}>Cancel</button>
              <button onClick={handleSave} disabled={!selectedCourse || saving} style={{
                padding: "9px 20px", borderRadius: 8, border: "none",
                background: T.accent, color: "#000", cursor: selectedCourse ? "pointer" : "not-allowed",
                fontWeight: 600, fontSize: 13, opacity: selectedCourse ? 1 : 0.5,
              }}>
                {saving ? "Saving…" : "Save Syllabus"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Parse modules from plain text ─────────────────────────────────────────────
function parseModulesText(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean)
  const modules = []
  let current = null
  for (const line of lines) {
    if (!line.startsWith("-") && line.endsWith(":")) {
      current = { title: line.slice(0, -1).trim(), topics: [] }
      modules.push(current)
    } else if (!line.startsWith("-") && (line.match(/^module\s+\d+/i) || line.match(/^unit\s+\d+/i))) {
      current = { title: line, topics: [] }
      modules.push(current)
    } else if (line.startsWith("-") && current) {
      current.topics.push({ title: line.slice(1).trim(), completed: false })
    } else if (!current) {
      current = { title: "Module 1", topics: [] }
      modules.push(current)
      if (line.startsWith("-")) current.topics.push({ title: line.slice(1).trim(), completed: false })
    }
  }
  return modules
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function SyllabusPage() {
  const C = useC()
  const { showToast, courses } = useAppStore()

  const [syllabi,   setSyllabi]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [selected,  setSelected]  = useState(null) // syllabus detail
  const [saving,    setSaving]    = useState(false)
  const [showAdd,   setShowAdd]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getAllSyllabus()
      setSyllabi(Array.isArray(data) ? data : [])
      // If currently selected, refresh it
      setSelected(prev => prev ? (data.find(s => s._id === prev._id) || null) : null)
    } catch (err) {
      showToast("Failed to load syllabus data", "error")
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { load() }, [load])

  const handleToggleTopic = async (topic) => {
    if (!selected) return
    setSaving(true)
    try {
      // Find module containing this topic
      const mod = selected.modules.find(m => m.topics.find(t => t._id === topic._id))
      if (!mod) return
      const updated = await api.updateSyllabusTopic(selected.courseId._id || selected.courseId, {
        moduleId: mod._id,
        topicId:  topic._id,
        completed: !topic.completed,
      })
      // Update local state
      setSyllabi(prev => prev.map(s => s._id === updated._id ? updated : s))
      setSelected(updated)
      showToast(
        !topic.completed ? "Topic marked as completed ✓" : "Topic marked as pending",
        !topic.completed ? "success" : "info"
      )
    } catch (err) {
      showToast(err.message || "Failed to update topic", "error")
    } finally {
      setSaving(false)
    }
  }

  const handleAddSyllabus = async (courseId, modules) => {
    await api.createSyllabus({ courseId, modules })
    showToast("Syllabus created!", "success")
    await load()
  }

  const handleDelete = async (syllabus) => {
    if (!window.confirm(`Delete syllabus for "${syllabus.courseId?.courseName}"?`)) return
    try {
      await api.deleteSyllabus(syllabus.courseId?._id || syllabus.courseId)
      showToast("Syllabus deleted", "success")
      if (selected?._id === syllabus._id) setSelected(null)
      await load()
    } catch (err) {
      showToast(err.message, "error")
    }
  }

  const existingCourseIds = syllabi.map(s => s.courseId?._id || s.courseId).filter(Boolean)

  return (
    <div style={{ color: C.txt }}>
      {/* Page header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Syllabus Progress</h1>
          <p style={{ fontSize: 13, color: C.sub }}>Track topic-wise completion across all your courses</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 18px", borderRadius: 10, border: "none",
            background: T.accent, color: "#000", fontWeight: 600, fontSize: 13, cursor: "pointer",
          }}
        >
          <Plus size={15} />
          Add Syllabus
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: C.sub }}>Loading syllabus data…</div>
      ) : syllabi.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "80px 0",
          background: C.card, borderRadius: 16, border: `1px solid ${C.border}`,
        }}>
          <BookOpen size={40} color={C.muted} style={{ margin: "0 auto 14px" }} />
          <p style={{ fontSize: 16, fontWeight: 600, color: C.txt, marginBottom: 6 }}>No syllabi yet</p>
          <p style={{ fontSize: 13, color: C.sub, marginBottom: 20 }}>Add a syllabus for your courses to start tracking progress.</p>
          <button
            onClick={() => setShowAdd(true)}
            style={{
              padding: "10px 22px", borderRadius: 10, border: "none",
              background: T.accent, color: "#000", fontWeight: 600, fontSize: 13, cursor: "pointer",
            }}
          >
            <Plus size={14} style={{ display: "inline", marginRight: 6 }} />
            Add First Syllabus
          </button>
        </div>
      ) : (
        <>
          {/* Dashboard cards */}
          <DashboardCards syllabi={syllabi} />

          <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 1.5fr" : "1fr", gap: 20 }}>
            {/* Course cards grid */}
            <div>
              <p style={{ fontSize: 12, color: C.sub, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Courses ({syllabi.length})
              </p>
              <div style={{
                display: "grid",
                gridTemplateColumns: selected ? "1fr" : "repeat(auto-fill, minmax(260px, 1fr))",
                gap: 14,
              }}>
                {syllabi.map(sy => (
                  <div key={sy._id} style={{ position: "relative" }}>
                    <CourseCard
                      syllabus={sy}
                      selected={selected?._id === sy._id}
                      onSelect={s => setSelected(prev => prev?._id === s._id ? null : s)}
                    />
                    {/* Delete btn */}
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(sy) }}
                      style={{
                        position: "absolute", top: 12, right: 12,
                        background: "rgba(239,68,68,0.1)", border: "none", borderRadius: 6,
                        padding: "4px 6px", cursor: "pointer", color: "#EF4444", display: "flex",
                      }}
                      title="Delete syllabus"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Detail panel */}
            {selected && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div>
                    <p style={{ fontSize: 12, color: C.sub, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
                      Course Detail
                    </p>
                    <h2 style={{ fontSize: 16, fontWeight: 700, color: C.txt }}>
                      {selected.courseId?.courseName}
                    </h2>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <StatusBadge status={selected.courseStatus} />
                    <button
                      onClick={() => setSelected(null)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: C.sub, padding: 4 }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Progress summary */}
                <div style={{
                  background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
                  padding: "16px 18px", marginBottom: 16,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: C.sub }}>Overall Progress</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: T.accent }}>{selected.progress}%</span>
                  </div>
                  <ProgressBar pct={selected.progress} />
                  <p style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
                    {selected.completedTopics} of {selected.totalTopics} topics completed
                  </p>
                </div>

                {/* Modules */}
                <div>
                  {selected.modules.length === 0 ? (
                    <p style={{ color: C.sub, fontSize: 13 }}>No modules defined.</p>
                  ) : (
                    selected.modules.map(mod => (
                      <ModuleSection
                        key={mod._id}
                        mod={mod}
                        onToggleTopic={handleToggleTopic}
                        saving={saving}
                      />
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Add modal */}
      {showAdd && (
        <AddSyllabusModal
          courses={courses}
          existingCourseIds={existingCourseIds}
          onClose={() => setShowAdd(false)}
          onSave={handleAddSyllabus}
        />
      )}
    </div>
  )
}
