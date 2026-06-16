import { useState, useEffect, useCallback } from "react"
import {
  Calendar, Clock, BookOpen, Coffee,
  ChevronLeft, ChevronRight, RefreshCw,
  MapPin, Users, GraduationCap, Layers,
  Sun, Sunrise, Sunset,
} from "lucide-react"
import { getTimetable } from "../services/api"
import useAppStore from "../store/useAppStore"

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const DAY_SHORT = { Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu", Friday: "Fri", Saturday: "Sat" }

// ── Colour palette per course (cycles through) ──────────────────────────
const SLOT_COLORS = [
  { bg: "rgba(34,197,94,0.10)",  border: "rgba(34,197,94,0.35)",  text: "#4ade80",  label: "green"  },
  { bg: "rgba(99,102,241,0.10)", border: "rgba(99,102,241,0.35)", text: "#818cf8",  label: "indigo" },
  { bg: "rgba(249,115,22,0.10)", border: "rgba(249,115,22,0.35)", text: "#fb923c",  label: "orange" },
  { bg: "rgba(236,72,153,0.10)", border: "rgba(236,72,153,0.35)", text: "#f472b6",  label: "pink"   },
  { bg: "rgba(20,184,166,0.10)", border: "rgba(20,184,166,0.35)", text: "#2dd4bf",  label: "teal"   },
  { bg: "rgba(234,179,8,0.10)",  border: "rgba(234,179,8,0.35)",  text: "#facc15",  label: "yellow" },
  { bg: "rgba(139,92,246,0.10)", border: "rgba(139,92,246,0.35)", text: "#a78bfa",  label: "violet" },
  { bg: "rgba(239,68,68,0.10)",  border: "rgba(239,68,68,0.35)",  text: "#f87171",  label: "red"    },
]

function getColor(courseId, colorMap) {
  if (!colorMap[courseId]) {
    const taken = Object.keys(colorMap).length
    colorMap[courseId] = SLOT_COLORS[taken % SLOT_COLORS.length]
  }
  return colorMap[courseId]
}

// ── Stat card ────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 16,
      padding: "20px 22px",
      display: "flex",
      gap: 14,
      alignItems: "center",
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
        background: accent + "22",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={20} color={accent} />
      </div>
      <div>
        <p style={{ fontSize: 22, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{value}</p>
        <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 3 }}>{label}</p>
        {sub && <p style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{sub}</p>}
      </div>
    </div>
  )
}

