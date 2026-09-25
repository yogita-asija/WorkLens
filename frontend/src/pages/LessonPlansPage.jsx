import React, { useState, useEffect, useCallback, useMemo } from "react"
import {
  Plus, Search, Edit2, Trash2, Eye, CheckCircle, BookMarked,
  Calendar, ChevronLeft, ChevronRight, X, BookOpen,
  Target, Clock, TrendingUp, ChevronDown, ChevronUp, Loader2,
  Sparkles, Wand2, AlertCircle,
} from "lucide-react"
import { useC } from "../components/UI"
import useAppStore from "../store/useAppStore"
import { useCourses } from "../hooks/useData"
import * as api from "../services/api"

/* ─── helpers ─────────────────────────────────────────────────────── */
const fmt = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"
const fmtISO = (d) => d ? new Date(d).toISOString().split("T")[0] : ""
const statusColor = (s, C) => s === "completed" ? C.accent : s === "in-progress" ? "#F59E0B" : C.sub
const statusBg    = (s) => s === "completed" ? "rgba(34,197,94,0.1)" : s === "in-progress" ? "rgba(245,158,11,0.1)" : "rgba(156,163,175,0.1)"

function ProgressBar({ pct, C }) {
  return (
    <div style={{ background: C.border, borderRadius: 99, height: 5, overflow: "hidden" }}>
      <div style={{
        width: `${pct}%`, height: "100%", borderRadius: 99,
        background: pct === 100 ? C.accent : `linear-gradient(90deg, ${C.accent}, #16a34a)`,
        transition: "width 0.4s ease",
      }} />
    </div>
  )
}

function StatusPill({ status }) {
  const C = useC()
  const label = status === "completed" ? "Completed" : status === "in-progress" ? "In Progress" : "Pending"
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
      background: statusBg(status), color: statusColor(status, C),
      textTransform: "uppercase", letterSpacing: "0.05em",
    }}>{label}</span>
  )
}

/* ─── empty unit template ──────────────────────────────────────────── */
const emptyUnit  = () => ({ title: "", topics: [] })
const emptyTopic = () => ({ title: "", date: "", status: "pending", description: "" })

