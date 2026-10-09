import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Check, X, Bell, CalendarClock, UserCheck, Undo2, Sparkles, ChevronDown } from "lucide-react"
import useAppStore from "../../store/useAppStore"
import * as hod from "../../services/HOD/hodApi"
import { btnPrimary, btnGhost, btnDanger, inputCls, Spinner, EmptyState, ErrorState, useLoad } from "./HodModal"
import LeaveImpact from "./LeaveImpact"

/* One panel per "Action Required" item. Each panel loads its own list, performs the action,
   removes the item locally and calls onChanged() so the dashboard numbers refresh. */

const fmt = (d, o = { day: "numeric", month: "short" }) => new Date(d).toLocaleDateString("en-GB", o)
const dateInput = (offset = 0) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10) }

const Badge = ({ children, color = "#9ca3af" }) => (
  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap" style={{ background: color + "22", color }}>{children}</span>
)
const PRIORITY = { High: "#ef4444", Medium: "#f59e0b", Low: "#3b82f6" }

function Shell({ state, empty, emptySub, children }) {
  if (state.loading) return <Spinner />
  if (state.error) return <ErrorState message={state.error} onRetry={state.reload} />
  if (!state.data || state.data.length === 0) return <EmptyState text={empty} sub={emptySub} />
  return <div className="space-y-3">{children}</div>
}

function useAct(onChanged) {
  const { showToast } = useAppStore()
  const [busy, setBusy] = useState(null)
  const run = async (id, fn, okMsg) => {
    setBusy(id)
    try { await fn(); showToast(okMsg, "success"); onChanged?.(); return true }
    catch (e) { showToast(e.message, "error"); return false }
    finally { setBusy(null) }
  }
  return { busy, run }
}

const Row = ({ children }) => <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4">{children}</div>

/* ───────────── 1. Leave requests ───────────── */
// Shown at the bottom of the dashboard's "Leave requests" drawer
function ManageLeaveLink() {
  const navigate = useNavigate()
  return (
    <button onClick={() => navigate("/leave-management")}
      className="mt-4 w-full text-xs font-medium rounded-xl border border-[#333] hover:border-green-500/50 hover:text-white text-neutral-400 py-2.5 transition cursor-pointer">
      Open Leave Management — history, calendar, balances & cover →
    </button>
  )
}

export function LeavePanel({ onChanged, showManageLink = false }) {
  const state = useLoad(hod.getPendingLeaves)
  const { busy, run } = useAct(onChanged)
  const [notes, setNotes] = useState({})
  const [open, setOpen] = useState({})          // leave ids whose impact analysis is expanded
  const drop = (id) => state.setData((d) => d.filter((x) => x._id !== id))

  const act = (l, status) => run(l._id + status, async () => {
    await hod.reviewLeave(l._id, { status, note: notes[l._id] || "" }); drop(l._id)
  }, `Leave ${status.toLowerCase()}`)

  return (
    <>
    <Shell state={state} empty="No pending leave requests" emptySub="Everything has been reviewed.">
      {state.data?.map((l) => (
        <Row key={l._id}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">{l.facultyName}</p>
              <p className="text-xs text-neutral-400 mt-0.5">{fmt(l.fromDate)} – {fmt(l.toDate)} · {l.duration} day{l.duration > 1 ? "s" : ""}</p>
            </div>
            <Badge color="#3b82f6">{l.type}</Badge>
          </div>
          <p className="text-sm text-neutral-300 mt-2">{l.reason}</p>
          <button className={`${btnGhost} mt-3 flex items-center gap-1.5`} onClick={() => setOpen({ ...open, [l._id]: !open[l._id] })}>
            <Sparkles size={13} className="text-green-400" />{open[l._id] ? "Hide impact analysis" : "Impact analysis & suggested cover"}
            <ChevronDown size={13} className={`transition ${open[l._id] ? "rotate-180" : ""}`} />
          </button>
          {open[l._id] && (
            <LeaveImpact leave={l} note={notes[l._id] || ""} onDone={() => { drop(l._id); onChanged?.() }} />
          )}
          <div className="flex items-center gap-2 mt-3">
            <input className={inputCls} placeholder="Note to faculty (optional)" value={notes[l._id] || ""}
              onChange={(e) => setNotes({ ...notes, [l._id]: e.target.value })} />
            <button className={btnPrimary} disabled={!!busy} onClick={() => act(l, "Approved")}><Check size={13} className="inline -mt-0.5 mr-1" />Approve</button>
            <button className={btnDanger} disabled={!!busy} onClick={() => act(l, "Rejected")}><X size={13} className="inline -mt-0.5 mr-1" />Reject</button>
          </div>
        </Row>
      ))}
    </Shell>
    {showManageLink && <ManageLeaveLink />}
    </>
  )
}

