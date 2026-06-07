import { useState, useEffect } from "react"
import { CheckCircle, XCircle, Clock, Filter } from "lucide-react"
import { T, Card, StatMiniCard, Modal, ModalBtn, Badge } from "../../components/UI"
import * as adminApi from "../../services/adminApi"
import useAppStore from "../../store/useAppStore"

function fmt(d) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

const STATUS_STYLES = {
  Pending:  { color: "#CA8A04", bg: "rgba(202,138,4,0.12)", label: "Pending" },
  Approved: { color: "#22C55E", bg: "rgba(34,197,94,0.12)", label: "Approved" },
  Rejected: { color: "#EF4444", bg: "rgba(239,68,68,0.12)", label: "Rejected" },
}

export default function AdminLeaves() {
  const { showToast } = useAppStore()
  const [leaves,    setLeaves]    = useState([])
  const [summary,   setSummary]   = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [page,      setPage]      = useState(1)
  const [total,     setTotal]     = useState(0)
  const [status,    setStatus]    = useState("")
  const [type,      setType]      = useState("")
  const [modal,     setModal]     = useState(null)
  const [selected,  setSelected]  = useState(null)
  const [adminNote, setAdminNote] = useState("")
  const [submitting,setSubmitting]= useState(false)
  const LIMIT = 15

  const load = async () => {
    setLoading(true)
    try {
      const params = { page, limit: LIMIT }
      if (status) params.status = status
      if (type)   params.type   = type
      const [lRes, sRes] = await Promise.all([
        adminApi.getAdminLeaves(params),
        adminApi.getAdminLeaveSummary(),
      ])
      setLeaves(lRes.data || [])
      setTotal(lRes.total || 0)
      setSummary(sRes.data)
    } catch (err) {
      showToast(err.message || "Failed to load", "error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [page, status, type])

  const openAction = (leave, action) => {
    setSelected(leave)
    setAdminNote("")
    setModal(action) // "approve" | "reject"
  }

  const handleAction = async (newStatus) => {
    setSubmitting(true)
    try {
      await adminApi.adminUpdateLeaveStatus(selected._id, { status: newStatus, adminNote })
      showToast(`Leave ${newStatus.toLowerCase()} successfully`)
      setModal(null); setSelected(null)
      load()
    } catch (err) {
      showToast(err.message || "Action failed", "error")
    } finally {
      setSubmitting(false)
    }
  }

  const pages = Math.ceil(total / LIMIT)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: T.txt }}>Leave Management</h1>
        <p style={{ fontSize: 13, color: T.sub, marginTop: 2 }}>Review and manage faculty leave requests</p>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14 }}>
        <StatMiniCard label="Pending"  value={summary?.pending  ?? "—"} icon={<Clock size={16} />}       color="#CA8A04" />
        <StatMiniCard label="Approved" value={summary?.approved ?? "—"} icon={<CheckCircle size={16} />} color="#22C55E" />
        <StatMiniCard label="Rejected" value={summary?.rejected ?? "—"} icon={<XCircle size={16} />}     color="#EF4444" />
        <StatMiniCard label="Total"    value={summary?.total    ?? "—"} icon={<Filter size={16} />}      color="#3B82F6" />
      </div>

      {/* Filters */}
      <Card style={{ padding: "12px 16px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
          style={{ padding: "9px 12px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, color: T.txt, fontSize: 13 }}>
          <option value="">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
        </select>
        <select value={type} onChange={e => { setType(e.target.value); setPage(1) }}
          style={{ padding: "9px 12px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, color: T.txt, fontSize: 13 }}>
          <option value="">All Types</option>
          <option value="Sick">Sick</option>
          <option value="Casual">Casual</option>
          <option value="Earned">Earned</option>
        </select>
      </Card>

      {/* Table */}
      <Card style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                {["Faculty", "Type", "From", "To", "Days", "Applied", "Status", "Actions"].map(h => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: T.muted }}>Loading…</td></tr>
              ) : leaves.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: T.muted }}>No leave requests found</td></tr>
              ) : leaves.map(l => {
                const st = STATUS_STYLES[l.status] || STATUS_STYLES.Pending
                return (
                  <tr key={l._id} className="table-row-hover" style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: "13px 14px", fontSize: 13, fontWeight: 500, color: T.txt }}>{l.facultyName}</td>
                    <td style={{ padding: "13px 14px" }}>
                      <Badge label={l.type} color="#3B82F6" bg="rgba(59,130,246,0.1)" />
                    </td>
                    <td style={{ padding: "13px 14px", fontSize: 12, color: T.sub }}>{fmt(l.fromDate)}</td>
                    <td style={{ padding: "13px 14px", fontSize: 12, color: T.sub }}>{fmt(l.toDate)}</td>
                    <td style={{ padding: "13px 14px", fontSize: 13, color: T.txt, fontWeight: 600 }}>{l.duration}</td>
                    <td style={{ padding: "13px 14px", fontSize: 12, color: T.muted }}>{fmt(l.appliedAt)}</td>
                    <td style={{ padding: "13px 14px" }}>
                      <span style={{ padding: "4px 10px", borderRadius: 6, background: st.bg, color: st.color, fontSize: 11, fontWeight: 600, border: `1px solid ${st.color}33` }}>
                        {l.status}
                      </span>
                    </td>
                    <td style={{ padding: "13px 14px" }}>
                      {l.status === "Pending" ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => openAction(l, "approve")}
                            style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 6, color: "#22C55E", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                            <CheckCircle size={12} /> Approve
                          </button>
                          <button onClick={() => openAction(l, "reject")}
                            style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6, color: "#EF4444", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                            <XCircle size={12} /> Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: T.muted }}>
                          {l.adminNote ? `"${l.adminNote.slice(0, 30)}${l.adminNote.length > 30 ? "…" : ""}"` : "No note"}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, padding: 16, borderTop: `1px solid ${T.border}` }}>
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              style={{ padding: "6px 14px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 6, color: page <= 1 ? T.muted : T.txt, fontSize: 12, cursor: page <= 1 ? "default" : "pointer" }}>Prev</button>
            <span style={{ fontSize: 12, color: T.sub }}>Page {page} of {pages}</span>
            <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}
              style={{ padding: "6px 14px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 6, color: page >= pages ? T.muted : T.txt, fontSize: 12, cursor: page >= pages ? "default" : "pointer" }}>Next</button>
          </div>
        )}
      </Card>

      {/* Approve / Reject Modal */}
      {(modal === "approve" || modal === "reject") && selected && (
        <Modal onClose={() => { setModal(null); setSelected(null) }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: T.txt, marginBottom: 8 }}>
            {modal === "approve" ? "✅ Approve Leave" : "❌ Reject Leave"}
          </h2>
          <div style={{ background: T.inner, borderRadius: 8, padding: "12px 14px", marginBottom: 20 }}>
            <p style={{ fontSize: 13, color: T.txt, fontWeight: 500 }}>{selected.facultyName}</p>
            <p style={{ fontSize: 12, color: T.sub, marginTop: 4 }}>
              {selected.type} leave · {fmt(selected.fromDate)} – {fmt(selected.toDate)} ({selected.duration} day{selected.duration !== 1 ? "s" : ""})
            </p>
            <p style={{ fontSize: 12, color: T.muted, marginTop: 6, fontStyle: "italic" }}>"{selected.reason}"</p>
          </div>
          <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 6 }}>
            Admin Note (optional)
          </label>
          <textarea value={adminNote} onChange={e => setAdminNote(e.target.value)} rows={3}
            placeholder="Add a note for the faculty member…"
            style={{ width: "100%", padding: "10px 12px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, color: T.txt, fontSize: 13, resize: "vertical", marginBottom: 20 }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <ModalBtn label="Cancel" variant="secondary" onClick={() => { setModal(null); setSelected(null) }} />
            <ModalBtn
              label={submitting ? "Processing…" : (modal === "approve" ? "Approve" : "Reject")}
              variant={modal === "reject" ? "danger" : "primary"}
              onClick={() => handleAction(modal === "approve" ? "Approved" : "Rejected")}
            />
          </div>
        </Modal>
      )}
    </div>
  )
}
