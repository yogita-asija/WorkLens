import { useState } from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { Download, FileText, Users, CalendarCheck, TrendingUp } from "lucide-react"
import { T, Card, StatMiniCard, Badge } from "../../components/UI"
import * as adminApi from "../../services/adminApi"
import useAppStore from "../../store/useAppStore"

const COLORS = ["#22C55E","#3B82F6","#CA8A04","#EF4444","#06B6D4","#8B5CF6"]

function fmt(d) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

// Simple CSV export utility
function exportCSV(rows, filename) {
  if (!rows.length) return
  const headers = Object.keys(rows[0]).join(",")
  const body = rows.map(r => Object.values(r).map(v => `"${v}"`).join(",")).join("\n")
  const blob = new Blob([headers + "\n" + body], { type: "text/csv" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a"); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function AdminReports() {
  const { showToast } = useAppStore()
  const [tab, setTab] = useState("attendance") // "attendance" | "leaves" | "performance"

  // Attendance
  const [attFrom,     setAttFrom]     = useState("")
  const [attTo,       setAttTo]       = useState("")
  const [attData,     setAttData]     = useState(null)
  const [attLoading,  setAttLoading]  = useState(false)

  // Leaves
  const [lvFrom,      setLvFrom]      = useState("")
  const [lvTo,        setLvTo]        = useState("")
  const [lvStatus,    setLvStatus]    = useState("")
  const [lvData,      setLvData]      = useState(null)
  const [lvLoading,   setLvLoading]   = useState(false)

  // Performance
  const [perfData,    setPerfData]    = useState(null)
  const [perfLoading, setPerfLoading] = useState(false)

  const loadAttendance = async () => {
    setAttLoading(true)
    try {
      const params = {}
      if (attFrom) params.from = attFrom
      if (attTo)   params.to   = attTo
      const res = await adminApi.getAttendanceReport(params)
      setAttData(res.data)
    } catch (err) {
      showToast(err.message || "Failed to load attendance report", "error")
    } finally { setAttLoading(false) }
  }

  const loadLeaves = async () => {
    setLvLoading(true)
    try {
      const params = {}
      if (lvFrom)   params.from   = lvFrom
      if (lvTo)     params.to     = lvTo
      if (lvStatus) params.status = lvStatus
      const res = await adminApi.getLeaveReport(params)
      setLvData(res.data)
    } catch (err) {
      showToast(err.message || "Failed to load leave report", "error")
    } finally { setLvLoading(false) }
  }

  const loadPerformance = async () => {
    setPerfLoading(true)
    try {
      const res = await adminApi.getTeacherPerfReport()
      setPerfData(res.data)
    } catch (err) {
      showToast(err.message || "Failed to load performance report", "error")
    } finally { setPerfLoading(false) }
  }

  const TABS = [
    { key: "attendance",  label: "Attendance",   icon: <CalendarCheck size={14} /> },
    { key: "leaves",      label: "Leaves",        icon: <FileText size={14} /> },
    { key: "performance", label: "Performance",   icon: <TrendingUp size={14} /> },
  ]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: T.txt }}>Reports</h1>
        <p style={{ fontSize: 13, color: T.sub, marginTop: 2 }}>Generate and export data reports</p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 4, width: "fit-content" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 7, border: "none",
              background: tab === t.key ? T.inner : "transparent", color: tab === t.key ? T.txt : T.sub,
              fontSize: 13, fontWeight: tab === t.key ? 600 : 400, cursor: "pointer" }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Attendance Report ── */}
      {tab === "attendance" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card style={{ padding: 20 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: T.txt, marginBottom: 16 }}>Filter Attendance</p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div>
                <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 5 }}>From Date</label>
                <input type="date" value={attFrom} onChange={e => setAttFrom(e.target.value)}
                  style={{ padding: "9px 12px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, color: T.txt, fontSize: 13 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 5 }}>To Date</label>
                <input type="date" value={attTo} onChange={e => setAttTo(e.target.value)}
                  style={{ padding: "9px 12px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, color: T.txt, fontSize: 13 }} />
              </div>
              <button onClick={loadAttendance}
                style={{ padding: "10px 20px", background: T.accent, color: "#000", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                {attLoading ? "Loading…" : "Generate Report"}
              </button>
            </div>
          </Card>

          {attData && (
            <>
              {/* Summary */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14 }}>
                <StatMiniCard label="Sessions"      value={attData.summary.totalSessions}  color="#3B82F6" />
                <StatMiniCard label="Present Count" value={attData.summary.totalPresent}   color="#22C55E" />
                <StatMiniCard label="Attendance Rate" value={`${attData.summary.attendanceRate}%`} color="#22C55E" />
              </div>

              {/* Export */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={() => exportCSV(
                    attData.records.map(r => ({
                      Date: r.date, Course: r.courseName || r.courseId,
                      Present: r.students?.filter(s => s.status === "present").length || 0,
                      Absent: r.students?.filter(s => s.status === "absent").length || 0,
                      Total: r.students?.length || 0,
                    })),
                    "attendance_report.csv"
                  )}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, color: T.txt, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
                  <Download size={13} /> Export CSV
                </button>
              </div>

              {/* Table */}
              <Card style={{ overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                        {["Date", "Course", "Present", "Absent", "Attendance %"].map(h => (
                          <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {attData.records.slice(0, 50).map((r, i) => {
                        const present = r.students?.filter(s => s.status === "present").length || 0
                        const absent  = r.students?.filter(s => s.status === "absent").length || 0
                        const total   = r.students?.length || 0
                        const rate    = total > 0 ? Math.round((present / total) * 100) : 0
                        return (
                          <tr key={r._id || i} className="table-row-hover" style={{ borderBottom: `1px solid ${T.border}` }}>
                            <td style={{ padding: "12px 14px", fontSize: 13, color: T.sub }}>{r.date}</td>
                            <td style={{ padding: "12px 14px", fontSize: 13, color: T.txt }}>{r.courseName || r.courseId}</td>
                            <td style={{ padding: "12px 14px", fontSize: 13, color: "#22C55E", fontWeight: 600 }}>{present}</td>
                            <td style={{ padding: "12px 14px", fontSize: 13, color: "#EF4444", fontWeight: 600 }}>{absent}</td>
                            <td style={{ padding: "12px 14px" }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: rate >= 75 ? "#22C55E" : "#EF4444" }}>{rate}%</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ── Leave Report ── */}
      {tab === "leaves" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card style={{ padding: 20 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: T.txt, marginBottom: 16 }}>Filter Leaves</p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div>
                <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 5 }}>From</label>
                <input type="date" value={lvFrom} onChange={e => setLvFrom(e.target.value)}
                  style={{ padding: "9px 12px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, color: T.txt, fontSize: 13 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 5 }}>To</label>
                <input type="date" value={lvTo} onChange={e => setLvTo(e.target.value)}
                  style={{ padding: "9px 12px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, color: T.txt, fontSize: 13 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 5 }}>Status</label>
                <select value={lvStatus} onChange={e => setLvStatus(e.target.value)}
                  style={{ padding: "9px 12px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, color: T.txt, fontSize: 13 }}>
                  <option value="">All</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
              <button onClick={loadLeaves}
                style={{ padding: "10px 20px", background: T.accent, color: "#000", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                {lvLoading ? "Loading…" : "Generate Report"}
              </button>
            </div>
          </Card>

          {lvData && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 14 }}>
                <StatMiniCard label="Total"    value={lvData.totals.total}    color="#3B82F6" />
                <StatMiniCard label="Approved" value={lvData.totals.approved} color="#22C55E" />
                <StatMiniCard label="Pending"  value={lvData.totals.pending}  color="#CA8A04" />
                <StatMiniCard label="Rejected" value={lvData.totals.rejected} color="#EF4444" />
              </div>

              {/* By Faculty Chart */}
              {lvData.byFaculty.length > 0 && (
                <Card style={{ padding: 20 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: T.txt, marginBottom: 16 }}>Leaves by Faculty</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={lvData.byFaculty.slice(0, 10)}>
                      <XAxis dataKey="name" tick={{ fill: T.sub, fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: T.sub, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="total" radius={[4,4,0,0]}>
                        {lvData.byFaculty.slice(0, 10).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button onClick={() => exportCSV(
                  lvData.leaves.map(l => ({
                    Faculty: l.facultyName, Type: l.type, From: fmt(l.fromDate), To: fmt(l.toDate),
                    Days: l.duration, Status: l.status, Reason: l.reason, Note: l.adminNote || ""
                  })),
                  "leave_report.csv"
                )}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, color: T.txt, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
                  <Download size={13} /> Export CSV
                </button>
              </div>

              <Card style={{ overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                        {["Faculty", "Type", "From", "To", "Days", "Status", "Note"].map(h => (
                          <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {lvData.leaves.slice(0, 50).map((l, i) => (
                        <tr key={l._id || i} className="table-row-hover" style={{ borderBottom: `1px solid ${T.border}` }}>
                          <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 500, color: T.txt }}>{l.facultyName}</td>
                          <td style={{ padding: "12px 14px" }}><Badge label={l.type} color="#3B82F6" bg="rgba(59,130,246,0.1)" /></td>
                          <td style={{ padding: "12px 14px", fontSize: 12, color: T.sub }}>{fmt(l.fromDate)}</td>
                          <td style={{ padding: "12px 14px", fontSize: 12, color: T.sub }}>{fmt(l.toDate)}</td>
                          <td style={{ padding: "12px 14px", fontSize: 13, color: T.txt, fontWeight: 600 }}>{l.duration}</td>
                          <td style={{ padding: "12px 14px" }}>
                            <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 5,
                              color:       l.status === "Approved" ? "#22C55E" : l.status === "Pending" ? "#CA8A04" : "#EF4444",
                              background:  l.status === "Approved" ? "rgba(34,197,94,0.1)" : l.status === "Pending" ? "rgba(202,138,4,0.1)" : "rgba(239,68,68,0.1)",
                            }}>{l.status}</span>
                          </td>
                          <td style={{ padding: "12px 14px", fontSize: 12, color: T.muted }}>{l.adminNote || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ── Performance Report ── */}
      {tab === "performance" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontSize: 14, color: T.sub }}>Teacher performance overview based on course load and leave data</p>
            <button onClick={loadPerformance}
              style={{ padding: "9px 18px", background: T.accent, color: "#000", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {perfLoading ? "Loading…" : "Load Report"}
            </button>
          </Card>

          {perfData && (
            <>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button onClick={() => exportCSV(
                  perfData.map(t => ({
                    Name: t.name, Email: t.email, Department: t.department || "—",
                    Courses: t.courseCount, LeavesTaken: t.leavesTaken,
                    Joined: fmt(t.joined)
                  })),
                  "teacher_performance.csv"
                )}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, color: T.txt, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
                  <Download size={13} /> Export CSV
                </button>
              </div>

              <Card style={{ overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                        {["Teacher", "Department", "Courses", "Leaves Taken", "Joined"].map(h => (
                          <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {perfData.map((t, i) => (
                        <tr key={t._id || i} className="table-row-hover" style={{ borderBottom: `1px solid ${T.border}` }}>
                          <td style={{ padding: "13px 14px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ width: 32, height: 32, borderRadius: "50%", background: COLORS[i % COLORS.length], color: "#000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                                {t.name?.split(" ").map(w => w[0]).slice(0, 2).join("")}
                              </div>
                              <div>
                                <p style={{ fontSize: 13, fontWeight: 500, color: T.txt }}>{t.name}</p>
                                <p style={{ fontSize: 11, color: T.muted }}>{t.email}</p>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "13px 14px", fontSize: 13, color: T.sub }}>{t.department || "—"}</td>
                          <td style={{ padding: "13px 14px", fontSize: 14, fontWeight: 700, color: t.courseCount > 0 ? "#22C55E" : T.muted }}>{t.courseCount}</td>
                          <td style={{ padding: "13px 14px", fontSize: 14, fontWeight: 700, color: t.leavesTaken > 8 ? "#EF4444" : T.txt }}>{t.leavesTaken}</td>
                          <td style={{ padding: "13px 14px", fontSize: 12, color: T.muted }}>{fmt(t.joined)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  )
}
