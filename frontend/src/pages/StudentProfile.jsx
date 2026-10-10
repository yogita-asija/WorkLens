import React, { useState, useEffect } from "react"
import { getStudentHistory } from "../services/api"

// ── Icons ─────────────────────────────────────────────────────────────────────
const UserIcon = () => (
  <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
)
const BackIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
)
const CalendarIcon = () => (
  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/>
    <line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>
  </svg>
)
const CloseIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
const NoteIcon = () => (
  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
)
const ChevronDownIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
)

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_STYLE = {
  present: { label: "Present", bg: "rgba(22,163,74,0.15)",  color: "#4ade80", border: "1px solid rgba(22,163,74,0.4)",  dot: "#4ade80" },
  absent:  { label: "Absent",  bg: "rgba(220,38,38,0.12)",  color: "#f87171", border: "1px solid rgba(220,38,38,0.5)",  dot: "#f87171" },
  late:    { label: "Late",    bg: "rgba(202,138,4,0.15)",  color: "#facc15", border: "1px solid rgba(202,138,4,0.4)", dot: "#facc15" },
  unknown: { label: "Unknown", bg: "rgba(100,100,100,0.15)",color: "#9CA3AF", border: "1px solid #444",                dot: "#9CA3AF" },
}

function StatusBadge({ status }) {
  const cfg = STATUS_STYLE[status] ?? STATUS_STYLE.unknown
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: 600,
      background: cfg.bg, color: cfg.color, border: cfg.border,
    }}>
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: cfg.dot }} />
      {cfg.label}
    </span>
  )
}

function formatDate(dateStr) {
  if (!dateStr) return ""
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    day: "2-digit", month: "short", year: "numeric",
  })
}

function CircleProgress({ value, color, size = 80 }) {
  const r = (size - 10) / 2
  const circ = 2 * Math.PI * r
  const dash = (value / 100) * circ
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#2a2a2a" strokeWidth="8"/>
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth="8"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.8s ease" }}
      />
    </svg>
  )
}

// ── Pie Chart (pure SVG, no dependencies) ────────────────────────────────────
function PieChart({ slices, size = 160, label, sublabel }) {
  // slices: [{value, color, name}]
  const total = slices.reduce((s, sl) => s + sl.value, 0)
  if (total === 0) return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "var(--bg-2a2a2a)",
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <span style={{ fontSize: "12px", color: "var(--t-4b5563)" }}>No data</span>
    </div>
  )

  const cx = size / 2, cy = size / 2
  const r  = size / 2 - 10
  const ri = r * 0.52   // inner radius for donut

  let cumAngle = -Math.PI / 2  // start from top

  const paths = slices.filter(sl => sl.value > 0).map((sl, i) => {
    const angle = (sl.value / total) * 2 * Math.PI
    const x1 = cx + r  * Math.cos(cumAngle)
    const y1 = cy + r  * Math.sin(cumAngle)
    const x2 = cx + ri * Math.cos(cumAngle)
    const y2 = cy + ri * Math.sin(cumAngle)
    cumAngle += angle
    const x3 = cx + r  * Math.cos(cumAngle)
    const y3 = cy + r  * Math.sin(cumAngle)
    const x4 = cx + ri * Math.cos(cumAngle)
    const y4 = cy + ri * Math.sin(cumAngle)
    const large = angle > Math.PI ? 1 : 0
    const d = [
      `M ${x2} ${y2}`,
      `L ${x1} ${y1}`,
      `A ${r} ${r} 0 ${large} 1 ${x3} ${y3}`,
      `L ${x4} ${y4}`,
      `A ${ri} ${ri} 0 ${large} 0 ${x2} ${y2}`,
      "Z"
    ].join(" ")
    return { d, color: sl.color, name: sl.name, value: sl.value, pct: Math.round((sl.value / total) * 100) }
  })

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size}>
          {paths.map((p, i) => (
            <path key={i} d={p.d} fill={p.color} opacity="0.9"
              style={{ transition: "opacity 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.opacity = "1"}
              onMouseLeave={e => e.currentTarget.style.opacity = "0.9"}
            />
          ))}
          {/* gap lines */}
          <circle cx={cx} cy={cy} r={ri - 1} fill="#161616" />
        </svg>
        {/* centre label */}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}>
          {label   && <span style={{ fontSize: "18px", fontWeight: 800, color: "var(--t-ffffff)",    lineHeight: 1 }}>{label}</span>}
          {sublabel && <span style={{ fontSize: "10px", color: "#6b7280", marginTop: "2px" }}>{sublabel}</span>}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%" }}>
        {paths.map((p, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: p.color, flexShrink: 0 }} />
              <span style={{ fontSize: "12px", color: "var(--t-9ca3af)" }}>{p.name}</span>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: p.color }}>{p.value}</span>
              <span style={{ fontSize: "11px", color: "var(--t-4b5563)", minWidth: "32px", textAlign: "right" }}>{p.pct}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Log Tab ───────────────────────────────────────────────────────────────────
