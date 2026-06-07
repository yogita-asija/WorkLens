import { useState, useEffect } from "react"
import { Shield, Search } from "lucide-react"
import { T, Card, Badge } from "../../components/UI"
import * as adminApi from "../../services/adminApi"
import useAppStore from "../../store/useAppStore"

const MODULE_COLORS = {
  teacher:       "#22C55E",
  course:        "#3B82F6",
  department:    "#06B6D4",
  leave:         "#CA8A04",
  communication: "#8B5CF6",
  settings:      "#9CA3AF",
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

export default function AdminAuditLogs() {
  const { showToast } = useAppStore()
  const [logs,    setLogs]    = useState([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [page,    setPage]    = useState(1)
  const [module,  setModule]  = useState("")
  const [from,    setFrom]    = useState("")
  const [to,      setTo]      = useState("")
  const LIMIT = 30

  const load = async () => {
    setLoading(true)
    try {
      const params = { page, limit: LIMIT }
      if (module) params.module = module
      if (from)   params.from   = from
      if (to)     params.to     = to
      const res = await adminApi.getAuditLogs(params)
      setLogs(res.data || [])
      setTotal(res.total || 0)
    } catch (err) {
      showToast(err.message || "Failed to load audit logs", "error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [page, module, from, to])

  const pages = Math.ceil(total / LIMIT)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(139,92,246,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Shield size={18} style={{ color: "#8B5CF6" }} />
        </div>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: T.txt }}>Audit Logs</h1>
          <p style={{ fontSize: 13, color: T.sub, marginTop: 1 }}>{total} admin actions recorded</p>
        </div>
      </div>

      {/* Filters */}
      <Card style={{ padding: "12px 16px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <select value={module} onChange={e => { setModule(e.target.value); setPage(1) }}
          style={{ padding: "9px 12px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, color: T.txt, fontSize: 13 }}>
          <option value="">All Modules</option>
          {Object.keys(MODULE_COLORS).map(m => (
            <option key={m} value={m} style={{ textTransform: "capitalize" }}>{m}</option>
          ))}
        </select>
        <div>
          <label style={{ fontSize: 11, color: T.muted, display: "block", marginBottom: 4 }}>From</label>
          <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1) }}
            style={{ padding: "9px 12px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, color: T.txt, fontSize: 13 }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: T.muted, display: "block", marginBottom: 4 }}>To</label>
          <input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1) }}
            style={{ padding: "9px 12px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, color: T.txt, fontSize: 13 }} />
        </div>
        {(module || from || to) && (
          <button onClick={() => { setModule(""); setFrom(""); setTo(""); setPage(1) }}
            style={{ padding: "9px 14px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, color: T.sub, fontSize: 13, cursor: "pointer" }}>
            Clear
          </button>
        )}
      </Card>

      {/* Logs Table */}
      <Card style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                {["Module", "Action", "Admin", "Target", "Detail", "Time"].map(h => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: T.muted }}>Loading…</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: T.muted }}>No audit logs found</td></tr>
              ) : logs.map((log, i) => {
                const mc = MODULE_COLORS[log.module] || T.sub
                return (
                  <tr key={log._id || i} className="table-row-hover" style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ padding: "3px 8px", borderRadius: 5, background: `${mc}18`, color: mc, fontSize: 11, fontWeight: 600, textTransform: "capitalize" }}>
                        {log.module}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontSize: 11, fontFamily: "monospace", color: T.sub, background: T.inner, padding: "2px 8px", borderRadius: 4 }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 13, color: T.txt }}>{log.adminName}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: T.sub }}>{log.targetName || "—"}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: T.sub, maxWidth: 300 }}>
                      <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {log.detail || "—"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 11, color: T.muted, whiteSpace: "nowrap" }}>
                      <span title={new Date(log.timestamp).toLocaleString()}>{timeAgo(log.timestamp)}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 8, padding: 16, borderTop: `1px solid ${T.border}` }}>
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              style={{ padding: "6px 14px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 6, color: page <= 1 ? T.muted : T.txt, fontSize: 12, cursor: page <= 1 ? "default" : "pointer" }}>Prev</button>
            <span style={{ fontSize: 12, color: T.sub }}>Page {page} of {pages}</span>
            <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}
              style={{ padding: "6px 14px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 6, color: page >= pages ? T.muted : T.txt, fontSize: 12, cursor: page >= pages ? "default" : "pointer" }}>Next</button>
          </div>
        )}
      </Card>
    </div>
  )
}
