import React, { useState, useMemo, useEffect } from "react"
import { Search, Users, Eye, X, ChevronDown, BookOpen, Archive, ArchiveRestore, UserCheck, CheckCircle, AlertCircle } from "lucide-react"
import { Card, Badge, ProgressBar, Icons, T } from "../components/UI"
import useAppStore from "../store/useAppStore"
import { useCourses } from "../hooks/useData"
import * as api from "../services/api"

const TYPE_COLORS = {
  active:   { color: "#22C55E", bg: "rgba(34,197,94,0.1)" },
  inactive: { color: "#EAB308", bg: "rgba(234,179,8,0.1)" },
  archived: { color: "#6B7280", bg: "rgba(107,114,128,0.1)" },
}

export default function CoursesPage() {
  const {  showToast, assignments } = useAppStore()
  const { courses, reload } = useCourses()

  const [search,   setSearch]   = useState("")
  const [filter,   setFilter]   = useState("all")
  const [modal,    setModal]    = useState(null) // null | "view" | "students"
  const [target,   setTarget]   = useState(null)

  const [enrolledStudents, setEnrolledStudents] = useState([])
  const [studentsLoading, setStudentsLoading]   = useState(false)

  const filtered = useMemo(() => {
    let list = courses
    if (filter !== "all") list = list.filter(c => c.status === filter)
    if (search.trim()) {
      const s = search.toLowerCase()
      list = list.filter(c =>
        c.courseName?.toLowerCase().includes(s) ||
        c.courseId?.toLowerCase().includes(s) ||
        c.courseCode?.toLowerCase().includes(s)
      )
    }
    return list
  }, [courses, filter, search])

  const totalStudents = courses.reduce((s, c) => s + (c.students || 0), 0)
  const avgProgress   = courses.length ? Math.round(courses.reduce((s, c) => s + (c.progress || 0), 0) / courses.length) : 0

 
  const openView     = (c) => { setTarget(c); setModal("view") }
  const openStudents = async (c) => {
    setTarget(c)
    setEnrolledStudents([])
    setModal("students")
    setStudentsLoading(true)
    try {
      const data = await api.getEnrolledStudents(c._id)
      setEnrolledStudents(data.students || [])
    } catch (err) {
      showToast(err.message || "Failed to load students", "error")
    } finally {
      setStudentsLoading(false)
    }
  }
  const handleArchive = async (c) => {
    try {
      await api.updateCourse(c._id, { status: "archived" })
      showToast(`"${c.courseName}" archived`)
      reload()
    } catch (err) { showToast(err.message || "Archive failed", "error") }
  }
  const handleUnarchive = async (c) => {
    try {
      await api.updateCourse(c._id, { status: "active" })
      showToast(`"${c.courseName}" restored to active`)
      reload()
    } catch (err) { showToast(err.message || "Unarchive failed", "error") }
  }

  const closeModal = () => { setModal(null); setTarget(null); setEnrolledStudents([]) }



  const F = ({ label, children, required }) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, color: T.sub, marginBottom: 5, fontWeight: 500 }}>
        {label}{required && <span style={{ color: "#ef4444" }}> *</span>}
      </label>
      {children}
    </div>
  )
  const inp = { background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", color: T.txt, fontSize: 13, width: "100%", outline: "none" }

  return (
    <div style={{ minHeight: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: T.txt, margin: 0 }}>Course Management</h1>
          <p style={{ fontSize: 13, color: T.muted, marginTop: 4, margin: 0 }}>Manage courses, enrollment & analytics</p>
        </div>
       
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total Courses",   value: courses.length,    color: T.txt },
          { label: "Active",          value: courses.filter(c=>c.status==="active").length, color:  T.txt},
          { label: "Total Students",  value: totalStudents,     color: T.txt },
          { label: "Avg Progress",    value: `${avgProgress}%`, color:  T.txt },
        ].map(s => (
          <div key={s.label} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 16px" }}>
            <p style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>{s.label}</p>
            <p style={{ fontSize: 24, fontWeight: 700, color: s.color, margin: 0 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.muted }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search courses…" style={{ ...inp, paddingLeft: 32 }} />
        </div>
        {["all", "active", "inactive", "archived"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer",
            background: filter === f ? "#fff" : T.card,
            color: filter === f ? "#000" : T.sub,
            border: `1px solid ${filter === f ? "#fff" : T.border}`,
          }}>{f.charAt(0).toUpperCase()+f.slice(1)}</button>
        ))}
      </div>

      {/* Course Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
        {filtered.map(c => (
          <CourseCard key={c._id} course={c}
            onView={() => openView(c)} onEdit={() => openEdit(c)}
            
             onStudents={() => openStudents(c)}
             onArchive={() => handleArchive(c)}
             onUnarchive={() => handleUnarchive(c)}
          />
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "60px 0", color: T.muted }}>
            <BookOpen size={40} style={{ margin: "0 auto 12px", display: "block", opacity: 0.3 }} />
            <p style={{ fontSize: 14 }}>No courses found</p>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      
      {modal === "view" && target && <CourseViewModal course={target} assignments={useAppStore.getState().assignments} onClose={closeModal} />}

      {modal === "students" && target && (
        <ModalWrap title={`Enrolled Students — ${target.courseId}`} onClose={closeModal}>
          {studentsLoading ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: T.muted }}>
              <Users size={28} style={{ margin: "0 auto 10px", display: "block", opacity: 0.4 }} />
              <p style={{ fontSize: 13 }}>Loading students…</p>
            </div>
          ) : enrolledStudents.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: T.muted }}>
              <UserCheck size={28} style={{ margin: "0 auto 10px", display: "block", opacity: 0.4 }} />
              <p style={{ fontSize: 13 }}>No students enrolled in this course</p>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 11, color: T.sub, marginBottom: 12 }}>
                {enrolledStudents.length} student{enrolledStudents.length !== 1 ? "s" : ""} enrolled
              </p>
              <div style={{ maxHeight: 380, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                {enrolledStudents.map((s, i) => {
                 
                  const asgSubmitted = s.assignments.submitted
                  const asgTotal = s.assignments.total
                  return (
                    <div key={s.id} style={{
                      background: T.inner, border: `1px solid ${T.border}`, borderRadius: 10,
                      padding: "10px 14px", display: "flex", alignItems: "center", gap: 12,
                    }}>
                      {/* Avatar */}
                      <div style={{
                        width: 34, height: 34, borderRadius: "50%", background: "rgba(74,222,128,0.15)",
                        border: "1px solid rgba(74,222,128,0.3)", display: "flex", alignItems: "center",
                        justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#4ade80", flexShrink: 0,
                      }}>
                        {s.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: T.txt, margin: "0 0 2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {s.name}
                        </p>
                        <p style={{ fontSize: 11, color: T.muted, margin: 0 }}>{s.id}</p>
                      </div>
                      
                      {/* Assignment badge */}
                      <div style={{ textAlign: "center", flexShrink: 0 }}>
                        <p style={{ fontSize: 10, color: T.muted, margin: "0 0 2px" }}>Assignments</p>
                        <p style={{ fontSize: 12, fontWeight: 700, color: asgTotal > 0 ? (asgSubmitted === asgTotal ? "#22C55E" : "#EAB308") : T.muted, margin: 0 }}>
                          {asgSubmitted}/{asgTotal}
                        </p>
                        <p style={{ fontSize: 10, color: T.muted, margin: 0 }}>submitted</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
          <div style={{ textAlign: "right", marginTop: 14 }}>
            <Btn label="Close" ghost onClick={closeModal} />
          </div>
        </ModalWrap>
      )}

     
    </div>
  )
}

