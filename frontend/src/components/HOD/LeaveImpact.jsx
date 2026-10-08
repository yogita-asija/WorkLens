import { useState } from "react"
import { Sparkles, AlertTriangle, Info, Users, CalendarDays, Check, X } from "lucide-react"
import useAppStore from "../../store/useAppStore"
import * as hod from "../../services/HOD/hodApi"
import { btnPrimary, btnDanger, Spinner, ErrorState, useLoad } from "./HodModal"

/* "Leave impact assistant" - shown inside a pending leave card.
   Everything here is computed by the server (GET /api/hod/leaves/:id/impact); this component only lets the
   HOD change a suggested substitute, then sends { courseId, dateKey, substituteId } pairs back. The server
   re-checks every choice before approving. */

const fmtDay = (d) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
const fmtDateTime = (d) => new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })
const LEVEL = {
  high:   { color: "#ef4444", label: "High impact" },
  medium: { color: "#f59e0b", label: "Moderate impact" },
  low:    { color: "#22c55e", label: "Low impact" },
}
const slotKey = (c) => `${c.courseId}|${c.dateKey}`

const Badge = ({ children, color = "#9ca3af" }) => (
  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap" style={{ background: color + "22", color }}>{children}</span>
)
const Section = ({ icon: Icon, title, children }) => (
  <div className="mt-4">
    <p className="text-[11px] uppercase tracking-wide text-neutral-500 font-semibold flex items-center gap-1.5 mb-2">
      {Icon && <Icon size={12} />}{title}
    </p>
    {children}
  </div>
)

export default function LeaveImpact({ leave, note, onDone }) {
  const state = useLoad(() => hod.getLeaveImpact(leave._id))
  if (state.loading) return <Spinner />
  if (state.error) return <ErrorState message={state.error} onRetry={state.reload} />
  return <ImpactBody impact={state.data} leave={leave} note={note} onDone={onDone} />
}