function LogTab({ history, courses }) {
  const [showFilter, setShowFilter] = useState("absent")
  const [selectedCourse, setSelectedCourse] = useState("all")
  const [courseDropdownOpen, setCourseDropdownOpen] = useState(false)

  const filtered = history.filter(h => {
    const courseOk = selectedCourse === "all" || h.courseId === selectedCourse
    const statusOk = showFilter === "both" || h.status === showFilter
    return courseOk && statusOk
  })

  const selectedCourseName = selectedCourse === "all"
    ? "All Courses"
    : (courses.find(c => c.courseId === selectedCourse)?.courseName || selectedCourse)

  return (
    <div>
      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "13px", color: "var(--t-9ca3af)", fontWeight: 500 }}>Show:</span>
          {["absent", "present", "both"].map(opt => (
            <label key={opt} style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
              <div
                onClick={() => setShowFilter(opt)}
                style={{
                  width: "16px", height: "16px", borderRadius: "50%",
                  border: `2px solid ${showFilter === opt ? "#22C55E" : "var(--b-3a3a3a)"}`,
                  background: showFilter === opt ? "#22C55E" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", transition: "all 0.15s", flexShrink: 0,
                }}
              >
                {showFilter === opt && (
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#fff" }} />
                )}
              </div>
              <span
                onClick={() => setShowFilter(opt)}
                style={{
                  fontSize: "13px", fontWeight: 500, cursor: "pointer",
                  color: showFilter === opt ? "var(--t-ffffff)" : "var(--t-9ca3af)",
                  textTransform: "capitalize",
                }}
              >
                {opt === "both" ? "Both" : opt.charAt(0).toUpperCase() + opt.slice(1)}
              </span>
            </label>
          ))}
        </div>

        <div style={{ position: "relative" }}>
          <button
            onClick={() => setCourseDropdownOpen(!courseDropdownOpen)}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "8px 14px", borderRadius: "10px", cursor: "pointer",
              background: "var(--bg-161616)", border: "1px solid var(--b-2d2d2d)", color: "var(--t-d1d5db)",
              fontSize: "13px", fontWeight: 500, minWidth: "240px", justifyContent: "space-between",
              transition: "border-color 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "#3a3a3a"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "#2D2D2D"}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {selectedCourseName}
            </span>
            <ChevronDownIcon />
          </button>
          {courseDropdownOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 100,
              background: "var(--bg-161616)", border: "1px solid var(--b-2d2d2d)", borderRadius: "10px",
              overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
              minWidth: "240px",
            }}>
              {[{ courseId: "all", courseName: "All Courses" }, ...courses].map(c => (
                <button
                  key={c.courseId}
                  onClick={() => { setSelectedCourse(c.courseId); setCourseDropdownOpen(false) }}
                  style={{
                    width: "100%", textAlign: "left", padding: "10px 14px",
                    background: selectedCourse === c.courseId ? "#1e1e1e" : "transparent",
                    border: "none", color: selectedCourse === c.courseId ? "#22C55E" : "var(--t-d1d5db)",
                    fontSize: "13px", cursor: "pointer", transition: "background 0.1s",
                    borderBottom: "1px solid var(--b-1f1f1f)",
                  }}
                  onMouseEnter={e => { if (selectedCourse !== c.courseId) e.currentTarget.style.background = "#1a1a1a" }}
                  onMouseLeave={e => { if (selectedCourse !== c.courseId) e.currentTarget.style.background = "transparent" }}
                >
                  {c.courseId === "all" ? "All Courses" : `${c.courseId} — ${c.courseName || c.courseId}`}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Log table */}
      <div style={{ background: "var(--bg-111111)", border: "1px solid var(--b-2d2d2d)", borderRadius: "14px", overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "var(--t-4b5563)", fontSize: "13px" }}>
            No records match the selected filter
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--b-2d2d2d)", background: "#0f1a14" }}>
                  {["Date", "Course", "Status", "Notes"].map(col => (
                    <th key={col} style={{
                      padding: "12px 18px", textAlign: "left",
                      fontSize: "11px", fontWeight: 600, color: "#6b7280",
                      textTransform: "uppercase", letterSpacing: "0.06em",
                    }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((h, i) => (
                  <tr
                    key={i}
                    style={{ borderBottom: "1px solid var(--b-1a1a1a)", transition: "background 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#161616"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding: "13px 18px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                        <CalendarIcon style={{ color: "var(--t-4b5563)" }} />
                        <span style={{ fontSize: "13px", color: "var(--t-d1d5db)" }}>{formatDate(h.date)}</span>
                      </div>
                    </td>
                    <td style={{ padding: "13px 18px" }}>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--t-ffffff)" }}>{h.courseId}</div>
                      <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>
                        {(h.courseName || "").replace(h.courseId + " — ", "").replace(h.courseId, "") || h.courseName}
                      </div>
                    </td>
                    <td style={{ padding: "13px 18px" }}>
                      <StatusBadge status={h.status} />
                    </td>
                    <td style={{ padding: "13px 18px" }}>
                      {h.notes ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "var(--t-9ca3af)" }}>
                          <NoteIcon /> {h.notes}
                        </div>
                      ) : (
                        <span style={{ fontSize: "11px", color: "#3a3a3a", fontStyle: "italic" }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div style={{ marginTop: "8px", fontSize: "11px", color: "var(--t-4b5563)", textAlign: "right" }}>
        Showing {filtered.length} record{filtered.length !== 1 ? "s" : ""}
      </div>
    </div>
  )
}

// ── Monthly Tab ───────────────────────────────────────────────────────────────
function MonthlyTab({ history }) {
  const now = new Date()
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const monthMap = {}
  history.forEach(h => {
    const d = new Date(h.date + "T00:00:00")
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    if (key !== currentKey) return
    const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" })
    if (!monthMap[key]) monthMap[key] = { label, present: 0, absent: 0, late: 0, total: 0 }
    monthMap[key].total++
    monthMap[key][h.status] = (monthMap[key][h.status] || 0) + 1
  })
  const months = Object.entries(monthMap)

  if (!months.length) return (
    <div style={{ textAlign: "center", padding: "48px 0", color: "var(--t-4b5563)", fontSize: "13px" }}>
      No attendance records for this month
    </div>
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {months.map(([key, m]) => {
        const pct = m.total > 0 ? Math.round((m.present / m.total) * 100) : 0
        // Single green colour: present = #22C55E, non-present = dark grey
        const slices = [
          { value: m.present,           color: "#22C55E", name: "Present" },
          { value: m.total - m.present, color: "#2a2a2a", name: "Absent / Late" },
        ]
        return (
          <div key={key} style={{
            background: "var(--bg-161616)", border: "1px solid var(--b-2a2a2a)", borderRadius: "14px",
            padding: "20px 24px",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--t-ffffff)" }}>{m.label}</div>
              <span style={{
                fontSize: "13px", fontWeight: 700, color: "#22C55E",
                background: "rgba(34,197,94,0.12)", padding: "3px 12px", borderRadius: "20px",
                border: "1px solid rgba(34,197,94,0.35)",
              }}>
                {pct}% attendance
              </span>
            </div>

            {/* Pie chart only */}
            <div style={{ display: "flex", justifyContent: "center" }}>
              <PieChart
                slices={slices}
                size={180}
                label={`${pct}%`}
                sublabel="present"
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Overall Tab ───────────────────────────────────────────────────────────────
function OverallTab({ data }) {
  if (!data) return null
  const { summary } = data
  const overallPct  = summary.total > 0 ? Math.round((summary.present / summary.total) * 100) : 0
  const healthColor = overallPct >= 75? "#22C55E"   : "#EF4444"   
  // Single green colour: present = #22C55E, rest = dark grey
  const slices = [
    { value: summary.present,           color: "#22C55E", name: "Present"       },
    { value: summary.total - summary.present, color: "#2a2a2a", name: "Absent / Late" },
  ]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Pie chart card */}
      <div style={{
        background: "var(--bg-161616)", border: "1px solid var(--b-2a2a2a)", borderRadius: "16px",
        padding: "28px 32px", display: "flex", flexDirection: "column", alignItems: "center", gap: "20px",
      }}>
        <PieChart
          slices={slices}
          size={200}
          label={`${overallPct}%`}
          sublabel="present"
        />

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--t-ffffff)", marginBottom: "6px" }}>
            Overall Attendance
          </div>
          <div style={{ fontSize: "13px", color: "var(--t-9ca3af)", marginBottom: "10px" }}>
            {summary.present} present out of {summary.total} total sessions
          </div>
          {/* <div style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            padding: "5px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: 600,
            background: `${healthColor}18`, color: healthColor, border: `1px solid ${healthColor}40`,
          }}>
            {overallPct >= 75 ? "✓ Good Standing" : overallPct >= 50 ? "⚠ Needs Improvement" : "✕ At Risk"}
          </div> */}
        </div>
      </div>

      {/* Stats grid */}
      {/* <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "10px" }}>
        {[
          { label: "Present",        value: summary.present, color: "#22C55E", dot: "#22C55E" },
          { label: "Absent",         value: summary.absent,  color: "#f87171", dot: "#f87171" },
          { label: "Late",           value: summary.late,    color: "#facc15", dot: "#facc15" },
          { label: "Total Sessions", value: summary.total,   color: "#60a5fa", dot: "#60a5fa" },
        ].map(item => {
          const pct = summary.total > 0 ? Math.round((item.value / summary.total) * 100) : 0
          return (
            <div key={item.label} style={{
              background: "var(--bg-161616)", border: "1px solid var(--b-2a2a2a)", borderRadius: "12px",
              padding: "18px", display: "flex", flexDirection: "column", gap: "8px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: item.dot }} />
                <span style={{ fontSize: "11px", color: "var(--t-9ca3af)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {item.label}
                </span>
              </div>
              <div style={{ fontSize: "30px", fontWeight: 700, color: item.color, lineHeight: 1 }}>{item.value}</div>
              {item.label !== "Total Sessions" && (
                <div style={{ fontSize: "11px", color: "#6b7280" }}>{pct}% of sessions</div>
              )}
            </div>
          )
        })}
      </div> */}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function StudentProfile({ studentId, onClose }) {
  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [activeTab, setActiveTab] = useState("log")   // log | monthly | overall

  useEffect(() => {
    if (!studentId) return
    setLoading(true)
    setError(null)
    getStudentHistory(studentId)
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [studentId])

  const overallPct  = data?.summary?.total > 0
    ? Math.round((data.summary.present / data.summary.total) * 100) : 0
   const healthColor = overallPct >= 75? "#22C55E"   : "#EF4444"
  const courses     = data?.courseBreakdown || []

  const tabs = [
    { id: "log",     label: "Log"      },
    { id: "monthly", label: "Monthly"  },
    { id: "overall", label: "Over all" },
  ]

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "var(--bg-0a0a0a)",
      overflowY: "auto",
    }}>
      {/* Top bar */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "rgba(10,10,10,0.95)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--b-2d2d2d)",
        padding: "14px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <button
          onClick={onClose}
          style={{
            display: "flex", alignItems: "center", gap: "8px",
            fontSize: "13px", fontWeight: 600, color: "var(--t-9ca3af)",
            background: "none", border: "1px solid var(--b-2d2d2d)", cursor: "pointer", padding: "6px 12px",
            borderRadius: "8px", transition: "all 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "#1c1c1c"; e.currentTarget.style.color = "#fff" }}
          onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#9CA3AF" }}
        >
          <BackIcon /> Back to Attendance
        </button>

        <div style={{ fontSize: "13px", color: "var(--t-4b5563)", fontFamily: "monospace" }}>
          Student Attendance Profile
        </div>

        <button
          onClick={onClose}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: "32px", height: "32px", borderRadius: "8px",
            background: "none", border: "1px solid var(--b-2d2d2d)", color: "#6b7280",
            cursor: "pointer", transition: "all 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "#1c1c1c"; e.currentTarget.style.color = "#fff" }}
          onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#6b7280" }}
        >
          <CloseIcon />
        </button>
      </div>

      {/* Body */}
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "28px 24px", display: "flex", flexDirection: "column", gap: "20px" }}>

        {loading && (
          <div style={{ textAlign: "center", color: "#6b7280", paddingTop: "80px", fontSize: "14px" }}>
            Loading student data…
          </div>
        )}

        {error && (
          <div style={{ background: "#1a0f0f", border: "1px solid #4b1c1c", borderRadius: "12px", padding: "20px", color: "#f87171", fontSize: "13px" }}>
            Failed to load: {error}
          </div>
        )}

        {!loading && !error && data && (
          <>
            {/* ── Student Profile Card ── */}
            <div style={{
              background: "var(--bg-111111)", border: "1px solid var(--b-2d2d2d)", borderRadius: "16px",
              padding: "20px 24px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "18px", marginBottom: "20px" }}>
                {/* Avatar */}
                <div style={{
                  width: "72px", height: "72px", borderRadius: "50%",
                  background: "var(--bg-1c1c1c)", border: `3px solid ${healthColor}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--t-555555)", flexShrink: 0,
                }}>
                  <UserIcon />
                </div>

                {/* Name + ID */}
                <div style={{ flex: 1 }}>
                  <h1 style={{ fontSize: "20px", fontWeight: 700, color: "var(--t-ffffff)", margin: "0 0 3px" }}>
                    {data.studentName || studentId}
                  </h1>
                  
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{
                      fontSize: "12px", color: "#6b7280", fontFamily: "monospace",
                      background: "var(--bg-1c1c1c)", border: "1px solid var(--b-2a2a2a)",
                      padding: "2px 10px", borderRadius: "6px",
                    }}>
                      {studentId}
                    </span>
                    {courses.length > 0 && (
                      <span style={{ fontSize: "12px", color: "#6b7280" }}>
                        · {courses.length} course{courses.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>

                {/* Overall ring */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                  <div style={{ position: "relative" }}>
                    <CircleProgress value={overallPct} color={healthColor} size={72} />
                    <div style={{
                      position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center",
                    }}>
                      <span style={{ fontSize: "14px", fontWeight: 800, color: healthColor }}>{overallPct}%</span>
                    </div>
                  </div>
                  <span style={{ fontSize: "10px", color: "#6b7280", textAlign: "center" }}>Overall</span>
                </div>
              </div>

              {/* Section heading */}
              <div style={{
                marginBottom: "16px", paddingBottom: "16px", borderBottom: "1px solid var(--b-2d2d2d)",
              }}>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--t-ffffff)" }}>
                  Attendance %
                  {/* <span style={{ fontSize: "13px", fontWeight: 400, color: "#6b7280", marginLeft: "8px" }}>
                    / All Time
                  </span> */}
                </div>
              </div>

              {/* Tabs — Log | Monthly | Over all */}
              <div style={{ display: "flex", gap: "0", borderBottom: "1px solid var(--b-2d2d2d)" }}>
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      padding: "10px 18px", fontSize: "13px", fontWeight: 600,
                      background: "none", border: "none", cursor: "pointer",
                      color: activeTab === tab.id ? "#22C55E" : "var(--t-9ca3af)",
                      borderBottom: activeTab === tab.id ? "2px solid #22C55E" : "2px solid transparent",
                      marginBottom: "-1px",
                      transition: "color 0.15s",
                    }}
                    onMouseEnter={e => { if (activeTab !== tab.id) e.currentTarget.style.color = "#d1d5db" }}
                    onMouseLeave={e => { if (activeTab !== tab.id) e.currentTarget.style.color = "#9CA3AF" }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Tab Content ── */}
            <div>
              {activeTab === "log" && (
                <LogTab history={data.history || []} courses={courses} />
              )}
              {activeTab === "monthly" && (
                <MonthlyTab history={data.history || []} />
              )}
              {activeTab === "overall" && (
                <OverallTab data={data} />
              )}
            </div>
          </>
        )}

        {!loading && !error && data && data.history.length === 0 && (
          <div style={{ textAlign: "center", color: "#6b7280", fontSize: "13px", padding: "40px 0" }}>
            No attendance records found for this student.
          </div>
        )}
      </div>
    </div>
  )
}
