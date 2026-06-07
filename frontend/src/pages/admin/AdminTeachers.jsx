import { useState, useEffect, useMemo } from "react"
import { Search, Plus, Trash2, Edit, KeyRound, Building2, Eye, X } from "lucide-react"
import { T, Card, Badge, Modal, ModalBtn, IconBtn, Icons } from "../../components/UI"
import * as adminApi from "../../services/adminApi"
import useAppStore from "../../store/useAppStore"

const EMPTY_FORM = { name: "", email: "", password: "", department: "", phone: "", bio: "" }

function statusBadge(active) {
  return active
    ? { label: "Active",   color: "#22C55E", bg: "rgba(34,197,94,0.12)" }
    : { label: "Inactive", color: "#EF4444", bg: "rgba(239,68,68,0.12)" }
}

export default function AdminTeachers() {
  const { showToast } = useAppStore()
  const [teachers,  setTeachers]  = useState([])
  const [total,     setTotal]     = useState(0)
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState("")
  const [deptFilter,setDeptFilter]= useState("")
  const [page,      setPage]      = useState(1)
  const [modal,     setModal]     = useState(null) // "add" | "edit" | "view" | "reset" | "dept"
  const [selected,  setSelected]  = useState(null)
  const [form,      setForm]      = useState(EMPTY_FORM)
  const [submitting,setSubmitting]= useState(false)
  const [resetPwd,  setResetPwd]  = useState("Welcome@123")
  const [newDept,   setNewDept]   = useState("")

  const LIMIT = 15

  const load = async () => {
    setLoading(true)
    try {
      const params = { page, limit: LIMIT }
      if (search)     params.search     = search
      if (deptFilter) params.department = deptFilter
      const res = await adminApi.getAdminTeachers(params)
      setTeachers(res.data || [])
      setTotal(res.total || 0)
    } catch (err) {
      showToast(err.message || "Failed to load teachers", "error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [page, deptFilter])

  // debounced search
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load() }, 400)
    return () => clearTimeout(t)
  }, [search])

  const openAdd  = () => { setForm(EMPTY_FORM); setModal("add") }
  const openEdit = (t) => { setSelected(t); setForm({ name: t.name, email: t.email, password: "", department: t.department || "", phone: t.phone || "", bio: t.bio || "" }); setModal("edit") }
  const openView = (t) => { setSelected(t); setModal("view") }
  const openReset= (t) => { setSelected(t); setResetPwd("Welcome@123"); setModal("reset") }
  const openDept = (t) => { setSelected(t); setNewDept(t.department || ""); setModal("dept") }
  const closeModal= () => { setModal(null); setSelected(null) }

  const handleSubmit = async () => {
    if (!form.name || !form.email) return showToast("Name and email are required", "warn")
    setSubmitting(true)
    try {
      if (modal === "add") {
        await adminApi.createAdminTeacher(form)
        showToast("Teacher created successfully")
      } else {
        await adminApi.updateAdminTeacher(selected._id, form)
        showToast("Teacher updated successfully")
      }
      closeModal(); load()
    } catch (err) {
      showToast(err.message || "Operation failed", "error")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (teacher) => {
    if (!confirm(`Delete ${teacher.name}? This cannot be undone.`)) return
    try {
      await adminApi.deleteAdminTeacher(teacher._id)
      showToast("Teacher deleted")
      load()
    } catch (err) {
      showToast(err.message || "Delete failed", "error")
    }
  }

  const handleReset = async () => {
    if (!resetPwd.trim()) return showToast("Password cannot be empty", "warn")
    setSubmitting(true)
    try {
      await adminApi.resetTeacherPassword(selected._id, { newPassword: resetPwd })
      showToast("Password reset successfully")
      closeModal()
    } catch (err) {
      showToast(err.message || "Reset failed", "error")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeptAssign = async () => {
    if (!newDept.trim()) return showToast("Department is required", "warn")
    setSubmitting(true)
    try {
      await adminApi.assignTeacherDept(selected._id, { department: newDept })
      showToast("Department assigned")
      closeModal(); load()
    } catch (err) {
      showToast(err.message || "Failed", "error")
    } finally {
      setSubmitting(false)
    }
  }

  const pages = Math.ceil(total / LIMIT)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: T.txt }}>Teacher Management</h1>
          <p style={{ fontSize: 13, color: T.sub, marginTop: 2 }}>{total} teacher{total !== 1 ? "s" : ""} registered</p>
        </div>
        <button
          onClick={openAdd}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", background: T.accent, color: "#000", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          <Plus size={15} /> Add Teacher
        </button>
      </div>

      {/* Filters */}
      <Card style={{ padding: "14px 16px", display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.muted }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            style={{ width: "100%", paddingLeft: 32, padding: "9px 12px 9px 32px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, color: T.txt, fontSize: 13 }}
          />
        </div>
        <input
          value={deptFilter} onChange={e => { setDeptFilter(e.target.value); setPage(1) }}
          placeholder="Filter by department…"
          style={{ padding: "9px 12px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, color: T.txt, fontSize: 13, width: 200 }}
        />
      </Card>

      {/* Table */}
      <Card style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                {["Name", "Email", "Department", "Courses", "Joined", "Actions"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: T.muted, fontSize: 13 }}>Loading…</td></tr>
              ) : teachers.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: T.muted, fontSize: 13 }}>No teachers found</td></tr>
              ) : teachers.map(t => (
                <tr key={t._id} className="table-row-hover" style={{ borderBottom: `1px solid ${T.border}` }}>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#22C55E", color: "#000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                        {t.name.split(" ").map(w => w[0]).slice(0, 2).join("")}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 500, color: T.txt }}>{t.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: 13, color: T.sub }}>{t.email}</td>
                  <td style={{ padding: "14px 16px", fontSize: 13, color: T.sub }}>{t.department || <span style={{ color: T.muted }}>—</span>}</td>
                  <td style={{ padding: "14px 16px", fontSize: 13, color: T.txt }}>{t.courseCount ?? 0}</td>
                  <td style={{ padding: "14px 16px", fontSize: 12, color: T.muted }}>{new Date(t.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <IconBtn icon={Icons.eye}   onClick={() => openView(t)}  title="View" />
                      <IconBtn icon={Icons.edit}  onClick={() => openEdit(t)}  title="Edit" />
                      <IconBtn icon={<Building2 size={14} />} onClick={() => openDept(t)}  title="Assign Department" />
                      <IconBtn icon={<KeyRound size={14} />}  onClick={() => openReset(t)} title="Reset Password" />
                      <IconBtn icon={Icons.trash} onClick={() => handleDelete(t)} title="Delete" danger />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, padding: 16, borderTop: `1px solid ${T.border}` }}>
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              style={{ padding: "6px 14px", background: page <= 1 ? T.inner : T.card, border: `1px solid ${T.border}`, borderRadius: 6, color: page <= 1 ? T.muted : T.txt, fontSize: 12, cursor: page <= 1 ? "default" : "pointer" }}>
              Prev
            </button>
            <span style={{ fontSize: 12, color: T.sub }}>Page {page} of {pages}</span>
            <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}
              style={{ padding: "6px 14px", background: page >= pages ? T.inner : T.card, border: `1px solid ${T.border}`, borderRadius: 6, color: page >= pages ? T.muted : T.txt, fontSize: 12, cursor: page >= pages ? "default" : "pointer" }}>
              Next
            </button>
          </div>
        )}
      </Card>

      {/* ── Modals ── */}

      {/* Add / Edit Teacher */}
      {(modal === "add" || modal === "edit") && (
        <Modal onClose={closeModal}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: T.txt, marginBottom: 20 }}>
            {modal === "add" ? "Add New Teacher" : "Edit Teacher"}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { label: "Full Name *", key: "name",       type: "text",     ph: "Dr. John Smith" },
              { label: "Email *",     key: "email",      type: "email",    ph: "john.smith@univ.edu" },
              { label: "Password",    key: "password",   type: "password", ph: modal === "add" ? "Default: Welcome@123" : "Leave blank to keep current" },
              { label: "Department",  key: "department", type: "text",     ph: "Computer Science" },
              { label: "Phone",       key: "phone",      type: "text",     ph: "+91-9876543210" },
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 5 }}>{f.label}</label>
                <input
                  type={f.type} value={form[f.key]} placeholder={f.ph}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{ width: "100%", padding: "10px 12px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, color: T.txt, fontSize: 13 }}
                />
              </div>
            ))}
            <div>
              <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 5 }}>Bio</label>
              <textarea
                value={form.bio} rows={3}
                onChange={e => setForm(p => ({ ...p, bio: e.target.value }))}
                style={{ width: "100%", padding: "10px 12px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, color: T.txt, fontSize: 13, resize: "vertical" }}
              />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <ModalBtn label="Cancel" variant="secondary" onClick={closeModal} />
            <ModalBtn label={submitting ? "Saving…" : "Save"} onClick={handleSubmit} />
          </div>
        </Modal>
      )}

      {/* View Teacher */}
      {modal === "view" && selected && (
        <Modal onClose={closeModal}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: T.txt, marginBottom: 20 }}>Teacher Profile</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#22C55E", color: "#000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700 }}>
              {selected.name.split(" ").map(w => w[0]).slice(0, 2).join("")}
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 600, color: T.txt }}>{selected.name}</p>
              <p style={{ fontSize: 13, color: T.sub }}>{selected.email}</p>
            </div>
          </div>
          {[
            ["Department",  selected.department || "—"],
            ["Phone",       selected.phone || "—"],
            ["Courses",     `${selected.courseCount ?? 0} assigned`],
            ["Joined",      new Date(selected.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
              <span style={{ fontSize: 13, color: T.sub }}>{k}</span>
              <span style={{ fontSize: 13, color: T.txt, fontWeight: 500 }}>{v}</span>
            </div>
          ))}
          {selected.bio && (
            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: 12, color: T.sub, marginBottom: 6 }}>Bio</p>
              <p style={{ fontSize: 13, color: T.txt, lineHeight: 1.6 }}>{selected.bio}</p>
            </div>
          )}
          <div style={{ marginTop: 20, textAlign: "right" }}>
            <ModalBtn label="Close" variant="secondary" onClick={closeModal} />
          </div>
        </Modal>
      )}

      {/* Reset Password */}
      {modal === "reset" && selected && (
        <Modal onClose={closeModal}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: T.txt, marginBottom: 8 }}>Reset Password</h2>
          <p style={{ fontSize: 13, color: T.sub, marginBottom: 20 }}>Reset password for <strong style={{ color: T.txt }}>{selected.name}</strong></p>
          <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 6 }}>New Password</label>
          <input type="text" value={resetPwd} onChange={e => setResetPwd(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, color: T.txt, fontSize: 13, marginBottom: 20 }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <ModalBtn label="Cancel" variant="secondary" onClick={closeModal} />
            <ModalBtn label={submitting ? "Resetting…" : "Reset"} onClick={handleReset} />
          </div>
        </Modal>
      )}

      {/* Assign Department */}
      {modal === "dept" && selected && (
        <Modal onClose={closeModal}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: T.txt, marginBottom: 8 }}>Assign Department</h2>
          <p style={{ fontSize: 13, color: T.sub, marginBottom: 20 }}>Assign department for <strong style={{ color: T.txt }}>{selected.name}</strong></p>
          <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 6 }}>Department</label>
          <input value={newDept} onChange={e => setNewDept(e.target.value)} placeholder="e.g. Computer Science"
            style={{ width: "100%", padding: "10px 12px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, color: T.txt, fontSize: 13, marginBottom: 20 }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <ModalBtn label="Cancel" variant="secondary" onClick={closeModal} />
            <ModalBtn label={submitting ? "Assigning…" : "Assign"} onClick={handleDeptAssign} />
          </div>
        </Modal>
      )}
    </div>
  )
}
