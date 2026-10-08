import { useEffect, useState } from "react"
import * as hod from "../../services/HOD/hodApi"
import { Spinner, ErrorState } from "./HodModal"
import { Bar, Card, TYPE_COLOR, YearSwitch } from "./LeaveUi"

/* Patterns across the year: volume, speed of decisions, busiest months/days, who is away most. */
const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"]
const fmtHours = (h) => (h == null ? "—" : h < 1 ? "<1 h" : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} days`)

export default function LeaveInsights() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [data, setData] = useState(null)
  const [error, setError] = useState("")
  useEffect(() => {
    let alive = true
    setData(null)
    hod.getLeaveInsights(year).then((d) => { if (alive) { setData(d); setError("") } }).catch((e) => alive && setError(e.message))
    return () => { alive = false }
  }, [year])
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-neutral-500">Based on approved leave days in the calendar year.</p>
        <YearSwitch year={year} onChange={setYear} />
      </div>
      {error ? <ErrorState message={error} /> : !data ? <Spinner /> : <InsightsView data={data} />}
    </div>
  )
}

export function InsightsView({ data }) {
  const t = data.totals
  if (t.applications === 0) return <div className="py-12 text-center text-sm text-neutral-500">No leave activity in {data.year}.</div>
  const maxMonth = Math.max(1, ...data.byMonth)
  const maxDay = Math.max(1, ...data.byWeekday.map((d) => d.days))
  const maxType = Math.max(1, ...data.byType.map((x) => x.days))

  const notes = []
  if (data.monFriShare != null && data.monFriShare >= 50) notes.push(`${data.monFriShare}% of leave days fall on a Monday or Friday — a possible long-weekend pattern.`)
  else if (data.monFriShare != null) notes.push(`Leave days are fairly spread across the week (Monday + Friday make up ${data.monFriShare}%).`)
  if (t.avgDecisionHours != null && t.avgDecisionHours > 48) notes.push(`Requests take about ${Math.round(t.avgDecisionHours / 24)} days to decide on average — faster replies help faculty plan.`)
  const peak = data.byMonth.indexOf(Math.max(...data.byMonth))
  if (data.byMonth[peak] > 0) notes.push(`${["January","February","March","April","May","June","July","August","September","October","November","December"][peak]} is the busiest month (${data.byMonth[peak]} leave days).`)

  const tiles = [
    ["Applications", t.applications, `${t.approved} approved · ${t.rejected} rejected · ${t.pending} pending`],
    ["Approval rate", t.approvalRate == null ? "—" : `${t.approvalRate}%`, "of decided requests"],
    ["Avg. time to decide", fmtHours(t.avgDecisionHours), "from application to decision"],
    ["Avg. leave length", t.avgDuration == null ? "—" : `${t.avgDuration} days`, "approved leaves"],
  ]
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {tiles.map(([label, value, sub]) => (
          <div key={label} className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4">
            <p className="text-xs text-neutral-400">{label}</p>
            <p className="text-2xl font-bold text-white mt-1">{value}</p>
            <p className="text-[11px] text-neutral-500 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {notes.length > 0 && (
        <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4">
          <p className="text-xs font-semibold text-green-400 mb-1.5">What stands out</p>
          <ul className="space-y-1">{notes.map((n, i) => <li key={i} className="text-xs text-neutral-300">• {n}</li>)}</ul>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card title="Leave days by month">
          <div className="flex items-end gap-1.5 h-36">
            {data.byMonth.map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-1" title={`${v} days`}>
                <span className="text-[9px] text-neutral-500">{v || ""}</span>
                <div className="w-full rounded-t bg-green-500/70" style={{ height: `${(v / maxMonth) * 100}%`, minHeight: v ? 3 : 0 }} />
                <span className="text-[10px] text-neutral-500">{MONTHS[i]}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Leave days by weekday">
          <div className="space-y-2">
            {data.byWeekday.map((d) => (
              <div key={d.day} className="flex items-center gap-3">
                <span className="text-xs text-neutral-400 w-20">{d.day}</span>
                <div className="flex-1"><Bar pct={(d.days / maxDay) * 100} color={d.day === "Monday" || d.day === "Friday" ? "#f59e0b" : "#3b82f6"} /></div>
                <span className="text-xs text-neutral-300 w-6 text-right">{d.days}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="By leave type">
          <div className="space-y-3">
            {data.byType.map((x) => (
              <div key={x.type}>
                <div className="flex justify-between text-xs mb-1"><span className="text-neutral-300">{x.type}</span><span className="text-neutral-500">{x.count} request{x.count === 1 ? "" : "s"} · {x.days} days</span></div>
                <Bar pct={(x.days / maxType) * 100} color={TYPE_COLOR[x.type]} />
              </div>
            ))}
          </div>
        </Card>
        <Card title="Most days away">
          {data.topAbsentees.length === 0 ? <p className="text-xs text-neutral-500">No approved leave yet.</p> : (
            <div className="space-y-2.5">
              {data.topAbsentees.map((p, i) => (
                <div key={p.facultyId} className="flex items-center justify-between text-xs">
                  <span className="text-neutral-300"><span className="text-neutral-600 mr-2">{i + 1}.</span>{p.name}</span>
                  <span className="text-neutral-400">{p.days} day{p.days === 1 ? "" : "s"} <span className="text-neutral-600">· {p.requests} request{p.requests === 1 ? "" : "s"}</span></span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}