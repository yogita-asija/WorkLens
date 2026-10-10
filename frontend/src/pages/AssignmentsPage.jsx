import React, { useState, useMemo, useEffect, useCallback } from "react"
import { Search, Plus, Edit2, Trash2, X, FileText, CheckCircle, Clock, Users } from "lucide-react"
import { T } from "../components/UI"
import useAppStore from "../store/useAppStore"
import { useAssignments, useCourses } from "../hooks/useData"
import * as api from "../services/api"

const TYPE_COLORS = {
  PROJECT:    { color: "#4ade80", bg: "rgba(6,182,212,0.1)" },
  CODING:     { color: "#4ade80", bg: "rgba(6,182,212,0.1)" },
  QUIZ:       { color: "#4ade80", bg: "rgba(6,182,212,0.1)" },
  ASSIGNMENT: { color: "#4ade80", bg: "rgba(6,182,212,0.1)" },
  EXAM:       { color: "#4ade80", bg: "rgba(6,182,212,0.1)" },
}

const EMPTY_FORM = { title: "", description: "", courseId: "", type: "ASSIGNMENT", deadline: "", total: "", maxGrade: 100 }

const F = ({ label, children, required, theme }) => (
  <div style={{ marginBottom: 13 }}>
    <label style={{ display: "block", fontSize: 11, color: theme.sub, marginBottom: 5, fontWeight: 500 }}>
      {label}{required && <span style={{ color: "#ef4444" }}> *</span>}
    </label>
    {children}
  </div>
)

