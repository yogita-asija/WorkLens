import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { X, Mail, Phone, MapPin, BookOpen, Calendar, Clock, GraduationCap, Star } from "lucide-react"
import * as api from "../services/api"
import useAppStore from "../store/useAppStore"

export default function ProfileSidebar({ open, onClose }) {
  const user = useAppStore((s) => s.user)
  const navigate = useNavigate()

  const [courses, setCourses] = useState([])
  const [stats,   setStats]   = useState([])

  useEffect(() => {
    if (!open) return
    api.getDashboardCourses().then(data => {
      setCourses((data || []).slice(0, 3))
    }).catch(() => {})
    api.getDashboardStats().then(data => {
      setStats([
        { label: "Classes Taught", value: String(data.classesTaught ?? "—") },
        { label: "Activity Score", value: String(data.activityScore ?? "—") },
        { label: "Weekly Hours",   value: String(data.weeklyHours   ?? "—") },
        { label: "Assignments",    value: String(data.assignments   ?? "—") },
      ])
    }).catch(() => {})
  }, [open])

  const initials = (user?.name || "?")
    .split(" ")
    .map(w => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <aside
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        height: "100vh",
        width: "360px",
        background: "var(--bg-0a0a0a)",
        borderLeft: "1px solid var(--b-262626)",
        zIndex: 40,
        overflowY: "auto",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.3s ease",
      }}
    >
      {/* Header */}
      <div style={{ padding: "20px", borderBottom: "1px solid var(--b-1f1f1f)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--t-ffffff)" }}>My Profile</p>
        <button
          onClick={onClose}
          style={{ background: "var(--bg-1c1c1c)", border: "1px solid var(--b-333333)", borderRadius: "8px", padding: "6px", cursor: "pointer", color: "var(--t-9ca3af)" }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Avatar + Name */}
      <div style={{ padding: "24px 20px", textAlign: "center", borderBottom: "1px solid var(--b-1f1f1f)" }}>
        <div style={{
          width: "80px", height: "80px", borderRadius: "50%",
          background: "var(--bg-invert)", display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px",
          fontSize: "28px", fontWeight: 700, color: "var(--fg-invert)",
        }}>
          {initials}
        </div>
        <p style={{ fontSize: "18px", fontWeight: 700, color: "var(--t-ffffff)", margin: 0 }}>{user?.name || "—"}</p>
        <p style={{ fontSize: "13px", color: "#22c55e", margin: "4px 0 0" }}>{user?.role === "teaching" ? "Teaching Staff" : user?.role === "non-teaching" ? "Non-Teaching Staff" : user?.role || "—"}</p>
        <p style={{ fontSize: "12px", color: "var(--t-9ca3af)", margin: "3px 0 0" }}>{user?.department || "—"}</p>
        <p style={{ fontSize: "11px", color: "var(--t-4b5563)", margin: "6px 0 0", fontFamily: "monospace" }}>ID: {user?._id?.slice(-8).toUpperCase() || "—"}</p>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px", background: "var(--bg-1f1f1f)", borderBottom: "1px solid var(--b-1f1f1f)" }}>
        {stats.map((s) => (
          <div key={s.label} style={{ background: "var(--bg-0a0a0a)", padding: "14px", textAlign: "center" }}>
            <p style={{ fontSize: "18px", fontWeight: 700, color: "var(--t-ffffff)", margin: 0 }}>{s.value}</p>
            <p style={{ fontSize: "10px", color: "#6b7280", margin: "3px 0 0" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Contact Info */}
      <div style={{ padding: "20px", borderBottom: "1px solid var(--b-1f1f1f)" }}>
        <p style={{ fontSize: "11px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "14px" }}>Contact</p>
        {[
          { icon: Mail,  label: user?.email || "—" },
          { icon: Phone, label: user?.phone || "—" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
            <div style={{ width: "32px", height: "32px", background: "var(--bg-1c1c1c)", border: "1px solid var(--b-2a2a2a)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon size={14} color="#9ca3af" />
            </div>
            <p style={{ fontSize: "12px", color: "var(--t-d1d5db)", margin: 0 }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Academic Info */}
      <div style={{ padding: "20px", borderBottom: "1px solid var(--b-1f1f1f)" }}>
        <p style={{ fontSize: "11px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "14px" }}>Academic Details</p>
        {[
          { icon: Calendar, label: "Joined",     value: user?.memberSince || "—" },
          { icon: MapPin,   label: "Department", value: user?.department  || "—" },
          { icon: Star,     label: "Bio",        value: user?.bio         || "—" },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} style={{ display: "flex", gap: "10px", marginBottom: "14px" }}>
            <div style={{ width: "32px", height: "32px", background: "var(--bg-1c1c1c)", border: "1px solid var(--b-2a2a2a)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon size={14} color="#9ca3af" />
            </div>
            <div>
              <p style={{ fontSize: "10px", color: "#6b7280", margin: 0 }}>{label}</p>
              <p style={{ fontSize: "12px", color: "var(--t-e5e7eb)", margin: "2px 0 0" }}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Current Courses */}
      <div style={{ padding: "20px" }}>
        <p style={{ fontSize: "11px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "14px" }}>Current Courses</p>
        {courses.length === 0 ? (
          <p style={{ fontSize: "12px", color: "var(--t-4b5563)" }}>No courses found.</p>
        ) : courses.map((c) => (
          <div key={c.code} style={{ background: "var(--bg-1c1c1c)", border: "1px solid var(--b-2a2a2a)", borderRadius: "10px", padding: "12px", marginBottom: "10px", display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "36px", height: "36px", background: "var(--bg-111111)", border: "1px solid var(--b-333333)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BookOpen size={14} color="#22c55e" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--t-ffffff)", margin: 0 }}>{c.code}</p>
              <p style={{ fontSize: "11px", color: "var(--t-9ca3af)", margin: "2px 0 0" }}>{c.name}</p>
            </div>
            <p style={{ fontSize: "11px", color: "#6b7280", margin: 0 }}>{c.students} students</p>
          </div>
        ))}
      </div>

      {/* Edit Profile Button */}
      <div style={{ padding: "0 20px 24px" }}>
        <button style={{
          width: "100%", padding: "10px", background: "var(--bg-invert)", color: "var(--fg-invert)",
          border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: 600,
          cursor: "pointer", transition: "opacity 0.2s",
        }}
          onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
          onMouseLeave={e => e.currentTarget.style.opacity = "1"}
          onClick={() => { onClose(); navigate("/settings") }}
        >
          Edit Profile
        </button>
      </div>
    </aside>
  );
}
