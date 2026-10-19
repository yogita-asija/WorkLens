import { Inbox, UserMinus, CalendarClock, CheckCheck, UserX } from "lucide-react"
import { fmtDay } from "./LeaveUi"

/* Stat cards at the top of Leave Management. Each card jumps to the tab where you act on it. */
export default function LeaveStats({ overview, onGo }) {
  const { counts: c, oldestPending, waitingOver3Days, awayToday, upcoming } = overview
  const names = (list) => (list.length <= 2 ? list.map((l) => l.facultyName).join(", ") : `${list.slice(0, 2).map((l) => l.facultyName).join(", ")} +${list.length - 2}`)

  const cards = [
    {
      key: "requests", icon: Inbox, color: "#f59e0b", label: "Pending requests", value: c.pending,
      sub: c.pending === 0 ? "All caught up" : waitingOver3Days > 0 ? `${waitingOver3Days} waiting over 3 days` : oldestPending ? `Oldest: ${oldestPending.facultyName}, ${oldestPending.daysWaiting}d` : "",
      warn: waitingOver3Days > 0,
    },
    { key: "calendar", icon: UserMinus, color: "#3b82f6", label: "Away today", value: c.onLeaveToday, sub: c.onLeaveToday ? names(awayToday) : `of ${c.totalFaculty} faculty` },
    { key: "calendar", icon: CalendarClock, color: "#a855f7", label: "Starting in 14 days", value: c.upcoming, sub: upcoming[0] ? `Next: ${upcoming[0].facultyName}, ${fmtDay(upcoming[0].fromDate)}` : "Nothing scheduled" },
    { key: "history", icon: CheckCheck, color: "#22c55e", label: "Decided this month", value: c.approvedThisMonth + c.rejectedThisMonth, sub: `${c.approvedThisMonth} approved · ${c.rejectedThisMonth} rejected` },
    { key: "cover", icon: UserX, color: c.uncoveredClasses ? "#ef4444" : "#22c55e", label: "Classes needing cover", value: c.uncoveredClasses, sub: c.uncoveredClasses ? "Next 7 days · assign substitutes" : "Everything is covered", warn: c.uncoveredClasses > 0 },
  ]
  return (
    <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
      {cards.map(({ key, icon: Icon, color, label, value, sub, warn }, i) => (
        <button key={i} onClick={() => onGo(key)}
          className="text-left bg-[#1c1c1c] border border-[#2a2a2a] hover:border-[#3a3a3a] rounded-2xl p-4 transition cursor-pointer">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400">{label}</span>
            <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: color + "22", color }}><Icon size={14} /></span>
          </div>
          <p className="text-2xl font-bold text-white mt-2">{value}</p>
          <p className={`text-[11px] mt-1 truncate ${warn ? "text-amber-400" : "text-neutral-500"}`}>{sub}</p>
        </button>
      ))}
    </div>
  )
}