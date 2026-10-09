import { useState } from "react"
import { AlertTriangle, Info, CheckCircle2, ChevronDown } from "lucide-react"
import { Card } from "./LeaveUi"
import { PARTS } from "./FacultyUi"

/* Department summary: how evenly work is spread, plus plain-English recommendations. */

const LEVEL_ICON = {
  warn: <AlertTriangle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />,
  info: <Info size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />,
  good: <CheckCircle2 size={14} className="text-green-400 mt-0.5 flex-shrink-0" />,
}

function Ring({ score }) {
  const r = 34, c = 2 * Math.PI * r
  const color = score == null ? "#525252" : score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444"
  return (
    <div className="relative w-[88px] h-[88px] flex-shrink-0">
      <svg viewBox="0 0 88 88" className="w-full h-full -rotate-90">
        <circle cx="44" cy="44" r={r} fill="none" stroke="#262626" strokeWidth="8" />
        {score != null && <circle cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-white">{score ?? "—"}</span>
    </div>
  )
}

export default function FacultyBalance({ data, onFocus }) {
  const { dept, insights, weights } = data
  const [how, setHow] = useState(false)
  const stat = (label, value, sub) => (
    <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-3">
      <p className="text-[11px] text-neutral-500">{label}</p>
      <p className="text-lg font-bold text-white mt-0.5">{value}</p>
      {sub && <p className="text-[11px] text-neutral-500 truncate">{sub}</p>}
    </div>
  )
  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
      <Card className="xl:col-span-3">
        <div className="flex items-center gap-5 flex-wrap">
          <Ring score={dept.balanceScore} />
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-neutral-500 font-semibold">Department balance</p>
            <p className="text-lg font-bold text-white">{dept.balanceLabel}</p>
            <p className="text-xs text-neutral-500 mt-0.5 max-w-xs">How evenly work is shared. 100 means everyone carries the same load.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          {stat("Average load", dept.mean, `median ${dept.median} pts`)}
          {stat("Overloaded", dept.overloaded, `${Math.round(weights.overloadedAt * 100)}% of average or more`)}
          {stat("Have capacity", dept.withCapacity, `${Math.round(weights.capacityAt * 100)}% of average or less`)}
          {stat("Most room", dept.mostCapacity ? dept.mostCapacity.name : "—", dept.mostCapacity ? `${dept.mostCapacity.load} pts` : "")}
        </div>
        <button onClick={() => setHow(!how)} className="mt-4 text-xs text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer">
          How is the load calculated? <ChevronDown size={13} className={`transition ${how ? "rotate-180" : ""}`} />
        </button>
        {how && (
          <div className="mt-2 text-xs text-neutral-400 space-y-1 bg-[#141414] border border-[#2a2a2a] rounded-xl p-3">
            <p>One point is roughly one hour of work per week. It adds up:</p>
            <ul className="space-y-0.5">
              {PARTS.map((p) => (
                <li key={p.key}><i className="inline-block w-2 h-2 rounded-sm mr-1.5" style={{ background: p.color }} /><span className="text-neutral-200">{p.label}:</span>{" "}
                  {p.key === "teaching" && "scheduled class hours per week, including batches they teach."}
                  {p.key === "cover" && `substitute classes in the last ${weights.coverPastDays} days and next ${weights.coverFutureDays}, averaged per week.`}
                  {p.key === "tasks" && `open tasks — High ${weights.taskPoints.High}, Medium ${weights.taskPoints.Medium}, Low ${weights.taskPoints.Low} pts each, +${weights.overdueTaskExtra} if overdue.`}
                  {p.key === "papers" && `question papers still due — ${weights.paperPoints} pts each, +${weights.overduePaperExtra} if overdue.`}
                  {p.key === "duty" && `days you marked "Other Duty" in Availability, ${weights.otherDutyDayPoints} pts per day, averaged per week.`}
                </li>
              ))}
            </ul>
            <p className="pt-1">Fairness compares each person with the department average: <span className="text-red-400">overloaded</span> at {Math.round(weights.overloadedAt * 100)}%+, <span className="text-blue-400">has capacity</span> at {Math.round(weights.capacityAt * 100)}% or less. Extra duties aren't included because they aren't linked to a person.</p>
          </div>
        )}
      </Card>

      <Card title="What to look at" className="xl:col-span-2">
        {insights.length === 0 ? <p className="text-xs text-neutral-500">Add at least two faculty members to compare workloads.</p> : (
          <ul className="space-y-2.5">
            {insights.map((i, k) => (
              <li key={k} className="flex items-start gap-2 text-xs text-neutral-300">
                {LEVEL_ICON[i.level]}
                <span className="flex-1">{i.text}</span>
                {i.facultyId && onFocus && <button onClick={() => onFocus(i.facultyId)} className="text-green-400 hover:text-green-300 whitespace-nowrap cursor-pointer">View</button>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}