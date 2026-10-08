import { ChevronDown, CalendarDays } from "lucide-react"
import * as hod from "../../services/HOD/hodApi"
import { btnGhost, Spinner, ErrorState, useLoad } from "./HodModal"
import { Badge, Bar, fmtDay, fmtRange } from "./LeaveUi"
import { Avatar, BAND, FACULTY_STATUS_COLOR, Legend, PARTS, StackedBar } from "./FacultyUi"
/* One faculty member: the load bar at a glance, and the full breakdown when opened. */

const PRIORITY_COLOR = { High: "#ef4444", Medium: "#f59e0b", Low: "#9ca3af" }

export default function FacultyCard({ f, max, open, onToggle, onViewLeaves }) {
  const band = BAND[f.band]
  return (
    <div id={`fac-${f._id}`} className={`bg-[#141414] border rounded-xl transition ${open ? "border-[#3a3a3a]" : "border-[#2a2a2a]"}`}>
      <button onClick={onToggle} className="w-full text-left px-4 py-3 cursor-pointer">
        <div className="flex items-center gap-3 flex-wrap">
          <Avatar name={f.name} />
          <div className="min-w-0 flex-1 basis-40">
            <p className="text-sm font-semibold text-white truncate">{f.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {f.status && <Badge color={FACULTY_STATUS_COLOR[f.status] || "#9ca3af"}>{f.status}</Badge>}
              <Badge color={band.color}>{band.label}</Badge>
              {f.overNorm && <Badge color="#f59e0b">Over teaching norm</Badge>}
              {f.awayNext14 > 0 && <Badge color="#f59e0b">Away {f.awayNext14}d soon</Badge>}
            </div>
          </div>
          <div className="flex-1 basis-56 min-w-[200px]">
            <StackedBar components={f.components} max={max} />
            <p className="text-[11px] text-neutral-500 mt-1.5">
              {f.courses} course{f.courses === 1 ? "" : "s"} · {f.teachingHours} h/week · {f.students} student{f.students === 1 ? "" : "s"}
              {f.tasks.overdue + f.papers.overdue > 0 && <span className="text-red-400"> · {f.tasks.overdue + f.papers.overdue} overdue</span>}
              {f.cover.count > 0 && <span> · covered {f.cover.count}</span>}
            </p>
          </div>
          <div className="text-right w-20 flex-shrink-0">
            <p className="text-lg font-bold" style={{ color: band.color }}>{f.load}</p>
            <p className="text-[11px] text-neutral-500">{f.ratio}% of avg</p>
          </div>
          <ChevronDown size={15} className={`text-neutral-500 transition flex-shrink-0 ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      {open && <div className="px-4 pb-4 pt-1 border-t border-[#2a2a2a]"><FacultyDetail id={f._id} onViewLeaves={onViewLeaves} /></div>}
    </div>
  )
}

function FacultyDetail({ id, onViewLeaves }) {
  const state = useLoad(() => hod.getFacultyWorkload(id))
  if (state.loading) return <Spinner />
  if (state.error) return <ErrorState message={state.error} onRetry={state.reload} />
  return <DetailView data={state.data} onViewLeaves={onViewLeaves} />
}

export function DetailView({ data, onViewLeaves }) {
  const { summary: s, week, schedule, cover, tasks, papers, dutyDays, leave } = data
  const lines = {
    teaching: `${s.teachingHours} h/week over ${s.sessionsPerWeek} session${s.sessionsPerWeek === 1 ? "" : "s"}`,
    cover:    s.cover.count ? `${s.cover.count} class${s.cover.count === 1 ? "" : "es"} (${s.cover.hours} h)${s.cover.upcoming ? `, ${s.cover.upcoming} coming up` : ""}` : "No substitute classes",
    tasks:    s.tasks.open ? `${s.tasks.open} open${s.tasks.overdue ? `, ${s.tasks.overdue} overdue` : ""}` : "No open tasks",
    papers:   s.papers.pending ? `${s.papers.pending} due${s.papers.overdue ? `, ${s.papers.overdue} overdue` : ""}` : "None due",
    duty:     dutyDays.length ? `${dutyDays.length} day${dutyDays.length === 1 ? "" : "s"} marked` : "None",
  }
  const maxHours = Math.max(1, ...week.map((d) => d.hours))
  const List = ({ title, empty, children, count }) => (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-neutral-500 font-semibold mb-2">{title}{count ? ` (${count})` : ""}</p>
      {count ? <div className="space-y-1.5">{children}</div> : <p className="text-xs text-neutral-500">{empty}</p>}
    </div>
  )
  return (
    <div className="mt-3 space-y-5">
      {/* where the points come from */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <p className="text-[11px] uppercase tracking-wide text-neutral-500 font-semibold">Where the {s.load} points come from</p>
          <Legend />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {PARTS.map((p) => (
            <div key={p.key} className="bg-[#101010] border border-[#262626] rounded-lg p-2.5">
              <p className="text-[11px] flex items-center gap-1.5 text-neutral-400"><i className="w-2 h-2 rounded-sm" style={{ background: p.color }} />{p.label}</p>
              <p className="text-base font-bold text-white">{s.components[p.key]}</p>
              <p className="text-[11px] text-neutral-500">{lines[p.key]}</p>
            </div>
          ))}
        </div>
        {s.estimatedTimes && <p className="text-[11px] text-amber-400 mt-2">Some class times couldn't be read, so they're counted as 1 hour each. Set the time in the course to make this exact.</p>}
      </div>

      {/* week */}
      <div>
        <p className="text-[11px] uppercase tracking-wide text-neutral-500 font-semibold mb-2">Weekly teaching</p>
        {schedule.length === 0 ? <p className="text-xs text-neutral-500">No scheduled classes.</p> : (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {week.map((d) => (
              <div key={d.day} className="bg-[#101010] border border-[#262626] rounded-lg p-2 min-h-[84px]">
                <div className="flex items-center justify-between text-[11px]"><span className="text-neutral-400">{d.day.slice(0, 3)}</span><span className="text-neutral-500">{d.hours ? `${d.hours} h` : ""}</span></div>
                <div className="mt-1"><Bar pct={(d.hours / maxHours) * 100} color="#3b82f6" height={4} /></div>
                <div className="mt-1.5 space-y-1">
                  {d.sessions.map((x, i) => (
                    <p key={i} className="text-[10px] text-neutral-300 leading-tight">
                      <span className="text-white">{x.courseCode || x.courseName}</span>{x.batchName ? ` · ${x.batchName}` : ""}<br /><span className="text-neutral-500">{x.time}</span>
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <List title="Substitute classes" empty="No substitute classes in this period." count={cover.length}>
          {cover.map((c) => (
            <p key={c._id} className="text-xs text-neutral-300">{c.courseName} <span className="text-neutral-500">· {fmtDay(c.dateKey)}{c.time ? ` · ${c.time}` : ""}{c.originalFacultyName ? ` · for ${c.originalFacultyName}` : ""}</span>{c.upcoming && <span className="ml-1.5"><Badge color="#a855f7">Upcoming</Badge></span>}</p>
          ))}
        </List>
        <List title="Open tasks" empty="No open tasks." count={tasks.length}>
          {tasks.map((t) => (
            <p key={t._id} className="text-xs text-neutral-300 flex items-center gap-1.5 flex-wrap">{t.title}<Badge color={PRIORITY_COLOR[t.priority]}>{t.priority}</Badge><span className="text-neutral-500">due {fmtDay(t.dueDate)}</span>{t.overdue && <Badge color="#ef4444">Overdue</Badge>}</p>
          ))}
        </List>
        <List title="Question papers due" empty="No papers due." count={papers.length}>
          {papers.map((p) => (
            <p key={p._id} className="text-xs text-neutral-300 flex items-center gap-1.5 flex-wrap">{p.courseName} <span className="text-neutral-500">· {p.examType} · {p.status}{p.dueDate ? ` · due ${fmtDay(p.dueDate)}` : ""}</span>{p.overdue && <Badge color="#ef4444">Overdue</Badge>}</p>
          ))}
        </List>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-neutral-500 font-semibold mb-2">Leave in {leave.year}</p>
          <div className="flex items-center gap-3"><div className="flex-1"><Bar pct={leave.allocated ? (leave.used / leave.allocated) * 100 : 0} color={leave.remaining < 0 ? "#ef4444" : leave.remaining <= 2 ? "#f59e0b" : "#22c55e"} /></div>
            <span className="text-xs text-neutral-300 whitespace-nowrap">{leave.used} / {leave.allocated} days used</span></div>
          {leave.pending > 0 && <p className="text-[11px] text-amber-400 mt-1">{leave.pending} more day{leave.pending === 1 ? "" : "s"} awaiting approval</p>}
          <div className="mt-2 space-y-1">
            {leave.upcoming.length === 0 ? <p className="text-xs text-neutral-500">No upcoming leave.</p> : leave.upcoming.map((l) => (
              <p key={l._id} className="text-xs text-neutral-300">{l.type} · {fmtRange(l.fromDate, l.toDate)} <Badge color={l.status === "Approved" ? "#22c55e" : "#f59e0b"}>{l.status}</Badge></p>
            ))}
          </div>
        </div>
      </div>

      {onViewLeaves && <button className={`${btnGhost} flex items-center gap-1.5`} onClick={() => onViewLeaves(data.faculty._id)}><CalendarDays size={13} />View leave history</button>}
    </div>
  )
}