import { useCallback, useEffect, useState } from "react"
import { Trash2, X, TriangleAlert, UserPlus } from "lucide-react"
import useAppStore from "../../store/useAppStore"
import * as api from "../../services/HOD/dutyAllocationApi"
import HodModal, { Spinner, EmptyState, ErrorState, btnPrimary, btnGhost, btnDanger, inputCls } from "../../components/HOD/HodModal"

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
const fmtKey = (k) =>
  new Date(`${k}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })

const AVAIL = {
  High:        { color: "#22c55e" },
  Medium:      { color: "#f59e0b" },
  Low:         { color: "#ef4444" },
  Unavailable: { color: "#6b7280" },
}
const barColor = (p) => (p > 85 ? "#ef4444" : p >= 70 ? "#f59e0b" : "#22c55e")

const btnDangerSolid = "bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg px-4 py-2 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
const btnNeedsMore   = "inline-flex items-center gap-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 text-xs font-semibold rounded-lg px-3 py-1.5 transition cursor-pointer"

const empty = { title: "", date: "", durationHours: "", requiredCount: "", description: "" }

function Label({ children, className = "" }) {
  return <label className={`block text-xs font-medium text-neutral-400 mb-1.5 ${className}`}>{children}</label>
}

function CandidateCard({ c, checked, disabled, onToggle }) {
  const meta = AVAIL[c.availability]
  const blocked = c.availability === "Unavailable"
  return (
    <label
      className={`flex gap-3 items-start p-4 rounded-xl border transition cursor-pointer
        ${checked ? "border-green-500 bg-green-500/5" : "border-[#2a2a2a] bg-[#141414] hover:border-[#3a3a3a]"}
        ${blocked ? "opacity-60 cursor-not-allowed" : ""}`}
    >
      <input type="checkbox" className="mt-1 accent-green-500" checked={checked} disabled={blocked || (disabled && !checked)} onChange={onToggle} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-white truncate">{c.name}</p>
          <span className="text-[11px] px-2.5 py-1 rounded-full font-medium flex-shrink-0" style={{ background: meta.color + "22", color: meta.color }}>
            {c.availability}
          </span>
        </div>

        <div className="h-1.5 rounded-full bg-[#2a2a2a] mt-3 overflow-hidden" title={`After this duty: ${c.projectedWorkload}%`}>
          <div className="h-full rounded-full" style={{ width: `${Math.min(c.currentWorkload, 100)}%`, background: barColor(c.currentWorkload) }} />
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2.5 text-xs text-neutral-300">
          <span>Current workload: <b className="text-white">{c.currentWorkload}%</b></span>
          <span>After this duty: <b className="text-white">{c.projectedWorkload}%</b></span>
          <span>Previous similar duties: <b className="text-white">{c.similarDuties}</b></span>
        </div>

        <p className="text-[11px] text-neutral-500 mt-1.5">
          {c.teachingHours}h teaching{c.teachingEstimated ? " (partly estimated from credits)" : ""}
          {c.substitutionHours > 0 && ` + ${c.substitutionHours}h substitutions`}
          {` + ${c.dutyHoursThisWeek}h duties this week, of ${c.capacityHours}h`}
          {c.classHoursThatDay > 0 && ` · ${c.classHoursThatDay}h of classes on that day`}
          {c.recentDutyHours90d > 0 && ` · ${c.recentDutyHours90d}h of duties in the last 90 days`}
        </p>

        {c.warning && (
          <p className="flex items-start gap-1.5 text-[11px] mt-2 text-amber-400">
            <TriangleAlert size={12} className="mt-0.5 flex-shrink-0" /> {c.warning}
          </p>
        )}
      </div>
    </label>
  )
}

/* ───────────── Warning pop-up used for "delete duty" and "remove faculty" ───────────── */
function ConfirmDialog({ confirm, onClose }) {
  const [working, setWorking] = useState(false)
  if (!confirm) return null

  const run = async () => {
    setWorking(true)
    try { await confirm.onConfirm() } finally { setWorking(false); onClose() }
  }

  return (
    <HodModal open onClose={working ? undefined : onClose} title={confirm.title} width={460}>
      <div className="flex gap-3 items-start">
        <div className="w-9 h-9 rounded-full bg-red-500/15 text-red-400 flex items-center justify-center flex-shrink-0">
          <TriangleAlert size={18} />
        </div>
        <div className="text-sm text-neutral-300 leading-relaxed space-y-2">
          {confirm.lines.map((l, i) => <p key={i}>{l}</p>)}
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button className={btnGhost} onClick={onClose} disabled={working}>Cancel</button>
        <button className={btnDangerSolid} onClick={run} disabled={working}>
          {working ? "Please wait…" : confirm.confirmLabel}
        </button>
      </div>
    </HodModal>
  )
}

/* ───────────── shared list: ranked candidates + selection + assign button ───────────── */
function CandidatePicker({ warnings, candidates, needed, selected, setSelected, saving, onAssign, emptyText }) {
  const toggle = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < needed ? [...s, id] : s))

  return (
    <>
      {warnings.map((w) => (
        <div key={w} className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 mb-3">
          <TriangleAlert size={14} className="flex-shrink-0 mt-0.5" /> {w}
        </div>
      ))}
      {candidates.length === 0 ? (
        <EmptyState text={emptyText} />
      ) : (
        <div className="space-y-2.5">
          {candidates.map((c) => (
            <CandidateCard
              key={c.facultyId} c={c}
              checked={selected.includes(c.facultyId)}
              disabled={selected.length >= needed}
              onToggle={() => toggle(c.facultyId)}
            />
          ))}
        </div>
      )}
      <div className="flex items-center justify-between mt-5 pt-4 border-t border-[#2a2a2a]">
        <span className="text-xs text-neutral-400">{selected.length} of {needed} selected</span>
        <button className={`${btnPrimary} !px-5 !py-2 !text-sm`} disabled={!selected.length || saving} onClick={onAssign}>
          {saving ? "Assigning…" : "Assign selected"}
        </button>
      </div>
    </>
  )
}

/* ───────────── "Find candidates" pop-up for a brand-new duty ───────────── */
function NewDutyModal({ result, form, selected, setSelected, saving, onAssign, onClose }) {
  return (
    <HodModal open onClose={onClose} width={720} title="Potential candidates"
      subtitle={`${form.title.trim()} · ${fmtKey(form.date)} · ${form.durationHours}h · ${result.requiredCount} required`}>
      <CandidatePicker
        warnings={result.warnings}
        candidates={result.candidates}
        needed={result.requiredCount}
        selected={selected}
        setSelected={setSelected}
        saving={saving}
        onAssign={onAssign}
        emptyText="No teaching faculty found in your department"
      />
    </HodModal>
  )
}

/* ───────────── "Needs N more" → find matching faculty for an existing duty ───────────── */
function FindFacultyModal({ duty, onClose, onAssigned }) {
  const { showToast } = useAppStore()
  const [state, setState]       = useState({ loading: true, error: "", data: null })
  const [selected, setSelected] = useState([])
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    let alive = true
    api.previewCandidates({ dutyId: duty.id })
      .then((data) => alive && setState({ loading: false, error: "", data }))
      .catch((e) => alive && setState({ loading: false, error: e.message, data: null }))
    return () => { alive = false }
  }, [duty.id])

  const needed = state.data?.needed ?? 0

  const assign = async () => {
    setSaving(true)
    try {
      await api.setAssignees(duty.id, [...duty.assignees.map((a) => a.facultyId), ...selected])
      showToast(`${selected.length} faculty assigned to "${duty.title}"`)
      onAssigned()
      onClose()
    } catch (e) {
      showToast(e.message, "error")
      setSaving(false)
    }
  }

  return (
    <HodModal open onClose={onClose} width={720} title={`Find faculty for "${duty.title}"`}
      subtitle={`${fmtKey(duty.dateKey)} · ${duty.durationHours}h · needs ${duty.missing} more`}>
      {state.loading ? <Spinner /> : state.error ? <ErrorState message={state.error} /> : (
        <CandidatePicker
          warnings={state.data.warnings}
          candidates={state.data.candidates}
          needed={needed}
          selected={selected}
          setSelected={setSelected}
          saving={saving}
          onAssign={assign}
          emptyText="No other faculty available in your department"
        />
      )}
    </HodModal>
  )
}

export default function DutyAllocationPage() {
  const { showToast } = useAppStore()
  const [form, setForm]         = useState(empty)
  const [result, setResult]     = useState(null)       // { candidates, warnings, requiredCount }
  const [selected, setSelected] = useState([])
  const [busy, setBusy]         = useState("")
  const [duties, setDuties]     = useState(null)
  const [error, setError]       = useState("")
  const [confirm, setConfirm]   = useState(null)       // warning pop-up
  const [finder, setFinder]     = useState(null)       // duty whose open slots are being filled

  const loadDuties = useCallback(async () => {
    try { setError(""); setDuties(await api.getDuties()) }
    catch (e) { setError(e.message) }
  }, [])
  useEffect(() => { loadDuties() }, [loadDuties])

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setResult(null)          // inputs changed → previous ranking is stale
    setSelected([])
  }

  const payload = () => ({
    title: form.title.trim(),
    date: form.date,
    durationHours: Number(form.durationHours),
    requiredCount: Number(form.requiredCount),
    description: form.description.trim(),
  })

  const find = async (e) => {
    e.preventDefault()
    setBusy("find")
    try {
      setResult(await api.previewCandidates(payload()))
      setSelected([])
    } catch (err) { showToast(err.message, "error") }
    finally { setBusy("") }
  }

  const assign = async () => {
    setBusy("assign")
    try {
      await api.createDuty({ ...payload(), facultyIds: selected })
      showToast(`"${form.title.trim()}" assigned to ${selected.length} faculty`)
      setForm(empty); setResult(null); setSelected([])
      loadDuties()
    } catch (err) { showToast(err.message, "error") }
    finally { setBusy("") }
  }

  /* cross (×) on a faculty chip → warning pop-up first */
  const askRemoveAssignee = (duty, a) => {
    const stillNeeded = duty.missing + 1
    setConfirm({
      title: "Remove faculty from duty?",
      confirmLabel: "Remove",
      lines: [
        `Remove ${a.name} from "${duty.title}" on ${fmtKey(duty.dateKey)}?`,
        `${a.name} will be notified. The duty will then need ${stillNeeded} more faculty.`,
      ],
      onConfirm: async () => {
        try {
          await api.setAssignees(duty.id, duty.assignees.map((x) => x.facultyId).filter((id) => id !== a.facultyId))
          showToast(`${a.name} removed from "${duty.title}"`)
          loadDuties()
        } catch (err) { showToast(err.message, "error") }
      },
    })
  }

  /* trash button on a duty → warning pop-up first */
  const askDeleteDuty = (duty) => {
    const n = duty.assignees.length
    setConfirm({
      title: "Delete this duty?",
      confirmLabel: "Delete duty",
      lines: [
        `"${duty.title}" on ${fmtKey(duty.dateKey)} will be deleted permanently.`,
        n
          ? `${n} assigned faculty (${duty.assignees.map((a) => a.name).join(", ")}) will be notified that it was cancelled.`
          : "Nobody is assigned to it yet.",
        "This cannot be undone.",
      ],
      onConfirm: async () => {
        try { await api.deleteDuty(duty.id); showToast("Duty deleted"); loadDuties() }
        catch (err) { showToast(err.message, "error") }
      },
    })
  }

  return (
    <div className="space-y-6 text-white font-sans max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Smart Duty Allocation</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Enter a duty and rank your faculty by workload, so no one gets overloaded.
        </p>
      </div>

      {/* ── New duty ── */}
      <form onSubmit={find} className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-3">
          <Label>Duty</Label>
          <input className={inputCls} placeholder="e.g. Orientation 2026" value={form.title} onChange={set("title")} required />
        </div>
        <div>
          <Label>Date</Label>
          <input type="date" className={inputCls} min={today()} value={form.date} onChange={set("date")} required />
        </div>
        <div>
          <Label>Duration (hours)</Label>
          <input type="number" className={inputCls} min="0.5" max="24" step="0.5" value={form.durationHours} onChange={set("durationHours")} required />
        </div>
        <div>
          <Label>Faculty required</Label>
          <input type="number" className={inputCls} min="1" max="50" step="1" value={form.requiredCount} onChange={set("requiredCount")} required />
        </div>
        <div className="md:col-span-3">
          <Label>Notes (optional)</Label>
          <textarea rows={2} className={inputCls} value={form.description} onChange={set("description")} />
        </div>
        <div className="md:col-span-3">
          <button className={`${btnPrimary} !px-5 !py-2 !text-sm`} disabled={busy === "find"}>
            {busy === "find" ? "Calculating…" : "Find candidates"}
          </button>
        </div>
      </form>

      {/* ── Candidates pop-up (opens when "Find candidates" is clicked) ── */}
      {result && (
        <NewDutyModal
          result={result} form={form}
          selected={selected} setSelected={setSelected}
          saving={busy === "assign"} onAssign={assign}
          onClose={() => { setResult(null); setSelected([]) }}
        />
      )}

      {/* ── Existing duties ── */}
      <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl p-6">
        <h2 className="text-base font-semibold mb-4">Department duties</h2>
        {error ? <ErrorState message={error} onRetry={loadDuties} /> : !duties ? <Spinner /> : duties.length === 0 ? (
          <p className="text-sm text-neutral-500">No duties created yet.</p>
        ) : (
          <div className="divide-y divide-[#2a2a2a]">
            {duties.map((d) => (
              <div key={d.id} className={`py-4 first:pt-0 last:pb-0 ${d.upcoming ? "" : "opacity-60"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{d.title}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">{fmtKey(d.dateKey)} · {d.durationHours}h · {d.requiredCount} required</p>
                    {d.description && <p className="text-xs text-neutral-400 mt-1">{d.description}</p>}
                  </div>
                  <button className={`${btnDanger} flex-shrink-0`} onClick={() => askDeleteDuty(d)} title="Delete duty">
                    <Trash2 size={13} />
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  {d.assignees.length === 0 && <span className="text-xs text-neutral-500">Nobody assigned</span>}
                  {d.assignees.map((a) => (
                    <span key={a.facultyId} className="inline-flex items-center gap-1.5 text-xs bg-[#2a2a2a] text-neutral-200 rounded-full pl-3 pr-1.5 py-1">
                      {a.name}
                      <button onClick={() => askRemoveAssignee(d, a)} className="p-0.5 rounded-full hover:bg-red-500/20 hover:text-red-400" title="Remove">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>

                {/* bottom-left: open slots are a working button, filled duties show a badge */}
                <div className="flex justify-start mt-3">
                  {d.missing > 0 && d.upcoming ? (
                    <button className={btnNeedsMore} onClick={() => setFinder(d)}>
                      <UserPlus size={13} /> Needs {d.missing} more · Find faculty
                    </button>
                  ) : d.missing > 0 ? (
                    <span className="text-[11px] px-2.5 py-1 rounded-full font-medium bg-neutral-500/20 text-neutral-400">
                      Needs {d.missing} more (date passed)
                    </span>
                  ) : (
                    <span className="text-[11px] px-2.5 py-1 rounded-full font-medium bg-green-500/15 text-green-400">Filled</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} />
      {finder && <FindFacultyModal duty={finder} onClose={() => setFinder(null)} onAssigned={loadDuties} />}
    </div>
  )
}
