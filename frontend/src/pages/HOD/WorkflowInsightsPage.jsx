import { useCallback, useEffect, useState } from "react"
import { Lock, ChevronRight, Lightbulb, Trash2, Check, TriangleAlert } from "lucide-react"
import useAppStore from "../../store/useAppStore"
import * as api from "../../services/HOD/workflowInsightsApi"
import HodModal, { Spinner, EmptyState, ErrorState, btnPrimary, btnGhost, btnDanger, inputCls } from "../../components/HOD/HodModal"

const PERIODS = [
  { days: 30,  label: "30 days" },
  { days: 90,  label: "90 days" },
  { days: 180, label: "6 months" },
  { days: 365, label: "1 year" },
]
const IMPACT_COLOR = { High: "#ef4444", Medium: "#f59e0b", Low: "#22c55e" }
const btnDangerSolid = "bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg px-4 py-2 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"

const fmtDate = (d) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
const plural = (n, one, many) => (n === 1 ? one : many)
const todayKey = () => new Date().toISOString().slice(0, 10)

/* trend of a PROBLEM: going up is bad (red), going down is good (green) */
function Trend({ t }) {
  if (!t || !t.direction) return <span className="text-neutral-500">No reports</span>
  if (t.direction === "new")  return <span className="text-amber-400">New this period</span>
  if (t.direction === "flat") return <span className="text-neutral-300">No change from previous period</span>
  const up = t.direction === "up"
  return <span className={up ? "text-red-400" : "text-green-400"}>{up ? "↑" : "↓"} {t.pct}% from previous period</span>
}

function Chip({ color, children }) {
  return (
    <span className="text-[11px] px-2.5 py-1 rounded-full font-medium whitespace-nowrap" style={{ background: color + "22", color }}>
      {children}
    </span>
  )
}

function Dot({ color }) {
  return <span className="inline-block w-2 h-2 rounded-full mr-2 align-middle" style={{ background: color }} />
}

/* ───────────── "Did this improve?" for one improvement action ───────────── */
function Verdict({ result }) {
  if (result.state === "in-progress") {
    return <p className="text-xs text-neutral-400">Reports on this issue since you started: <b className="text-white">{result.reportsSinceStart}</b></p>
  }
  if (result.state === "measuring") {
    return (
      <p className="text-xs text-neutral-400">
        <Dot color="#f59e0b" />Measuring — {result.daysNeeded} more {plural(result.daysNeeded, "day", "days")} of anonymous feedback needed before we can tell if this helped.
      </p>
    )
  }
  if (result.state === "insufficient") {
    return (
      <p className="text-xs text-neutral-400">
        <Dot color="#6b7280" />Only {result.before} {plural(result.before, "report", "reports")} before the change — too few to compare reliably.
      </p>
    )
  }
  const meta = {
    improved:    { color: "#22c55e", text: `Issue frequency decreased by ${Math.abs(result.changePct)}%. The intervention appears to have improved the workflow.` },
    "no-change": { color: "#f59e0b", text: `No clear change in issue frequency (${result.changePct > 0 ? "+" : ""}${result.changePct}%).` },
    worse:       { color: "#ef4444", text: `Issue frequency increased by ${result.changePct}%. Consider a follow-up action.` },
  }[result.state]
  return (
    <div>
      <div className="flex gap-6 text-xs text-neutral-300 mb-2">
        <span>Before intervention: <b className="text-white">{result.before} {plural(result.before, "report", "reports")}</b></span>
        <span>After: <b className="text-white">{result.after} {plural(result.after, "report", "reports")}</b></span>
        <span className="text-neutral-500">({result.windowDays}-day windows)</span>
      </div>
      <p className="text-xs text-neutral-200"><Dot color={meta.color} />{meta.text}</p>
    </div>
  )
}

