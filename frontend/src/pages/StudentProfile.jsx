import React, { useState, useEffect } from "react"
import { getStudentHistory } from "../services/api"

// ── Icons ─────────────────────────────────────────────────────────────────────
const UserIcon = () => (
  <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
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
const BookIcon = () => (
  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>
)
const TrendUpIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
  </svg>
)
const NoteIcon = () => (
  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
  </svg>
)
const CloseIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
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
      padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700,
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
    weekday: "short", year: "numeric", month: "short", day: "numeric",
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

function StatCard({ label, value, total, color, dot }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div style={{
      background: "#161616", border: "1px solid #2a2a2a", borderRadius: "14px",
      padding: "20px", display: "flex", flexDirection: "column", gap: "12px",
      flex: "1", minWidth: "130px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: dot }} />
        <span style={{ fontSize: "12px", color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: "32px", fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
          <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "4px" }}>{pct}% of sessions</div>
        </div>
        <div style={{ position: "relative" }}>
          <CircleProgress value={pct} color={dot} size={56} />
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "10px", fontWeight: 700, color, transform: "rotate(0deg)",
          }}>
            {pct}%
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Course Breakdown Card ─────────────────────────────────────────────────────
function CourseCard({ course }) {
  const pct = course.total > 0 ? Math.round((course.present / course.total) * 100) : 0
  const barColor = pct >= 75 ? "#4ade80" : pct >= 50 ? "#facc15" : "#f87171"
  return (
    <div style={{
      background: "#161616", border: "1px solid #2a2a2a", borderRadius: "12px",
      padding: "16px 18px",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px", marginBottom: "12px" }}>
        <div>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "#fff" }}>{course.courseName}</div>
          <div style={{ fontSize: "11px", color: "#6b7280", fontFamily: "monospace", marginTop: "2px" }}>{course.courseId}</div>
        </div>
        <span style={{
          fontSize: "13px", fontWeight: 700, color: barColor,
          background: `${barColor}20`, padding: "2px 10px", borderRadius: "20px",
          border: `1px solid ${barColor}50`,
          whiteSpace: "nowrap",
        }}>
          {pct}%
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ height: "5px", background: "#2a2a2a", borderRadius: "99px", overflow: "hidden", marginBottom: "12px" }}>
        <div style={{
          height: "100%", width: `${pct}%`, background: barColor, borderRadius: "99px",
          transition: "width 0.8s ease",
        }} />
      </div>

      <div style={{ display: "flex", gap: "14px" }}>
        {[
          { label: "Present", count: course.present, color: "#4ade80" },
          { label: "Absent",  count: course.absent,  color: "#f87171" },
          { label: "Late",    count: course.late,     color: "#facc15" },
        ].map(item => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: item.color }} />
            <span style={{ fontSize: "11px", color: "#6b7280" }}>{item.label}:</span>
            <span style={{ fontSize: "12px", fontWeight: 700, color: item.color }}>{item.count}</span>
          </div>
        ))}
        <span style={{ fontSize: "11px", color: "#4b5563", marginLeft: "auto" }}>{course.total} sessions</span>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function StudentProfile({ studentId, onClose }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [filter,  setFilter]  = useState("all")   // all | present | absent | late
  const [courseFilter, setCourseFilter] = useState("all")

  useEffect(() => {
    if (!studentId) return
    setLoading(true)
    setError(null)
    getStudentHistory(studentId)
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [studentId])

  // Derived
  const overallPct  = data?.summary?.total > 0
    ? Math.round((data.summary.present / data.summary.total) * 100) : 0
  const healthColor = overallPct >= 75 ? "#4ade80" : overallPct >= 50 ? "#facc15" : "#f87171"

  const courses = data?.courseBreakdown || []
  const filteredHistory = (data?.history || []).filter(h => {
    const statusOk = filter      === "all" || h.status   === filter
    const courseOk = courseFilter === "all" || h.courseId === courseFilter
    return statusOk && courseOk
  })

  // streak: current consecutive present days (sorted newest first already)
  const streak = (() => {
    if (!data?.history?.length) return 0
    let s = 0
    for (const h of [...data.history].sort((a,b) => b.date.localeCompare(a.date))) {
      if (h.status === "present") s++
      else break
    }
    return s
  })()

  const lastSeen = data?.history?.[0]?.date

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "#0A0A0A",
      overflowY: "auto",
    }}>
      {/* Top bar */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "rgba(10,10,10,0.95)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid #2D2D2D",
        padding: "14px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <button
          onClick={onClose}
          style={{
            display: "flex", alignItems: "center", gap: "8px",
            fontSize: "13px", fontWeight: 600, color: "#9CA3AF",
            background: "none", border: "none", cursor: "pointer", padding: "6px 12px",
            borderRadius: "8px", border: "1px solid #2D2D2D",
            transition: "all 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "#1c1c1c"; e.currentTarget.style.color = "#fff" }}
          onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#9CA3AF" }}
        >
          <BackIcon /> Back to Attendance
        </button>

        <div style={{ fontSize: "13px", color: "#4b5563", fontFamily: "monospace" }}>
          Student Profile
        </div>

        <button
          onClick={onClose}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: "32px", height: "32px", borderRadius: "8px",
            background: "none", border: "1px solid #2D2D2D", color: "#6b7280",
            cursor: "pointer", transition: "all 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "#1c1c1c"; e.currentTarget.style.color = "#fff" }}
          onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#6b7280" }}
        >
          <CloseIcon />
        </button>
      </div>

      {/* Body */}
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "32px 24px", display: "flex", flexDirection: "column", gap: "24px" }}>

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
            {/* ── Hero card ──────────────────────────────────────────────────── */}
            <div style={{
              background: "#111", border: "1px solid #2D2D2D", borderRadius: "16px",
              padding: "28px 32px",
              display: "flex", flexWrap: "wrap", alignItems: "center", gap: "28px",
            }}>
              {/* Avatar */}
              <div style={{
                width: "80px", height: "80px", borderRadius: "50%",
                background: "#1c1c1c", border: `3px solid ${healthColor}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#555", flexShrink: 0,
              }}>
                <UserIcon />
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: "180px" }}>
                <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#fff", margin: 0 }}>
                  {data.studentName || studentId}
                </h1>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "6px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "12px", color: "#6b7280", fontFamily: "monospace", background: "#1c1c1c", border: "1px solid #2a2a2a", padding: "3px 10px", borderRadius: "6px" }}>
                    {studentId}
                  </span>
                  {lastSeen && (
                    <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "#6b7280" }}>
                      <CalendarIcon /> Last session: {formatDate(lastSeen)}
                    </span>
                  )}
                  {streak > 0 && (
                    <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "#facc15", background: "rgba(202,138,4,0.1)", border: "1px solid rgba(202,138,4,0.3)", padding: "3px 10px", borderRadius: "6px" }}>
                      🔥 {streak} session streak
                    </span>
                  )}
                </div>
                <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "12px", color: "#6b7280" }}>Enrolled in</span>
                  {courses.map(c => (
                    <span key={c.courseId} style={{
                      fontSize: "11px", color: "#9CA3AF", background: "#1c1c1c",
                      border: "1px solid #2a2a2a", padding: "2px 8px", borderRadius: "6px",
                      display: "flex", alignItems: "center", gap: "4px",
                    }}>
                      <BookIcon /> {c.courseId}
                    </span>
                  ))}
                </div>
              </div>

              {/* Overall attendance ring */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                <div style={{ position: "relative" }}>
                  <CircleProgress value={overallPct} color={healthColor} size={96} />
                  <div style={{
                    position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                  }}>
                    <span style={{ fontSize: "20px", fontWeight: 800, color: healthColor }}>{overallPct}%</span>
                  </div>
                </div>
                <span style={{ fontSize: "11px", color: "#6b7280", textAlign: "center" }}>Overall<br/>Attendance</span>
              </div>
            </div>

            {/* ── Stat cards ─────────────────────────────────────────────────── */}
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <StatCard label="Present" value={data.summary.present} total={data.summary.total} color="#4ade80" dot="#4ade80" />
              <StatCard label="Absent"  value={data.summary.absent}  total={data.summary.total} color="#f87171" dot="#f87171" />
              <StatCard label="Late"    value={data.summary.late}    total={data.summary.total} color="#facc15" dot="#facc15" />
              {/* Total sessions */}
              <div style={{
                background: "#161616", border: "1px solid #2a2a2a", borderRadius: "14px",
                padding: "20px", flex: "1", minWidth: "130px", display: "flex", flexDirection: "column", gap: "8px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <TrendUpIcon style={{ color: "#60a5fa" }} />
                  <span style={{ fontSize: "12px", color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Sessions</span>
                </div>
                <div style={{ fontSize: "32px", fontWeight: 700, color: "#60a5fa", lineHeight: 1 }}>{data.summary.total}</div>
                <div style={{ fontSize: "11px", color: "#6b7280" }}>across {courses.length} course{courses.length !== 1 ? "s" : ""}</div>
              </div>
            </div>

            {/* ── Course breakdown ───────────────────────────────────────────── */}
            {courses.length > 0 && (
              <div>
                <h2 style={{ fontSize: "14px", fontWeight: 600, color: "#9CA3AF", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Course Breakdown
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
                  {courses.map(c => <CourseCard key={c.courseId} course={c} />)}
                </div>
              </div>
            )}

            {/* ── History table ──────────────────────────────────────────────── */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", marginBottom: "12px" }}>
                <h2 style={{ fontSize: "14px", fontWeight: 600, color: "#9CA3AF", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Attendance History
                  <span style={{ fontWeight: 400, color: "#4b5563", marginLeft: "8px", fontSize: "12px" }}>
                    ({filteredHistory.length} records)
                  </span>
                </h2>

                {/* Filters */}
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {/* Status filter */}
                  <div style={{ display: "flex", background: "#1c1c1c", border: "1px solid #2D2D2D", borderRadius: "8px", overflow: "hidden" }}>
                    {["all", "present", "absent", "late"].map(f => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        style={{
                          padding: "6px 12px", fontSize: "11px", fontWeight: 600, cursor: "pointer", border: "none",
                          background: filter === f ? "#2a2a2a" : "transparent",
                          color: filter === f
                            ? (f === "all" ? "#fff" : STATUS_STYLE[f]?.color)
                            : "#6b7280",
                          textTransform: "capitalize",
                          transition: "all 0.15s",
                        }}
                      >
                        {f === "all" ? "All" : STATUS_STYLE[f]?.label}
                      </button>
                    ))}
                  </div>

                  {/* Course filter */}
                  {courses.length > 1 && (
                    <select
                      value={courseFilter}
                      onChange={e => setCourseFilter(e.target.value)}
                      style={{
                        background: "#1c1c1c", border: "1px solid #2D2D2D", borderRadius: "8px",
                        padding: "6px 12px", fontSize: "11px", color: "#9CA3AF", cursor: "pointer", outline: "none",
                      }}
                    >
                      <option value="all">All Courses</option>
                      {courses.map(c => (
                        <option key={c.courseId} value={c.courseId}>{c.courseId}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div style={{ background: "#111", border: "1px solid #2D2D2D", borderRadius: "14px", overflow: "hidden" }}>
                {filteredHistory.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "48px 0", color: "#4b5563", fontSize: "13px" }}>
                    No records match the selected filter
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #2D2D2D" }}>
                          {["Date", "Course", "Status", "Notes"].map(col => (
                            <th key={col} style={{
                              padding: "11px 18px", textAlign: "left",
                              fontSize: "11px", fontWeight: 600, color: "#6b7280",
                              textTransform: "uppercase", letterSpacing: "0.06em",
                              background: "#111",
                            }}>
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredHistory.map((h, i) => (
                          <tr
                            key={i}
                            style={{ borderBottom: "1px solid #1a1a1a", transition: "background 0.15s" }}
                            onMouseEnter={e => e.currentTarget.style.background = "#161616"}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                          >
                            <td style={{ padding: "12px 18px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                                <CalendarIcon style={{ color: "#4b5563" }} />
                                <span style={{ fontSize: "13px", color: "#d1d5db" }}>{formatDate(h.date)}</span>
                              </div>
                            </td>
                            <td style={{ padding: "12px 18px" }}>
                              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                <span style={{ fontSize: "12px", fontWeight: 600, color: "#fff" }}>{h.courseId}</span>
                                <span style={{ fontSize: "11px", color: "#6b7280" }}>{h.courseName.replace(h.courseId + " — ", "").replace(h.courseId, "")}</span>
                              </div>
                            </td>
                            <td style={{ padding: "12px 18px" }}>
                              <StatusBadge status={h.status} />
                            </td>
                            <td style={{ padding: "12px 18px" }}>
                              {h.notes ? (
                                <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "#9CA3AF" }}>
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