/* ─── Create / Edit Modal ──────────────────────────────────────────── */
function PlanModal({ open, onClose, existing, courses, onSaved, user }) {
  const C    = useC()
  const { showToast } = useAppStore()
  const [saving, setSaving] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState("")
const [aiForm, setAiForm] = useState({
  planType: "standard",
  durationWeeks: "",
  topics: "",
  extraInstructions: ""
})
  const [form, setForm] = useState({
    title: "", courseId: "", description: "", startDate: "", endDate: "",
    units: [{ title: "Unit 1", topics: [{ title: "", date: "", status: "pending", description: "" }] }],
  })
  const [expandedUnits, setExpandedUnits] = useState({ 0: true })

  useEffect(() => {
    if (!open) return
    setAiOpen(false)
    setAiError("")
   setAiForm({
  planType: "standard",
  durationWeeks: "",
  topics: "",
  extraInstructions: ""
})
    if (existing) {
      setForm({
        title:       existing.title || "",
        courseId:    existing.courseId || "",
        description: existing.description || "",
        startDate:   fmtISO(existing.startDate),
        endDate:     fmtISO(existing.endDate),
        units:       existing.units?.length ? existing.units.map(u => ({
          title:  u.title,
          topics: u.topics.map(t => ({ title: t.title, date: fmtISO(t.date), status: t.status, description: t.description || "" }))
        })) : [emptyUnit()],
      })
      const exp = {}; existing.units?.forEach((_, i) => { exp[i] = true }); setExpandedUnits(exp)
    } else {
      setForm({ title: "", courseId: "", description: "", startDate: "", endDate: "",
        units: [{ title: "Unit 1", topics: [emptyTopic()] }] })
      setExpandedUnits({ 0: true })
    }
  }, [open, existing])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const addUnit  = () => setForm(f => ({ ...f, units: [...f.units, { title: `Unit ${f.units.length + 1}`, topics: [emptyTopic()] }] }))
  const delUnit  = (ui) => setForm(f => ({ ...f, units: f.units.filter((_, i) => i !== ui) }))
  const setUnit  = (ui, k, v) => setForm(f => ({ ...f, units: f.units.map((u, i) => i === ui ? { ...u, [k]: v } : u) }))

  const addTopic  = (ui) => setForm(f => ({ ...f, units: f.units.map((u, i) => i === ui ? { ...u, topics: [...u.topics, emptyTopic()] } : u) }))
  const delTopic  = (ui, ti) => setForm(f => ({ ...f, units: f.units.map((u, i) => i === ui ? { ...u, topics: u.topics.filter((_, j) => j !== ti) } : u) }))
  const setTopic  = (ui, ti, k, v) => setForm(f => ({
    ...f, units: f.units.map((u, i) => i !== ui ? u : {
      ...u, topics: u.topics.map((t, j) => j !== ti ? t : { ...t, [k]: v })
    })
  }))

  const toggleUnit = (i) => setExpandedUnits(e => ({ ...e, [i]: !e[i] }))

  const generateWithAI = async () => {
    if (!form.courseId) { setAiError("Select a course first so AI knows what to plan for."); return }
    setAiLoading(true)
    setAiError("")
    try {
      const result = await api.generateLessonPlanAI({
  courseId: form.courseId,
  planType: aiForm.planType,
  durationWeeks: aiForm.durationWeeks
    ? Number(aiForm.durationWeeks)
    : undefined,
  topics: aiForm.topics,
  extraInstructions: aiForm.extraInstructions,
})
      const newUnits = (result.units || []).map(u => ({
        title: u.title,
        topics: (u.topics || []).map(t => ({ title: t.title, date: "", status: "pending", description: t.description || "" })),
      }))
      if (!newUnits.length) { setAiError("AI did not return a usable plan. Try again."); return }
      setForm(f => ({
        ...f,
        title: f.title || `${courses.find(c => c._id === f.courseId)?.courseName || ""} Teaching Plan`,
        units: newUnits,
      }))
      const exp = {}; newUnits.forEach((_, i) => { exp[i] = true }); setExpandedUnits(exp)
      setAiOpen(false)
      showToast("AI plan generated — review and adjust before saving")
    } catch (e) {
      setAiError(e.message || "Failed to generate plan")
    } finally {
      setAiLoading(false)
    }
  }


  const submit = async () => {
    if (!form.title.trim()) return showToast("Title is required", "error")
    if (!form.courseId)     return showToast("Course is required", "error")
    setSaving(true)
    try {
      const payload = { ...form, faculty: { id: user?._id, name: user?.name || "" } }
      if (existing) await api.updateLessonPlan(existing._id, payload)
      else           await api.createLessonPlan(payload)
      showToast(existing ? "Plan updated" : "Plan created")
      onSaved()
      onClose()
    } catch (e) { showToast(e.message, "error") }
    finally { setSaving(false) }
  }

  if (!open) return null

  const inp = {
    background: C.inner, border: `1px solid ${C.border}`, borderRadius: 8,
    color: C.txt, fontSize: 13, padding: "8px 12px", width: "100%", outline: "none",
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, width: "min(720px,95vw)", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(34,197,94,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BookMarked size={16} color={C.accent} />
            </div>
            <h2 style={{ color: C.txt, fontWeight: 700, fontSize: 16 }}>{existing ? "Edit Lesson Plan" : "Create Lesson Plan"}</h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.sub, cursor: "pointer" }}><X size={18} /></button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {/* Basic Info */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={{ fontSize: 11, color: C.sub, display: "block", marginBottom: 5, fontWeight: 500 }}>Plan Title *</label>
              <input style={inp} value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. Semester I Teaching Plan" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: C.sub, display: "block", marginBottom: 5, fontWeight: 500 }}>Course *</label>
              <select style={inp} value={form.courseId} onChange={e => set("courseId", e.target.value)}>
                <option value="">Select course…</option>
                {courses.map(c => <option key={c._id} value={c._id}>{c.courseCode} — {c.courseName}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: C.sub, display: "block", marginBottom: 5, fontWeight: 500 }}>Description</label>
              <input style={inp} value={form.description} onChange={e => set("description", e.target.value)} placeholder="Optional description" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: C.sub, display: "block", marginBottom: 5, fontWeight: 500 }}>Start Date</label>
              <input type="date" style={inp} value={form.startDate} onChange={e => set("startDate", e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: C.sub, display: "block", marginBottom: 5, fontWeight: 500 }}>End Date</label>
              <input type="date" style={inp} value={form.endDate} onChange={e => set("endDate", e.target.value)} />
            </div>
          </div>

          {/* Units */}
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, marginTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.sub, textTransform: "uppercase", letterSpacing: "0.05em" }}>Units & Topics</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setAiOpen(o => !o); setAiError("") }} style={{
                  display: "flex", alignItems: "center", gap: 5,
                  background: aiOpen ? "rgba(168,85,247,0.18)" : "rgba(168,85,247,0.1)",
                  border: `1px solid ${aiOpen ? "#A855F7" : "transparent"}`,
                  color: "#A855F7", borderRadius: 7, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontWeight: 500,
                }}>
                  <Sparkles size={13} /> Generate with AI
                </button>
                <button onClick={addUnit} style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(34,197,94,0.1)", border: "none", color: C.accent, borderRadius: 7, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontWeight: 500 }}>
                  <Plus size={13} /> Add Unit
                </button>
              </div>
            </div>

            {/* AI Generation Panel */}
           {/* AI Generation Panel */}
{aiOpen && (
  <div
    style={{
      background: "rgba(168,85,247,0.06)",
      border: "1px solid rgba(168,85,247,0.3)",
      borderRadius: 10,
      padding: 14,
      marginBottom: 14,
    }}
  >
    {/* Header */}
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        marginBottom: 10,
      }}
    >
      <Wand2 size={14} color="#A855F7" />
      <span
        style={{
          fontSize: 12.5,
          fontWeight: 600,
          color: C.txt,
        }}
      >
        AI Lesson Plan Generator
      </span>
    </div>

    <p
      style={{
        fontSize: 11.5,
        color: C.sub,
        marginBottom: 12,
      }}
    >
      Uses the selected course's name & description to draft a complete
      lesson plan. The AI will automatically decide the number of units,
      topics, and teaching sequence.
    </p>

    {/* Plan Type + Duration */}
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 10,
        marginBottom: 12,
      }}
    >
      <div>
        <label
          style={{
            fontSize: 10.5,
            color: C.sub,
            display: "block",
            marginBottom: 4,
          }}
        >
          Plan Type
        </label>

        <select
          style={inp}
          value={aiForm.planType}
          onChange={(e) =>
            setAiForm((f) => ({
              ...f,
              planType: e.target.value,
            }))
          }
        >
          <option value="compact">
            Compact (4-5 Units)
          </option>

          <option value="standard">
            Standard (6-8 Units)
          </option>

          <option value="detailed">
            Detailed (8-10 Units + Labs)
          </option>
        </select>
      </div>

      <div>
        <label
          style={{
            fontSize: 10.5,
            color: C.sub,
            display: "block",
            marginBottom: 4,
          }}
        >
          Semester Duration (Weeks)
        </label>

        <input
          type="number"
          min={1}
          max={52}
          style={inp}
          placeholder="Optional"
          value={aiForm.durationWeeks}
          onChange={(e) =>
            setAiForm((f) => ({
              ...f,
              durationWeeks: e.target.value,
            }))
          }
        />
      </div>
    </div>

    {/* Topics / Syllabus to Cover */}
    <div style={{ marginBottom: 12 }}>
      <label
        style={{
          fontSize: 10.5,
          color: C.sub,
          display: "block",
          marginBottom: 4,
        }}
      >
       Topics / Syllabus to Cover*
      </label>

      <textarea
  style={{
    ...inp,
    minHeight: 10,
    resize: "vertical"
  }}