function ActionCard({ action, showCategory, onResolve, onDelete }) {
  const inProgress = action.status === "In Progress"
  return (
    <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {showCategory && <p className="text-sm font-semibold text-white mb-1">{action.category}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <Chip color={inProgress ? "#3b82f6" : "#22c55e"}>{action.status}</Chip>
            <span className="text-[11px] text-neutral-500">
              Started {fmtDate(action.startedAt)}
              {action.resolvedAt && ` · Resolved ${fmtDate(action.resolvedAt)}`}
              {inProgress && action.targetDate && ` · Review by ${fmtDate(action.targetDate)}`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {inProgress && (
            <button className={btnPrimary} onClick={() => onResolve(action)}><Check size={12} className="inline -mt-0.5 mr-1" />Mark as resolved</button>
          )}
          <button className={btnDanger} onClick={() => onDelete(action)} title="Remove action"><Trash2 size={13} /></button>
        </div>
      </div>

      <ul className="mt-3 space-y-1">
        {action.steps.map((s, i) => (
          <li key={i} className="text-xs text-neutral-300 flex gap-2"><span className="text-green-400">•</span><span>{s}</span></li>
        ))}
      </ul>
      {action.note && <p className="text-xs text-neutral-500 mt-2">Note: {action.note}</p>}
      {action.outcomeNote && <p className="text-xs text-neutral-500 mt-1">What changed: {action.outcomeNote}</p>}

      <div className="mt-3 pt-3 border-t border-[#2a2a2a]">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-2">Did this improve?</p>
        <Verdict result={action.result} />
      </div>
    </div>
  )
}

/* ───────────── "Start Improvement Action" form ───────────── */
function ActionForm({ cat, onBack, onSaved }) {
  const { showToast } = useAppStore()
  const [steps, setSteps]   = useState([])
  const [custom, setCustom] = useState("")
  const [note, setNote]     = useState("")
  const [target, setTarget] = useState("")
  const [busy, setBusy]     = useState(false)

  const toggle = (s) => setSteps((x) => (x.includes(s) ? x.filter((y) => y !== s) : [...x, s]))
  const valid = steps.length > 0 || custom.trim()

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.startAction({ category: cat.name, steps, customStep: custom, note, targetDate: target })
      showToast("Improvement action started — the department has been told feedback is being acted on")
      onSaved()
    } catch (err) { showToast(err.message, "error"); setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-white">{cat.suggestion?.headline}</p>
        <p className="text-xs text-neutral-400 mt-1">Choose what you will do. You can pick several, or write your own.</p>
      </div>

      <div className="space-y-2">
        {(cat.suggestion?.options || []).map((o) => (
          <label key={o} className={`flex gap-3 items-start p-3 rounded-xl border cursor-pointer transition
            ${steps.includes(o) ? "border-green-500 bg-green-500/5" : "border-[#2a2a2a] bg-[#141414] hover:border-[#3a3a3a]"}`}>
            <input type="checkbox" className="mt-0.5 accent-green-500" checked={steps.includes(o)} onChange={() => toggle(o)} />
            <span className="text-sm text-neutral-200">{o}</span>
          </label>
        ))}
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-400 mb-1.5">Your own step (optional)</label>
        <input className={inputCls} maxLength={200} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. Move leave approval to a 2-day SLA" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-1.5">Review date (optional)</label>
          <input type="date" className={inputCls} min={todayKey()} value={target} onChange={(e) => setTarget(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-1.5">Private note (optional)</label>
          <input className={inputCls} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>

      <div className="flex justify-between items-center pt-2">
        <button type="button" className={btnGhost} onClick={onBack} disabled={busy}>Back</button>
        <button className={`${btnPrimary} !px-5 !py-2 !text-sm`} disabled={!valid || busy}>{busy ? "Starting…" : "Start improvement action"}</button>
      </div>
    </form>
  )
}

function SuggestionCard({ cat, inProgress, onStart }) {
  if (!cat.suggestion) return null
  return (
    <div className="bg-green-500/5 border border-green-500/30 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <Lightbulb size={18} className="text-green-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-[11px] uppercase tracking-wider text-green-400 mb-1">Suggested action</p>
          <p className="text-sm font-semibold text-white">{cat.suggestion.headline}</p>
          <p className="text-xs text-neutral-400 mt-1">{cat.suggestion.why}</p>
          {inProgress
            ? <p className="text-xs text-blue-400 mt-3">An improvement action is already in progress for this issue.</p>
            : <button className={`${btnPrimary} mt-3 !px-4 !py-2`} onClick={onStart}>
                {cat.actions.length ? "Start another improvement action" : "Start Improvement Action"}
              </button>}
        </div>
      </div>
    </div>
  )
}

/* ───────────── detail view for one problem category ───────────── */
function CategoryDetail({ cat, days, minReports, onStart, onResolve, onDelete }) {
  const d = cat.details
  const inProgress = cat.actions.find((a) => a.status === "In Progress")

  if (!d) {
    return (
      <>
        <p className="text-sm text-neutral-400">
          Fewer than {minReports} reports in this period — concerns, trend and impact are hidden so no individual can be singled out. You can still act on this issue.
        </p>
        <SuggestionCard cat={cat} inProgress={inProgress} onStart={onStart} />
        {cat.actions.length > 0 && <ActionList cat={cat} onResolve={onResolve} onDelete={onDelete} />}
      </>
    )
  }

  const share = d.respondentShare
  const shareText = share.available
    ? <><b className="text-white">{share.label}</b> of faculty respondents</>
    : <span className="text-neutral-500">{share.reason === "few-respondents" ? "Too few respondents to show a percentage safely" : "Not available"}</span>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-neutral-500 mb-2">Reported by</p>
          <p className="text-sm text-neutral-300">{shareText}</p>
        </div>
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-neutral-500 mb-2">Trend</p>
          <p className="text-sm"><Trend t={d.trend} /></p>
        </div>
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-neutral-500 mb-2">Workflow impact</p>
          <Chip color={IMPACT_COLOR[d.impact.level]}>{d.impact.level}</Chip>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-white mb-2">Why this impact?</p>
        {d.impact.reasons.length === 0
          ? <p className="text-xs text-neutral-500">No escalating signals in this period.</p>
          : <ul className="space-y-1">{d.impact.reasons.map((r) => <li key={r} className="text-xs text-neutral-300 flex gap-2"><span className="text-green-400">•</span>{r}</li>)}</ul>}
      </div>

      <div>
        <p className="text-xs font-semibold text-white mb-2">Commonly reported concerns</p>
        {d.themes.length === 0
          ? <p className="text-xs text-neutral-500">{d.themesNote}</p>
          : (
            <ul className="space-y-1.5">
              {d.themes.map((t) => (
                <li key={t.label} className="flex items-center justify-between gap-3 text-sm text-neutral-200 bg-[#141414] border border-[#2a2a2a] rounded-lg px-3 py-2">
                  <span>{t.label}</span>
                  <span className="text-[11px] text-neutral-500 whitespace-nowrap">{t.count} {plural(t.count, "report", "reports")}</span>
                </li>
              ))}
            </ul>
          )}
        <p className="text-[11px] text-neutral-600 mt-2">Concerns are grouped automatically from anonymous reports. Individual reports are never shown.</p>
      </div>

      <SuggestionCard cat={cat} inProgress={inProgress} onStart={onStart} />

      {cat.actions.length > 0 && <ActionList cat={cat} onResolve={onResolve} onDelete={onDelete} />}
    </div>
  )
}

function ActionList({ cat, onResolve, onDelete }) {
  return (
    <div className="mt-6">
      <p className="text-xs font-semibold text-white mb-2">Improvement actions for this issue</p>
      <div className="space-y-3">
        {cat.actions.map((a) => <ActionCard key={a.id} action={a} onResolve={onResolve} onDelete={onDelete} />)}
      </div>
    </div>
  )
}

/* ───────────── confirm dialogs (resolve / delete) ───────────── */
function ResolveDialog({ action, onClose, onDone }) {
  const { showToast } = useAppStore()
  const [outcome, setOutcome] = useState("")
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true)
    try { await api.resolveAction(action.id, { outcomeNote: outcome }); showToast("Marked as resolved — measuring feedback from now on"); onDone() }
    catch (e) { showToast(e.message, "error"); setBusy(false) }
  }
  return (
    <HodModal open onClose={busy ? undefined : onClose} width={480} title="Mark this action as resolved?">
      <p className="text-sm text-neutral-300 leading-relaxed">
        WorkLens will compare anonymous feedback on <b className="text-white">{action.category}</b> before and after today
        (after at least 14 days). The department will be asked to share fresh feedback.
      </p>
      <label className="block text-xs font-medium text-neutral-400 mt-4 mb-1.5">What was changed? (optional)</label>
      <textarea rows={2} maxLength={500} className={inputCls} value={outcome} onChange={(e) => setOutcome(e.target.value)} />
      <div className="flex justify-end gap-2 mt-5">
        <button className={btnGhost} onClick={onClose} disabled={busy}>Cancel</button>
        <button className={`${btnPrimary} !px-4 !py-2`} onClick={go} disabled={busy}>{busy ? "Saving…" : "Mark as resolved"}</button>
      </div>
    </HodModal>
  )
}

