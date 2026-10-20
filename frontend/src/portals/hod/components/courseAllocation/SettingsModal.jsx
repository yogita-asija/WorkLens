import { useEffect, useState } from "react"
import HodModal, { Spinner, ErrorState, btnGhost, inputCls } from "../HodModal"
import { Label, btnSolid } from "./shared"
import * as api from "../../services/courseAllocationApi"
import useAppStore from "../../../../store/useAppStore"

const LIMITS = [
  ["maxWeeklyHours", "Max weekly teaching hours", "hours / week incl. the new course"],
  ["maxCourses", "Max concurrent courses", "incl. the new course"],
  ["leaveBlockPercent", "Approved-leave threshold", "% of the semester → not eligible"],
]

/** Scoring weights, workload limits and policies for this department (saved per department). */
export default function SettingsModal({ onClose, onSaved }) {
  const { showToast } = useAppStore()
  const [s, setS] = useState(null)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => { api.getSettings().then(setS).catch((e) => setError(e.message)) }, [])

  if (error) return <HodModal open onClose={onClose} title="Allocation settings"><ErrorState message={error} /></HodModal>
  if (!s) return <HodModal open onClose={onClose} title="Allocation settings"><Spinner /></HodModal>

  const sum = Object.values(s.weights).reduce((a, b) => a + (Number(b) || 0), 0)
  const setW = (k, v) => setS({ ...s, weights: { ...s.weights, [k]: v } })
  const setL = (k, v) => setS({ ...s, limits: { ...s.limits, [k]: v } })
  const reset = () => setS({ ...s, weights: { ...s.defaults.weights }, limits: { ...s.defaults.limits } })

  const save = async () => {
    setSaving(true)
    try {
      await api.saveSettings({
        weights: Object.fromEntries(Object.entries(s.weights).map(([k, v]) => [k, Number(v)])),
        limits: Object.fromEntries(Object.entries(s.limits).map(([k, v]) => [k, Number(v)])),
        unknownPolicy: s.unknownPolicy, blockOnUnknownQualification: s.blockOnUnknownQualification,
      })
      showToast("Allocation settings saved")
      onSaved?.()
      onClose()
    } catch (e) { showToast(e.message, "error"); setSaving(false) }
  }

  return (
    <HodModal open onClose={onClose} width={720} title="Allocation settings" subtitle="Weights and limits used for every recommendation in your department">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-3">Scoring weights (must add up to 100)</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {Object.keys(s.weights).map((k) => (
          <div key={k}>
            <Label>{s.labels[k]}</Label>
            <input type="number" min="0" max="100" step="1" className={inputCls} value={s.weights[k]} onChange={(e) => setW(k, e.target.value)} />
          </div>
        ))}
      </div>
      <p className={`text-xs mt-2 ${Math.abs(sum - 100) <= 0.5 ? "text-green-400" : "text-red-400"}`}>Total: {Math.round(sum * 10) / 10}</p>

      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mt-6 mb-3">Mandatory limits (eligibility, not score)</p>
      <div className="grid sm:grid-cols-3 gap-3">
        {LIMITS.map(([k, label, hint]) => (
          <div key={k}><Label hint={hint}>{label}</Label><input type="number" min="1" className={inputCls} value={s.limits[k]} onChange={(e) => setL(k, e.target.value)} /></div>
        ))}
      </div>

      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mt-6 mb-3">Missing data</p>
      <Label>When a score component is unknown</Label>
      <select className={inputCls} value={s.unknownPolicy} onChange={(e) => setS({ ...s, unknownPolicy: e.target.value })}>
        <option value="zero">Give no credit for it (recommended — people with documented strengths rank higher)</option>
        <option value="renormalize">Ignore it and re-scale the known components (shows only what is known)</option>
      </select>
      <label className="flex items-start gap-2 text-xs text-neutral-300 mt-3 cursor-pointer">
        <input type="checkbox" className="mt-0.5 accent-green-500" checked={s.blockOnUnknownQualification} onChange={(e) => setS({ ...s, blockOnUnknownQualification: e.target.checked })} />
        <span>Treat an unverifiable required qualification as “not eligible” (otherwise it is only flagged for review)</span>
      </label>

      <div className="flex justify-between mt-6">
        <button className={btnGhost} onClick={reset}>Reset to defaults</button>
        <div className="flex gap-2">
          <button className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnSolid} disabled={saving || Math.abs(sum - 100) > 0.5} onClick={save}>{saving ? "Saving…" : "Save settings"}</button>
        </div>
      </div>
    </HodModal>
  )
}
