import { useState, useEffect } from "react"
import { Plus, Building2, Users, BookOpen, Crown } from "lucide-react"
import { T, Card, StatMiniCard, Modal, ModalBtn, IconBtn, Icons } from "../../components/UI"
import * as adminApi from "../../services/adminApi"
import useAppStore from "../../store/useAppStore"

const EMPTY_FORM = { name: "", code: "", description: "" }

export default function AdminDepartments() {
  const { showToast } = useAppStore()
  const [depts,     setDepts]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [modal,     setModal]     = useState(null)
  const [selected,  setSelected]  = useState(null)
  const [form,      setForm]      = useState(EMPTY_FORM)
  const [submitting,setSubmitting]= useState(false)
  const [teachers,  setTeachers]  = useState([])
  const [hodId,     setHodId]     = useState("")
  const [search,    setSearch]    = useState("")

  const load = async () => {
    setLoading(true)
    try {
      const res = await adminApi.getAdminDepartments(search ? { search } : {})
      setDepts(res.data || [])
    } catch (err) {
      showToast(err.message || "Failed to load departments", "error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    const t = setTimeout(load, 400)
    return () => clearTimeout(t)
  }, [search])

  const openAdd  = () => { setForm(EMPTY_FORM); setModal("add") }
  const openEdit = (d) => { setSelected(d); setForm({ name: d.name, code: d.code, description: d.description || "" }); setModal("edit") }
  const openView = async (d) => {
    setSelected(d)
    try {
      const res = await adminApi.getAdminDepartmentById(d._id)
      setSelected(res.data)
    } catch {}
    setModal("view")
  }
  const openHOD  = async (d) => {
    setSelected(d)
    setHodId(d.hod?.userId || "")
    try {
      const res = await adminApi.getAdminTeachers({ department: d.name, limit: 100 })
      setTeachers(res.data || [])
    } catch {}
    setModal("hod")
  }
  const closeModal = () => { setModal(null); setSelected(null); setTeachers([]) }

  const handleSubmit = async () => {
    if (!form.name || !form.code) return showToast("Name and code are required", "warn")
    setSubmitting(true)
    try {
      if (modal === "add") {
        await adminApi.createAdminDepartment(form)
        showToast("Department created")
      } else {
        await adminApi.updateAdminDepartment(selected._id, form)
        showToast("Department updated")
      }
      closeModal(); load()
    } catch (err) {
      showToast(err.message || "Operation failed", "error")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (dept) => {
    if (!confirm(`Delete ${dept.name}? Teachers assigned here will not be deleted.`)) return
    try {
      await adminApi.deleteAdminDepartment(dept._id)
      showToast("Department deleted")
      load()
    } catch (err) {
      showToast(err.message || "Delete failed", "error")
    }
  }

  const handleHOD = async () => {
    if (!hodId) return showToast("Select a teacher", "warn")
    setSubmitting(true)
    try {
      await adminApi.assignDeptHOD(selected._id, { userId: hodId })
      showToast("HOD assigned successfully")
      closeModal(); load()
    } catch (err) {
      showToast(err.message || "Failed", "error")
    } finally {
      setSubmitting(false)
    }
  }

  const totalTeachers = depts.reduce((s, d) => s + (d.totalTeachers || 0), 0)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: T.txt }}>Department Management</h1>
          <p style={{ fontSize: 13, color: T.sub, marginTop: 2 }}>{depts.length} departments configured</p>
        </div>
        <button onClick={openAdd}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", background: T.accent, color: "#000", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          <Plus size={15} /> Add Department
        </button>
      </div>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
        <StatMiniCard label="Total Departments" value={depts.length}   icon={<Building2 size={16} />} color="#06B6D4" />
        <StatMiniCard label="Total Teachers"    value={totalTeachers} icon={<Users size={16} />}     color="#22C55E" />
      </div>

      {/* Search */}
      <Card style={{ padding: "12px 16px" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search departments…"
          style={{ width: "100%", padding: "9px 12px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, color: T.txt, fontSize: 13 }}
        />
      </Card>

      {/* Grid */}
      {loading ? (
        <div style={{ textAlign: "center", color: T.muted, padding: 40 }}>Loading…</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {depts.map(d => (
            <Card key={d._id} style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(6,182,212,0.12)", color: "#06B6D4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700 }}>
                    {d.code}
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: T.txt }}>{d.name}</p>
                    {d.hod?.name && (
                      <p style={{ fontSize: 11, color: T.muted, marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                        <Crown size={10} /> HOD: {d.hod.name}
                      </p>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <IconBtn icon={Icons.eye}   onClick={() => openView(d)} title="View" />
                  <IconBtn icon={Icons.edit}  onClick={() => openEdit(d)} title="Edit" />
                  <IconBtn icon={<Crown size={14} />}  onClick={() => openHOD(d)}  title="Assign HOD" />
                  <IconBtn icon={Icons.trash} onClick={() => handleDelete(d)} title="Delete" danger />
                </div>
              </div>
              {d.description && <p style={{ fontSize: 12, color: T.sub, marginBottom: 14, lineHeight: 1.5 }}>{d.description}</p>}
              <div style={{ display: "flex", gap: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Users size={12} style={{ color: T.muted }} />
                  <span style={{ fontSize: 12, color: T.sub }}>{d.totalTeachers || 0} Teachers</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: d.status === "active" ? "#22C55E" : "#EF4444", display: "inline-block" }} />
                  <span style={{ fontSize: 12, color: T.sub, textTransform: "capitalize" }}>{d.status}</span>
                </div>
              </div>
            </Card>
          ))}
          {depts.length === 0 && <p style={{ color: T.muted, fontSize: 13 }}>No departments found</p>}
        </div>
      )}

      {/* Add / Edit Modal */}
      {(modal === "add" || modal === "edit") && (
        <Modal onClose={closeModal}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: T.txt, marginBottom: 20 }}>
            {modal === "add" ? "Add Department" : "Edit Department"}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { label: "Department Name *", key: "name", ph: "Computer Science" },
              { label: "Code *",            key: "code", ph: "CS" },
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 5 }}>{f.label}</label>
                <input value={form[f.key]} placeholder={f.ph}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{ width: "100%", padding: "10px 12px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, color: T.txt, fontSize: 13 }}
                />
              </div>
            ))}
            <div>
              <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 5 }}>Description</label>
              <textarea value={form.description} rows={3}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
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

      {/* View Modal */}
      {modal === "view" && selected && (
        <Modal onClose={closeModal}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: T.txt, marginBottom: 20 }}>{selected.name}</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {[
              ["Code", selected.code],
              ["HOD", selected.hod?.name || "—"],
              ["Teachers", `${selected.totalTeachers || (selected.teachers?.length) || 0}`],
              ["Status", selected.status],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 13, color: T.sub }}>{k}</span>
                <span style={{ fontSize: 13, color: T.txt, fontWeight: 500, textTransform: "capitalize" }}>{v}</span>
              </div>
            ))}
          </div>
          {selected.teachers?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 12, color: T.sub, marginBottom: 10 }}>ASSIGNED TEACHERS</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {selected.teachers.slice(0, 5).map(t => (
                  <div key={t._id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#22C55E", color: "#000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>
                      {t.name.split(" ").map(w => w[0]).slice(0, 2).join("")}
                    </div>
                    <span style={{ fontSize: 13, color: T.txt }}>{t.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ marginTop: 20, textAlign: "right" }}><ModalBtn label="Close" variant="secondary" onClick={closeModal} /></div>
        </Modal>
      )}

      {/* HOD Assignment */}
      {modal === "hod" && selected && (
        <Modal onClose={closeModal}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: T.txt, marginBottom: 8 }}>Assign HOD</h2>
          <p style={{ fontSize: 13, color: T.sub, marginBottom: 20 }}>Select Head of Department for <strong style={{ color: T.txt }}>{selected.name}</strong></p>
          <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 6 }}>Select Teacher</label>
          <select value={hodId} onChange={e => setHodId(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, color: T.txt, fontSize: 13, marginBottom: 20 }}>
            <option value="">-- Select Teacher --</option>
            {teachers.map(t => (
              <option key={t._id} value={t._id}>{t.name} ({t.email})</option>
            ))}
          </select>
          {teachers.length === 0 && <p style={{ fontSize: 12, color: T.warn, marginBottom: 16 }}>No teachers in this department yet. Assign teachers first.</p>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <ModalBtn label="Cancel" variant="secondary" onClick={closeModal} />
            <ModalBtn label={submitting ? "Assigning…" : "Assign HOD"} onClick={handleHOD} />
          </div>
        </Modal>
      )}
    </div>
  )
}