function DeleteDialog({ action, onClose, onDone }) {
  const { showToast } = useAppStore()
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true)
    try { await api.deleteAction(action.id); showToast("Improvement action removed"); onDone() }
    catch (e) { showToast(e.message, "error"); setBusy(false) }
  }
  return (
    <HodModal open onClose={busy ? undefined : onClose} width={460} title="Remove this improvement action?">
      <div className="flex gap-3 items-start">
        <div className="w-9 h-9 rounded-full bg-red-500/15 text-red-400 flex items-center justify-center flex-shrink-0"><TriangleAlert size={18} /></div>
        <div className="text-sm text-neutral-300 leading-relaxed space-y-2">
          <p>The action for <b className="text-white">{action.category}</b> and its before/after comparison will be deleted.</p>
          <p>This cannot be undone.</p>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button className={btnGhost} onClick={onClose} disabled={busy}>Cancel</button>
        <button className={btnDangerSolid} onClick={go} disabled={busy}>{busy ? "Please wait…" : "Remove action"}</button>
      </div>
    </HodModal>
  )
}

/* ═══════════════════════════ page ═══════════════════════════ */

export default function WorkflowInsightsPage() {
  const [days, setDays]       = useState(90)
  const [data, setData]       = useState(null)
  const [error, setError]     = useState("")
  const [openName, setOpenName] = useState(null)   // category panel
  const [showForm, setShowForm] = useState(false)  // "start improvement action" form inside the panel
  const [dialog, setDialog]   = useState(null)     // { type: "resolve" | "delete", action }

  const load = useCallback(async () => {
    try { setError(""); setData(await api.getInsights(days)) }
    catch (e) { setError(e.message) }
  }, [days])
  useEffect(() => { load() }, [load])

  const cat = data?.categories.find((c) => c.name === openName) || null
  const closePanel = () => { setOpenName(null); setShowForm(false) }
  const onResolve = (action) => setDialog({ type: "resolve", action })
  const onDelete  = (action) => setDialog({ type: "delete", action })
  const dialogDone = () => { setDialog(null); load() }

  if (!data) {
    return error
      ? <ErrorState message={error} onRetry={load} />
      : <div className="space-y-6">{[...Array(3)].map((_, i) => <div key={i} className="h-28 rounded-2xl bg-[#1c1c1c] border border-[#2a2a2a] animate-pulse" />)}</div>
  }

  const max = Math.max(1, ...data.categories.map((c) => c.count))
  const s = data.summary

  return (
    <div className="space-y-6 text-white font-sans ">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workflow Insights</h1>
          <p className="text-sm text-neutral-400 mt-1">Anonymous faculty feedback • Aggregated to protect identity</p>
        </div>
        <div className="flex gap-1 bg-[#141414] rounded-xl p-1">
          {PERIODS.map((p) => (
            <button key={p.days} onClick={() => setDays(p.days)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${days === p.days ? "bg-green-500 text-black font-semibold" : "text-neutral-400 hover:text-white"}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl p-5">
          <p className="text-xs text-neutral-400">Total Feedback</p>
          <p className="text-3xl font-bold mt-2">{s.totalFeedback}</p>
          <p className="text-[11px] mt-2"><Trend t={s.trend} /></p>
        </div>
        <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl p-5">
          <p className="text-xs text-neutral-400">Issues Identified</p>
          <p className="text-3xl font-bold mt-2">{s.issuesIdentified}</p>
          <p className="text-[11px] text-neutral-500 mt-2">Any report can be acted on</p>
        </div>
        <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl p-5">
          <p className="text-xs text-neutral-400">Resolved Issues</p>
          <p className="text-3xl font-bold mt-2 text-green-400">{s.resolvedIssues}</p>
          <p className="text-[11px] text-neutral-500 mt-2">Marked resolved by you</p>
        </div>
      </div>

      <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl p-6">
        <h2 className="text-base font-semibold mb-4">Workflow Issues</h2>
        {data.categories.length === 0 ? (
          <EmptyState text={`No workflow feedback in the last ${PERIODS.find((p) => p.days === days).label}`}
                      sub="Feedback faculty submit in Workflow Review will appear here, aggregated." />
        ) : (
          <div className="space-y-2.5">
            {data.categories.map((c) => {
              const latest = c.actions[0]
              return (
                <button key={c.name} onClick={() => setOpenName(c.name)}
                  className="w-full text-left bg-[#141414] border border-[#2a2a2a] hover:border-[#3a3a3a] rounded-xl p-4 transition">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="text-sm font-semibold text-white">{c.name}</span>
                      {c.details && <Chip color={IMPACT_COLOR[c.details.impact.level]}>{c.details.impact.level} impact</Chip>}
                      {latest && <Chip color={latest.status === "Resolved" ? "#22c55e" : "#3b82f6"}>{latest.status === "Resolved" ? "Resolved" : "Action in progress"}</Chip>}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-lg font-bold">{c.count}</span>
                      <ChevronRight size={16} className="text-neutral-600" />
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#2a2a2a] mt-3 overflow-hidden">
                    <div className="h-full rounded-full bg-green-500" style={{ width: `${(c.count / max) * 100}%` }} />
                  </div>
                  <p className="text-[11px] mt-2 text-neutral-500">
                    {c.details ? <Trend t={c.details.trend} /> : `Fewer than ${data.privacy.minReports} reports — details hidden`}
                  </p>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl p-6">
        <h2 className="text-base font-semibold mb-1">Improvement actions</h2>
        <p className="text-xs text-neutral-500 mb-4">Did it work? WorkLens compares anonymous feedback before and after each change.</p>
        {data.actions.length === 0
          ? <p className="text-sm text-neutral-500">No improvement actions yet. Open an issue above to start one.</p>
          : <div className="space-y-3">{data.actions.map((a) => <ActionCard key={a.id} action={a} showCategory onResolve={onResolve} onDelete={onDelete} />)}</div>}
      </div>

      {/* category panel */}
      <HodModal open={!!cat} onClose={dialog ? undefined : closePanel} width={760}
        title={cat?.name} subtitle={cat ? `${cat.count} anonymous ${plural(cat.count, "report", "reports")} · last ${PERIODS.find((p) => p.days === days).label}` : ""}>
        {cat && (showForm
          ? <ActionForm cat={cat} onBack={() => setShowForm(false)} onSaved={() => { setShowForm(false); load() }} />
          : <CategoryDetail cat={cat} days={days} minReports={data.privacy.minReports} onStart={() => setShowForm(true)} onResolve={onResolve} onDelete={onDelete} />)}
      </HodModal>

      {dialog?.type === "resolve" && <ResolveDialog action={dialog.action} onClose={() => setDialog(null)} onDone={dialogDone} />}
      {dialog?.type === "delete"  && <DeleteDialog  action={dialog.action} onClose={() => setDialog(null)} onDone={dialogDone} />}
    </div>
  )
}