/* ───────────── 2. Substitutions ───────────── */
export function SubstitutionPanel({ onChanged }) {
  const state = useLoad(hod.getSubstitutions)
  const { busy, run } = useAct(onChanged)
  const [pick, setPick] = useState({})

  const assign = (s) => run(s.key, async () => {
    await hod.assignSubstitute({ leaveId: s.leaveId, courseId: s.courseId, dateKey: s.dateKey, substituteId: pick[s.key] })
    await state.reload()
  }, "Substitute assigned")

  const unassign = (s) => run(s.key, async () => {
    await hod.removeSubstitution(s.substitute._id); await state.reload()
  }, "Substitution removed")

  const pending = state.data?.filter((s) => !s.substitute).length ?? 0
  return (
    <Shell state={state} empty="No classes need cover" emptySub="No approved leaves clash with scheduled classes this week.">
      <p className="text-xs text-neutral-500">{pending} of {state.data?.length} class{state.data?.length === 1 ? "" : "es"} still need a substitute (next 7 days)</p>
      {state.data?.map((s) => (
        <Row key={s.key}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">{s.courseName} <span className="text-neutral-500 font-normal">{s.courseCode}</span></p>
              <p className="text-xs text-neutral-400 mt-0.5">{s.weekday}, {fmt(s.dateKey)} · {s.time || "time TBD"}{s.room ? ` · ${s.room}` : ""}</p>
              <p className="text-xs text-neutral-500 mt-0.5">{s.originalFacultyName} on {s.leaveType.toLowerCase()} leave</p>
            </div>
            {s.substitute ? <Badge color="#22c55e">Covered</Badge> : <Badge color="#f59e0b">Needs cover</Badge>}
          </div>
          {s.substitute ? (
            <div className="flex items-center justify-between mt-3">
              <p className="text-sm text-green-400 flex items-center gap-2"><UserCheck size={14} /> {s.substitute.name}</p>
              <button className={btnGhost} disabled={!!busy} onClick={() => unassign(s)}><Undo2 size={12} className="inline -mt-0.5 mr-1" />Undo</button>
            </div>
          ) : s.candidates.length === 0 ? (
            <p className="text-xs text-red-400 mt-3">No faculty free at this time. Free someone up in the Availability tab.</p>
          ) : (
            <div className="flex items-center gap-2 mt-3">
              <select className={inputCls} value={pick[s.key] || ""} onChange={(e) => setPick({ ...pick, [s.key]: e.target.value })}>
                <option value="">Select substitute…</option>
                {s.candidates.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
              <button className={btnPrimary} disabled={!pick[s.key] || !!busy} onClick={() => assign(s)}>Assign</button>
            </div>
          )}
        </Row>
      ))}
    </Shell>
  )
}

/* ───────────── 3. Timetable conflicts ───────────── */
function ConflictFix({ course, rooms, onApply, busy }) {
  const [room, setRoom] = useState("")
  const [time, setTime] = useState("")
  return (
    <div className="flex-1 min-w-0 bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg p-3">
      <p className="text-sm font-medium text-white truncate">{course.courseName}</p>
      <p className="text-xs text-neutral-500 mb-2">{course.teacherName} · {course.time} · {course.room || "no room"}</p>
      <div className="space-y-2">
        <input className={inputCls} list="hod-rooms" placeholder="Move to room (e.g. LH-204)" value={room} onChange={(e) => setRoom(e.target.value)} />
        <input className={inputCls} placeholder='Or new time (e.g. 11:30 AM - 12:30 PM)' value={time} onChange={(e) => setTime(e.target.value)} />
        <button className={`${btnPrimary} w-full`} disabled={busy || (!room.trim() && !time.trim())} onClick={() => onApply({ courseId: course.courseId, room, time })}>
          Reschedule this class
        </button>
      </div>
      <datalist id="hod-rooms">{rooms.map((r) => <option key={r} value={r} />)}</datalist>
    </div>
  )
}

export function ConflictPanel({ onChanged }) {
  const state = useLoad(async () => { const r = await hod.getConflicts(); return Object.assign(r.data, { rooms: r.rooms }) })
  const { busy, run } = useAct(onChanged)
  const rooms = state.data?.rooms || []

  const apply = (payload) => run("fix", async () => {
    await hod.resolveConflict(payload); await state.reload()
  }, "Timetable updated")

  return (
    <Shell state={state} empty="No timetable conflicts" emptySub="No room or faculty is double-booked.">
      {state.data?.map((c) => (
        <Row key={c.id}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-sm font-semibold text-white flex items-center gap-2"><CalendarClock size={14} className="text-amber-400" />{c.day}</p>
              <p className="text-xs text-neutral-400 mt-0.5">{c.reason}</p>
            </div>
            <Badge color="#ef4444">{c.type}</Badge>
          </div>
          <div className="flex gap-3 flex-col md:flex-row">
            <ConflictFix course={c.a} rooms={rooms} busy={!!busy} onApply={apply} />
            <ConflictFix course={c.b} rooms={rooms} busy={!!busy} onApply={apply} />
          </div>
        </Row>
      ))}
    </Shell>
  )
}

/* ───────────── 4. Overdue faculty tasks ───────────── */
export function OverduePanel({ onChanged }) {
  const state = useLoad(hod.getOverdueTasks)
  const { busy, run } = useAct(onChanged)
  const [ext, setExt] = useState({})
  const drop = (id) => state.setData((d) => d.filter((x) => x._id !== id))

  return (
    <Shell state={state} empty="No overdue tasks" emptySub="Faculty are on top of their assignments.">
      {state.data?.map((t) => (
        <Row key={t._id}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">{t.title}</p>
              <p className="text-xs text-neutral-400 mt-0.5">{t.assignedToName} · due {fmt(t.dueDate)}</p>
            </div>
            <div className="flex gap-2">
              <Badge color={PRIORITY[t.priority]}>{t.priority}</Badge>
              <Badge color="#ef4444">{t.daysOverdue}d overdue</Badge>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button className={btnGhost} disabled={!!busy} onClick={() => run(t._id + "r", () => hod.remindHodTask(t._id), `Reminder sent to ${t.assignedToName}`)}>
              <Bell size={12} className="inline -mt-0.5 mr-1" />Remind
            </button>
            <input type="date" min={dateInput(0)} className={`${inputCls} !w-auto [color-scheme:dark]`} value={ext[t._id] || ""} onChange={(e) => setExt({ ...ext, [t._id]: e.target.value })} />
            <button className={btnGhost} disabled={!ext[t._id] || !!busy}
              onClick={() => run(t._id + "e", async () => { await hod.updateHodTask(t._id, { dueDate: ext[t._id] }); drop(t._id) }, "Deadline extended")}>
              Extend
            </button>
            <button className={`${btnPrimary} ml-auto`} disabled={!!busy}
              onClick={() => run(t._id + "c", async () => { await hod.updateHodTask(t._id, { status: "Completed" }); drop(t._id) }, "Marked complete")}>
              <Check size={13} className="inline -mt-0.5 mr-1" />Mark complete
            </button>
          </div>
        </Row>
      ))}
    </Shell>
  )
}

/* ───────────── 5. Question papers ───────────── */
export function PapersPanel({ onChanged }) {
  const state = useLoad(hod.getPendingPapers)
  const { busy, run } = useAct(onChanged)
  const [notes, setNotes] = useState({})
  const drop = (id) => state.setData((d) => d.filter((x) => x._id !== id))

  const review = (p, decision) => run(p._id + decision, async () => {
    await hod.reviewPaper(p._id, { decision, note: notes[p._id] || "" }); drop(p._id)
  }, decision === "approve" ? "Paper approved" : "Changes requested")

  return (
    <Shell state={state} empty="No papers awaiting review" emptySub="All submitted papers have been reviewed.">
      {state.data?.map((p) => (
        <Row key={p._id}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">{p.courseName} <span className="text-neutral-500 font-normal">{p.courseCode}</span></p>
              <p className="text-xs text-neutral-400 mt-0.5">{p.examType} · {p.facultyName} · submitted {p.submittedAt ? fmt(p.submittedAt) : "—"}</p>
            </div>
            {p.dueDate && <Badge color="#f59e0b">Due {fmt(p.dueDate)}</Badge>}
          </div>
          <textarea rows={2} className={`${inputCls} mt-3 resize-none`} placeholder="Review note (required when requesting changes)"
            value={notes[p._id] || ""} onChange={(e) => setNotes({ ...notes, [p._id]: e.target.value })} />
          <div className="flex justify-end gap-2 mt-3">
            <button className={btnDanger} disabled={!!busy || !(notes[p._id] || "").trim()} onClick={() => review(p, "changes")}>Request changes</button>
            <button className={btnPrimary} disabled={!!busy} onClick={() => review(p, "approve")}><Check size={13} className="inline -mt-0.5 mr-1" />Approve</button>
          </div>
        </Row>
      ))}
    </Shell>
  )
}

/* ───────────── 6. Student escalations ───────────── */
export function EscalationPanel({ onChanged }) {
  const state = useLoad(hod.getOpenEscalations)
  const { busy, run } = useAct(onChanged)
  const [notes, setNotes] = useState({})
  const drop = (id) => state.setData((d) => d.filter((x) => x._id !== id))

  return (
    <Shell state={state} empty="No open escalations" emptySub="All student issues have been resolved.">
      {state.data?.map((e) => (
        <Row key={e._id}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">{e.subject}</p>
              <p className="text-xs text-neutral-400 mt-0.5">{e.studentName}{e.studentId ? ` (${e.studentId})` : ""}{e.course ? ` · ${e.course}` : ""} · raised {fmt(e.createdAt)}</p>
            </div>
            <Badge color={PRIORITY[e.priority]}>{e.priority}</Badge>
          </div>
          {e.description && <p className="text-sm text-neutral-300 mt-2">{e.description}</p>}
          <div className="flex items-center gap-2 mt-3">
            <input className={inputCls} placeholder="Resolution note (required)" value={notes[e._id] || ""}
              onChange={(ev) => setNotes({ ...notes, [e._id]: ev.target.value })} />
            <button className={btnPrimary} disabled={!(notes[e._id] || "").trim() || !!busy}
              onClick={() => run(e._id, async () => { await hod.resolveEscalation(e._id, { note: notes[e._id] }); drop(e._id) }, "Escalation resolved")}>
              Resolve
            </button>
          </div>
        </Row>
      ))}
    </Shell>
  )
}

export const PANELS = {
  leaves:        { title: "Leave requests",         subtitle: "Approve or reject pending faculty leave",           Component: LeavePanel },
  substitutions: { title: "Faculty substitutions",  subtitle: "Assign a free faculty member to cover absent classes", Component: SubstitutionPanel },
  conflicts:     { title: "Timetable conflicts",    subtitle: "Move one of the clashing classes to a free room or slot", Component: ConflictPanel },
  tasks:         { title: "Overdue faculty tasks",  subtitle: "Remind, extend or close out overdue assignments",   Component: OverduePanel },
  papers:        { title: "Question papers",        subtitle: "Approve submitted papers or request changes",       Component: PapersPanel },
  escalations:   { title: "Student escalations",    subtitle: "Resolve open student issues with a note",           Component: EscalationPanel },
}