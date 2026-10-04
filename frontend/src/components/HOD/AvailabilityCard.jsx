import { ChevronRight } from "lucide-react"

export const STATUS_META = {
  available:   { label: "Available",   status: "Available",   color: "#22c55e" },
  teaching:    { label: "Teaching",    status: "Teaching",    color: "#3b82f6" },
  onLeave:     { label: "On Leave",    status: "On Leave",    color: "#f59e0b" },
  otherDuty:   { label: "Other Duty",  status: "Other Duty",  color: "#a855f7" },
  unavailable: { label: "Unavailable", status: "Unavailable", color: "#ef4444" },
}

export default function AvailabilityCard({ availability, pendingSubs, onOpen }) {
  const { counts, total } = availability
  return (
    <div
      onClick={() => onOpen()}
      className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl p-5 cursor-pointer hover:border-[#3a3a3a] hover:bg-[#202020] transition-all group"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold">Faculty Availability — Today</h2>
          <p className="text-xs text-neutral-500 mt-0.5">{total} faculty in department</p>
        </div>
        <ChevronRight size={18} className="text-neutral-600 group-hover:text-white transition" />
      </div>

      {/* proportional bar */}
      <div className="flex h-2 rounded-full overflow-hidden bg-[#2a2a2a] mb-4">
        {Object.entries(STATUS_META).map(([k, m]) =>
          counts[k] > 0 ? <div key={k} style={{ width: `${(counts[k] / Math.max(total, 1)) * 100}%`, background: m.color }} /> : null)}
      </div>

      <div className="space-y-2.5">
        {Object.entries(STATUS_META).map(([k, m]) => (
          <div key={k} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2.5 text-neutral-300">
              <span className="w-2 h-2 rounded-full" style={{ background: m.color }} />{m.label}
            </span>
            <span className="font-semibold text-white tabular-nums">{counts[k]}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-[#2a2a2a] flex items-center justify-between">
        <span className="text-xs text-neutral-500">
          {pendingSubs > 0 ? <span className="text-amber-400">{pendingSubs} substitution{pendingSubs > 1 ? "s" : ""} to arrange</span> : "No substitutions pending"}
        </span>
        <span className="text-xs text-green-400 font-medium">Open workflow →</span>
      </div>
    </div>
  )
}
