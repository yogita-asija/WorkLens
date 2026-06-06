import { useEffect, useState } from "react"
import { X, Mail, Phone, MapPin, BookOpen, Calendar, Clock, GraduationCap, Star } from "lucide-react"
import * as api from "../services/api"
import useAppStore from "../store/useAppStore"

const profile = {
  name: "Dr. Sarah Chen",
  title: "Associate Professor",
  department: "Computer Science",
  employeeId: "FAC-2019-042",
  email: "sarah.chen@university.edu",
  phone: "+1 (555) 234-5678",
  office: "Tech Building, Room 304",
  joinDate: "August 2019",
  qualification: "Ph.D. in Computer Science, MIT",
  specialization: "Algorithms & Machine Learning",
  experience: "8 years",
  courses: [
    { code: "CS401", name: "Advanced Algorithms", students: 45 },
    { code: "CS301", name: "Data Structures", students: 62 },
    { code: "CS201", name: "Programming II", students: 54 },
  ],
  stats: [
    { label: "Classes Taught", value: "6" },
    { label: "Students", value: "161" },
    { label: "Activity Score", value: "94%" },
    { label: "Avg Rating", value: "4.8" },
  ],
};

export default function ProfileSidebar({ open, onClose }) {
  return (
    <aside
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        height: "100vh",
        width: "360px",
        background: "#0a0a0a",
        borderLeft: "1px solid #262626",
        zIndex: 40,
        overflowY: "auto",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.3s ease",
      }}
    >
      {/* Header */}
      <div style={{ padding: "20px", borderBottom: "1px solid #1f1f1f", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ fontSize: "14px", fontWeight: 600, color: "#fff" }}>My Profile</p>
        <button
          onClick={onClose}
          style={{ background: "#1c1c1c", border: "1px solid #333", borderRadius: "8px", padding: "6px", cursor: "pointer", color: "#9ca3af" }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Avatar + Name */}
      <div style={{ padding: "24px 20px", textAlign: "center", borderBottom: "1px solid #1f1f1f" }}>
        <div style={{
          width: "80px", height: "80px", borderRadius: "50%",
          background: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px",
          fontSize: "28px", fontWeight: 700, color: "#000",
        }}>
          SC
        </div>
        <p style={{ fontSize: "18px", fontWeight: 700, color: "#fff", margin: 0 }}>{profile.name}</p>
        <p style={{ fontSize: "13px", color: "#22c55e", margin: "4px 0 0" }}>{profile.title}</p>
        <p style={{ fontSize: "12px", color: "#9ca3af", margin: "3px 0 0" }}>{profile.department}</p>
        <p style={{ fontSize: "11px", color: "#4b5563", margin: "6px 0 0", fontFamily: "monospace" }}>ID: {profile.employeeId}</p>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px", background: "#1f1f1f", borderBottom: "1px solid #1f1f1f" }}>
        {profile.stats.map((s) => (
          <div key={s.label} style={{ background: "#0a0a0a", padding: "14px", textAlign: "center" }}>
            <p style={{ fontSize: "18px", fontWeight: 700, color: "#fff", margin: 0 }}>{s.value}</p>
            <p style={{ fontSize: "10px", color: "#6b7280", margin: "3px 0 0" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Contact Info */}
      <div style={{ padding: "20px", borderBottom: "1px solid #1f1f1f" }}>
        <p style={{ fontSize: "11px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "14px" }}>Contact</p>
        {[
          { icon: Mail, label: profile.email },
          { icon: Phone, label: profile.phone },
          { icon: MapPin, label: profile.office },
        ].map(({ icon: Icon, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
            <div style={{ width: "32px", height: "32px", background: "#1c1c1c", border: "1px solid #2a2a2a", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon size={14} color="#9ca3af" />
            </div>
            <p style={{ fontSize: "12px", color: "#d1d5db", margin: 0 }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Academic Info */}
      <div style={{ padding: "20px", borderBottom: "1px solid #1f1f1f" }}>
        <p style={{ fontSize: "11px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "14px" }}>Academic Details</p>
        {[
          { icon: GraduationCap, label: "Qualification", value: profile.qualification },
          { icon: Star, label: "Specialization", value: profile.specialization },
          { icon: Clock, label: "Experience", value: profile.experience },
          { icon: Calendar, label: "Joined", value: profile.joinDate },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} style={{ display: "flex", gap: "10px", marginBottom: "14px" }}>
            <div style={{ width: "32px", height: "32px", background: "#1c1c1c", border: "1px solid #2a2a2a", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon size={14} color="#9ca3af" />
            </div>
            <div>
              <p style={{ fontSize: "10px", color: "#6b7280", margin: 0 }}>{label}</p>
              <p style={{ fontSize: "12px", color: "#e5e7eb", margin: "2px 0 0" }}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Current Courses */}
      <div style={{ padding: "20px" }}>
        <p style={{ fontSize: "11px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "14px" }}>Current Courses</p>
        {profile.courses.map((c) => (
          <div key={c.code} style={{ background: "#1c1c1c", border: "1px solid #2a2a2a", borderRadius: "10px", padding: "12px", marginBottom: "10px", display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "36px", height: "36px", background: "#111", border: "1px solid #333", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BookOpen size={14} color="#22c55e" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "12px", fontWeight: 600, color: "#fff", margin: 0 }}>{c.code}</p>
              <p style={{ fontSize: "11px", color: "#9ca3af", margin: "2px 0 0" }}>{c.name}</p>
            </div>
            <p style={{ fontSize: "11px", color: "#6b7280", margin: 0 }}>{c.students} students</p>
          </div>
        ))}
      </div>

      {/* Edit Profile Button */}
      <div style={{ padding: "0 20px 24px" }}>
        <button style={{
          width: "100%", padding: "10px", background: "#fff", color: "#000",
          border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: 600,
          cursor: "pointer", transition: "opacity 0.2s",
        }}
          onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
          onMouseLeave={e => e.currentTarget.style.opacity = "1"}
        >
          Edit Profile
        </button>
      </div>
    </aside>
  );
}