// ── Single timetable cell ────────────────────────────────────────────────
function SlotCell({ slots, isToday, colorMap }) {
  if (!slots || slots.length === 0) {
    return (
      <td style={{
        padding: "10px 8px",
        verticalAlign: "top",
        background: isToday ? "rgba(34,197,94,0.03)" : "transparent",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        borderRight: "1px solid rgba(255,255,255,0.05)",
        minWidth: 130,
      }}>
        <div style={{
          height: 72, display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: 10, border: "1px dashed rgba(255,255,255,0.07)",
        }}>
          <span style={{ fontSize: 11, color: "#4b5563" }}>—</span>
        </div>
      </td>
    )
  }

  return (
    <td style={{
      padding: "8px 8px",
      verticalAlign: "top",
      background: isToday ? "rgba(34,197,94,0.04)" : "transparent",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
      borderRight: "1px solid rgba(255,255,255,0.05)",
      minWidth: 130,
    }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {slots.map((slot, i) => {
          const c = getColor(String(slot.courseId), colorMap)
          return (
            <div key={i} style={{
              background: c.bg,
              border: `1px solid ${c.border}`,
              borderRadius: 10,
              padding: "8px 10px",
              cursor: "default",
            }}>
              <p style={{
                fontSize: 12, fontWeight: 700, color: c.text,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                marginBottom: 4,
              }}>
                {slot.courseName}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 10, color: "#9ca3af", display: "flex", gap: 4, alignItems: "center" }}>
                  <GraduationCap size={10} /> Sem {slot.sem}
                </span>
                <span style={{ fontSize: 10, color: "#9ca3af", display: "flex", gap: 4, alignItems: "center" }}>
                  <Layers size={10} /> Batch {slot.batch}
                </span>
                <span style={{ fontSize: 10, color: "#9ca3af", display: "flex", gap: 4, alignItems: "center" }}>
                  <MapPin size={10} /> {slot.room}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </td>
  )
}

// ── Today's schedule list ─────────────────────────────────────────────────
function TodaySchedule({ classes, todayName, colorMap }) {
  if (!classes || classes.length === 0) {
    return (
      <div style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16, padding: 24,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 10, minHeight: 120,
      }}>
        <Coffee size={28} color="#4b5563" />
        <p style={{ color: "#6b7280", fontSize: 13 }}>No classes scheduled for today</p>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {classes.map((slot, i) => {
        const c = getColor(String(slot.courseId), colorMap)
        return (
          <div key={i} style={{
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${c.border}`,
            borderLeft: `3px solid ${c.text}`,
            borderRadius: 12,
            padding: "14px 16px",
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 10,
            alignItems: "center",
          }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 6 }}>
                {slot.courseName}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px" }}>
                <span style={{ fontSize: 11, color: "#9ca3af", display: "flex", gap: 4, alignItems: "center" }}>
                  <GraduationCap size={11} /> Sem {slot.sem}
                </span>
                <span style={{ fontSize: 11, color: "#9ca3af", display: "flex", gap: 4, alignItems: "center" }}>
                  <Layers size={11} /> Batch {slot.batch}
                </span>
                <span style={{ fontSize: 11, color: "#9ca3af", display: "flex", gap: 4, alignItems: "center" }}>
                  <MapPin size={11} /> {slot.room}
                </span>
                <span style={{ fontSize: 11, color: "#9ca3af", display: "flex", gap: 4, alignItems: "center" }}>
                  <Users size={11} /> {slot.students} students
                </span>
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <p style={{ fontSize: 12, color: c.text, fontWeight: 600 }}>
                {slot.timeInfo?.display || slot.timeInfo?.start || "TBD"}
              </p>
              <p style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                {slot.durationMins} min
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────
export default function TimetablePage() {
  const user = useAppStore(s => s.user)

  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [activeDay, setActiveDay] = useState(null) // for mobile day filter
  const colorMap = {}                               // courseId → color (stable per render)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getTimetable(user?._id)
      setData(res)
      setActiveDay(res.today)
    } catch (e) {
      setError(e.message || "Failed to load timetable")
    } finally {
      setLoading(false)
    }
  }, [user?._id])

  useEffect(() => { fetchData() }, [fetchData])

  // Collect all unique time-slot labels (for table rows)
  const timeSlots = data
    ? [...new Map(
        DAYS.flatMap(d => (data.timetable[d] || []).map(s => [s.timeInfo.display, s]))
          .sort((a, b) => a[1].timeInfo.sortKey - b[1].timeInfo.sortKey)
      ).entries()].map(([k]) => k)
    : []

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 320, gap: 10 }}>
        <RefreshCw size={18} color="#4ade80" style={{ animation: "spin 1s linear infinite" }} />
        <span style={{ color: "#6b7280", fontSize: 14 }}>Loading timetable…</span>
        <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        height: 320, gap: 12,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: "rgba(239,68,68,0.1)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Calendar size={22} color="#f87171" />
        </div>
        <p style={{ color: "#f87171", fontSize: 14 }}>{error}</p>
        <button
          onClick={fetchData}
          style={{
            padding: "8px 20px", borderRadius: 99, border: "1px solid rgba(255,255,255,0.1)",
            background: "transparent", color: "#9ca3af", fontSize: 13, cursor: "pointer",
          }}
        >Retry</button>
      </div>
    )
  }

  const { stats, today: todayName, timetable } = data
  const todayClasses = timetable[todayName] || []

  return (
    <div className="space-y-6 text-white font-sans">

      {/* ── Page header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 3 }}>My Timetable</h1>
          <p style={{ fontSize: 13, color: "#6b7280" }}>
            Weekly class schedule · {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <button
          onClick={fetchData}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "8px 16px", borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.04)",
            color: "#9ca3af", fontSize: 13, cursor: "pointer",
          }}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <StatCard
          icon={Calendar}
          label="Total Classes This Week"
          value={stats.totalClassesWeek}
          sub="across all courses"
          accent="#4ade80"
        />
        <StatCard
          icon={BookOpen}
          label="Today's Classes"
          value={stats.todayClassesCount}
          sub={`${todayName}`}
          accent="#818cf8"
        />
        <StatCard
          icon={Coffee}
          label="Free Periods Today"
          value={stats.freePeriodsToday}
          sub="unscheduled time slots"
          accent="#fb923c"
        />
        <StatCard
          icon={Clock}
          label="Teaching Hours"
          value={`${stats.teachingHoursWeek}h`}
          sub={`${stats.teachingHoursToday}h today`}
          accent="#2dd4bf"
        />
      </div>

      {/* ── Today's schedule ── */}
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16, padding: "20px 22px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: "rgba(34,197,94,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Sun size={16} color="#4ade80" />
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>Today — {todayName}</p>
            <p style={{ fontSize: 11, color: "#6b7280" }}>
              {stats.todayClassesCount} class{stats.todayClassesCount !== 1 ? "es" : ""} · {stats.teachingHoursToday}h teaching
            </p>
          </div>
        </div>
        <TodaySchedule classes={todayClasses} todayName={todayName} colorMap={colorMap} />
      </div>

      {/* ── Weekly timetable ── */}
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16, padding: "20px 0 0 0",
        overflow: "hidden",
      }}>
        {/* Table heading row */}
        <div style={{ padding: "0 22px 16px 22px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: "rgba(99,102,241,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Layers size={16} color="#818cf8" />
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>Weekly Schedule</p>
        </div>

        {timeSlots.length === 0 ? (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", gap: 10, padding: "40px 24px 40px",
          }}>
            <Calendar size={32} color="#374151" />
            <p style={{ color: "#6b7280", fontSize: 13 }}>
              No courses with schedules found.
              Add schedules to your courses to see them here.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: 110 }} />
                {DAYS.map(d => <col key={d} style={{ width: 150 }} />)}
              </colgroup>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.04)" }}>
                  <th style={{
                    padding: "12px 14px", textAlign: "left",
                    fontSize: 11, fontWeight: 600, color: "#6b7280",
                    textTransform: "uppercase", letterSpacing: "0.05em",
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                    borderRight: "1px solid rgba(255,255,255,0.05)",
                  }}>
                    Time
                  </th>
                  {DAYS.map(day => {
                    const isToday = day === todayName
                    return (
                      <th key={day} style={{
                        padding: "12px 10px", textAlign: "center",
                        fontSize: 11, fontWeight: 600,
                        color: isToday ? "#4ade80" : "#6b7280",
                        textTransform: "uppercase", letterSpacing: "0.05em",
                        borderBottom: "1px solid rgba(255,255,255,0.08)",
                        borderRight: "1px solid rgba(255,255,255,0.05)",
                        background: isToday ? "rgba(34,197,94,0.06)" : "transparent",
                        position: "relative",
                      }}>
                        {isToday && (
                          <span style={{
                            position: "absolute", top: 6, right: 6,
                            width: 6, height: 6, borderRadius: "50%",
                            background: "#4ade80",
                          }} />
                        )}
                        <span style={{ display: "block" }}>{DAY_SHORT[day]}</span>
                        <span style={{ fontSize: 9, display: "block", marginTop: 1, opacity: 0.6 }}>{day}</span>
                        {timetable[day]?.length > 0 && (
                          <span style={{
                            display: "inline-block", marginTop: 4,
                            padding: "1px 7px", borderRadius: 99,
                            background: isToday ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.07)",
                            fontSize: 9, color: isToday ? "#4ade80" : "#9ca3af",
                            fontWeight: 600,
                          }}>
                            {timetable[day].length} class{timetable[day].length !== 1 ? "es" : ""}
                          </span>
                        )}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {timeSlots.map(timeLabel => (
                  <tr key={timeLabel}>
                    {/* Time column */}
                    <td style={{
                      padding: "10px 14px",
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                      borderRight: "1px solid rgba(255,255,255,0.05)",
                      verticalAlign: "middle",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Clock size={11} color="#4b5563" />
                        <span style={{ fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap" }}>
                          {timeLabel}
                        </span>
                      </div>
                    </td>
                    {/* Day columns */}
                    {DAYS.map(day => {
                      const isToday = day === todayName
                      const daySlots = (timetable[day] || []).filter(
                        s => s.timeInfo.display === timeLabel
                      )
                      return (
                        <SlotCell
                          key={day}
                          slots={daySlots}
                          isToday={isToday}
                          colorMap={colorMap}
                        />
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Legend */}
        {timeSlots.length > 0 && (
          <div style={{
            padding: "14px 22px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center",
          }}>
            <span style={{ fontSize: 11, color: "#4b5563", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Legend:</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#6b7280" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", flexShrink: 0 }} />
              Today
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#6b7280" }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: "rgba(255,255,255,0.12)", flexShrink: 0 }} />
              No class
            </span>
            <span style={{ fontSize: 11, color: "#4b5563", marginLeft: "auto" }}>
              Each colour = one course
            </span>
          </div>
        )}
      </div>

      {/* ── Course summary chips ── */}
      {data && (() => {
        const uniqueCourses = []
        const seen = new Set()
        DAYS.forEach(d => {
          ;(timetable[d] || []).forEach(s => {
            if (!seen.has(String(s.courseId))) {
              seen.add(String(s.courseId))
              uniqueCourses.push(s)
            }
          })
        })
        if (uniqueCourses.length === 0) return null
        return (
          <div style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16, padding: "18px 22px",
          }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#9ca3af", marginBottom: 12 }}>
              Courses in this Schedule
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {uniqueCourses.map((s, i) => {
                const c = getColor(String(s.courseId), colorMap)
                return (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "6px 12px", borderRadius: 99,
                    background: c.bg, border: `1px solid ${c.border}`,
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.text, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: c.text, fontWeight: 600 }}>{s.courseName}</span>
                    <span style={{ fontSize: 11, color: "#6b7280" }}>· Sem {s.sem} · {s.batch}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
