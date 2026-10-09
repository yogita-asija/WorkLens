import { useNavigate } from "react-router-dom"
import { CalendarCheck, UserCog, CalendarX2, AlarmClock, FileCheck2, MessageSquareWarning, CheckCircle2, ChevronRight } from "lucide-react"

const META = {
  leaves:        { Icon: CalendarCheck,        accent: "#f59e0b" },
  substitutions: { Icon: UserCog,              accent: "#3b82f6" },
  conflicts:     { Icon: CalendarX2,           accent: "#ef4444" },
  tasks:         { Icon: AlarmClock,           accent: "#ef4444" },
  papers:        { Icon: FileCheck2,           accent: "#a855f7" },
  escalations:   { Icon: MessageSquareWarning, accent: "#f97316" },
}
const EMPTY = {
  leaves: "No leave requests pending", substitutions: "No substitutions required", conflicts: "No timetable conflicts",
  tasks: "No overdue faculty tasks", papers: "No question papers awaiting review", escalations: "No unresolved student escalations",
}

function Row({ item, onOpen }) {
  const navigate = useNavigate()
  const { Icon, accent } = META[item.key]
  const clear = item.count === 0
  return (
    <div
      onClick={() => onOpen(item.key)}
      className={`flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-all cursor-pointer group
        ${clear ? "border-[#2a2a2a] bg-transparent hover:bg-[#222]" : "border-[#2a2a2a] bg-[#161616] hover:bg-[#222] hover:border-[#3a3a3a]"}`}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
           style={{ background: (clear ? "#22c55e" : accent) + "18", color: clear ? "#22c55e" : accent }}>
        {clear ? <CheckCircle2 size={18} /> : <Icon size={18} />}
      </div>

      <div className="flex-1 min-w-0">
        {clear ? (
          <p className="text-sm text-neutral-500">{EMPTY[item.key]}</p>
        ) : (
          <>
            <p className="text-sm font-medium text-white">
              <span className="font-bold" style={{ color: accent }}>{item.count}</span> {item.label}
            </p>
            {item.hint && <p className="text-xs text-neutral-500 mt-0.5 truncate">{item.hint}</p>}
          </>
        )}
      </div>

      {item.key === "leaves" && (
        <button
          onClick={(e) => { e.stopPropagation(); navigate("/leave-management") }}
          className="hidden md:inline text-xs text-neutral-400 hover:text-white hover:underline underline-offset-2 whitespace-nowrap cursor-pointer"
        >
          Leave Management
        </button>
      )}

      {!clear && item.urgent && (
        <span className="hidden sm:inline text-[10px] px-2 py-1 rounded-full font-semibold bg-red-500/15 text-red-400">Urgent</span>
      )}

      <button
        onClick={(e) => { e.stopPropagation(); onOpen(item.key) }}
        className={clear
          ? "text-xs font-medium rounded-lg px-3 py-1.5 border border-[#333] text-neutral-400 group-hover:text-white transition flex items-center gap-1"
          : "text-xs font-semibold rounded-lg px-3.5 py-1.5 bg-green-500 hover:bg-green-600 text-black transition flex items-center gap-1"}
      >
        {clear ? "View" : "Resolve"} <ChevronRight size={13} />
      </button>
    </div>
  )
}

export default function ActionRequired({ actions, onOpen }) {
  const open = actions.reduce((n, a) => n + a.count, 0)
  return (
    <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Action Required</h2>
          <p className="text-xs text-neutral-500 mt-0.5">Things waiting on you today</p>
        </div>
        {open > 0
          ? <span className="text-xs bg-red-500/20 text-red-400 px-2.5 py-1 rounded-full font-medium">{open} open</span>
          : <span className="text-xs bg-green-500/15 text-green-400 px-2.5 py-1 rounded-full font-medium">All clear</span>}
      </div>
      <div className="space-y-2.5">
        {actions.map((a) => <Row key={a.key} item={a} onOpen={onOpen} />)}
      </div>
    </div>
  )
}