function CourseCard({ course, onView, onStudents, onArchive, onUnarchive }) {
  const [hov, setHov] = useState(false)
  const tc = TYPE_COLORS[course.status] || TYPE_COLORS.active
  const enrollPct = course.capacity ? Math.min(100, Math.round((course.students / course.capacity) * 100)) : 0

  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: hov ? "var(--bg-2a2a2a)" : T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px 18px", transition: "background 0.15s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: T.sub, background: "rgba(156,163,175,0.1)", border: `1px solid ${T.border}`, padding: "2px 8px", borderRadius: 5 }}>{course.courseCode || course.courseId}</span>
          {course.sem && course.sem !== "N/A" && <span style={{ fontSize: 10, color: "#4ade80", background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", padding: "2px 8px", borderRadius: 5 }}>{course.sem}</span>}
          <span style={{ fontSize: 10, color: tc.color, background: tc.bg, padding: "2px 8px", borderRadius: 5 }}>{course.status || "active"}</span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
         
          <IBtn icon={<Users size={13} />} onClick={onStudents} title="View Students" />
          {course.status === "archived"
            ? <IBtn icon={<ArchiveRestore size={13} />} onClick={onUnarchive} title="Unarchive" />
            : <IBtn icon={<Archive size={13} />} onClick={onArchive} title="Archive" />
          }
          <IBtn icon={<Eye size={13} />} onClick={onView} title="View" />
          
        </div>
      </div>

      <p style={{ fontSize: 14, fontWeight: 600, color: T.txt, margin: "0 0 4px" }}>{course.courseName}</p>
      {course.description && <p style={{ fontSize: 11, color: T.muted, margin: "0 0 10px", lineHeight: 1.4 }}>{course.description}</p>}

      <div style={{ display: "flex", gap: 14, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: T.muted }}> {course.students}/{course.capacity} students</span>
        {course.schedule?.days && <span style={{ fontSize: 11, color: T.muted }}> {course.schedule.days}{course.schedule.time ? ` · ${course.schedule.time}` : ""}</span>}
        {Array.isArray(course.batches) && course.batches.length > 0 && (
          <span style={{ fontSize: 11, color: "#4ade80" }}>
            {course.batches.length} batch{course.batches.length !== 1 ? "es" : ""}
          </span>
        )}
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: T.muted }}>Enrollment</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: "#4ade80" }}>{enrollPct}%</span>
        </div>
        <div style={{ background: T.inner, borderRadius: 4, height: 4, overflow: "hidden" }}>
          <div style={{ width: `${enrollPct}%`, height: "100%", background: "#4ade80", borderRadius: 4 }} />
        </div>
      </div>
      {course.assignmentCount !== undefined && (
        <p style={{ fontSize: 10, color: T.muted, marginTop: 8 }}>{course.assignmentCount} assignment{course.assignmentCount !== 1 ? "s" : ""}</p>
      )}
    </div>
  )
}

