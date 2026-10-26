import { useState } from "react"
import HodModal, { btnGhost, inputCls } from "./../HodModal"
import { CheckIcon, EligibilityBadge, Notice, btnSolid, fmtKey, scoreColor } from "./shared"

/**
 * Final review before anything is saved: constraints, warnings, what will change.
 * The server re-validates everything again on confirm — this screen is never the only guard.
 */
export default function ReviewModal({ candidate: c, result, form, onClose, onConfirm, saving, serverError }) {
  const [ack, setAck] = useState(false)
  const [replace, setReplace] = useState(false)
  const [note, setNote] = useState("")

  const others = result.target.currentTeachers.filter((t) => t.id !== c.facultyId)
  const replaces = others.length > 0
  const otherNames = others.map((t) => t.name || "another faculty member").join(", ")
  const needsAck = c.eligibility.warnings.length > 0
  const ready = ack && (!replaces || replace)

  return (
    <HodModal open onClose={saving ? undefined : onClose} width={760} title="Review & confirm assignment"
      subtitle={`${result.target.label} — ${result.course.courseName}`}>
      <div className="grid sm:grid-cols-3 gap-3 mb-5">
        <div className="rounded-xl bg-[#141414] border border-[#2a2a2a] p-3">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">Faculty</p>
          <p className="text-sm font-semibold text-white mt-1">{c.name}</p>
          <div className="mt-1.5"><EligibilityBadge status={c.eligibility.status} /></div>
        </div>
        <div className="rounded-xl bg-[#141414] border border-[#2a2a2a] p-3">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">Semester</p>
          <p className="text-sm font-semibold text-white mt-1">{form.term}</p>
          <p className="text-[11px] text-neutral-500 mt-0.5">{fmtKey(form.startDate)} – {fmtKey(form.endDate)}</p>
        </div>
        <div className="rounded-xl bg-[#141414] border border-[#2a2a2a] p-3">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">Recommendation</p>
          <p className="text-sm font-semibold mt-1" style={{ color: scoreColor(c.score) }}>{c.score}/100 <span className="text-neutral-500 font-normal">· rank #{c.rank}</span></p>
          <p className="text-[11px] text-neutral-500 mt-0.5">Data completeness {c.completeness}%</p>
        </div>
      </div>

      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-2">Constraints reviewed</p>
      <ul className="space-y-2 mb-5">
        {c.eligibility.checks.map((k) => (
          <li key={k.key} className="flex items-start gap-2 text-xs">
            <CheckIcon status={k.status} />
            <span className="text-neutral-300"><b className="text-white">{k.label}</b> — {k.detail}</span>
          </li>
        ))}
      </ul>

      {c.unknownFields.length > 0 && (
        <div className="mb-4"><Notice tone="info">Unknown — no data on record, so nothing was assumed: {c.unknownFields.join(" · ")}.</Notice></div>
      )}

      {replaces && (
        <div className="mb-4">
          <Notice tone="warn">
            <b>{result.target.label}</b> is currently taught by <b>{otherNames}</b>. Confirming <b>replaces</b> them, and they will be notified.
          </Notice>
        </div>
      )}

      <div className="mb-4">
        <Notice tone="info">
          The assignment takes effect immediately: <b>{c.name}</b> will see this course in their Courses page, and nobody else in the faculty portal will.
        </Notice>
      </div>

      <label className="block text-xs font-medium text-neutral-400 mb-1.5">Note (optional, saved in the allocation history)</label>
      <textarea rows={2} className={`${inputCls} mb-4`} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />

      <div className="space-y-2 mb-5">
        <label className="flex items-start gap-2 text-xs text-neutral-300 cursor-pointer">
          <input type="checkbox" className="mt-0.5 accent-green-500" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          <span>I have reviewed the constraints{needsAck ? " and the warnings above" : ""} and want to assign this course.</span>
        </label>
        {replaces && (
          <label className="flex items-start gap-2 text-xs text-neutral-300 cursor-pointer">
            <input type="checkbox" className="mt-0.5 accent-green-500" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
            <span>Replace {otherNames} for this course.</span>
          </label>
        )}
      </div>

      {serverError && <div className="mb-4"><Notice tone="bad">{serverError}</Notice></div>}

      <div className="flex justify-end gap-2">
        <button className={btnGhost} onClick={onClose} disabled={saving}>Back</button>
        <button className={btnSolid} disabled={!ready || saving}
          onClick={() => onConfirm({ note: note.trim(), acknowledgeWarnings: ack, replaceExisting: replaces && replace })}>
          {saving ? "Assigning…" : "Confirm assignment"}
        </button>
      </div>
    </HodModal>
  )
}