function ImpactBody({ impact, leave, note, onDone }) {
  const { showToast } = useAppStore()
  const [busy, setBusy] = useState(false)
  // pre-select the server's suggestion for every class; the HOD can change or clear any of them
  const [picks, setPicks] = useState(() => Object.fromEntries(impact.classes.map((c) => [slotKey(c), c.suggestedId || ""])))

  const lvl = LEVEL[impact.level] || LEVEL.low
  const chosen = impact.classes.filter((c) => picks[slotKey(c)])
  const uncovered = impact.classes.length - chosen.length
  const E = impact.events
  const nothingElse = !E.deadlines.length && !E.papers.length && !E.exams.length && !E.tasks.length && !E.onlineClasses.length

  const approve = async () => {
    setBusy(true)
    try {
      const assignments = chosen.map((c) => ({ courseId: c.courseId, dateKey: c.dateKey, substituteId: picks[slotKey(c)] }))
      const r = await hod.approveLeaveWithCover(leave._id, { note, assignments })
      showToast(r.data.assigned ? `Leave approved · ${r.data.assigned} class${r.data.assigned === 1 ? "" : "es"} covered` : "Leave approved", "success")
      onDone()
    } catch (e) { showToast(e.message, "error"); setBusy(false) }
  }
  const reject = async () => {
    setBusy(true)
    try { await hod.reviewLeave(leave._id, { status: "Rejected", note }); showToast("Leave rejected", "success"); onDone() }
    catch (e) { showToast(e.message, "error"); setBusy(false) }
  }

  return (
    <div className="mt-3 rounded-xl border border-[#2a2a2a] bg-[#101010] p-4">
      {/* verdict */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge color={lvl.color}>{lvl.label}</Badge>
        <span className="text-xs text-neutral-500">{fmtDay(impact.leave.fromDate)} – {fmtDay(impact.leave.toDate)} · {impact.window.days} day{impact.window.days === 1 ? "" : "s"} analysed</span>
      </div>
      {impact.flags.length > 0 && (
        <ul className="mt-2 space-y-1">
          {impact.flags.map((f, i) => (
            <li key={i} className="text-xs text-neutral-300 flex items-start gap-2">
              {f.level === "info"
                ? <Info size={13} className="mt-0.5 text-neutral-500 flex-shrink-0" />
                : <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" style={{ color: LEVEL[f.level].color }} />}
              {f.text}
            </li>
          ))}
        </ul>
      )}

      {/* classes + suggested cover */}
      <Section icon={Sparkles} title={`Classes that need cover (${impact.classes.length})`}>
        {impact.classes.length === 0 ? (
          <p className="text-xs text-neutral-500">No scheduled classes fall on these days.</p>
        ) : (
          <div className="space-y-2">
            {impact.classes.map((c) => {
              const k = slotKey(c)
              const sel = c.candidates.find((x) => x._id === picks[k])
              return (
                <div key={k} className="bg-[#161616] border border-[#262626] rounded-lg p-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{c.courseName} <span className="text-neutral-500 font-normal">{c.courseCode}</span></p>
                      <p className="text-xs text-neutral-400 mt-0.5">{c.weekday}, {fmtDay(c.dateKey)} · {c.time || "time TBD"}{c.room ? ` · ${c.room}` : ""}</p>
                    </div>
                    {c.candidates.length === 0 ? (
                      <Badge color="#ef4444">No one free</Badge>
                    ) : (
                      <select
                        className="bg-[#141414] border border-[#333] focus:border-green-500 outline-none rounded-lg px-2 py-1.5 text-xs text-white max-w-[230px]"
                        value={picks[k] || ""} onChange={(e) => setPicks({ ...picks, [k]: e.target.value })}>
                        <option value="">Leave uncovered</option>
                        {c.candidates.map((x) => (
                          <option key={x._id} value={x._id}>{x.name} · {x.score}% match{x._id === c.suggestedId ? " ★" : ""}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  {sel && (
                    <p className="text-[11px] text-neutral-500 mt-2">
                      <span className="text-green-400">{sel._id === c.suggestedId ? "Suggested" : "Selected"}:</span> {sel.reasons.slice(0, 3).join(" · ")}
                    </p>
                  )}
                  {c.candidates.length === 0 && (
                    <p className="text-[11px] text-red-400 mt-2">Everyone is teaching, away or marked unavailable at this time.</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Section>

      {/* who else is away */}
      <Section icon={Users} title="Also away during this period">
        {impact.overlappingLeaves.length === 0 ? (
          <p className="text-xs text-neutral-500">No other faculty have approved or pending leave in this window.</p>
        ) : (
          <div className="space-y-1.5">
            {impact.overlappingLeaves.map((o) => (
              <div key={o.leaveId} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-neutral-300">{o.facultyName} <span className="text-neutral-500">· {o.type} · {fmtDay(o.fromDate)} – {fmtDay(o.toDate)}</span></span>
                <Badge color={o.status === "Approved" ? "#22c55e" : "#f59e0b"}>{o.status}</Badge>
              </div>
            ))}
          </div>
        )}
        {impact.staffing.peakOnLeave > 0 && (
          <div className="mt-2">
            <div className="flex justify-between text-[11px] text-neutral-500 mb-1">
              <span>Peak absence{impact.staffing.peakDateKey ? ` · ${fmtDay(impact.staffing.peakDateKey)}` : ""}</span>
              <span>{impact.staffing.peakOnLeave} of {impact.staffing.totalFaculty} faculty ({impact.staffing.percent}%)</span>
            </div>
            <div className="h-1.5 rounded-full bg-[#222] overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, impact.staffing.percent)}%`, background: impact.staffing.percent >= 30 ? "#ef4444" : "#f59e0b" }} />
            </div>
          </div>
        )}
      </Section>

      {/* deadlines, papers, exams ... */}
      <Section icon={CalendarDays} title="Falling in this window">
        {nothingElse ? (
          <p className="text-xs text-neutral-500">No deadlines, question papers, exams or tasks fall in this window.</p>
        ) : (
          <div className="space-y-1.5 text-xs">
            {E.deadlines.map((d) => <Line key={d.id} left={d.title} sub="Department deadline" right={fmtDay(d.dueDate)} />)}
            {E.papers.map((p) => (
              <Line key={p.id} left={`${p.courseName} — ${p.examType} paper`} sub={`${p.facultyName || "Faculty"} · ${p.status}`} right={p.dueDate ? fmtDay(p.dueDate) : ""}
                badge={p.isApplicant ? <Badge color="#ef4444">Applicant's paper</Badge> : null} />
            ))}
            {E.exams.map((x) => <Line key={x.id} left={x.title} sub={`${x.type === "QUIZ" ? "Quiz" : "Exam"}${x.course ? ` · ${x.course}` : ""}`} right={fmtDay(x.dateKey)} />)}
            {E.tasks.map((t) => <Line key={t.id} left={t.title} sub={`Task for ${impact.leave.facultyName}`} right={fmtDay(t.dueDate)} />)}
            {E.onlineClasses.map((o) => <Line key={o.id} left={o.title} sub={`Online class${o.courseName ? ` · ${o.courseName}` : ""}`} right={fmtDateTime(o.scheduledAt)} />)}
          </div>
        )}
      </Section>

      {/* one-click decision */}
      <div className="mt-5 pt-4 border-t border-[#2a2a2a]">
        {uncovered > 0 && impact.classes.length > 0 && (
          <p className="text-[11px] text-amber-400 mb-2">{uncovered} class{uncovered === 1 ? "" : "es"} will stay uncovered — you can still assign cover later from Faculty substitutions.</p>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <button className={btnPrimary} disabled={busy} onClick={approve}>
            <Check size={13} className="inline -mt-0.5 mr-1" />
            {chosen.length ? `Approve & assign ${chosen.length} substitute${chosen.length === 1 ? "" : "s"}` : "Approve without cover"}
          </button>
          <button className={btnDanger} disabled={busy} onClick={reject}><X size={13} className="inline -mt-0.5 mr-1" />Reject</button>
        </div>
      </div>
    </div>
  )
}

function Line({ left, sub, right, badge }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-neutral-300">{left} {badge}</p>
        <p className="text-[11px] text-neutral-500">{sub}</p>
      </div>
      <span className="text-neutral-400 whitespace-nowrap">{right}</span>
    </div>
  )
}