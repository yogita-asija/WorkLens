import { useState, useEffect } from "react"
import { Plus, BookOpen, Users, TrendingUp, Search } from "lucide-react"
import { T, Card, StatMiniCard, Modal, ModalBtn, IconBtn, Icons, Badge } from "../../components/UI"
import * as adminApi from "../../services/adminApi"
import useAppStore from "../../store/useAppStore"

const EMPTY_FORM = {
  courseId: "", courseCode: "", courseName: "", description: "",
  sem: "", credits: 3, teacherId: "", capacity: 60,
  scheduleDays: "", scheduleTime: "", scheduleRoom: "",
}

const STATUS_COLORS = {
  active:   { color: "#22C55E", bg: "rgba(34,197,94,0.1)" },
  inactive: { color: "#CA8A04", bg: "rgba(202,138,4,0.1)" },
  archived: { color: "#6B7280", bg: "rgba(107,114,128,0.1)" },
}

export default function AdminCourses() {
  const { showToast } = useAppStore()
  const [courses,   setCourses]   = useState([])
  const [stats,     setStats]     = useState(null)
  const [total,     setTotal]     = useState(0)
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [page,      setPage]      = useState(1)
  const [modal,     setModal]     = useState(null)
  const [selected,  setSelected]  = useState(null)
  const [form,      setForm]      = useState(EMPTY_FORM)
  const [teachers,  setTeachers]  = useState([])
  const [submitting,setSubmitting]= useState(false)
  const [assignTeacherId, setAssignTeacherId] = useState("")
  const LIMIT = 15

  const load = async () => {
    setLoading(true)
    try {
      const params = { page, limit: LIMIT }
      if (search)       params.search = search
      if (statusFilter) params.status = statusFilter
      const [cRes, sRes] = await Promise.all([
        adminApi.getAdminCourses(params),
        adminApi.getAdminCourseStats(),
      ])
      setCourses(cRes.data || [])
      setTotal(cRes.total || 0)
      setStats(sRes.data)
    } catch (err) {
      showToast(err.message || "Failed to load courses", "error")
    } finally {
      setLoading(false)
    }
  }

  const loadTeachers = async () => {
    try {
      const res = await adminApi.getAdminTeachers({ limit: 200 })
      setTeachers(res.data || [])
    } catch {}
  }

  useEffect(() => { load() }, [page, statusFilter])
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load() }, 400)
    return () => clearTimeout(t)
  }, [search])

  const openAdd  = async () => { await loadTeachers(); setForm(EMPTY_FORM); setModal("add") }
  const openEdit = async (c) => {
    await loadTeachers()
    setSelected(c)
    setForm({
      courseId: c.courseId, courseCode: c.courseCode || "", courseName: c.courseName,
      description: c.description || "", sem: c.sem || "", credits: c.credits || 3,
      teacherId: c.teacher?.id || "", capacity: c.capacity || 60,
      scheduleDays: c.schedule?.days || "", scheduleTime: c.schedule?.time || "", scheduleRoom: c.schedule?.room || "",
    })
    setModal("edit")
  }
  const openView    = (c) => { setSelected(c); setModal("view") }
  const openAssign  = async (c) => { await loadTeachers(); setSelected(c); setAssignTeacherId(c.teacher?.id || ""); setModal("assign") }
  const closeModal  = () => { setModal(null); setSelected(null) }

  const handleSubmit = async () => {
    if (!form.courseId || !form.courseName) return showToast("Course ID and Name are required", "warn")
    setSubmitting(true)
    try {
      const payload = {
        ...form,
        schedule: { days: form.scheduleDays, time: form.scheduleTime, room: form.scheduleRoom },
      }
      if (modal === "add") {
        await adminApi.createAdminCourse(payload)
        showToast("Course created successfully")
      } else {
        await adminApi.updateAdminCourse(selected._id, payload)
        showToast("Course updated successfully")
      }
      closeModal(); load()
    } catch (err) {
      showToast(err.message || "Operation failed", "error")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (course) => {
    if (!confirm(`Delete "${course.courseName}"? This cannot be undone.`)) return
    try {
      await adminApi.deleteAdminCourse(course._id)
      showToast("Course deleted")
      load()
    } catch (err) {
      showToast(err.message || "Delete failed", "error")
    }
  }

  const handleAssignTeacher = async () => {
    if (!assignTeacherId) return showToast("Select a teacher", "warn")
    setSubmitting(true)
    try {
      await adminApi.assignCourseTeacher(selected._id, { teacherId: assignTeacherId })
      showToast("Teacher assigned successfully")
      closeModal(); load()
    } catch (err) {
      showToast(err.message || "Failed", "error")
    } finally {
      setSubmitting(false)
    }
  }

  const pages = Math.ceil(total / LIMIT)

  const field = (label, key, opts = {}) => (
    <div key={key}>
      <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 5 }}>{label}</label>
      <input
        type={opts.type || "text"} value={form[key]} placeholder={opts.ph || ""}
        onChange={e => setForm(p => ({ ...p, [key]: opts.type === "number" ? Number(e.target.value) : e.target.value }))}
        style={{ width: "100%", padding: "10px 12px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, color: T.txt, fontSize: 13 }}
      />
    </div>
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: T.txt }}>Course Management</h1>
          <p style={{ fontSize: 13, color: T.sub, marginTop: 2 }}>{total} courses in system</p>
        </div>
        <button onClick={openAdd}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", background: T.accent, color: "#000", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          <Plus size={15} /> Add Course
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 14 }}>
        <StatMiniCard label="Total"    value={stats?.total    ?? "—"} icon={<BookOpen size={16} />}    color="#3B82F6" />
        <StatMiniCard label="Active"   value={stats?.active   ?? "—"} icon={<TrendingUp size={16} />}  color="#22C55E" />
        <StatMiniCard label="Inactive" value={stats?.inactive ?? "—"} icon={<BookOpen size={16} />}    color="#CA8A04" />
        <StatMiniCard label="Archived" value={stats?.archived ?? "—"} icon={<BookOpen size={16} />}    color="#6B7280" />
      </div>

      {/* Filters */}
      <Card style={{ padding: "12px 16px", display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.muted }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search courses…"
            style={{ width: "100%", paddingLeft: 32, padding: "9px 12px 9px 32px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, color: T.txt, fontSize: 13 }} />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          style={{ padding: "9px 12px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, color: T.txt, fontSize: 13 }}>
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="archived">Archived</option>
        </select>
      </Card>

      {/* Table */}
      <Card style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                {["Course", "Code", "Teacher", "Semester", "Credits", "Students", "Status", "Actions"].map(h => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: T.muted }}>Loading…</td></tr>
              ) : courses.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: T.muted }}>No courses found</td></tr>
              ) : courses.map(c => {
                const sc = STATUS_COLORS[c.status] || STATUS_COLORS.inactive
                return (
                  <tr key={c._id} className="table-row-hover" style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: "13px 14px" }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: T.txt }}>{c.courseName}</p>
                      <p style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{c.courseId}</p>
                    </td>
                    <td style={{ padding: "13px 14px", fontSize: 12, color: T.sub }}>{c.courseCode || "—"}</td>
                    <td style={{ padding: "13px 14px", fontSize: 13, color: T.sub }}>{c.teacher?.name || <span style={{ color: T.muted }}>Unassigned</span>}</td>
                    <td style={{ padding: "13px 14px", fontSize: 12, color: T.sub }}>{c.sem || "—"}</td>
                    <td style={{ padding: "13px 14px", fontSize: 13, color: T.txt }}>{c.credits}</td>
                    <td style={{ padding: "13px 14px", fontSize: 13, color: T.txt }}>{Array.isArray(c.students) ? c.students.length : 0}</td>
                    <td style={{ padding: "13px 14px" }}>
                      <span style={{ padding: "4px 10px", borderRadius: 6, background: sc.bg, color: sc.color, fontSize: 11, fontWeight: 600, textTransform: "capitalize" }}>
                        {c.status}
                      </span>
                    </td>
                    <td style={{ padding: "13px 14px" }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <IconBtn icon={Icons.eye}   onClick={() => openView(c)}   title="View" />
                        <IconBtn icon={Icons.edit}  onClick={() => openEdit(c)}   title="Edit" />
                        <IconBtn icon={<Users size={14} />} onClick={() => openAssign(c)} title="Assign Teacher" />
                        <IconBtn icon={Icons.trash} onClick={() => handleDelete(c)} title="Delete" danger />
                      </div>
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

      {/* Add/Edit Modal */}
      {(modal === "add" || modal === "edit") && (
        <Modal onClose={closeModal}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: T.txt, marginBottom: 20 }}>
            {modal === "add" ? "Add New Course" : "Edit Course"}
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {field("Course ID *",   "courseId",   { ph: "CS401" })}
            {field("Course Code",   "courseCode", { ph: "CS-401" })}
            {field("Course Name *", "courseName", { ph: "Advanced Algorithms" })}
            {field("Semester",      "sem",        { ph: "6th" })}
            {field("Credits",       "credits",    { type: "number", ph: "3" })}
            {field("Capacity",      "capacity",   { type: "number", ph: "60" })}
            {field("Schedule Days", "scheduleDays", { ph: "Mon, Wed, Fri" })}
            {field("Schedule Time", "scheduleTime", { ph: "9:00 AM - 10:00 AM" })}
          </div>
          {field("Schedule Room", "scheduleRoom", { ph: "Room 301, Block A" })}
          <div style={{ marginTop: 14 }}>
            <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 5 }}>Assign Teacher</label>
            <select value={form.teacherId} onChange={e => setForm(p => ({ ...p, teacherId: e.target.value }))}
              style={{ width: "100%", padding: "10px 12px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, color: T.txt, fontSize: 13 }}>
              <option value="">-- Select Teacher --</option>
              {teachers.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
            </select>
          </div>
          <div style={{ marginTop: 14 }}>
            <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 5 }}>Description</label>
            <textarea value={form.description} rows={2}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              style={{ width: "100%", padding: "10px 12px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, color: T.txt, fontSize: 13, resize: "vertical" }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <ModalBtn label="Cancel" variant="secondary" onClick={closeModal} />
            <ModalBtn label={submitting ? "Saving…" : "Save"} onClick={handleSubmit} />
          </div>
        </Modal>
      )}

      {/* View Modal */}
      {modal === "view" && selected && (
        <Modal onClose={closeModal}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: T.txt, marginBottom: 20 }}>{selected.courseName}</h2>
          {[
            ["Course ID",   selected.courseId],
            ["Code",        selected.courseCode || "—"],
            ["Semester",    selected.sem || "—"],
            ["Credits",     selected.credits],
            ["Teacher",     selected.teacher?.name || "Unassigned"],
            ["Students",    Array.isArray(selected.students) ? selected.students.length : 0],
            ["Capacity",    selected.capacity],
            ["Status",      selected.status],
            ["Schedule",    [selected.schedule?.days, selected.schedule?.time, selected.schedule?.room].filter(Boolean).join(" · ") || "—"],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
              <span style={{ fontSize: 13, color: T.sub }}>{k}</span>
              <span style={{ fontSize: 13, color: T.txt, fontWeight: 500, textTransform: "capitalize" }}>{v}</span>
            </div>
          ))}
          <div style={{ marginTop: 20, textAlign: "right" }}><ModalBtn label="Close" variant="secondary" onClick={closeModal} /></div>
        </Modal>
      )}

      {/* Assign Teacher Modal */}
      {modal === "assign" && selected && (
        <Modal onClose={closeModal}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: T.txt, marginBottom: 8 }}>Assign Teacher</h2>
          <p style={{ fontSize: 13, color: T.sub, marginBottom: 20 }}>Course: <strong style={{ color: T.txt }}>{selected.courseName}</strong></p>
          <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 6 }}>Select Teacher</label>
          <select value={assignTeacherId} onChange={e => setAssignTeacherId(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, color: T.txt, fontSize: 13, marginBottom: 20 }}>
            <option value="">-- Select Teacher --</option>
            {teachers.map(t => <option key={t._id} value={t._id}>{t.name} — {t.department || "No dept"}</option>)}
          </select>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <ModalBtn label="Cancel" variant="secondary" onClick={closeModal} />
            <ModalBtn label={submitting ? "Assigning…" : "Assign"} onClick={handleAssignTeacher} />
          </div>
        </Modal>
      )}
    </div>
  )
}
