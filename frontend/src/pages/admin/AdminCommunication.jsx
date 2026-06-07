import { useState, useEffect } from "react"
import { Send, Users, Building2, Radio, History, Bell } from "lucide-react"
import { T, Card, Modal, ModalBtn, Badge } from "../../components/UI"
import * as adminApi from "../../services/adminApi"
import useAppStore from "../../store/useAppStore"

const NOTIFICATION_TYPES = ["system", "assignment", "course", "grade", "enrollment"]

export default function AdminCommunication() {
  const { showToast } = useAppStore()
  const [tab,          setTab]          = useState("compose") // "compose" | "history"
  const [targetType,   setTargetType]   = useState("broadcast")
  const [department,   setDepartment]   = useState("")
  const [title,        setTitle]        = useState("")
  const [message,      setMessage]      = useState("")
  const [notifType,    setNotifType]    = useState("system")
  const [link,         setLink]         = useState("")
  const [recipients,   setRecipients]   = useState([])
  const [selectedIds,  setSelectedIds]  = useState([])
  const [history,      setHistory]      = useState([])
  const [histTotal,    setHistTotal]    = useState(0)
  const [histPage,     setHistPage]     = useState(1)
  const [submitting,   setSubmitting]   = useState(false)
  const [loadingRec,   setLoadingRec]   = useState(false)

  const HIST_LIMIT = 20

  // Load teachers when targetType changes
  useEffect(() => {
    if (targetType === "specific" || targetType === "department") {
      loadRecipients()
    }
  }, [targetType, department])

  const loadRecipients = async () => {
    setLoadingRec(true)
    try {
      const params = {}
      if (department) params.department = department
      const res = await adminApi.getCommRecipients(params)
      setRecipients(res.data || [])
    } catch {}
    finally { setLoadingRec(false) }
  }

  const loadHistory = async () => {
    try {
      const res = await adminApi.getCommHistory({ page: histPage, limit: HIST_LIMIT })
      setHistory(res.data || [])
      setHistTotal(res.total || 0)
    } catch {}
  }

  useEffect(() => {
    if (tab === "history") loadHistory()
  }, [tab, histPage])

  const toggleId = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) return showToast("Title and message are required", "warn")
    if (targetType === "specific" && selectedIds.length === 0) return showToast("Select at least one recipient", "warn")
    if (targetType === "department" && !department.trim()) return showToast("Select a department", "warn")

    setSubmitting(true)
    try {
      await adminApi.sendAdminNotification({
        title, message, type: notifType, link,
        targetType,
        targetIds: selectedIds,
        department,
      })
      showToast("Notification sent successfully")
      setTitle(""); setMessage(""); setLink(""); setSelectedIds([])
      if (tab === "history") loadHistory()
    } catch (err) {
      showToast(err.message || "Send failed", "error")
    } finally {
      setSubmitting(false)
    }
  }

  const histPages = Math.ceil(histTotal / HIST_LIMIT)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: T.txt }}>Communication Center</h1>
        <p style={{ fontSize: 13, color: T.sub, marginTop: 2 }}>Send notifications and broadcast messages to faculty</p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 4, width: "fit-content" }}>
        {[
          { key: "compose", label: "Compose", icon: <Send size={14} /> },
          { key: "history", label: "History",  icon: <History size={14} /> },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 16px", borderRadius: 7, border: "none",
              background: tab === t.key ? T.inner : "transparent",
              color: tab === t.key ? T.txt : T.sub,
              fontSize: 13, fontWeight: tab === t.key ? 600 : 400, cursor: "pointer",
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "compose" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, alignItems: "start" }}>
          {/* Compose Form */}
          <Card style={{ padding: 24 }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: T.txt, marginBottom: 20 }}>New Notification</p>

            {/* Target Type */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 8 }}>Send To</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[
                  { key: "broadcast",  label: "All Faculty",   icon: <Radio size={13} /> },
                  { key: "department", label: "Department",    icon: <Building2 size={13} /> },
                  { key: "specific",   label: "Specific",      icon: <Users size={13} /> },
                ].map(opt => (
                  <button key={opt.key} onClick={() => { setTargetType(opt.key); setSelectedIds([]) }}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "8px 14px", borderRadius: 8, border: `1px solid`,
                      borderColor: targetType === opt.key ? T.accent : T.border,
                      background: targetType === opt.key ? "rgba(34,197,94,0.08)" : T.inner,
                      color: targetType === opt.key ? T.accent : T.sub,
                      fontSize: 12, fontWeight: 500, cursor: "pointer",
                    }}>
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Department picker */}
            {targetType === "department" && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 6 }}>Department</label>
                <input value={department} onChange={e => setDepartment(e.target.value)}
                  placeholder="e.g. Computer Science"
                  style={{ width: "100%", padding: "10px 12px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, color: T.txt, fontSize: 13 }}
                />
              </div>
            )}

            {/* Specific recipients */}
            {targetType === "specific" && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 6 }}>
                  Select Recipients {loadingRec ? "(loading…)" : `(${recipients.length} available)`}
                </label>
                <div style={{ maxHeight: 200, overflowY: "auto", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, padding: 8 }}>
                  {recipients.map(r => (
                    <label key={r._id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 4px", cursor: "pointer" }}>
                      <input type="checkbox" checked={selectedIds.includes(r._id)} onChange={() => toggleId(r._id)}
                        style={{ accentColor: T.accent }} />
                      <span style={{ fontSize: 13, color: T.txt }}>{r.name}</span>
                      <span style={{ fontSize: 11, color: T.muted }}>— {r.department || "No dept"}</span>
                    </label>
                  ))}
                  {recipients.length === 0 && !loadingRec && <p style={{ fontSize: 12, color: T.muted, padding: 4 }}>No recipients found</p>}
                </div>
                {selectedIds.length > 0 && <p style={{ fontSize: 11, color: T.accent, marginTop: 4 }}>{selectedIds.length} selected</p>}
              </div>
            )}

            {/* Notification Type */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 6 }}>Notification Type</label>
              <select value={notifType} onChange={e => setNotifType(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, color: T.txt, fontSize: 13 }}>
                {NOTIFICATION_TYPES.map(t => <option key={t} value={t} style={{ textTransform: "capitalize" }}>{t}</option>)}
              </select>
            </div>

            {/* Title */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 6 }}>Title *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Notification title…"
                style={{ width: "100%", padding: "10px 12px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, color: T.txt, fontSize: 13 }}
              />
            </div>

            {/* Message */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 6 }}>Message *</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5}
                placeholder="Write your message here…"
                style={{ width: "100%", padding: "10px 12px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, color: T.txt, fontSize: 13, resize: "vertical" }}
              />
            </div>

            {/* Link */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 6 }}>Link (optional)</label>
              <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://…"
                style={{ width: "100%", padding: "10px 12px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, color: T.txt, fontSize: 13 }}
              />
            </div>

            <button onClick={handleSend} disabled={submitting}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 24px", background: T.accent, color: "#000", borderRadius: 10, border: "none", fontSize: 14, fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}>
              <Send size={15} /> {submitting ? "Sending…" : "Send Notification"}
            </button>
          </Card>

          {/* Preview */}
          <Card style={{ padding: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: T.txt, marginBottom: 14 }}>Preview</p>
            <div style={{ background: T.inner, borderRadius: 10, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(34,197,94,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Bell size={15} style={{ color: T.accent }} />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: T.txt }}>{title || "Notification Title"}</p>
                  <p style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>From Admin · Just now</p>
                </div>
              </div>
              <p style={{ fontSize: 12, color: T.sub, lineHeight: 1.6 }}>{message || "Your message preview will appear here…"}</p>
            </div>
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 11, color: T.muted, marginBottom: 8 }}>TARGET</p>
              <p style={{ fontSize: 12, color: T.sub, textTransform: "capitalize" }}>
                {targetType === "broadcast"  && "📢 All Faculty Members"}
                {targetType === "department" && `🏢 ${department || "Selected Department"}`}
                {targetType === "specific"   && `👥 ${selectedIds.length} specific recipient(s)`}
              </p>
            </div>
          </Card>
        </div>
      )}

      {tab === "history" && (
        <Card style={{ overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  {["Title", "Message", "Type", "Sent By", "Sent At"].map(h => (
                    <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: T.muted }}>No notification history</td></tr>
                ) : history.map((n, i) => (
                  <tr key={n._id || i} className="table-row-hover" style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 500, color: T.txt }}>{n.title}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: T.sub, maxWidth: 280 }}>
                      <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{n.message}</span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <Badge label={n.type} color="#3B82F6" bg="rgba(59,130,246,0.1)" />
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: T.sub }}>{n.meta?.sentBy || "Admin"}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: T.muted }}>
                      {new Date(n.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {histPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, padding: 16, borderTop: `1px solid ${T.border}` }}>
              <button disabled={histPage <= 1} onClick={() => setHistPage(p => p - 1)}
                style={{ padding: "6px 14px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 6, color: histPage <= 1 ? T.muted : T.txt, fontSize: 12, cursor: histPage <= 1 ? "default" : "pointer" }}>Prev</button>
              <span style={{ fontSize: 12, color: T.sub }}>Page {histPage} of {histPages}</span>
              <button disabled={histPage >= histPages} onClick={() => setHistPage(p => p + 1)}
                style={{ padding: "6px 14px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 6, color: histPage >= histPages ? T.muted : T.txt, fontSize: 12, cursor: histPage >= histPages ? "default" : "pointer" }}>Next</button>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
