import { useState } from "react"
import { Wand2, AlertTriangle, CheckCircle2 } from "lucide-react"
import * as hod from "../../services/HOD/hodApi"
import { Card, Bar } from "./LeaveUi"
import { btnPrimary, inputCls } from "./HodModal"

/* "What if I give this to…?" – asks the server how each person's load and the department balance would change.
   Uses the same load weights as the Workload page, so nothing is estimated on the client. */

const TYPES = {
  task:     { label: "Task",                 fields: ["priority", "count"] },
  paper:    { label: "Question paper",       fields: ["count"] },
  duty:     { label: "Duty / invigilation",  fields: ["hours", "count"] },
  cover:    { label: "Substitute class",     fields: ["hours", "count"] },
  teaching: { label: "Extra teaching hours", fields: ["hours"] },
}
const BAND = { overloaded: ["Overloaded", "#ef4444"], balanced: ["Balanced", "#22c55e"], capacity: ["Has capacity", "#3b82f6"] }
const scoreColor = (s) => (s == null ? "#9ca3af" : s >= 80 ? "#22c55e" : s >= 60 ? "#f59e0b" : "#ef4444")

export default function WhatIfPlanner({ onPick }) {
  const [f, setF] = useState({ type: "duty", priority: "Medium", hours: 3, count: 1 })
  const [res, setRes] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const fields = TYPES[f.type].fields

  const run = async () => {
    setBusy(true); setErr("")
    try { setRes(await hod.whatIfAssignment({ type: f.type, priority: f.priority, hours: Number(f.hours), count: Number(f.count) })) }
    catch (e) { setErr(e.message); setRes(null) }
    finally { setBusy(false) }
  }
  const max = res ? Math.max(1, ...res.options.map((o) => o.newLoad)) : 1

  return (
    <Card title={<span className="flex items-center gap-2"><Wand2 size={15} className="text-green-500" />Plan an assignment — what if?</span>}>
      <p className="text-xs text-neutral-500 mb-4">Describe something you are about to assign. You'll see what happens to each person's load and to the department balance if they take it.</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-[11px] text-neutral-500 flex flex-col">What<select className={`${inputCls} !w-auto mt-1`} value={f.type} onChange={(e) => set("type", e.target.value)}>
          {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
        {fields.includes("priority") && <label className="text-[11px] text-neutral-500 flex flex-col">Priority<select className={`${inputCls} !w-auto mt-1`} value={f.priority} onChange={(e) => set("priority", e.target.value)}>
          {["High", "Medium", "Low"].map((p) => <option key={p}>{p}</option>)}</select></label>}
        {fields.includes("hours") && <label className="text-[11px] text-neutral-500 flex flex-col">Hours{f.type === "teaching" ? " / week" : " each"}<input type="number" min="0.5" max="80" step="0.5" className={`${inputCls} !w-24 mt-1`} value={f.hours} onChange={(e) => set("hours", e.target.value)} /></label>}
        {fields.includes("count") && <label className="text-[11px] text-neutral-500 flex flex-col">How many<input type="number" min="1" max="20" className={`${inputCls} !w-20 mt-1`} value={f.count} onChange={(e) => set("count", e.target.value)} /></label>}
        <button className={`${btnPrimary} !py-2`} onClick={run} disabled={busy}>{busy ? "Comparing…" : "Compare faculty"}</button>
      </div>
      {err && <p className="text-xs text-red-400 mt-3">{err}</p>}

      {res && (
        <div className="mt-5">
          <p className="text-xs text-neutral-400 mb-3">
            Adding <span className="text-white font-medium">{res.action.label}</span> ≈ <span className="text-white font-medium">+{res.action.points} pts</span>.
            Department balance now <span style={{ color: scoreColor(res.before.balanceScore) }} className="font-semibold">{res.before.balanceScore ?? "—"}</span>.
          </p>
          <div className="space-y-2">
            {res.options.map((o) => {
              const rec = o.facultyId === res.recommendedId
              return (
                <div key={o.facultyId} className={`rounded-xl border p-3 ${rec ? "border-green-500/60 bg-green-500/5" : "border-[#2a2a2a] bg-[#141414]"}`}>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <div className="min-w-[150px]">
                      <p className="text-sm font-medium flex items-center gap-1.5">{o.name}{rec && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 flex items-center gap-1"><CheckCircle2 size={10} />Best fit</span>}</p>
                      <p className="text-[11px] text-neutral-500 flex flex-col">{o.status}</p>
                    </div>
                    <div className="flex-1 min-w-[180px]">
                      <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1"><span>{o.load} → <span className="text-white font-semibold">{o.newLoad}</span> pts</span><span style={{ color: BAND[o.newBand][1] }}>{BAND[o.newBand][0]} ({o.newRatio}%)</span></div>
                      <Bar pct={(o.newLoad / max) * 100} color={BAND[o.newBand][1]} height={5} />
                    </div>
                    <div className="text-right min-w-[110px]">
                      <p className="text-[11px] text-neutral-500 flex flex-col">Dept balance</p>
                      <p className="text-sm font-semibold" style={{ color: scoreColor(o.balanceAfter) }}>{o.balanceAfter ?? "—"}{o.balanceDelta ? <span className="text-[11px] ml-1">({o.balanceDelta > 0 ? "+" : ""}{o.balanceDelta})</span> : null}</p>
                    </div>
                    {onPick && <button className="text-[11px] text-neutral-400 hover:text-white underline cursor-pointer" onClick={() => onPick(o.facultyId)}>View</button>}
                  </div>
                  {o.warnings.length > 0 && <p className="text-[11px] text-amber-400 mt-2 flex items-center gap-1.5 flex-wrap"><AlertTriangle size={11} />{o.warnings.join(" · ")}</p>}
                </div>
              )
            })}
          </div>
          <p className="text-[11px] text-neutral-600 mt-3">"Best fit" gives the best resulting balance, never someone on leave or pushed into overload if there is another option. This only simulates — nothing is assigned.</p>
        </div>
      )}
    </Card>
  )
}
