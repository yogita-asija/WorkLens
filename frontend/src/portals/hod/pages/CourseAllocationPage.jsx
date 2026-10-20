import { useCallback, useEffect, useMemo, useState } from "react"
import { GraduationCap, Settings2, UserCog, Sparkles, Scale, ClipboardCheck } from "lucide-react"
import useAppStore from "../../../store/useAppStore"
import * as api from "../services/courseAllocationApi"
import { Spinner, ErrorState, btnGhost, inputCls } from "../components/HodModal"
import CandidateCard from "../components/courseAllocation/CandidateCard"
import CompareModal from "../components/courseAllocation/CompareModal"
import ReviewModal from "../components/courseAllocation/ReviewModal"
import SettingsModal from "../components/courseAllocation/SettingsModal"
import ProfilesModal from "../components/courseAllocation/ProfilesModal"
import RequirementModal from "../components/courseAllocation/RequirementModal"
import HistoryPanel from "../components/courseAllocation/HistoryPanel"
import { Label, Notice, Pill, btnSolid, fmtKey } from "../components/courseAllocation/shared"

// Suggested semester window from today's date — the HOD can change every field.
function suggestTerm() {
  const d = new Date(); const y = d.getFullYear()
  if (d.getMonth() >= 6) return { term: `${y}-${String(y + 1).slice(2)} Odd Semester`, startDate: `${y}-07-01`, endDate: `${y}-12-31` }
  return { term: `${y - 1}-${String(y).slice(2)} Even Semester`, startDate: `${y}-01-01`, endDate: `${y}-06-30` }
}