function CourseViewModal({ course, assignments, onClose }) {
  const cas = assignments.filter(a => a.courseId?.toString() === course._id?.toString())
  return (
    <ModalWrap title={course.courseName} onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Code",     value: course.courseId || course.courseCode },
          { label: "Semester", value: course.sem || "N/A" },
          { label: "Students", value: `${course.students}/${course.capacity}` },
         
          { label: "Schedule", value: [course.schedule?.days, course.schedule?.time, course.schedule?.room].filter(Boolean).join(" · ") || "Not set" },
          { label: "Status",   value: course.status || "active" },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: T.inner, borderRadius: 8, padding: "10px 12px", border: `1px solid ${T.border}` }}>
            <p style={{ fontSize: 10, color: T.muted, margin: "0 0 3px" }}>{label}</p>
            <p style={{ fontSize: 13, color: T.txt, fontWeight: 500, margin: 0 }}>{value}</p>
          </div>
        ))}
      </div>
      {course.description && <p style={{ fontSize: 12, color: T.sub, marginBottom: 16, lineHeight: 1.5 }}>{course.description}</p>}
      {Array.isArray(course.batches) && course.batches.length > 0 && (
        <>
          <p style={{ fontSize: 11, fontWeight: 600, color: T.txt, marginBottom: 8 }}>Batches ({course.batches.length})</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
            {course.batches.map(b => (
              <div key={b._id} style={{ background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.txt }}>{b.batchName}</span>
                  <span style={{ fontSize: 11, color: T.muted }}>{b.students}/{b.capacity} students</span>
                </div>
                <p style={{ fontSize: 11, color: T.muted, margin: "4px 0 0" }}>
                  Teacher: {b.teacher?.name || "Unassigned"}
                  {(b.schedule?.days || b.schedule?.time) && ` · ${[b.schedule?.days, b.schedule?.time, b.schedule?.room].filter(Boolean).join(" · ")}`}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
      {cas.length > 0 && (
        <>
          <p style={{ fontSize: 11, fontWeight: 600, color: T.txt, marginBottom: 8 }}>Linked Assignments ({cas.length})</p>
          <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
            {cas.map(a => (
              <div key={a._id} style={{ background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: T.txt }}>{a.title}</span>
                <span style={{ fontSize: 11, color: T.muted }}>{a.submissions?.length || 0}/{a.total} submitted</span>
              </div>
            ))}
          </div>
        </>
      )}
      <div style={{ textAlign: "right" }}>
        <Btn label="Close" ghost onClick={onClose} />
      </div>
    </ModalWrap>
  )
}

function ModalWrap({ title, children, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "24px", width: "100%", maxWidth: 560, maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: T.txt, margin: 0 }}>{title}</p>
          <button onClick={onClose} style={{ background: T.inner, border: `1px solid ${T.border}`, borderRadius: 7, padding: 5, cursor: "pointer", color: T.sub, display: "flex" }}><X size={14} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function IBtn({ icon, onClick, title, danger }) {
  const [h, setH] = useState(false)
  return (
    <button onClick={onClick} title={title} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ background: h ? (danger ? "rgba(239,68,68,0.15)" : T.inner) : "transparent", border: "none", borderRadius: 6, padding: 5, cursor: "pointer", color: h ? (danger ? "#ef4444" : T.txt) : T.sub, display: "flex" }}>
      {icon}
    </button>
  )
}

function Btn({ label, onClick, ghost, disabled }) {
  const [h, setH] = useState(false)
  return (
    <button onClick={onClick} disabled={disabled} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ padding: "8px 18px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1,
        background: ghost ? (h ? T.inner : "transparent") : (h ? "#e5e7eb" : "#fff"),
        color: ghost ? T.sub : "#000", border: ghost ? `1px solid ${T.border}` : "none" }}>
      {label}
    </button>
  )
}