//   placeholder="e.g.
// Arrays,Linked Lists,Stacks,Queues
// Trees
// Graphs
// Sorting
// Searching"
  value={aiForm.topics}
  onChange={(e) =>
    setAiForm((f) => ({
      ...f,
      topics: e.target.value
    }))
  }
/>
    </div>

    {/* Error Message */}
    {aiError && (
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 6,
          color: C.danger,
          fontSize: 11.5,
          marginBottom: 10,
        }}
      >
        <AlertCircle
          size={13}
          style={{
            marginTop: 1,
            flexShrink: 0,
          }}
        />
        <span>{aiError}</span>
      </div>
    )}

    {/* Footer Buttons */}
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        gap: 8,
      }}
    >
      <button
        onClick={() => setAiOpen(false)}
        style={{
          padding: "7px 14px",
          borderRadius: 7,
          background: "none",
          border: `1px solid ${C.border}`,
          color: C.sub,
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        Cancel
      </button>

      <button
        onClick={generateWithAI}
        disabled={aiLoading}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "7px 16px",
          borderRadius: 7,
          background: "#A855F7",
          border: "none",
          color: "#fff",
          fontSize: 12,
          fontWeight: 600,
          cursor: aiLoading ? "not-allowed" : "pointer",
          opacity: aiLoading ? 0.7 : 1,
        }}
      >
        {aiLoading ? (
          <Loader2
            size={13}
            style={{
              animation: "spin 1s linear infinite",
            }}
          />
        ) : (
          <Sparkles size={13} />
        )}

        {aiLoading ? "Generating..." : "Generate Plan"}
      </button>
    </div>
  </div>
)}


            {form.units.map((unit, ui) => (
              <div key={ui} style={{ background: C.inner, border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 10 }}>
                {/* Unit header */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", cursor: "pointer" }} onClick={() => toggleUnit(ui)}>
                  {expandedUnits[ui] ? <ChevronUp size={14} color={C.sub} /> : <ChevronDown size={14} color={C.sub} />}
                  <input
                    style={{ ...inp, background: "transparent", border: "none", padding: 0, flex: 1, fontWeight: 600, fontSize: 13 }}
                    value={unit.title}
                    onChange={e => { e.stopPropagation(); setUnit(ui, "title", e.target.value) }}
                    onClick={e => e.stopPropagation()}
                    placeholder="Unit title"
                  />
                  <span style={{ fontSize: 11, color: C.muted }}>{unit.topics.length} topic{unit.topics.length !== 1 ? "s" : ""}</span>
                  {form.units.length > 1 && (
                    <button onClick={e => { e.stopPropagation(); delUnit(ui) }} style={{ background: "none", border: "none", color: C.danger, cursor: "pointer", padding: 2 }}><X size={13} /></button>
                  )}
                </div>

                {expandedUnits[ui] && (
                  <div style={{ borderTop: `1px solid ${C.border}`, padding: "10px 12px" }}>
                    {unit.topics.map((topic, ti) => (
                      <div key={ti} style={{ marginBottom: 8 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 8, alignItems: "center" }}>
                          <input style={inp} value={topic.title} onChange={e => setTopic(ui, ti, "title", e.target.value)} placeholder="Topic title" />
                          <input type="date" style={inp} value={topic.date} onChange={e => setTopic(ui, ti, "date", e.target.value)} />
                          <select style={inp} value={topic.status} onChange={e => setTopic(ui, ti, "status", e.target.value)}>
                            <option value="pending">Pending</option>
                            <option value="in-progress">In Progress</option>
                            <option value="completed">Completed</option>
                          </select>
                          {unit.topics.length > 1 && (
                            <button onClick={() => delTopic(ui, ti)} style={{ background: "none", border: "none", color: C.danger, cursor: "pointer" }}><X size={13} /></button>
                          )}
                        </div>
                        {topic.description && (
                          <p style={{ fontSize: 10.5, color: C.muted, marginTop: 4, paddingLeft: 2 }}>{topic.description}</p>
                        )}
                      </div>
                    ))}
                    <button onClick={() => addTopic(ui)} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: `1px dashed ${C.border}`, color: C.sub, borderRadius: 7, padding: "5px 10px", fontSize: 12, cursor: "pointer", width: "100%", justifyContent: "center", marginTop: 4 }}>
                      <Plus size={12} /> Add Topic
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 24px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 8, background: "none", border: `1px solid ${C.border}`, color: C.sub, fontSize: 13, cursor: "pointer" }}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ padding: "8px 20px", borderRadius: 8, background: C.accent, border: "none", color: "#000", fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, display: "flex", alignItems: "center", gap: 6 }}>
            {saving && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
            {saving ? "Saving…" : existing ? "Update Plan" : "Create Plan"}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── View Modal ───────────────────────────────────────────────────── */
function ViewModal({ open, plan, onClose }) {
  const C = useC()
  if (!open || !plan) return null
  const allTopics = plan.units?.flatMap(u => u.topics) || []
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, width: "min(640px,95vw)", maxHeight: "88vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ color: C.txt, fontWeight: 700, fontSize: 16 }}>{plan.title}</h2>
            <p style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{plan.courseName} {plan.courseCode ? `· ${plan.courseCode}` : ""}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.sub, cursor: "pointer" }}><X size={18} /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {/* Summary */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
            {[
              { label: "Topics", value: allTopics.length },
              { label: "Completed", value: allTopics.filter(t => t.status === "completed").length, color: C.accent },
              { label: "Pending", value: allTopics.filter(t => t.status === "pending").length, color: C.warn },
            ].map(s => (
              <div key={s.label} style={{ background: C.inner, borderRadius: 8, padding: "10px 14px", textAlign: "center" }}>
                <p style={{ fontSize: 20, fontWeight: 700, color: s.color || C.txt }}>{s.value}</p>
                <p style={{ fontSize: 11, color: C.sub }}>{s.label}</p>
              </div>
            ))}
          </div>
          {/* Progress */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: C.sub }}>Overall Progress</span>
              <span style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>{plan.progress || 0}%</span>
            </div>
            <ProgressBar pct={plan.progress || 0} C={C} />
          </div>
          {/* Units */}
          {plan.units?.map((unit, ui) => (
            <div key={ui} style={{ marginBottom: 16 }}>
              <p style={{ fontWeight: 600, color: C.txt, fontSize: 13, marginBottom: 8 }}>{unit.title}</p>
              {unit.topics.map((t, ti) => (
                <div key={ti} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: C.inner, borderRadius: 8, marginBottom: 5 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: statusColor(t.status, C), flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, color: C.txt }}>{t.title}</span>
                  <span style={{ fontSize: 11, color: C.muted }}>{fmt(t.date)}</span>
                  <StatusPill status={t.status} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Calendar View ────────────────────────────────────────────────── */
const DAYS  = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS= ["January","February","March","April","May","June","July","August","September","October","November","December"]

function CalendarView({ events }) {
  const C = useC()
  const today = new Date()
  const [cur, setCur] = useState({ month: today.getMonth(), year: today.getFullYear() })

  const firstDay = new Date(cur.year, cur.month, 1).getDay()
  const daysInMonth = new Date(cur.year, cur.month + 1, 0).getDate()

  const eventMap = useMemo(() => {
    const m = {}
    for (const ev of events) {
      const d = new Date(ev.date)
      if (d.getMonth() === cur.month && d.getFullYear() === cur.year) {
        const key = d.getDate()
        if (!m[key]) m[key] = []
        m[key].push(ev)
      }
    }
    return m
  }, [events, cur.month, cur.year])

  const prev = () => setCur(c => c.month === 0 ? { month: 11, year: c.year - 1 } : { month: c.month - 1, year: c.year })
  const next = () => setCur(c => c.month === 11 ? { month: 0, year: c.year + 1 } : { month: c.month + 1, year: c.year })

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
      {/* Calendar header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h3 style={{ color: C.txt, fontWeight: 700, fontSize: 15 }}>{MONTHS[cur.month]} {cur.year}</h3>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={prev} style={{ background: C.inner, border: `1px solid ${C.border}`, color: C.txt, borderRadius: 7, padding: "4px 8px", cursor: "pointer" }}><ChevronLeft size={14} /></button>
          <button onClick={() => setCur({ month: today.getMonth(), year: today.getFullYear() })} style={{ background: C.inner, border: `1px solid ${C.border}`, color: C.sub, borderRadius: 7, padding: "4px 10px", cursor: "pointer", fontSize: 11 }}>Today</button>
          <button onClick={next} style={{ background: C.inner, border: `1px solid ${C.border}`, color: C.txt, borderRadius: 7, padding: "4px 8px", cursor: "pointer" }}><ChevronRight size={14} /></button>
        </div>
      </div>

      {/* Day headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 4 }}>
        {DAYS.map(d => <div key={d} style={{ textAlign: "center", fontSize: 11, color: C.muted, fontWeight: 600, padding: "4px 0" }}>{d}</div>)}
      </div>

      {/* Cells */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} />
          const evs = eventMap[day] || []
          const isToday = day === today.getDate() && cur.month === today.getMonth() && cur.year === today.getFullYear()
          return (
            <div key={day} style={{
              minHeight: 72, background: isToday ? "rgba(34,197,94,0.08)" : C.inner,
              border: `1px solid ${isToday ? C.accent : C.border}`, borderRadius: 8, padding: "5px 6px",
            }}>
              <span style={{ fontSize: 12, fontWeight: isToday ? 700 : 500, color: isToday ? C.accent : C.txt, display: "block", marginBottom: 3 }}>{day}</span>
              {evs.slice(0, 2).map((ev, i) => (
                <div key={i} title={`${ev.topicTitle} · ${ev.planTitle}`} style={{
                  fontSize: 9, padding: "2px 5px", borderRadius: 4, marginBottom: 2,
                  background: statusBg(ev.status), color: statusColor(ev.status, C),
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  cursor: "default",
                }}>
                  {ev.topicTitle}
                </div>
              ))}
              {evs.length > 2 && <span style={{ fontSize: 9, color: C.muted }}>+{evs.length - 2} more</span>}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 14, flexWrap: "wrap" }}>
        {[["pending","Pending"],["in-progress","In Progress"],["completed","Completed"]].map(([s, l]) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: statusBg(s) }} />
            <span style={{ fontSize: 11, color: C.muted }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Plan Card ────────────────────────────────────────────────────── */
function PlanCard({ plan, onView, onEdit, onDelete, onComplete }) {
  const C = useC()
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 20px",
      display: "flex", flexDirection: "column", gap: 12, transition: "border-color 0.2s",
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = C.accent + "66"}
      onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
    >
      {/* Top */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(34,197,94,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <BookMarked size={13} color={C.accent} />
            </div>
            <h3 style={{ fontWeight: 600, fontSize: 13, color: C.txt, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{plan.title}</h3>
          </div>
          <p style={{ fontSize: 11, color: C.sub, marginLeft: 36 }}>{plan.courseName} {plan.courseCode ? `· ${plan.courseCode}` : ""}</p>
        </div>
        <StatusPill status={plan.status === "completed" ? "completed" : plan.progress > 0 ? "in-progress" : "pending"} />
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 12 }}>
        {[
          { icon: <Target size={11} />, label: `${plan.units?.length || 0} Units` },
          { icon: <BookOpen size={11} />, label: `${plan.totalTopics || 0} Topics` },
          { icon: <CheckCircle size={11} />, label: `${plan.completedTopics || 0} Done` },
        ].map(s => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ color: C.muted }}>{s.icon}</span>
            <span style={{ fontSize: 11, color: C.sub }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Date range */}
      {(plan.startDate || plan.endDate) && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.muted }}>
          <Clock size={11} />
          <span>{fmt(plan.startDate)} — {fmt(plan.endDate)}</span>
        </div>
      )}

      {/* Progress */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
          <span style={{ fontSize: 11, color: C.sub }}>Progress</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: plan.progress === 100 ? C.accent : C.txt }}>{plan.progress || 0}%</span>
        </div>
        <ProgressBar pct={plan.progress || 0} C={C} />
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
        {[
          { label: "View",    icon: <Eye size={12} />,          onClick: onView,     bg: C.inner,            color: C.sub    },
          { label: "Edit",    icon: <Edit2 size={12} />,        onClick: onEdit,     bg: "rgba(59,130,246,0.1)", color: "#3B82F6" },
          { label: "Delete",  icon: <Trash2 size={12} />,       onClick: onDelete,   bg: "rgba(239,68,68,0.1)",  color: C.danger },
          { label: "Complete",icon: <CheckCircle size={12} />,  onClick: onComplete, bg: "rgba(34,197,94,0.1)",  color: C.accent, hide: plan.status === "completed" },
        ].filter(a => !a.hide).map(a => (
          <button key={a.label} onClick={a.onClick} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
            background: a.bg, border: "none", color: a.color, borderRadius: 7,
            padding: "6px 0", fontSize: 11, fontWeight: 500, cursor: "pointer",
          }}>
            {a.icon}{a.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ─── Main Page ────────────────────────────────────────────────────── */
export default function LessonPlansPage() {
  const C = useC()
  const { user, showToast } = useAppStore()
  const { courses } = useCourses()

  const [plans,      setPlans]      = useState([])
  const [stats,      setStats]      = useState({ totalPlans: 0, activeCourses: 0, completedTopics: 0, pendingTopics: 0 })
  const [calEvents,  setCalEvents]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState("")
  const [view,       setView]       = useState("grid")   // "grid" | "calendar"
  const [modal,      setModal]      = useState(null)     // null | "create" | "edit" | "view"
  const [target,     setTarget]     = useState(null)
  const [delTarget,  setDelTarget]  = useState(null)
  const [deleting,   setDeleting]   = useState(false)

  const facultyId = user?._id

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = facultyId ? { facultyId } : {}
      const [plansData, statsData, calData] = await Promise.all([
        api.getLessonPlans(params),
        api.getLessonPlanStats(params),
        api.getCalendarData(params),
      ])
      setPlans(Array.isArray(plansData) ? plansData : [])
      setStats(statsData || {})
      setCalEvents(Array.isArray(calData) ? calData : [])
    } catch (e) { showToast("Failed to load lesson plans", "error") }
    finally { setLoading(false) }
  }, [facultyId])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    if (!search.trim()) return plans
    const s = search.toLowerCase()
    return plans.filter(p => p.title?.toLowerCase().includes(s) || p.courseName?.toLowerCase().includes(s))
  }, [plans, search])

  const handleDelete = async () => {
    if (!delTarget) return
    setDeleting(true)
    try {
      await api.deleteLessonPlan(delTarget._id)
      showToast("Plan deleted")
      setDelTarget(null)
      load()
    } catch (e) { showToast(e.message, "error") }
    finally { setDeleting(false) }
  }

  const handleComplete = async (plan) => {
    try {
      await api.markLessonPlanComplete(plan._id)
      showToast("Plan marked complete")
      load()
    } catch (e) { showToast(e.message, "error") }
  }

  const STAT_CARDS = [
    { label: "Total Plans",       value: stats.totalPlans,      icon: <BookMarked size={18} />,   color: "#3B82F6" },
    { label: "Active Courses",    value: stats.activeCourses,   icon: <BookOpen size={18} />,     color: "#22C55E" },
    { label: "Completed Topics",  value: stats.completedTopics, icon: <CheckCircle size={18} />,  color: "#22C55E" },
    { label: "Pending Topics",    value: stats.pendingTopics,   icon: <Clock size={18} />,        color: "#F59E0B" },
  ]

  return (
    <div style={{ color: C.txt, minHeight: "100%" }}>
      {/* Page Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.txt }}>Lesson Plans</h1>
          <p style={{ fontSize: 13, color: C.sub, marginTop: 3 }}>Manage your teaching plans — Course → Unit → Topic</p>
        </div>
        <button onClick={() => { setTarget(null); setModal("create") }} style={{
          display: "flex", alignItems: "center", gap: 7,
          background: C.accent, border: "none", color: "#000",
          borderRadius: 9, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}>
          <Plus size={15} /> Create Plan
        </button>
      </div>

      {/* Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, marginBottom: 24 }}>
        {STAT_CARDS.map(s => (
          <div key={s.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${s.color}1a`, display: "flex", alignItems: "center", justifyContent: "center", color: s.color, flexShrink: 0 }}>{s.icon}</div>
            <div>
              <p style={{ fontSize: 22, fontWeight: 700, color: C.txt, lineHeight: 1 }}>{loading ? "—" : s.value}</p>
              <p style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        {/* Search */}
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.muted }} />
          <input
            style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.txt, fontSize: 13, padding: "8px 12px 8px 34px", outline: "none", width: "100%" }}
            placeholder="Search plans or courses…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {/* View toggle */}
        <div style={{ display: "flex", background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
          {[{ k: "grid", icon: <TrendingUp size={14} />, label: "Grid" }, { k: "calendar", icon: <Calendar size={14} />, label: "Calendar" }].map(v => (
            <button key={v.k} onClick={() => setView(v.k)} style={{
              display: "flex", alignItems: "center", gap: 5, padding: "7px 14px",
              background: view === v.k ? C.accent : "transparent",
              color: view === v.k ? "#000" : C.sub,
              border: "none", cursor: "pointer", fontSize: 12, fontWeight: 500,
              transition: "background 0.15s",
            }}>{v.icon}{v.label}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200, gap: 10, color: C.sub }}>
          <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
          <span style={{ fontSize: 13 }}>Loading lesson plans…</span>
        </div>
      ) : view === "calendar" ? (
        <CalendarView events={calEvents} />
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: C.sub }}>
          <BookMarked size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
          <p style={{ fontSize: 15, fontWeight: 500, color: C.txt }}>{search ? "No plans match your search" : "No lesson plans yet"}</p>
          <p style={{ fontSize: 12, marginTop: 6 }}>{search ? "Try a different keyword" : "Click \"Create Plan\" to get started"}</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 14 }}>
          {filtered.map(plan => (
            <PlanCard
              key={plan._id}
              plan={plan}
              onView={() => { setTarget(plan); setModal("view") }}
              onEdit={() => { setTarget(plan); setModal("edit") }}
              onDelete={() => setDelTarget(plan)}
              onComplete={() => handleComplete(plan)}
            />
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <PlanModal
        open={modal === "create" || modal === "edit"}
        onClose={() => { setModal(null); setTarget(null) }}
        existing={modal === "edit" ? target : null}
        courses={courses}
        onSaved={load}
        user={user}
      />

      {/* View Modal */}
      <ViewModal open={modal === "view"} plan={target} onClose={() => { setModal(null); setTarget(null) }} />

      {/* Delete Confirm */}
      {delTarget && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "32px 36px", textAlign: "center", maxWidth: 360 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Trash2 size={20} color={C.danger} />
            </div>
            <p style={{ color: C.txt, fontWeight: 600, fontSize: 15, marginBottom: 8 }}>Delete Lesson Plan?</p>
            <p style={{ color: C.sub, fontSize: 13, marginBottom: 24 }}>"{delTarget.title}" will be permanently deleted.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setDelTarget(null)} style={{ padding: "8px 20px", borderRadius: 8, background: "none", border: `1px solid ${C.border}`, color: C.sub, fontSize: 13, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleDelete} disabled={deleting} style={{ padding: "8px 20px", borderRadius: 8, background: C.danger, border: "none", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
