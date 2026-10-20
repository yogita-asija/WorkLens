import { useCallback, useEffect, useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import HodModal, { Spinner, ErrorState, btnDanger, btnGhost, inputCls } from "../HodModal"
import { ComponentBar, CheckIcon, Pill, fmtDateTime, fmtKey, scoreColor } from "./shared"
import * as api from "../../services/courseAllocationApi"
import useAppStore from "../../../../store/useAppStore"

const STATUS = { active: "#22c55e", superseded: "#9ca3af", cancelled: "#ef4444" }

function Row({ a, onCancel }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{a.courseCode} — {a.courseName}{a.batchName ? ` · ${a.batchName}` : ""}</p>
          <p className="text-xs text-neutral-400 mt-0.5">
            <b className="text-neutral-200">{a.facultyName}</b> · {a.term} ({fmtKey(a.startDate)} – {fmtKey(a.endDate)})
          </p>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            Assigned by {a.assignedByName || "HOD"} on {fmtDateTime(a.createdAt)}
            {a.previousTeacher && ` · replaced ${a.previousTeacher.name}`}
          </p>
          {a.status === "cancelled" && <p className="text-[11px] text-red-400 mt-0.5">Cancelled {fmtDateTime(a.cancelledAt)}{a.cancelReason ? ` — ${a.cancelReason}` : ""}</p>}
        </div>
        <div className="flex items-center gap-2">
          {a.score !== null && <Pill color={scoreColor(a.score)}>Score {a.score} · rank #{a.rank ?? "–"} of {a.candidatesConsidered}</Pill>}
          <Pill color={STATUS[a.status]}>{a.status}</Pill>
          {a.status === "active" && <button className={btnDanger} onClick={() => onCancel(a)}>Cancel</button>}
        </div>
      </div>
      {a.note && <p className="text-xs text-neutral-400 mt-2">“{a.note}”</p>}
      <button onClick={() => setOpen((o) => !o)} className="mt-2 inline-flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white">
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Why this person was chosen (as recorded at the time)
      </button>
      {open && (
        <div className="mt-3 grid md:grid-cols-2 gap-6">
          <div className="space-y-3">{(a.components || []).map((c) => <ComponentBar key={c.key} c={c} compact />)}</div>
          <ul className="space-y-1.5">
            {(a.eligibility?.checks || []).map((k) => (
              <li key={k.key} className="flex items-start gap-2 text-[11px] text-neutral-300"><CheckIcon status={k.status} size={12} /> <span><b className="text-white">{k.label}</b> — {k.detail}</span></li>
            ))}
            {a.acknowledgedWarnings && <li className="text-[11px] text-amber-400">Warnings were acknowledged by the HOD at confirmation.</li>}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function HistoryPanel({ refreshKey, onChanged }) {
  const { showToast } = useAppStore()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState("")
  const [status, setStatus] = useState("")
  const [q, setQ] = useState("")
  const [cancel, setCancel] = useState(null)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try { setError(""); setRows(await api.getHistory({ status })) } catch (e) { setError(e.message) }
  }, [status])
  useEffect(() => { load() }, [load, refreshKey])

  const doCancel = async () => {
    setBusy(true)
    try {
      await api.cancelAllocation(cancel.id, reason.trim())
      showToast(`Allocation cancelled — ${cancel.courseCode} is unassigned`)
      setCancel(null); setReason(""); load(); onChanged?.()
    } catch (e) { showToast(e.message, "error") } finally { setBusy(false) }
  }

  const shown = (rows || []).filter((a) => !q.trim() || `${a.courseCode} ${a.courseName} ${a.facultyName} ${a.term}`.toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl p-6">
      <div className="flex flex-wrap gap-3 items-center justify-between mb-5">
        <h2 className="text-base font-semibold">Allocation history</h2>
        <div className="flex gap-2">
          <input className={`${inputCls} !w-56`} placeholder="Search course, faculty, term…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className={`${inputCls} !w-40`} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option><option value="active">Active</option><option value="superseded">Superseded</option><option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>
      {error ? <ErrorState message={error} onRetry={load} /> : !rows ? <Spinner /> : shown.length === 0 ? (
        <p className="text-sm text-neutral-500">No allocations yet.</p>
      ) : <div className="divide-y divide-[#2a2a2a]">{shown.map((a) => <Row key={a.id} a={a} onCancel={setCancel} />)}</div>}

      {cancel && (
        <HodModal open onClose={busy ? undefined : () => setCancel(null)} width={460} title="Cancel this allocation?">
          <p className="text-sm text-neutral-300 leading-relaxed">
            {cancel.facultyName} will be removed from <b>{cancel.courseCode} — {cancel.courseName}</b>{cancel.batchName ? ` (${cancel.batchName})` : ""} and notified. The course disappears from their Courses page. The record stays in this history.
          </p>
          <input className={`${inputCls} mt-4`} placeholder="Reason (optional)" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex justify-end gap-2 mt-5">
            <button className={btnGhost} onClick={() => setCancel(null)} disabled={busy}>Keep</button>
            <button className="bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg px-4 py-2 disabled:opacity-50" onClick={doCancel} disabled={busy}>{busy ? "Please wait…" : "Cancel allocation"}</button>
          </div>
        </HodModal>
      )}
    </div>
  )
}
