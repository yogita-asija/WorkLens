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
import { Label, Notice, Pill, ScheduleInput, btnSolid, fmtKey, scheduleFromText, scheduleToText, scheduleReady, blankSchedule } from "../components/courseAllocation/shared"

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
  const [form, setForm] = useState({ courseCode: "", courseName: "", credits: "", total: 1, from: 1, to: 1, ...suggestTerm() })
  const [schedule, setSchedule] = useState(blankSchedule())   // ONE schedule: the selected batches meet together
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

  // The HOD types any course; if the code/name belongs to an existing course it is only used to pre-fill the fields.
  const course = useMemo(() => {
    const code = form.courseCode.trim().toLowerCase()
    return (courses || []).find((c) => code && c.courseCode.toLowerCase() === code) || null
  }, [courses, form.courseCode])

  const total = Number(form.total), from = Number(form.from), to = Number(form.to)
  const rangeOk = total === 1 || (Number.isInteger(from) && Number.isInteger(to) && from >= 1 && to >= from && to <= total)
  const nParts = total > 1 && rangeOk ? to - from + 1 : 1

  const reset = () => { setResult(null); setCompare([]) }
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); reset() }

  const fill = (c) => {            // pre-fill from an existing course (everything stays editable)
    const total = Math.max(1, c.batches.length)   // eslint-disable-line no-shadow
    const firstFree = c.batches.findIndex((b) => !b.teacher)
    const from = total > 1 ? (firstFree >= 0 ? firstFree + 1 : 1) : 1
    setForm((f) => ({ ...f, courseCode: c.courseCode, courseName: c.courseName, credits: c.credits || "", total, from, to: total }))
    const base = scheduleFromText(c.schedule)
    setSchedule(base)
    reset()
  }
  const onCode = (e) => {
    const v = e.target.value
    const hit = (courses || []).find((c) => c.courseCode.toLowerCase() === v.trim().toLowerCase())
    if (hit && hit._id !== course?._id) return fill(hit)
    set("courseCode")(e)
  }
  const onName = (e) => {
    const v = e.target.value
    const hit = (courses || []).find((c) => c.courseName.toLowerCase() === v.trim().toLowerCase())
    if (hit && hit._id !== course?._id) return fill(hit)
    set("courseName")(e)
  }
  const setBatches = (k) => (e) => {          // typed freely; validated before Find
    const v = e.target.value === "" ? "" : Number(e.target.value)
    setForm((f) => {
      const n = { ...f, [k]: v }
      if (k === "total") {                        // changing the total never throws away a range that still fits (e.g. 5–6 of 6)
        const t = v === "" ? 1 : v
        const f0 = Number(f.from), t0 = Number(f.to)
        if (!(Number.isInteger(f0) && Number.isInteger(t0) && f0 >= 1 && t0 >= f0 && t0 <= t)) { n.from = 1; n.to = t }
      }
      return n
    })
    reset()
  }
  const setSched = (v) => { setSchedule(v); reset() }

  const batchLabel = (i) => {
    const b = course?.batches?.[i - 1]
    return `Batch ${i}${b?.teacher ? ` · now: ${b.teacher.name}` : ""}`
  }

  const buildPayload = () => ({
    course: { courseId: course?._id, courseCode: form.courseCode.trim(), courseName: form.courseName.trim(), credits: Number(form.credits) },
    batches: { total: Number(form.total), from: Number(form.from), to: Number(form.to), schedule: scheduleToText(schedule) },
    term: form.term.trim(), startDate: form.startDate, endDate: form.endDate,
  })

  const find = async (e, keepSelection) => {
    e?.preventDefault()
    setBusy(true)
    try {
      const payload = buildPayload()
      setResult(await api.recommend(payload)); setResultForm(payload)
      if (!keepSelection) setCompare([])
    } catch (err) { showToast(err.message, "error") } finally { setBusy(false) }
  }

  const confirm = async (extra) => {
    setSaving(true); setServerError("")
    try {
      await api.assign({ ...resultForm, facultyId: selected.facultyId, ...extra })
      showToast(`${selected.name} assigned to ${result.target.label} for ${resultForm.term}`)
      // keep the course typed in: the HOD continues with the next batches (a fresh selection + schedule)
      if (total > 1 && to < total) { setForm((f) => ({ ...f, from: to + 1, to: total })); setSchedule(blankSchedule()) }
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
  const canFind = form.courseCode.trim() && form.courseName.trim() && Number(form.credits) > 0 && form.term.trim() && form.startDate && form.endDate
    && rangeOk && Number.isInteger(total) && total >= 1 && scheduleReady(schedule)

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
                <div className="md:col-span-2">
                  <Label>Course code</Label>
                  <input className={inputCls} list="ca-codes" placeholder="e.g. CS401" value={form.courseCode} onChange={onCode} maxLength={30} required />
                </div>
                <div className="md:col-span-3">
                  <Label>Course name</Label>
                  <input className={inputCls} list="ca-names" placeholder="e.g. Advanced Algorithms" value={form.courseName} onChange={onName} maxLength={120} required />
                </div>
                <div className="md:col-span-1">
                  <Label>Credits</Label>
                  <input type="number" className={inputCls} min="0.5" max="20" step="0.5" value={form.credits} onChange={set("credits")} required />
                </div>
                <datalist id="ca-codes">{courses.map((c) => <option key={c._id} value={c.courseCode}>{c.courseName}</option>)}</datalist>
                <datalist id="ca-names">{courses.map((c) => <option key={c._id} value={c.courseName}>{c.courseCode}</option>)}</datalist>

                <div className="md:col-span-6 -mt-2 flex flex-wrap items-center gap-x-4 text-[11px] text-neutral-500">
                  {form.courseCode.trim() && (course
                    ? <>Existing course{course.teacher ? <> · now taught by <b className="text-neutral-300">{course.teacher.name}</b></> : ""}{course.allocation && <Pill color="#22c55e">Allocated for {course.allocation.term}</Pill>}</>
                    : <>New course — it is created when you confirm an assignment</>)}
                  {course && (
                    <button type="button" className="text-green-400 hover:text-green-300 font-medium" onClick={() => setModal("requirement")}>
                      Course requirements{course.hasRequirement ? " ✓" : ""}
                    </button>
                  )}
                </div>

                <div className="md:col-span-3">
                  <Label>Semester / term</Label>
                  <input className={inputCls} value={form.term} onChange={set("term")} maxLength={80} required />
                </div>
                <div className="md:col-span-1"><Label>Starts</Label><input type="date" className={inputCls} value={form.startDate} onChange={set("startDate")} required /></div>
                <div className="md:col-span-2"><Label>Ends</Label><input type="date" className={inputCls} value={form.endDate} min={form.startDate} onChange={set("endDate")} required /></div>

                {/* batches — the selected range meets together; pick the next range afterwards */}
                <div className="md:col-span-2">
                  <Label hint="1 = no batches">Total batches of the course</Label>
                  <input type="number" className={inputCls} min="1" max="30" value={form.total} onChange={setBatches("total")} />
                </div>
                {total > 1 && (
                  <>
                    <div className="md:col-span-2">
                      <Label>Batches from</Label>
                      <input type="number" className={inputCls} min="1" max={total} value={form.from} onChange={setBatches("from")} placeholder="1" />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Up to</Label>
                      <input type="number" className={inputCls} min={form.from || 1} max={total} value={form.to} onChange={setBatches("to")} placeholder={String(total)} />
                    </div>
                    {!rangeOk && <div className="md:col-span-6 -mt-2 text-[11px] text-red-400">Enter whole batch numbers between 1 and {total} (“up to” not smaller than “from”). To use a later batch such as Batch {Number(form.to) || total + 1}, raise “Total batches of the course” to at least that number first.</div>}
                  </>
                )}

                <div className="md:col-span-6 space-y-3 bg-[#141414] border border-[#2a2a2a] rounded-xl px-4 py-3">
                  <p className="text-xs text-neutral-400">
                    {total > 1 && rangeOk
                      ? <><b className="text-white">{nParts === 1 ? `Batch ${from}` : `Batches ${from}–${to}`}</b> will have class together, taught by one teacher. Set their weekly schedule. For the remaining batches, run Find faculty again with a new selection.</>
                      : <>Weekly schedule of the course.</>}
                  </p>
                  <ScheduleInput value={schedule} onChange={setSched} />
                  {total > 1 && course && course.batches.slice(from - 1, to).some((b) => b.teacher) && (
                    <p className="text-[11px] text-amber-300/90">{course.batches.slice(from - 1, to).filter((b) => b.teacher).map((b) => `${b.batchName}: ${b.teacher.name}`).join(" · ")} currently assigned.</p>
                  )}
                </div>

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
                  <h2 className="text-base font-semibold">Recommended faculty for {result.target.label} — {result.course.courseName}</h2>
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
              {result.target.currentTeachers.length > 0 && (
                <Notice tone="warn">Currently taught by <b>{result.target.currentTeachers.map((t) => t.name).join(", ")}</b>. Assigning someone else replaces them (you will be asked to confirm).</Notice>
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
