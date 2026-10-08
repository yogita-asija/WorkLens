import { ChevronLeft, ChevronRight } from "lucide-react"

/* Small shared pieces for the HOD "Leave Management" tabs */

export const pad     = (n) => String(n).padStart(2, "0")
export const dayKey  = (d) => new Date(d).toISOString().slice(0, 10)                       // leave dates are stored as UTC midnight
export const fmtDay  = (d, withYear = false) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" })
export const fmtRange = (a, b) => (dayKey(a) === dayKey(b) ? fmtDay(a) : `${fmtDay(a)} – ${fmtDay(b)}`)
export const fmtStamp = (d) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })   // real timestamps (applied / decided)

export const STATUS_COLOR = { Pending: "#f59e0b", Approved: "#22c55e", Rejected: "#ef4444" }
export const TYPE_COLOR   = { Sick: "#ef4444", Casual: "#3b82f6", Earned: "#a855f7" }

export const Badge = ({ children, color = "#9ca3af" }) => (
  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap" style={{ background: color + "22", color }}>{children}</span>
)

export const Card = ({ title, right, children, className = "" }) => (
  <div className={`bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl p-5 ${className}`}>
    {(title || right) && (
      <div className="flex items-center justify-between gap-3 mb-4">
        {title && <h3 className="text-sm font-semibold text-white">{title}</h3>}
        {right}
      </div>
    )}
    {children}
  </div>
)

export function YearSwitch({ year, onChange }) {
  const btn = "p-1.5 rounded-lg border border-[#333] text-neutral-300 hover:bg-[#252525] transition"
  return (
    <div className="flex items-center gap-2">
      <button className={btn} onClick={() => onChange(year - 1)} aria-label="Previous year"><ChevronLeft size={14} /></button>
      <span className="text-sm font-semibold text-white w-12 text-center">{year}</span>
      <button className={btn} onClick={() => onChange(year + 1)} aria-label="Next year"><ChevronRight size={14} /></button>
    </div>
  )
}

export const Bar = ({ pct, color = "#22c55e", height = 6 }) => (
  <div className="rounded-full bg-[#262626] overflow-hidden" style={{ height }}>
    <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
  </div>
)