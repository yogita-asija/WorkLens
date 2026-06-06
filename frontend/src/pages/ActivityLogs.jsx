import React, { useState, useEffect, useCallback } from "react"
import { getActivityLogs } from "../services/api"

// ── Constants ─────────────────────────────────────────────────────────────────
const ACTIVITY_TYPES = [
  { id: "all",        label: "All Activities" },
  { id: "assignment", label: "Assignment" },
  { id: "attendance", label: "Attendance" },
  { id: "grading",    label: "Grading" },
  { id: "course",     label: "Course" },
  { id: "deadline",   label: "Deadline" },
]

const TYPE_META = {
  assignment: { label: "Assignment" },
  attendance: { label: "Attendance" },
  grading:    { label: "Grading" },
  course:     { label: "Course" },
  deadline:   { label: "Deadline" },
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const IconCalendar   = () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
const IconFilter     = () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
const IconChevron    = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
const IconAssignment = () => <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
const IconAttendance = () => <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
const IconGrading    = () => <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
const IconCourse     = () => <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
const IconDeadline   = () => <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
const IconRefresh    = () => <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
const IconSearch     = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>



const TYPE_ICON = {
  assignment: <IconAssignment />,
  attendance: <IconAttendance />,
  grading:    <IconGrading />,
  course:     <IconCourse />,
  deadline:   <IconDeadline />,
}

// ── Styles ────────────────────────────────────────────────────────────────────
const card      = { background: "#262626", border: "1px solid #333333", borderRadius: "12px" }
const innerCard = { background: "#2f2f2f", border: "1px solid #333333", borderRadius: "8px" }
const inputStyle = {
  background: "#2f2f2f", border: "1px solid #333333", borderRadius: "8px",
  color: "#FFFFFF", fontSize: "13px", padding: "9px 12px 9px 36px", width: "100%", outline: "none",
}
const labelStyle = {
  fontSize: "11px", fontWeight: 600, textTransform: "uppercase",
  letterSpacing: "0.06em", color: "#9CA3AF", display: "block", marginBottom: "6px",
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function toInputDate(d) { return d.toISOString().slice(0, 10) }

function fmtTimestamp(ts) {
  const d    = new Date(ts)
  const date = d.toLocaleDateString("en-GB").replace(/\//g, "-")
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
  return `${date}  ${time}`
}

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── Filter Bar ────────────────────────────────────────────────────────────────
function FilterBar({ fromDate, toDate, typeFilter, setFromDate, setToDate, setTypeFilter, onApply, loading }) {
  return (
    <div style={{ ...card, padding: "20px" }}>
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>

        {/* From date */}
        <div style={{ flex: 1, minWidth: "160px" }}>
          <label style={labelStyle}>From Date</label>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#6B7280" }}>
              <IconCalendar />
            </span>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
              style={{ ...inputStyle, colorScheme: "dark" }} />
          </div>
        </div>

        {/* To date */}
        <div style={{ flex: 1, minWidth: "160px" }}>
          <label style={labelStyle}>To Date</label>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#6B7280" }}>
              <IconCalendar />
            </span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
              style={{ ...inputStyle, colorScheme: "dark" }} />
          </div>
        </div>

        {/* Type */}
        <div style={{ flex: 1, minWidth: "160px" }}>
          <label style={labelStyle}>Activity Type</label>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#6B7280" }}>
              <IconFilter />
            </span>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
              style={{ ...inputStyle, appearance: "none", cursor: "pointer", paddingRight: "32px" }}>
              {ACTIVITY_TYPES.map((t) => (
                <option key={t.id} value={t.id} style={{ background: "#262626" }}>{t.label}</option>
              ))}
            </select>
            <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#6B7280", pointerEvents: "none" }}>
              <IconChevron />
            </span>
          </div>
        </div>

        {/* Apply */}
        <button onClick={onApply} disabled={loading} style={{
          background: loading ? "#15803d" : "#22C55E",
          color: "#000", fontWeight: 600, fontSize: "13px",
          padding: "10px 24px", borderRadius: "8px", border: "none",
          cursor: loading ? "not-allowed" : "pointer", height: "38px",
          display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap",
        }}>
          <IconRefresh /> {loading ? "Loading..." : "Apply Filters"}
        </button>
      </div>
    </div>
  )
}

// ── Single activity row ───────────────────────────────────────────────────────
function ActivityItem({ log, isLast }) {
  const [hovering, setHovering] = useState(false)
  const meta = TYPE_META[log.type] ?? { label: log.type }
  const icon = TYPE_ICON[log.type]

  return (
    <div
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      style={{
        display: "flex", gap: "14px",
        padding: "18px 0",
        borderBottom: isLast ? "none" : "1px solid #333333",
        position: "relative",
      }}
    >
      {/* Icon circle */}
      <div style={{
        flexShrink: 0, width: "34px", height: "34px", borderRadius: "50%",
        background: "#2f2f2f", border: "1px solid #333333",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#9CA3AF", marginTop: "2px",
      }}>
        {icon}
      </div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
          <div>
            {/* Type badge */}
            <span style={{
              fontSize: "10px", fontWeight: 600, padding: "2px 8px",
              borderRadius: "4px", background: "#2f2f2f", border: "1px solid #444",
              color: "#9CA3AF", letterSpacing: "0.05em", textTransform: "uppercase",
              display: "inline-block", marginBottom: "4px",
            }}>
              {meta.label}
            </span>
            <p style={{ fontSize: "14px", color: "#22C55E", fontWeight: 500, margin: "0 0 2px" }}>{log.title}</p>
            <p style={{ fontSize: "13px", color: "#FFFFFF", fontWeight: 500, margin: "0 0 2px" }}>{log.subject}</p>
            <p style={{ fontSize: "12px", color: "#6B7280", margin: 0 }}>{log.course}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: "12px", color: "#6B7280", margin: 0, fontVariantNumeric: "tabular-nums" }}>
                {fmtTimestamp(log.timestamp || log.createdAt)}
              </p>
              <p style={{ fontSize: "11px", color: "#4b5563", margin: "2px 0 0" }}>
                {timeAgo(log.timestamp || log.createdAt)}
              </p>
            </div>
            {/* Delete button — shows on hover */}
            
          </div>
        </div>

        {/* Detail pill */}
        {log.detail && (
          <p style={{
            fontSize: "12px", color: "#9CA3AF", marginTop: "8px",
            padding: "6px 12px", display: "inline-block", ...innerCard,
          }}>
            {log.detail}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div style={{ display: "flex", gap: "14px", padding: "18px 0", borderBottom: "1px solid #333333" }}>
      <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#333", flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ height: 12, width: "30%", background: "#333", borderRadius: 4, marginBottom: 8 }} />
        <div style={{ height: 14, width: "60%", background: "#333", borderRadius: 4, marginBottom: 6 }} />
        <div style={{ height: 12, width: "40%", background: "#2a2a2a", borderRadius: 4 }} />
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function ActivityLogs() {
  const end   = new Date()
  const start = new Date(); start.setDate(end.getDate() - 30)

  const [fromDate,   setFromDate]   = useState(toInputDate(start))
  const [toDate,     setToDate]     = useState(toInputDate(end))
  const [typeFilter, setTypeFilter] = useState("all")

  const [logs,    setLogs]    = useState([])
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState("")
  const [search, setSearch] = useState("")

  const [toast, setToast] = useState("")

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500) }

  // ── Fetch from backend ──────────────────────────────────────────────────────
  const fetchLogs = useCallback((params) => {
    setLoading(true)
    setError("")
    getActivityLogs(params)
      .then((data) => {
        // Backend returns { logs: [...], stats: {...} }
        setLogs(data.logs || [])
        setStats(data.stats || null)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message || "Failed to fetch activity logs")
        setLoading(false)
      })
  }, [])

  // Fetch on mount
  useEffect(() => {
    fetchLogs({ from: fromDate, to: toDate, type: typeFilter })
  }, []) // eslint-disable-line

  const handleApply = () => {
    fetchLogs({ from: fromDate, to: toDate, type: typeFilter })
  }

  const filteredLogs = logs.filter((log) => {
    const text = (
      log.title +
      log.subject +
      log.course +
      (log.detail || "")
    ).toLowerCase()

    return text.includes(search.toLowerCase())
  })


  

  
  return (
    <div style={{ minHeight: "100vh",
    background: "#0A0A0A",
    padding: "2px 10px 10px",
    fontFamily: "Inter, sans-serif",
  }}
>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 600, color: "#FFFFFF", margin: 0 }}>Activity Logs</h1>
          <p style={{ fontSize: "13px", color: "#9CA3AF", margin: "4px 0 0" }}>
            Track and review all your teaching activities.
          </p>
        </div>
      
      </div>

      {/* Filter bar */}
      <div style={{ marginBottom: "24px" }}>
        <FilterBar
          fromDate={fromDate} toDate={toDate} typeFilter={typeFilter}
          setFromDate={setFromDate} setToDate={setToDate} setTypeFilter={setTypeFilter}
          onApply={handleApply} loading={loading}
        />
      </div>

      {/* Error banner */}
      {error && !loading && (
        <div style={{
          background: "#1a0f0f", border: "1px solid #4b1c1c",
          borderRadius: "12px", padding: "16px 20px", marginBottom: "20px",
          color: "#f87171", fontSize: "13px",
        }}>
          ⚠️ {error} — Make sure the backend is running on port 8000.
          <button onClick={handleApply} style={{
            marginLeft: "12px", background: "none", border: "1px solid #4b1c1c",
            color: "#f87171", fontSize: "12px", padding: "4px 10px",
            borderRadius: "6px", cursor: "pointer",
          }}>Retry</button>
        </div>
      )}

      {/* Two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "20px", alignItems: "start" }}>

        {/* ── Timeline ── */}
        <div style={card}>
                  <div style={{ 
            padding: "20px 24px", 
            borderBottom: "1px solid #333333",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <div>
              <h2 style={{ fontSize: "15px", fontWeight: 600, color: "#FFFFFF", margin: 0 }}>
                Activity Timeline
              </h2>
              <p style={{ fontSize: "13px", color: "#9CA3AF", margin: "3px 0 0" }}>
                {loading ? "Loading..." : `${filteredLogs.length} ${filteredLogs.length === 1 ? "activity" : "activities"} found`}
              </p>
            </div>

            {/* 🔍 SEARCH BAR */}
            <input
              type="text"
              placeholder="Search activities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                background: "#2f2f2f",
                border: "1px solid #333333",
                borderRadius: "8px",
                color: "#FFFFFF",
                fontSize: "13px",
                padding: "8px 12px",
                width: "220px",
                outline: "none"
              }}
            />
          </div>

          <div style={{ padding: "0 24px" }}>
            {loading ? (
              // Skeleton
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            ) : logs.length === 0 ? (
              <div style={{ padding: "60px 0", textAlign: "center" }}>
                <p style={{ color: "#6B7280", fontSize: "14px", marginBottom: "8px" }}>No activities found</p>
                <p style={{ color: "#4b5563", fontSize: "12px" }}>
                  Activities are logged automatically when you mark attendance, create assignments, etc.
                </p>
              </div>
            ) : (
              filteredLogs.map((log, i) => (
                <ActivityItem
                  key={log._id}
                  log={log}
                  isLast={i === logs.length - 1}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Activity Summary */}
          <div style={card}>
            <div style={{ padding: "20px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#FFFFFF", margin: "0 0 16px" }}>
                Activity Summary
              </h3>

              {loading ? (
                <>
                  <div style={{ height: 32, width: "50%", background: "#333", borderRadius: 4, marginBottom: 8 }} />
                  <div style={{ height: 12, width: "70%", background: "#2a2a2a", borderRadius: 4 }} />
                </>
              ) : (
                <>
                  <div style={{ marginBottom: "16px" }}>
                    <p style={{ fontSize: "12px", color: "#9CA3AF", margin: "0 0 2px" }}>Total Activities</p>
                    <p style={{ fontSize: "28px", fontWeight: 700, color: "#FFFFFF", margin: 0, lineHeight: 1.1 }}>
                      {stats?.total ?? logs.length}
                    </p>
                    <p style={{ fontSize: "12px", color: "#6B7280", margin: "3px 0 0" }}>
                      Last 7 days: {stats?.last7 ?? "—"}
                    </p>
                  </div>

                  {stats?.mostActiveDay && stats.mostActiveDay !== "—" && (
                    <div style={{ borderTop: "1px solid #333333", paddingTop: "16px" }}>
                      <p style={{ fontSize: "12px", color: "#9CA3AF", margin: "0 0 2px" }}>Most Active Day</p>
                      <p style={{ fontSize: "20px", fontWeight: 700, color: "#FFFFFF", margin: 0 }}>
                        {stats.mostActiveDay}
                      </p>
                      <p style={{ fontSize: "12px", color: "#6B7280", margin: "3px 0 0" }}>
                        {stats.mostActiveDayCount} activities
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Activity Breakdown */}
          <div style={card}>
            <div style={{ padding: "20px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#FFFFFF", margin: "0 0 16px" }}>
                Activity Breakdown
              </h3>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} style={{ height: 28, background: "#2a2a2a", borderRadius: 6, marginBottom: 8 }} />
                ))
              ) : (stats?.breakdown?.length ?? 0) === 0 ? (
                <p style={{ fontSize: "12px", color: "#6B7280" }}>No data yet</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {stats.breakdown.map(({ type, count }) => (
                    <div key={type} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{
                        fontSize: "12px", fontWeight: 500, color: "#9CA3AF",
                        background: "#2f2f2f", border: "1px solid #333333",
                        borderRadius: "6px", padding: "3px 10px",
                      }}>
                        {TYPE_META[type]?.label ?? type}
                      </span>
                      <span style={{ fontSize: "14px", fontWeight: 600, color: "#FFFFFF" }}>{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Productivity Insight */}
          {stats?.mostActiveDay && stats.mostActiveDay !== "—" && (
            <div style={{ ...card, background: "#1a2e22", border: "1px solid #2d4a38" }}>
              <div style={{ padding: "20px" }}>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "#FFFFFF", margin: "0 0 6px" }}>
                  Productivity Insight
                </p>
                <p style={{ fontSize: "12px", color: "#9CA3AF", margin: 0, lineHeight: 1.6 }}>
                  You've been most active on {stats.mostActiveDay}s. Consider scheduling
                  complex tasks on this day for better productivity.
                </p>
              </div>
            </div>
          )}

          {/* Empty state hint */}
          {!loading && logs.length === 0 && !error && (
            <div style={{ ...card, background: "#1a1a2e", border: "1px solid #2d2d4a" }}>
              <div style={{ padding: "20px" }}>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "#FFFFFF", margin: "0 0 8px" }}>
                  How logs are created
                </p>
                <p style={{ fontSize: "12px", color: "#9CA3AF", margin: 0, lineHeight: 1.7 }}>
                  ✓ Mark attendance<br />
                  ✓ Save assignment<br />
                  ✓ Delete record <br />

                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: "24px", right: "24px", zIndex: 1000,
          background: "#0f1a10", border: "1px solid #1c4b1c",
          color: "#4ade80", fontSize: "13px", fontWeight: 600,
          padding: "10px 20px", borderRadius: "8px",
        }}>
          ✓ {toast}
        </div>
      )}
    </div>
  )
}