export default function AssignmentsPage() {
  const { upsertAssignment, removeAssignment, showToast } = useAppStore()
  const { assignments, reload } = useAssignments()
  const { courses } = useCourses()

  const [search,      setSearch]      = useState("")
  const [typeFilter,  setTypeFilter]  = useState("ALL")
  const [statusFilter,setStatusFilter]= useState("all")
  const [modal,       setModal]       = useState(null)
  const [target,      setTarget]      = useState(null)
  const [form,        setForm]        = useState(EMPTY_FORM)
  const [saving,      setSaving]      = useState(false)
  const [gradeTarget, setGradeTarget] = useState(null)
  const [gradeForm,   setGradeForm]   = useState({ grade: "", feedback: "" })

  // Students marks modal state
  const [marksModal,   setMarksModal]   = useState(false)
  const [marksAssign,  setMarksAssign]  = useState(null)
  const [marksData,    setMarksData]    = useState(null)
  const [marksLoading, setMarksLoading] = useState(false)
  const [marksInput,   setMarksInput]   = useState({}) // { studentId: { grade, feedback } }
  const [marksSaving,  setMarksSaving]  = useState(false)

  const now = new Date()
  const overdue = (a) => a.deadline && new Date(a.deadline) < now && !a.completed

  const filtered = useMemo(() => {
    let list = assignments
    if (typeFilter !== "ALL") list = list.filter(a => a.type === typeFilter)
    if (statusFilter === "active")    list = list.filter(a => !a.completed && !overdue(a))
    if (statusFilter === "overdue")   list = list.filter(a => overdue(a))
    if (statusFilter === "completed") list = list.filter(a => a.completed)
    if (search.trim()) {
      const s = search.toLowerCase()
      list = list.filter(a => a.title?.toLowerCase().includes(s) || a.course?.toLowerCase().includes(s))
    }
    return list
  }, [assignments, typeFilter, statusFilter, search])

  const totalA     = assignments.length
  const activeA    = assignments.filter(a => !a.completed && !overdue(a)).length
  const overdueA   = assignments.filter(overdue).length
  const completedA = assignments.filter(a => a.completed).length
  const avgRate    = totalA > 0
    ? Math.round(assignments.reduce((s, a) => s + (a.total > 0 ? ((a.submissions?.length || a.submitted || 0) / a.total) * 100 : 0), 0) / totalA)
    : 0

  const openCreate = () => { setForm(EMPTY_FORM); setModal("create") }
  const openEdit   = (a) => {
    setTarget(a)
    setForm({ title: a.title, description: a.description || "", courseId: a.courseId || "", type: a.type, deadline: a.deadline || "", total: a.total || "", maxGrade: a.maxGrade || 100 })
    setModal("edit")
  }
  const openView   = (a) => { setTarget(a); setModal("view") }
  const closeModal = () => { setModal(null); setTarget(null); setGradeTarget(null) }

  // Open students/marks modal
  const openMarksModal = useCallback(async (a) => {
    setMarksAssign(a)
    setMarksModal(true)
    setMarksLoading(true)
    setMarksData(null)
    setMarksInput({})
    try {
      const data = await api.getAssignmentStudentsMarks(a._id)
      setMarksData(data)
      // Pre-fill input from existing grades
      const prefilled = {}
      for (const s of (data.students || [])) {
        prefilled[s.id] = {
          grade: s.grade !== null && s.grade !== undefined ? String(s.grade) : "",
          feedback: s.feedback || "",
        }
      }
      setMarksInput(prefilled)
    } catch (err) {
      showToast(err.message || "Failed to load students", "error")
      setMarksModal(false)
    } finally {
      setMarksLoading(false)
    }
  }, [showToast])

  const closeMarksModal = () => {
    setMarksModal(false)
    setMarksAssign(null)
    setMarksData(null)
    setMarksInput({})
  }

  const handleMarkInput = (studentId, field, value) => {
    setMarksInput(prev => ({
      ...prev,
      [studentId]: { ...(prev[studentId] || {}), [field]: value }
    }))
  }

  const handleSaveMarks = async () => {
    if (!marksAssign || !marksData) return
    setMarksSaving(true)
    try {
      const marks = (marksData.students || []).map(s => ({
        studentId: s.id,
        studentName: s.name,
        grade: marksInput[s.id]?.grade !== "" && marksInput[s.id]?.grade !== undefined
          ? Number(marksInput[s.id].grade)
          : null,
        feedback: marksInput[s.id]?.feedback || "",
      }))
      await api.bulkSaveMarks(marksAssign._id, { marks })
      showToast("Marks saved successfully!")
      reload()
      closeMarksModal()
    } catch (err) {
      showToast(err.message || "Failed to save marks", "error")
    } finally {
      setMarksSaving(false)
    }
  }

  const handleSave = async () => {
    if (!form.title.trim()) return showToast("Title is required", "error")
    setSaving(true)
    try {
      if (modal === "create") {
        const saved = await api.createAssignment({ ...form, total: Number(form.total) || 0, uploadDate: new Date().toISOString().slice(0, 10) })
        upsertAssignment(saved)
        showToast(`"${saved.title}" created`)
      } else {
        const saved = await api.updateAssignment(target._id, { ...form, total: Number(form.total) || 0 })
        upsertAssignment(saved)
        showToast(`"${saved.title}" updated`)
      }
      closeModal(); reload()
    } catch (err) { showToast(err.message || "Save failed", "error") }
    finally { setSaving(false) }
  }

  const handleDelete = async (a) => {
    if (!window.confirm(`Delete "${a.title}"?`)) return
    try {
      await api.deleteAssignment(a._id)
      removeAssignment(a._id)
      showToast("Assignment deleted")
    } catch (err) { showToast(err.message, "error") }
  }

  const handleToggleComplete = async (a) => {
    try {
      const saved = await api.updateAssignment(a._id, { completed: !a.completed })
      upsertAssignment(saved)
      showToast(saved.completed ? "Marked complete" : "Marked active")
    } catch (err) { showToast(err.message, "error") }
  }

  const openGrade = (a, sub) => { setGradeTarget({ a, sub }); setGradeForm({ grade: sub.grade ?? "", feedback: sub.feedback || "" }) }

  const handleGrade = async () => {
    if (gradeForm.grade === "") return showToast("Enter a grade", "error")
    try {
      await api.gradeSubmission(gradeTarget.a._id, gradeTarget.sub._id, { grade: Number(gradeForm.grade), feedback: gradeForm.feedback })
      showToast("Graded!")
      reload()
      setGradeTarget(null)
    } catch (err) { showToast(err.message, "error") }
  }

  const inp = { background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", color: T.txt, fontSize: 13, width: "100%", outline: "none" }
  // const F = ({ label, children, required }) => (
  //   <div style={{ marginBottom: 13 }}>
  //     <label style={{ display: "block", fontSize: 11, color: T.sub, marginBottom: 5, fontWeight: 500 }}>{label}{required && <span style={{ color: "#ef4444" }}> *</span>}</label>
  //     {children}
  //   </div>
  // )

  return (
    <div style={{ minHeight: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: T.txt, margin: 0 }}>Assignments</h1>
          <p style={{ fontSize: 13, color: T.muted, marginTop: 4, margin: 0 }}>Manage assignments, submissions & grading</p>
        </div>
        <button onClick={openCreate} style={{ display: "flex", alignItems: "center", gap: 7, background: "#179344", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          <Plus size={15} /> New Assignment
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total",        value: totalA,     color: T.txt },
          { label: "Active",       value: activeA,    color: T.txt },
          { label: "Overdue",      value: overdueA,   color:T.txt },
          { label: "Completed",    value: completedA, color: T.txt},
          { label: "Avg Sub Rate", value: `${avgRate}%`, color:T.txt},
        ].map(s => (
          <div key={s.label} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "13px 16px" }}>
            <p style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 5px" }}>{s.label}</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: s.color, margin: 0 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.muted }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assignments…" style={{ ...inp, paddingLeft: 32 }} />
        </div>
        {["all","active","overdue","completed"].map(f => (
          <button key={f} onClick={() => setStatusFilter(f)} style={{ padding: "7px 13px", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer", background: statusFilter===f?"#fff":T.card, color: statusFilter===f?"#000":T.sub, border: `1px solid ${statusFilter===f?"#fff":T.border}` }}>
            {f.charAt(0).toUpperCase()+f.slice(1)}
          </button>
        ))}
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          style={{ ...inp, width: "auto", appearance: "none", padding: "7px 12px" }}>
          <option value="ALL">All Types</option>
          {["ASSIGNMENT","PROJECT","CODING","QUIZ","EXAM"].map(t => <option key={t}>{t}</option>)}
        </select>
      </div>

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(a => (
          <AssignmentRow key={a._id} a={a} courses={courses}
            onView={() => openView(a)} onEdit={() => openEdit(a)}
            onDelete={() => handleDelete(a)} onToggle={() => handleToggleComplete(a)}
            onStudentsMarks={() => openMarksModal(a)}
          />
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0", color: T.muted }}>
            <FileText size={40} style={{ margin: "0 auto 12px", display: "block", opacity: 0.3 }} />
            <p style={{ fontSize: 14 }}>No assignments found</p>
          </div>
        )}
      </div>

      {/* ── Create/Edit Modal ── */}
      {(modal === "create" || modal === "edit") && (
        <ModalWrap title={modal === "create" ? "New Assignment" : "Edit Assignment"} onClose={closeModal}>
          <F label="Title"  required theme={T}>
            <input value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} style={inp} placeholder="Assignment title..." />
          </F>
          <F label="Description"  theme={T}>
            <textarea value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} style={{ ...inp, height: 60, resize: "vertical" }} placeholder="Optional description..." />
          </F>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
            <F label="Course" required theme={T}>
              <select value={form.courseId} onChange={e => setForm(f=>({...f,courseId:e.target.value}))} style={{ ...inp, appearance: "none" }}>
                <option value="">No course</option>
                {courses.map(c => <option key={c._id} value={c._id}>{c.courseCode || c.courseId} — {c.courseName}</option>)}
              </select>
            </F>
            <F label="Type" required theme={T}>
              <select value={form.type} onChange={e => setForm(f=>({...f,type:e.target.value}))} style={{ ...inp, appearance: "none" }}>
                {["ASSIGNMENT","PROJECT","CODING","QUIZ","EXAM"].map(t => <option key={t}>{t}</option>)}
              </select>
            </F>
            <F label="Deadline" required theme={T}>
              <input type="date" value={form.deadline} onChange={e => setForm(f=>({...f,deadline:e.target.value}))} style={inp} />
            </F>
            <F label="Total Students" theme={T}>
              <input type="number" value={form.total} onChange={e => setForm(f=>({...f,total:e.target.value}))} style={inp} placeholder="0 = auto from course" />
            </F>
            <F label="Max Grade" required theme={T}>
              <input type="number" value={form.maxGrade} onChange={e => setForm(f=>({...f,maxGrade:e.target.value}))} style={inp} />
            </F>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
            <Btn label="Cancel" ghost onClick={closeModal} />
            <Btn label={saving ? "Saving…" : modal === "create" ? "Create" : "Save"} onClick={handleSave} disabled={saving} />
          </div>
        </ModalWrap>
      )}

      {/* ── View/Submissions Modal ── */}
      {modal === "view" && target && (
        <ModalWrap title={target.title} onClose={closeModal} wide>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
            {[
              { label: "Course",    value: target.course || "—" },
              { label: "Type",      value: target.type },
              { label: "Deadline",  value: target.deadline || "None" },
              { label: "Submitted", value: `${target.submissions?.length || target.submitted || 0}/${target.total}` },
              { label: "Max Grade", value: target.maxGrade || 100 },
              { label: "Status",    value: target.completed ? "Completed" : overdue(target) ? "Overdue" : "Active" },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: T.inner, borderRadius: 8, padding: "10px 12px", border: `1px solid ${T.border}` }}>
                <p style={{ fontSize: 10, color: T.muted, margin: "0 0 3px" }}>{label}</p>
                <p style={{ fontSize: 13, color: T.txt, fontWeight: 500, margin: 0 }}>{value}</p>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 12, fontWeight: 600, color: T.txt, marginBottom: 10 }}>
            Submissions ({target.submissions?.length || 0})
          </p>
          {(!target.submissions || target.submissions.length === 0) ? (
            <p style={{ fontSize: 12, color: T.muted, marginBottom: 16 }}>No submissions yet.</p>
          ) : (
            <div style={{ maxHeight: 260, overflowY: "auto", marginBottom: 16 }}>
              {target.submissions.map(sub => (
                <div key={sub._id} style={{ background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: T.txt, margin: 0 }}>{sub.studentName}</p>
                    <p style={{ fontSize: 10, color: T.muted, margin: "2px 0 0" }}>
                      {new Date(sub.submittedAt).toLocaleDateString()} · {sub.status}
                      {sub.fileName && <> · 📎 {sub.fileName}</>}
                    </p>
                    {sub.feedback && <p style={{ fontSize: 10, color: T.sub, margin: "2px 0 0" }}>"{sub.feedback}"</p>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {sub.grade !== null && sub.grade !== undefined ? (
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#22C55E" }}>{sub.grade}/{target.maxGrade || 100}</span>
                    ) : (
                      <button onClick={() => openGrade(target, sub)} style={{ fontSize: 11, background: "rgba(59,130,246,0.1)", color: "#3B82F6", border: "1px solid rgba(59,130,246,0.3)", padding: "4px 10px", borderRadius: 6, cursor: "pointer" }}>Grade</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ textAlign: "right" }}>
            <Btn label="Close" ghost onClick={closeModal} />
          </div>
        </ModalWrap>
      )}

      {/* ── Grade Modal ── */}
      {gradeTarget && (
        <ModalWrap title={`Grade — ${gradeTarget.sub.studentName}`} onClose={() => setGradeTarget(null)}>
          <F label={`Grade (out of ${gradeTarget.a.maxGrade || 100})`} required required theme={T}>
            <input type="number" value={gradeForm.grade} onChange={e => setGradeForm(f=>({...f,grade:e.target.value}))}
              style={inp} min={0} max={gradeTarget.a.maxGrade || 100} />
          </F>
          <F label="Feedback" required theme={T}>
            <textarea value={gradeForm.feedback} onChange={e => setGradeForm(f=>({...f,feedback:e.target.value}))}
              style={{ ...inp, height: 70, resize: "vertical" }} placeholder="Optional feedback..." />
          </F>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
            <Btn label="Cancel" ghost onClick={() => setGradeTarget(null)} />
            <Btn label="Save Grade" onClick={handleGrade} />
          </div>
        </ModalWrap>
      )}

      {/* ── Students Marks Modal ── */}
      {marksModal && (
        <ModalWrap
          title={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Users size={16} style={{ color: "#22C55E" }} />
              <span>Student Marks — {marksAssign?.title}</span>
            </div>
          }
          onClose={closeMarksModal}
          wide
          extraWide
        >
          {marksLoading ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: T.muted }}>
              <p style={{ fontSize: 13 }}>Loading students...</p>
            </div>
          ) : marksData ? (
            <>
              {/* Course info bar */}
              <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                <div style={{ background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 14px", display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: T.muted }}>Course</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.txt }}>{marksData.courseName || marksData.courseId || "—"}</span>
                </div>
                <div style={{ background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 14px", display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: T.muted }}>Max Marks</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.txt }}>{marksData.maxGrade}</span>
                </div>
                <div style={{ background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 14px", display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: T.muted }}>Students</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.txt }}>{marksData.students?.length || 0}</span>
                </div>
              </div>

              {/* Students list */}
              {(!marksData.students || marksData.students.length === 0) ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: T.muted }}>
                  <Users size={32} style={{ margin: "0 auto 10px", display: "block", opacity: 0.3 }} />
                  <p style={{ fontSize: 13 }}>No students enrolled in this course</p>
                  <p style={{ fontSize: 11, marginTop: 4 }}>Enroll students in the course to enter marks</p>
                </div>
              ) : (
                <>
                  {/* Table header */}
                  <div style={{ display: "grid", gridTemplateColumns: "10px 2fr 120px 100px 3fr", gap: 50, padding: "8px 12px", background: T.inner, borderRadius: 8, marginBottom: 6, border: `1px solid ${T.border}` }}>
                    {["S.no", "Student Name", "Status", `Marks (/${marksData.maxGrade})`, "Feedback"].map((h, i) => (
                      <span key={i} style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em",textAlign:"center" }}>{h}</span>
                    ))}
                  </div>

                  <div style={{ maxHeight: 360, overflowY: "auto", marginBottom: 16 }}>
                    {marksData.students.map((s, idx) => {
                      const currentGrade = marksInput[s.id]?.grade ?? ""
                      const currentFeedback = marksInput[s.id]?.feedback ?? ""
                      const gradeNum = currentGrade !== "" ? Number(currentGrade) : null
                      const gradeColor = gradeNum === null ? T.muted
                        : gradeNum >= marksData.maxGrade * 0.75 ? "#22C55E"
                        : gradeNum >= marksData.maxGrade * 0.5 ? "#22C55E"
                        : "#22C55E"

                      const statusBadge = {
                        graded:        { label: "Graded",       color: "#22C55E", bg: "rgba(34,197,94,0.1)" },
                        submitted:     { label: "Submitted",  color: "#CA8A04", bg: "rgba(234,179,8,0.15)"  },
                        late:          { label: "Late",        color: "#F97316", bg: "rgba(249,115,22,0.1)"  },
                        not_submitted: { label: "Not Submitted", color: "#6B7280", bg: "rgba(107,114,128,0.1)" },
                      }[s.status] || { label: s.status, color: T.muted, bg: T.inner }

                      return (
                        <div key={s.id} style={{ display: "grid", gridTemplateColumns: "10px 2fr 120px 100px 3fr", gap: 50, padding: "10px 12px", background: idx % 2 === 0 ? "transparent" : "rgb(var(--c-wash) / 0.02)", borderRadius: 6, alignItems: "center", marginBottom: 2 ,textAlign:"center"}}>
                          {/* # */}
                          <span style={{ fontSize: 11, color: T.muted, fontWeight: 500 }}>{idx + 1}</span>

                          {/* Name */}
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 600, color: T.txt, margin: 0 }}>{s.name}</p>
                            <p style={{ fontSize: 10, color: T.muted, margin: "1px 0 0" }}>ID: {s.id}</p>
                          </div>

                          {/* Status */}
                          <span style={{ fontSize: 10, fontWeight: 600, color: statusBadge.color, background: statusBadge.bg, padding: "3px 8px", borderRadius: 5, textAlign: "center" }}>
                            {statusBadge.label}
                          </span>

                          {/* Marks input */}
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <input
                              type="number"
                              value={currentGrade}
                              onChange={e => handleMarkInput(s.id, "grade", e.target.value === "" ? "" : e.target.value.replace(/^0+(?=\d)/, ""))}
                              placeholder="—"
                              min={0}
                              max={marksData.maxGrade}
                              style={{
                                background: T.inner,
                                border: `1px solid ${gradeNum !== null ? gradeColor + "66" : T.border}`,
                                borderRadius: 7,
                                padding: "6px 10px",
                                color: gradeNum !== null ? gradeColor : T.txt,
                                fontSize: 13,
                                fontWeight: 600,
                                width: "100%",
                                outline: "none",
                                textAlign: "center",
                              }}
                            />
                          </div>

                          {/* Feedback */}
                          <input
                            type="text"
                            value={currentFeedback}
                            onChange={e => handleMarkInput(s.id, "feedback", e.target.value)}
                            placeholder="Optional feedback..."
                            style={{
                              background: T.inner,
                              border: `1px solid ${T.border}`,
                              borderRadius: 7,
                              padding: "6px 10px",
                              color: T.txt,
                              fontSize: 12,
                              width: "100%",
                              outline: "none",
                            }}
                          />

                          {/* Existing grade badge */}
                          {/* <div style={{ textAlign: "right" }}>
                            {s.grade !== null && s.grade !== undefined ? (
                              <span style={{ fontSize: 12, fontWeight: 700, color: "#22C55E" }}>
                                {s.grade}/{marksData.maxGrade}
                              </span>
                            ) : (
                              <span style={{ fontSize: 10, color: T.muted }}>No grade</span>
                            )}
                          </div> */}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
                <p style={{ fontSize: 11, color: T.muted, margin: 0 }}>
                  {marksData.students?.filter(s => marksInput[s.id]?.grade !== "" && marksInput[s.id]?.grade !== undefined).length || 0} of {marksData.students?.length || 0} marks entered
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn label="Cancel" ghost onClick={closeMarksModal} />
                  <Btn
                    label={marksSaving ? "Saving…" : "Save All Marks"}
                    onClick={handleSaveMarks}
                    disabled={marksSaving || !marksData?.students?.length}
                  />
                </div>
              </div>
            </>
          ) : null}
        </ModalWrap>
      )}
    </div>
  )
}

function AssignmentRow({ a, courses, onView, onEdit, onDelete, onToggle, onStudentsMarks }) {
  const [hov, setHov] = useState(false)
  const now = new Date()
  const isOverdue = a.deadline && new Date(a.deadline) < now && !a.completed
  const submitted = a.submissions?.length || a.submitted || 0
  const subPct = a.total > 0 ? Math.min(100, Math.round((submitted / a.total) * 100)) : 0
  const tc = TYPE_COLORS[a.type] || { color: T.sub, bg: "rgba(156,163,175,0.1)" }

  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: hov ? "var(--bg-2a2a2a)" : T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 18px", transition: "background 0.15s", position: "relative" }}>

      {/* Students/Marks button — top left */}
      {a.courseId && (
        <button
          onClick={e => { e.stopPropagation(); onStudentsMarks() }}
          title="View & enter student marks"
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            display: "flex",
            alignItems: "center",
            gap: 5,
            background: "rgba(6,182,212,0.1)",
            border: "1px solid rgba(6,182,212,0.1)",
            borderRadius: 7,
            padding: "4px 10px",
            fontSize: 11,
            fontWeight: 600,
            color: "#22C55E",
            cursor: "pointer",
          }}
        >
          <Users size={11} />Marks
        </button>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingLeft: a.courseId ? 80 : 0 }}>
        <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: tc.color, background: tc.bg, padding: "2px 8px", borderRadius: 5 }}>{a.type}</span>
            {a.course && <span style={{ fontSize: 10, color: T.muted, background: "rgba(156,163,175,0.08)", padding: "2px 8px", borderRadius: 5 }}>{a.course}</span>}
            {isOverdue && <span style={{ fontSize: 10, color: "#EF4444", background: "rgba(239,68,68,0.1)", padding: "2px 8px", borderRadius: 5 }}> OVERDUE</span>}
            {a.completed && <span style={{ fontSize: 10, color: "#4ddb2a", background: "rgba(107,114,128,0.1)", padding: "2px 8px", borderRadius: 5 }}> DONE</span>}
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: T.txt, margin: "0 0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</p>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {a.deadline && <span style={{ fontSize: 11, color:  T.muted }}>📅 {a.deadline}</span>}
            <span style={{ fontSize: 11, color: T.muted }}>👥 {submitted}/{a.total} submitted ({subPct}%)</span>
            {a.submissions?.filter(s => s.grade === null || s.grade === undefined).length > 0 && (
              <span style={{ fontSize: 11, color: "#EAB308" }}>⏳ {a.submissions.filter(s=>s.grade==null).length} ungraded</span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <IBtn icon={<Eye size={13}/>} onClick={onView} title="View submissions" />
          <IBtn icon={<Edit2 size={13}/>} onClick={onEdit} title="Edit" />
          <IBtn icon={a.completed ? <Clock size={13}/> : <CheckCircle size={13}/>} onClick={onToggle} title={a.completed ? "Mark active" : "Mark complete"} />
          <IBtn icon={<Trash2 size={13}/>} onClick={onDelete} title="Delete" danger />
        </div>
      </div>
      {a.total > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <span style={{ fontSize: 10, color: T.muted }}>Submission rate</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: subPct > 70 ? "#22C55E" : subPct > 40 ? "#22C55E" : "#22C55E" }}>{subPct}%</span>
          </div>
          <div style={{ background: T.inner, borderRadius: 4, height: 4, overflow: "hidden" }}>
            <div style={{ width: `${subPct}%`, height: "100%", background: subPct > 70 ? "#22C55E" : subPct > 40 ? "#22C55E" : "#22C55E", borderRadius: 4 }} />
          </div>
        </div>
      )}
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

const Eye = ({ size }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>

function ModalWrap({ title, children, onClose, wide, extraWide }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 24, width: "100%", maxWidth: extraWide ? 860 : wide ? 680 : 540, maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: T.txt, margin: 0 }}>{title}</p>
          <button onClick={onClose} style={{ background: T.inner, border: `1px solid ${T.border}`, borderRadius: 7, padding: 5, cursor: "pointer", color: T.sub, display: "flex" }}><X size={14} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
