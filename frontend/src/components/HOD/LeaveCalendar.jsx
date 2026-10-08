import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import * as hod from "../../services/HOD/hodApi"
import { btnGhost, Spinner, ErrorState } from "./HodModal"
import { Badge, STATUS_COLOR, TYPE_COLOR, dayKey, fmtDay, pad } from "./LeaveUi"

/* Month calendar of who is away: approved (solid) and pending (outlined) leaves, plus public holidays. */

const localKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const shiftMonth = (m, n) => { const [y, mo] = m.split("-").map(Number); const d = new Date(Date.UTC(y, mo - 1 + n, 1)); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}` }
const first = (name) => (name || "").split(" ").find((w) => w && !/^(dr|prof|mr|mrs|ms)\.?$/i.test(w)) || name

export default function LeaveCalendar() {
  const [month, setMonth] = useState(localKey().slice(0, 7))
  const [data, setData] = useState(null)
  const [error, setError] = useState("")
  const [selected, setSelected] = useState(localKey())

  useEffect(() => {
    let alive = true
    setData(null)
    hod.getLeaveCalendar(month).then((d) => { if (alive) { setData(d); setError("") } }).catch((e) => alive && setError(e.message))
    return () => { alive = false }
  }, [month])

  const go = (n) => { const m = shiftMonth(month, n); setMonth(m); setSelected(`${m}-01`) }
  const title = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7) - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <div className="flex items-center gap-2">
          <button className={btnGhost} onClick={() => go(-1)} aria-label="Previous month"><ChevronLeft size={14} /></button>
          <button className={btnGhost} onClick={() => { setMonth(localKey().slice(0, 7)); setSelected(localKey()) }}>Today</button>
          <button className={btnGhost} onClick={() => go(1)} aria-label="Next month"><ChevronRight size={14} /></button>
        </div>
      </div>
      {error ? <ErrorState message={error} /> : !data ? <Spinner /> : <CalendarView data={data} selected={selected} onSelect={setSelected} todayKey={localKey()} />}
    </div>
  )
}

export function CalendarView({ data, selected, onSelect, todayKey }) {
  const [y, mo] = data.month.split("-").map(Number)
  const lead = (new Date(Date.UTC(y, mo - 1, 1)).getUTCDay() + 6) % 7          // Monday-first grid
  const count = new Date(Date.UTC(y, mo, 0)).getUTCDate()
  const cells = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => `${data.month}-${pad(i + 1)}`)]

  const on = (k) => data.leaves.filter((l) => dayKey(l.fromDate) <= k && dayKey(l.toDate) >= k)
  const holidayOn = (k) => data.holidays.filter((h) => dayKey(h.date) === k)
  const sel = selected ? { leaves: on(selected), holidays: holidayOn(selected) } : null

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
      <div className="xl:col-span-2">
        <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-wide text-neutral-500 mb-1 px-1">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((k, i) => {
            if (!k) return <div key={`b${i}`} />
            const list = on(k), away = list.filter((l) => l.status === "Approved").length
            const pct = data.totalFaculty ? (away / data.totalFaculty) * 100 : 0
            const hol = holidayOn(k)
            const sunday = new Date(k + "T00:00:00Z").getUTCDay() === 0
            const tint = pct >= 30 ? "rgba(239,68,68,0.14)" : pct >= 15 ? "rgba(245,158,11,0.12)" : "transparent"
            return (
              <button key={k} onClick={() => onSelect(k)} title={`${fmtDay(k)}: ${away} away`}
                className={`min-h-[78px] text-left rounded-lg border p-1.5 transition cursor-pointer ${selected === k ? "border-green-500" : k === todayKey ? "border-neutral-500" : "border-[#2a2a2a] hover:border-[#3a3a3a]"} ${sunday ? "opacity-60" : ""}`}
                style={{ background: tint || "#141414" }}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${k === todayKey ? "text-green-400 font-bold" : "text-neutral-300"}`}>{+k.slice(8)}</span>
                  {away > 0 && <span className="text-[9px] text-neutral-400">{away} away</span>}
                </div>
                {hol[0] && <p className="text-[9px] text-blue-400 truncate mt-0.5">{hol[0].name}</p>}
                <div className="mt-1 space-y-0.5">
                  {list.slice(0, 2).map((l) => (
                    <div key={l._id} className="text-[9px] px-1 rounded truncate"
                      style={l.status === "Approved" ? { background: TYPE_COLOR[l.type] + "33", color: "#e5e7eb" } : { border: `1px dashed ${STATUS_COLOR.Pending}`, color: STATUS_COLOR.Pending }}>
                      {first(l.facultyName)}
                    </div>
                  ))}
                  {list.length > 2 && <div className="text-[9px] text-neutral-500">+{list.length - 2} more</div>}
                </div>
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap items-center gap-4 mt-3 text-[11px] text-neutral-500">
          <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded" style={{ background: "#3b82f633" }} />Approved (colour = type)</span>
          <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded border border-dashed border-amber-500" />Pending</span>
          <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded" style={{ background: "rgba(239,68,68,0.3)" }} />30%+ of faculty away</span>
          <span className="text-blue-400">Public holiday</span>
        </div>
      </div>

      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4">
        <p className="text-sm font-semibold text-white">{selected ? fmtDay(selected, true) : "Select a day"}</p>
        {sel && (
          <div className="mt-3 space-y-2">
            {sel.holidays.map((h) => <p key={h.name} className="text-xs text-blue-400">🎌 {h.name} <span className="text-neutral-500">· {h.type}</span></p>)}
            {sel.leaves.length === 0 && sel.holidays.length === 0 && <p className="text-xs text-neutral-500">Everyone is available.</p>}
            {sel.leaves.map((l) => (
              <div key={l._id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-white truncate">{l.facultyName}</p>
                  <p className="text-[11px] text-neutral-500">{l.type} · {fmtDay(l.fromDate)} – {fmtDay(l.toDate)}</p>
                </div>
                <Badge color={STATUS_COLOR[l.status]}>{l.status}</Badge>
              </div>
            ))}
            {sel.leaves.length > 0 && <p className="text-[11px] text-neutral-500 pt-2 border-t border-[#2a2a2a]">{sel.leaves.filter((l) => l.status === "Approved").length} of {data.totalFaculty} faculty away</p>}
          </div>
        )}
      </div>
    </div>
  )
}