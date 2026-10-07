import { useEffect, useState } from "react"
import { Users, GraduationCap, BookOpen, AlarmClock } from "lucide-react"

function useCountUp(target, duration = 700) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let start = 0
    const step = target / (duration / 16)
    const t = setInterval(() => {
      start += step
      if (start >= target) { setVal(target); clearInterval(t) } else setVal(Math.floor(start))
    }, 16)
    return () => clearInterval(t)
  }, [target, duration])
  return val
}

function Card({ title, value, suffix = "", Icon, accent, note, onClick }) {
  const isNum = typeof value === "number"
  const animated = useCountUp(isNum ? value : 0)
  return (
    <div
      onClick={onClick}
      className={`bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl p-5 flex flex-col gap-4 transition-all hover:border-[#3a3a3a] hover:bg-[#222222] ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: accent + "18", color: accent }}>
        <Icon size={18} />
      </div>
      <div>
        <div className="flex items-end gap-1">
          <span className="text-3xl font-bold text-white tracking-tight">{isNum ? animated : "—"}</span>
          {isNum && suffix && <span className="text-lg font-semibold mb-0.5 text-neutral-400">{suffix}</span>}
        </div>
        <p className="text-sm text-neutral-500 mt-1">{title}</p>
        {note && <p className="text-[11px] mt-1" style={{ color: accent }}>{note}</p>}
      </div>
    </div>
  )
}

export default function SnapshotCards({ snapshot, onOpenAction }) {
  const s = snapshot
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-600 mb-3">Department Snapshot</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
  <Card title="Total Faculty"  value={s.totalFaculty}  Icon={Users}         accent="#22c55e" />
  <Card title="Total Students" value={s.totalStudents} Icon={GraduationCap} accent="#3b82f6" />
  <Card title="Active Courses" value={s.activeCourses} Icon={BookOpen}      accent="#a855f7" />
  <Card title="Overdue Tasks"  value={s.overdueTasks}  Icon={AlarmClock}    accent="#ef4444"
        onClick={s.overdueTasks > 0 ? () => onOpenAction("tasks") : undefined} />
</div>
    </div>
  )
}
