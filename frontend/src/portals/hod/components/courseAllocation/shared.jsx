import { CircleCheck, CircleX, CircleHelp, TriangleAlert, Info } from "lucide-react"

/* Small pieces + formatters shared by the Course Allocation screens (same dark theme as the rest of the HOD portal). */

export const fmtKey = (k) =>
  k ? new Date(`${k}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—"

export const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"

export const scoreColor = (s) => (s >= 70 ? "#22c55e" : s >= 45 ? "#f59e0b" : "#ef4444")

export const ELIG = {
  eligible:   { label: "Eligible",     color: "#22c55e" },
  review:     { label: "Needs review", color: "#f59e0b" },
  ineligible: { label: "Not eligible", color: "#ef4444" },
}

export const btnSolid = "bg-green-500 hover:bg-green-600 text-black text-sm font-semibold rounded-lg px-5 py-2 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"

export function Label({ children, hint }) {
  return (
    <label className="block text-xs font-medium text-neutral-400 mb-1.5">
      {children}{hint && <span className="text-neutral-600 font-normal"> · {hint}</span>}
    </label>
  )
}

export function Pill({ color, children, title }) {
  return (
    <span title={title} className="text-[11px] px-2.5 py-1 rounded-full font-medium flex-shrink-0 whitespace-nowrap" style={{ background: color + "22", color }}>
      {children}
    </span>
  )
}

export function EligibilityBadge({ status }) {
  const m = ELIG[status] || ELIG.review
  return <Pill color={m.color}>{m.label}</Pill>
}

export function Notice({ tone = "warn", children }) {
  const tones = {
    warn: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    info: "text-sky-300 bg-sky-500/10 border-sky-500/30",
    bad:  "text-red-400 bg-red-500/10 border-red-500/30",
  }
  const Icon = tone === "info" ? Info : TriangleAlert
  return (
    <div className={`flex items-start gap-2 text-xs border rounded-lg px-3 py-2 ${tones[tone]}`}>
      <Icon size={14} className="flex-shrink-0 mt-0.5" /> <div className="min-w-0">{children}</div>
    </div>
  )
}

export function CheckIcon({ status, size = 14 }) {
  if (status === "fail")    return <CircleX size={size} className="text-red-400 flex-shrink-0" />
  if (status === "warn")    return <TriangleAlert size={size} className="text-amber-400 flex-shrink-0" />
  if (status === "unknown") return <CircleHelp size={size} className="text-amber-400 flex-shrink-0" />
  if (status === "na")      return <Info size={size} className="text-neutral-500 flex-shrink-0" />
  return <CircleCheck size={size} className="text-green-400 flex-shrink-0" />
}

/** One component row: label, weight, bar (or "Unknown"), raw score. */
export function ComponentBar({ c, compact }) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-x-3 items-center">
      <div className="min-w-0">
        <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1">
          <span className="truncate">{c.label} <span className="text-neutral-600">· {c.weight}%</span></span>
        </div>
        {c.known ? (
          <div className="h-1.5 rounded-full bg-[#2a2a2a] overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${c.raw}%`, background: scoreColor(c.raw) }} />
          </div>
        ) : (
          <div className="h-1.5 rounded-full border border-dashed border-[#3a3a3a]" />
        )}
        {!compact && <p className="text-[11px] text-neutral-500 mt-1 leading-snug">{c.detail}</p>}
      </div>
      <div className="text-right w-16">
        {c.known
          ? <><p className="text-sm font-semibold text-white leading-none">{c.raw}</p><p className="text-[10px] text-neutral-600 mt-0.5">+{c.contribution} pts</p></>
          : <p className="text-[11px] font-medium text-amber-400">Unknown</p>}
      </div>
    </div>
  )
}


/* ───────── schedule helpers + input (HOD types the schedule; no free-text format to get wrong) ───────── */
export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export const to12 = (hhmm) => {
  const m = String(hhmm || "").match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return ""
  const h = parseInt(m[1], 10)
  return `${((h + 11) % 12) + 1}:${m[2]} ${h >= 12 ? "PM" : "AM"}`
}
export const to24 = (t) => {
  const m = String(t || "").match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
  if (!m) return ""
  let h = parseInt(m[1], 10); const p = (m[3] || "").toUpperCase()
  if (p === "PM" && h !== 12) h += 12
  if (p === "AM" && h === 12) h = 0
  return `${String(h).padStart(2, "0")}:${m[2]}`
}
/** "Mon, Wed" + "10:00 AM - 11:00 AM"  →  { days:["Mon","Wed"], start:"10:00", end:"11:00" } (what can be read, else blank) */
export function scheduleFromText(s = {}) {
  const days = DAYS.filter((d) => new RegExp(`\\b${d}`, "i").test(s.days || ""))
  const parts = String(s.time || "").match(/\d{1,2}:\d{2}\s*(?:AM|PM)?/gi) || []
  return { days, start: to24(parts[0]), end: to24(parts[1]) }
}
export const scheduleToText = (v) => ({ days: DAYS.filter((d) => v.days.includes(d)).join(", "), time: v.start && v.end ? `${to12(v.start)} - ${to12(v.end)}` : "" })
export const scheduleReady = (v) => !!v && v.days.length > 0 && !!v.start && !!v.end && v.end > v.start
export const blankSchedule = () => ({ days: [], start: "", end: "" })

export function ScheduleInput({ label, value, onChange }) {
  const toggle = (d) => onChange({ ...value, days: value.days.includes(d) ? value.days.filter((x) => x !== d) : [...value.days, d] })
  const field = "bg-[#141414] border border-[#333] focus:border-green-500 outline-none rounded-lg px-3 py-2 text-sm text-white"
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {label && <span className="text-xs font-medium text-neutral-300 w-20">{label}</span>}
      <div className="flex gap-1.5">
        {DAYS.map((d) => (
          <button type="button" key={d} onClick={() => toggle(d)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${value.days.includes(d) ? "bg-green-500 text-black border-green-500" : "border-[#333] text-neutral-400 hover:text-white hover:bg-[#252525]"}`}>{d}</button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input type="time" className={field} value={value.start} onChange={(e) => onChange({ ...value, start: e.target.value })} />
        <span className="text-neutral-500 text-xs">to</span>
        <input type="time" className={field} value={value.end} onChange={(e) => onChange({ ...value, end: e.target.value })} />
      </div>
      {value.start && value.end && value.end <= value.start && <span className="text-[11px] text-red-400">End must be after start</span>}
    </div>
  )
}
