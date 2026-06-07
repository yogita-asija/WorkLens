import { useState, useEffect } from "react"
import { Save, University, GraduationCap, Bell, Shield } from "lucide-react"
import { T, Card, Toggle } from "../../components/UI"
import * as adminApi from "../../services/adminApi"
import useAppStore from "../../store/useAppStore"

const SECTIONS = [
  {
    key: "general",
    label: "University Information",
    icon: <University size={16} />,
    fields: [
      { key: "university_name",    label: "University Name",    type: "text" },
      { key: "university_email",   label: "Contact Email",      type: "email" },
      { key: "university_phone",   label: "Phone Number",       type: "text" },
      { key: "university_address", label: "Address",            type: "textarea" },
    ],
  },
  {
    key: "academic",
    label: "Academic Session",
    icon: <GraduationCap size={16} />,
    fields: [
      { key: "academic_year",    label: "Academic Year",    type: "text", ph: "2025-2026" },
      { key: "current_semester", label: "Current Semester", type: "select", options: ["Odd", "Even"] },
      { key: "max_leave_days",   label: "Max Leave Days",   type: "number" },
    ],
  },
  {
    key: "notification",
    label: "Notification Settings",
    icon: <Bell size={16} />,
    fields: [
      { key: "email_notifications", label: "Email Notifications", type: "toggle", desc: "Send email notifications for system events" },
      { key: "leave_auto_approve",  label: "Auto-approve Leaves",  type: "toggle", desc: "Automatically approve leave requests under 2 days" },
    ],
  },
]

export default function AdminSettings() {
  const { showToast } = useAppStore()
  const [settings, setSettings] = useState({})
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [dirty,    setDirty]    = useState(false)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const res = await adminApi.getAdminSettings()
      setSettings(res.data || {})
    } catch (err) {
      showToast(err.message || "Failed to load settings", "error")
    } finally {
      setLoading(false) }
  }

  const update = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await adminApi.updateAdminSettings(settings)
      showToast("Settings saved successfully")
      setDirty(false)
    } catch (err) {
      showToast(err.message || "Save failed", "error")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div style={{ textAlign: "center", padding: 60, color: T.muted }}>Loading settings…</div>
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: T.txt }}>System Settings</h1>
          <p style={{ fontSize: 13, color: T.sub, marginTop: 2 }}>Configure university and system-wide settings</p>
        </div>
        <button onClick={handleSave} disabled={saving || !dirty}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", background: dirty ? T.accent : T.inner, color: dirty ? "#000" : T.muted, borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600, cursor: dirty ? "pointer" : "default", transition: "all 0.2s" }}>
          <Save size={14} /> {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>

      {SECTIONS.map(section => (
        <Card key={section.key} style={{ padding: 24 }}>
          {/* Section header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, paddingBottom: 14, borderBottom: `1px solid ${T.border}` }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: T.inner, display: "flex", alignItems: "center", justifyContent: "center", color: T.sub }}>
              {section.icon}
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: T.txt }}>{section.label}</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {section.fields.map(f => {
              const val = settings[f.key]

              if (f.type === "toggle") {
                return (
                  <div key={f.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0" }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500, color: T.txt }}>{f.label}</p>
                      {f.desc && <p style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>{f.desc}</p>}
                    </div>
                    <Toggle checked={!!val} onChange={v => update(f.key, v)} />
                  </div>
                )
              }

              if (f.type === "select") {
                return (
                  <div key={f.key}>
                    <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 6 }}>{f.label}</label>
                    <select value={val || ""} onChange={e => update(f.key, e.target.value)}
                      style={{ padding: "10px 12px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, color: T.txt, fontSize: 13, minWidth: 200 }}>
                      {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                )
              }

              if (f.type === "textarea") {
                return (
                  <div key={f.key}>
                    <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 6 }}>{f.label}</label>
                    <textarea value={val || ""} rows={3}
                      onChange={e => update(f.key, e.target.value)}
                      style={{ width: "100%", maxWidth: 480, padding: "10px 12px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, color: T.txt, fontSize: 13, resize: "vertical" }}
                    />
                  </div>
                )
              }

              return (
                <div key={f.key}>
                  <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 6 }}>{f.label}</label>
                  <input type={f.type || "text"} value={val || ""} placeholder={f.ph || ""}
                    onChange={e => update(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)}
                    style={{ width: "100%", maxWidth: 480, padding: "10px 12px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, color: T.txt, fontSize: 13 }}
                  />
                </div>
              )
            })}
          </div>
        </Card>
      ))}

      {/* Danger Zone */}
      <Card style={{ padding: 24, borderColor: "rgba(239,68,68,0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Shield size={16} style={{ color: "#EF4444" }} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: "#EF4444" }}>Danger Zone</p>
        </div>
        <p style={{ fontSize: 13, color: T.sub, marginBottom: 16 }}>These actions are irreversible. Proceed with caution.</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            onClick={() => showToast("This feature requires server-level access. Contact your system administrator.", "warn")}
            style={{ padding: "9px 18px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, color: "#EF4444", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            Clear All Activity Logs
          </button>
          <button
            onClick={() => showToast("Database export initiated — check server logs for file path.", "info")}
            style={{ padding: "9px 18px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, color: T.sub, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            Export Database Backup
          </button>
        </div>
      </Card>
    </div>
  )
}