export default function CourseAllocationPage() {
  const { showToast } = useAppStore()
  const [tab, setTab] = useState("allocate")
  const [courses, setCourses] = useState(null)
  const [error, setError] = useState("")
  const [form, setForm] = useState({ courseId: "", batchId: "", ...suggestTerm() })
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)        // recommendation response
  const [resultForm, setResultForm] = useState(null) // the inputs that produced it
  const [compare, setCompare] = useState([])        // facultyIds
  const [showCompare, setShowCompare] = useState(false)
  const [selected, setSelected] = useState(null)    // candidate under review
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState("")
  const [modal, setModal] = useState("")            // "settings" | "profiles" | "requirement"
  const [histKey, setHistKey] = useState(0)

  const loadCourses = useCallback(async () => {
    try { setError(""); setCourses(await api.getCourses()) } catch (e) { setError(e.message) }
  }, [])
  useEffect(() => { loadCourses() }, [loadCourses])

  const course = useMemo(() => (courses || []).find((c) => c._id === form.courseId), [courses, form.courseId])

  const set = (k) => (e) => {
    const v = e.target.value
    setForm((f) => ({ ...f, [k]: v, ...(k === "courseId" ? { batchId: "" } : {}) }))
    setResult(null); setCompare([])
  }

  const find = async (e, keepSelection) => {
    e?.preventDefault()
    setBusy(true)
    try {
      const payload = { courseId: form.courseId, batchId: form.batchId || undefined, term: form.term.trim(), startDate: form.startDate, endDate: form.endDate }
      setResult(await api.recommend(payload)); setResultForm({ ...payload, term: payload.term })
      if (!keepSelection) setCompare([])
    } catch (err) { showToast(err.message, "error") } finally { setBusy(false) }
  }

  const confirm = async (extra) => {
    setSaving(true); setServerError("")
    try {
      await api.assign({ ...resultForm, facultyId: selected.facultyId, ...extra })
      showToast(`${selected.name} assigned to ${result.course.courseCode} for ${resultForm.term}`)
      setSelected(null); setShowCompare(false); setResult(null); setCompare([])
      setHistKey((k) => k + 1); loadCourses()
    } catch (err) {
      setServerError(err.message)
      if (["STALE", "INELIGIBLE", "DUPLICATE"].includes(err.code)) { await find(null, true); }
    } finally { setSaving(false) }
  }

  const cands = result?.candidates || []
  const ranked = cands.filter((c) => c.eligibility.status !== "ineligible")
  const blocked = cands.filter((c) => c.eligibility.status === "ineligible")
  const toggleCompare = (id) => setCompare((l) => (l.includes(id) ? l.filter((x) => x !== id) : l.length < 3 ? [...l, id] : l))
  const compared = cands.filter((c) => compare.includes(c.facultyId))
  const w = result?.settings.weights
  const canFind = form.courseId && form.term.trim() && form.startDate && form.endDate

  const startSelect = (c) => { setServerError(""); setSelected(c) }

  return (
    <div className="space-y-6 text-white font-sans">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Course Allocation</h1>
          <p className="text-sm text-neutral-400 mt-1">Pick a course and WorkLens ranks your faculty from their history, qualifications, workload and timetable.</p>
        </div>
        <div className="flex gap-2">
          <button className={`${btnGhost} inline-flex items-center gap-1.5`} onClick={() => setModal("profiles")}><UserCog size={14} /> Faculty profiles</button>
          <button className={`${btnGhost} inline-flex items-center gap-1.5`} onClick={() => setModal("settings")}><Settings2 size={14} /> Weights & limits</button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-[#2a2a2a]">
        {[["allocate", "Allocate", GraduationCap], ["history", "History", ClipboardCheck]].map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)} className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 -mb-px transition ${tab === k ? "border-green-500 text-white font-semibold" : "border-transparent text-neutral-400 hover:text-white"}`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === "history" ? <HistoryPanel refreshKey={histKey} onChanged={loadCourses} /> : (
        <>
          {/* ── Step 1: course + semester ── */}
          <form onSubmit={find} className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl p-6 grid grid-cols-1 md:grid-cols-6 gap-4">
            {error ? <div className="md:col-span-6"><ErrorState message={error} onRetry={loadCourses} /></div> : !courses ? <div className="md:col-span-6"><Spinner /></div> : (
              <>
                <div className="md:col-span-4">
                  <Label>Course</Label>
                  <select className={inputCls} value={form.courseId} onChange={set("courseId")} required>
                    <option value="">Select a course…</option>
                    {courses.map((c) => <option key={c._id} value={c._id}>{c.courseCode} — {c.courseName} ({c.sem}){c.teacher ? ` · now: ${c.teacher.name}` : " · unassigned"}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <Label>Section</Label>
                  <select className={inputCls} value={form.batchId} onChange={set("batchId")} disabled={!course || course.batches.length === 0}>
                    <option value="">Whole course</option>
                    {(course?.batches || []).map((b) => <option key={b._id} value={b._id}>{b.batchName}{b.teacher ? ` · now: ${b.teacher.name}` : ""}</option>)}
                  </select>
                </div>
                <div className="md:col-span-3">
                  <Label>Semester / term</Label>
                  <input className={inputCls} value={form.term} onChange={set("term")} maxLength={80} required />
                </div>
                <div className="md:col-span-1"><Label>Starts</Label><input type="date" className={inputCls} value={form.startDate} onChange={set("startDate")} required /></div>
                <div className="md:col-span-2"><Label>Ends</Label><input type="date" className={inputCls} value={form.endDate} min={form.startDate} onChange={set("endDate")} required /></div>

                {course && (
                  <div className="md:col-span-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-neutral-400 bg-[#141414] border border-[#2a2a2a] rounded-xl px-4 py-3">
                    <span>Credits: <b className="text-white">{course.credits}</b></span>
                    <span>Schedule: <b className="text-white">{[course.schedule.days, course.schedule.time].filter(Boolean).join(" · ") || "not set"}</b></span>
                    <span>Current teacher: <b className="text-white">{course.teacher?.name || "none"}</b></span>
                    {course.allocation && <Pill color="#22c55e">Allocated for {course.allocation.term}</Pill>}
                    {course.departmentState === "unclaimed" && <Pill color="#f59e0b">Department not set yet</Pill>}
                    <button type="button" className="ml-auto text-green-400 hover:text-green-300 font-medium" onClick={() => setModal("requirement")}>
                      Course requirements{course.hasRequirement ? " ✓" : ""}
                    </button>
                  </div>
                )}

                <div className="md:col-span-6">
                  <button className={`${btnSolid} inline-flex items-center gap-2`} disabled={busy || !canFind}>
                    <Sparkles size={15} /> {busy ? "Analysing faculty history…" : "Find Best Faculty"}
                  </button>
                </div>
              </>
            )}
          </form>

          {/* ── Step 2: ranked recommendations ── */}
          {result && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">Recommended faculty for {result.course.courseCode} — {result.course.courseName}{result.target.batchName ? ` · ${result.target.batchName}` : ""}</h2>
                  <p className="text-xs text-neutral-500 mt-1">
                    {result.term.term} · {fmtKey(result.term.startDate)} – {fmtKey(result.term.endDate)} · {result.totals.eligible} of {result.totals.faculty} faculty can be assigned
                  </p>
                </div>
                <p className="text-[11px] text-neutral-500 max-w-xl text-right">
                  Weights: {Object.entries(w).map(([k, v]) => `${v}% ${({ expertise: "expertise", previousTeaching: "previous teaching", relevantExperience: "experience", workload: "workload", timetable: "timetable", continuity: "continuity" })[k]}`).join(" · ")}
                </p>
              </div>

              {result.activeAllocation && (
                <Notice tone="bad">This course is already allocated to <b>{result.activeAllocation.facultyName}</b> for “{result.activeAllocation.term}”. Cancel that allocation in History before assigning someone else for the same term.</Notice>
              )}
              {result.notices.map((n) => <Notice key={n} tone="info">{n}</Notice>)}

              {result.target.currentTeacher && (
                <Notice tone="warn">Currently taught by <b>{result.target.currentTeacher.name}</b>. Assigning someone else replaces them (you will be asked to confirm).</Notice>
              )}

              {ranked.length === 0 && <Notice tone="bad">Nobody in your department can be assigned this course for this semester. See the reasons below.</Notice>}

              <div className="space-y-3">
                {ranked.map((c) => (
                  <CandidateCard key={c.facultyId} c={c} comparing={compare.includes(c.facultyId)} compareFull={compare.length >= 3}
                    onToggleCompare={() => toggleCompare(c.facultyId)} onSelect={() => startSelect(c)} />
                ))}
              </div>

              {blocked.length > 0 && (
                <details className="group">
                  <summary className="cursor-pointer text-sm text-neutral-400 hover:text-white py-2">Not eligible ({blocked.length}) — why they were excluded</summary>
                  <div className="space-y-3 mt-3">
                    {blocked.map((c) => (
                      <CandidateCard key={c.facultyId} c={c} comparing={compare.includes(c.facultyId)} compareFull={compare.length >= 3}
                        onToggleCompare={() => toggleCompare(c.facultyId)} onSelect={() => {}} />
                    ))}
                  </div>
                </details>
              )}

              {compare.length >= 2 && (
                <div className="sticky bottom-4 flex justify-center">
                  <button className={`${btnSolid} inline-flex items-center gap-2 shadow-card`} onClick={() => setShowCompare(true)}>
                    <Scale size={15} /> Compare {compare.length} candidates
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {showCompare && compared.length >= 2 && !selected && (
        <CompareModal candidates={compared} onClose={() => setShowCompare(false)} onRemove={toggleCompare} onSelect={startSelect} />
      )}
      {selected && result && (
        <ReviewModal candidate={selected} result={result} form={resultForm} saving={saving} serverError={serverError}
          onClose={() => { setSelected(null); setServerError("") }} onConfirm={confirm} />
      )}
      {modal === "settings" && <SettingsModal onClose={() => setModal("")} onSaved={() => setResult(null)} />}
      {modal === "profiles" && <ProfilesModal onClose={() => setModal("")} />}
      {modal === "requirement" && course && <RequirementModal course={course} onClose={() => setModal("")} onSaved={() => { loadCourses(); setResult(null) }} />}
    </div>
  )
}
