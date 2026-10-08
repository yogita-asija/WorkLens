import { useEffect, useState } from "react"
import * as hod from "../../services/HOD/hodApi"
import { Spinner, ErrorState } from "./HodModal"
import { Badge, Bar, TYPE_COLOR, YearSwitch } from "./LeaveUi"

/* Per-faculty leave allocation vs. days used in the calendar year. */
export default function LeaveBalances() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [data, setData] = useState(null)
  const [error, setError] = useState("")
  useEffect(() => {
    let alive = true
    setData(null)
    hod.getLeaveBalances(year).then((d) => { if (alive) { setData(d); setError("") } }).catch((e) => alive && setError(e.message))
    return () => { alive = false }
  }, [year])
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-neutral-500">Approved leave days per calendar year. Pending requests are shown separately.</p>
        <YearSwitch year={year} onChange={setYear} />
      </div>
      {error ? <ErrorState message={error} /> : !data ? <Spinner /> : <BalancesView data={data} />}
    </div>
  )
}

export function BalancesView({ data }) {
  const { rows, totals } = data
  if (!rows.length) return <div className="py-12 text-center text-sm text-neutral-500">No faculty found in your department.</div>
  const pct = totals.allocated ? Math.round((totals.used / totals.allocated) * 100) : 0
  return (
    <div>
      <p className="text-xs text-neutral-400 mb-3">Department has used <span className="text-white font-semibold">{totals.used}</span> of {totals.allocated} allocated days ({pct}%){totals.pending ? ` · ${totals.pending} more day${totals.pending === 1 ? "" : "s"} pending approval` : ""}</p>
      <div className="space-y-2">
        {rows.map((r) => {
          const used = r.allocated ? (r.used / r.allocated) * 100 : 0
          const over = r.remaining < 0, low = !over && r.remaining <= 2
          return (
            <div key={r.facultyId} className="bg-[#141414] border border-[#2a2a2a] rounded-xl px-4 py-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{r.name}</p>
                  <p className="text-[11px] text-neutral-500">{r.requests} request{r.requests === 1 ? "" : "s"} this year</p>
                </div>
                <div className="flex items-center gap-2">
                  {Object.entries(r.byType).filter(([, d]) => d > 0).map(([t, d]) => <Badge key={t} color={TYPE_COLOR[t]}>{t} {d}d</Badge>)}
                  {r.pending > 0 && <Badge color="#f59e0b">{r.pending}d pending</Badge>}
                  {over && <Badge color="#ef4444">Over allocation</Badge>}
                  {low && <Badge color="#f59e0b">Low balance</Badge>}
                </div>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex-1"><Bar pct={used} color={over ? "#ef4444" : low ? "#f59e0b" : "#22c55e"} /></div>
                <span className="text-xs text-neutral-300 w-40 text-right">{r.used} / {r.allocated} used · <span className={over ? "text-red-400" : "text-white"}>{r.remaining} left</span></span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}