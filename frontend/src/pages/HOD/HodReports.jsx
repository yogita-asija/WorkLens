import { useCallback, useEffect, useMemo, useState } from "react"
import { RefreshCw, Printer, Download, AlertTriangle, Info, CheckCircle2, Save, ShieldCheck, ShieldAlert, ArrowLeft } from "lucide-react"
import useAppStore from "../../store/useAppStore"
import * as hod from "../../services/HOD/hodApi"
import { Card, Bar } from "../../components/HOD/LeaveUi"
import { btnPrimary, btnGhost, inputCls, Spinner, ErrorState } from "../../components/HOD/HodModal"

/* Reports: one-click department report (attendance · leave · workload · syllabus).
   All numbers are computed on the server (GET /api/hod/reports/department); this page only displays,
   prints (browser "Save as PDF") and exports CSV. */

const pad = (n) => String(n).padStart(2, "0")
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const fmt = (k) => new Date(`${k}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
const dash = (v, suffix = "") => (v === null || v === undefined ? "—" : `${v}${suffix}`)

const PRESETS = {
  "7":    { label: "Last 7 days",  range: () => { const t = new Date(); return [keyOf(addDays(t, -6)), keyOf(t)] } },
  "30":   { label: "Last 30 days", range: () => { const t = new Date(); return [keyOf(addDays(t, -29)), keyOf(t)] } },
  "month":{ label: "This month",   range: () => { const t = new Date(); return [keyOf(new Date(t.getFullYear(), t.getMonth(), 1)), keyOf(t)] } },
  "prev": { label: "Last month",   range: () => { const t = new Date(); return [keyOf(new Date(t.getFullYear(), t.getMonth() - 1, 1)), keyOf(new Date(t.getFullYear(), t.getMonth(), 0))] } },
  "sem":  { label: "Last 6 months",range: () => { const t = new Date(); return [keyOf(addDays(t, -182)), keyOf(t)] } },
}

const good = "#22c55e", warn = "#f59e0b", bad = "#ef4444", blue = "#3b82f6"
const attColor = (p, min) => (p == null ? "#6b7280" : p >= min ? good : p >= min - 10 ? warn : bad)
const sylColor = { "Completed": good, "On track": good, "Behind": warn, "Not started": bad, "No syllabus": "#6b7280" }
const bandColor = { overloaded: bad, balanced: good, capacity: blue }
const bandLabel = { overloaded: "Overloaded", balanced: "Balanced", capacity: "Has capacity" }

/* ───────── small pieces ───────── */
const Pill = ({ children, color = "#9ca3af" }) => (
  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap" style={{ background: color + "22", color }}>{children}</span>
)
const Stat = ({ label, value, sub, color }) => (
  <div className="rp-stat bg-[#141414] border border-[#2a2a2a] rounded-xl p-4">
    <p className="text-[11px] text-neutral-500 uppercase tracking-wider">{label}</p>
    <p className="text-2xl font-bold mt-1" style={color ? { color } : undefined}>{value}</p>
    {sub && <p className="text-[11px] text-neutral-500 mt-1">{sub}</p>}
  </div>
)
const Th = ({ children, right }) => <th className={`py-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 ${right ? "text-right" : "text-left"}`}>{children}</th>
const Td = ({ children, right, className = "" }) => <td className={`py-2 px-2 text-[13px] ${right ? "text-right tabular-nums" : ""} ${className}`}>{children}</td>
const Table = ({ head, children, empty }) => (
  <div className="overflow-x-auto">
    <table className="w-full border-collapse">
      <thead><tr className="border-b border-[#2a2a2a]">{head}</tr></thead>
      <tbody className="[&>tr]:border-b [&>tr]:border-[#222]">{children}</tbody>
    </table>
    {empty && <p className="py-6 text-center text-sm text-neutral-500">{empty}</p>}
  </div>
)
const Section = ({ n, title, sub, children }) => (
  <section className="rp-section space-y-3 break-inside-avoid-page">
    <div>
      <h2 className="text-lg font-semibold"><span className="text-green-500 mr-2">{n}</span>{title}</h2>
      {sub && <p className="text-xs text-neutral-500 mt-0.5">{sub}</p>}
    </div>
    {children}
  </section>
)
const Meter = ({ pct, color }) => <div className="w-24 inline-block align-middle"><Bar pct={pct ?? 0} color={color} height={5} /></div>

/* ───────── CSV ───────── */
function buildCsv(d) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`
  const out = []
  const row = (...c) => out.push(c.map(esc).join(","))
  row("Department report", d.meta.department); row("Period", `${d.meta.period.from} to ${d.meta.period.to}`); row("Generated", d.meta.generatedAt); out.push("")
  row("HIGHLIGHTS"); d.highlights.forEach((h) => row(h.section, h.text)); out.push("")
  row("ATTENDANCE (by course)"); row("Code", "Course", "Teacher", "Enrolled", "Sessions", "Present", "Late", "Absent", "Attendance %", `Students below ${d.attendance.threshold}%`)
  d.attendance.courses.forEach((c) => row(c.courseCode, c.courseName, c.teacher, c.enrolled, c.sessions, c.present, c.late, c.absent, c.percent ?? "", c.belowMin)); out.push("")
  row("ATTENDANCE (students at risk)"); row("ID", "Name", "Course", "Classes", "Attendance %")
  d.attendance.atRisk.forEach((s) => row(s.id, s.name, s.course, s.classes, s.percent)); out.push("")
  row("LEAVE (by faculty)"); row("Faculty", "Applications", "Approved days", "Pending", "Rejected")
  d.leave.faculty.forEach((f) => row(f.name, f.applications, f.approvedDays, f.pending, f.rejected)); out.push("")
  row("WORKLOAD"); row("Faculty", "Status", "Load (pts)", "% of dept avg", "Band", "Teaching h/week", "Courses", "Students", "Cover classes", "Open tasks", "Overdue tasks", "Papers due")
  d.workload.faculty.forEach((f) => row(f.name, f.status, f.load, f.ratio, bandLabel[f.band], f.teachingHours, f.courses, f.students, f.coverClasses, f.openTasks, f.overdueTasks, f.papersDue)); out.push("")
  row("SYLLABUS"); row("Code", "Course", "Teacher", "Status", "Topics done", "Topics total", "Progress %", "Modules done", "Modules")
  d.syllabus.courses.forEach((c) => row(c.courseCode, c.courseName, c.teacher, c.status, c.topicsDone, c.topics, c.progress, c.modulesDone, c.modules))
  return out.join("\n")
}
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement("a"); a.href = url; a.download = name
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
}

/* ───────── page ───────── */
export default function HodReports() {
  const [preset, setPreset] = useState("30")
  const [[from, to], setRange] = useState(PRESETS["30"].range())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const showToast = useAppStore((s) => s.showToast)

  // saved snapshots (frozen copies with a checksum – the audit trail)
  const [viewing, setViewing] = useState(null)        // set while a saved report is open
  const [saved, setSaved] = useState([])
  const [saveOpen, setSaveOpen] = useState(false)
  const [form, setForm] = useState({ title: "", note: "" })
  const [saving, setSaving] = useState(false)

  const generate = useCallback(async (f, t) => {
    setLoading(true)
    try { setData(await hod.getDepartmentReport({ from: f, to: t })); setError("") }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { if (!viewing) generate(from, to) }, [from, to, generate, viewing])

    const loadSaved = useCallback(() => hod.listReportSnapshots().then(setSaved).catch(() => {}), [])
    useEffect(() => { loadSaved() }, [loadSaved])
  
    const openSaved = async (id) => {
      setLoading(true)
      try { const r = await hod.getReportSnapshot(id); setData(r.report); setViewing({ ...r.snapshot, verified: r.verified }); setError("") }
      catch (e) { showToast(e.message, "error") }
      finally { setLoading(false) }
    }
    const saveSnapshot = async () => {
      if (!form.title.trim()) return showToast("Give the saved report a title", "error")
      setSaving(true)
      try {
        await hod.saveReportSnapshot({ title: form.title, note: form.note, from, to })
        setSaveOpen(false); setForm({ title: "", note: "" }); loadSaved(); showToast("Report saved — it can no longer be edited")
      } catch (e) { showToast(e.message, "error") }
      finally { setSaving(false) }
    }

  const pick = (k) => { setPreset(k); setRange(PRESETS[k].range()) }
  const custom = (which, v) => { setPreset("custom"); setRange(which === "from" ? [v, to] : [from, v]) }

  const A = data?.attendance, L = data?.leave, W = data?.workload, S = data?.syllabus
  const fileBase = useMemo(() => data ? `department-report-${data.meta.period.from}_to_${data.meta.period.to}` : "report", [data])

  return (
    <div className="space-y-6 text-white font-sans report-root">
      <style>{PRINT_CSS}</style>

      <div className="rp-noprint flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-sm text-neutral-400 mt-1">One-click department report — attendance, leave, workload and syllabus in a single view.</p>
        </div>
        <div className="flex flex-wrap gap-2">
        {viewing
            ? <button className={`${btnGhost} flex items-center gap-1.5`} onClick={() => setViewing(null)}><ArrowLeft size={13} />Back to live report</button>
            : <>
                <button className={`${btnGhost} flex items-center gap-1.5`} onClick={() => generate(from, to)} disabled={loading}><RefreshCw size={13} className={loading ? "animate-spin" : ""} />Regenerate</button>
                <button className={`${btnGhost} flex items-center gap-1.5`} disabled={!data} onClick={() => setSaveOpen((v) => !v)}><Save size={13} />Save snapshot</button>
              </>}
                <button className={`${btnGhost} flex items-center gap-1.5`} disabled={!data} onClick={() => download(`${fileBase}.csv`, buildCsv(data), "text/csv;charset=utf-8")}><Download size={13} />CSV</button>
          <button className={`${btnPrimary} flex items-center gap-1.5`} disabled={!data} onClick={() => window.print()}><Printer size={13} />Print / Save PDF</button>
        </div>
      </div>

      {saveOpen && !viewing && (
        <Card className="rp-noprint" title="Save this report as a snapshot">
          <p className="text-xs text-neutral-500 -mt-2 mb-3">A snapshot freezes today's numbers for {fmt(from)} – {fmt(to)}. It cannot be edited or deleted later, and carries a checksum so you can prove it was not changed.</p>
          <div className="flex flex-wrap gap-3 items-end">
            <input className={`${inputCls} !w-72`} placeholder="Title, e.g. Semester 5 – attendance review" maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <input className={`${inputCls} flex-1 min-w-[200px]`} placeholder="Note (optional)" maxLength={500} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            <button className={btnPrimary} onClick={saveSnapshot} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </Card>
      )}

      {viewing && (
        <div className={`rp-noprint flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm ${viewing.verified ? "border-green-500/40 bg-green-500/5" : "border-red-500/40 bg-red-500/10"}`}>
          {viewing.verified ? <ShieldCheck size={18} className="text-green-500 shrink-0" /> : <ShieldAlert size={18} className="text-red-400 shrink-0" />}
          <div className="min-w-0">
            <p className="font-medium">Saved report: {viewing.title}</p>
            <p className="text-[11px] text-neutral-400">
              Saved {new Date(viewing.createdAt).toLocaleString("en-GB")} by {viewing.createdBy?.name}. {viewing.verified ? "Checksum verified — numbers are exactly as saved." : "WARNING: stored numbers do not match the checksum. This report may have been altered."}
              {viewing.note ? ` Note: ${viewing.note}` : ""}
            </p>
          </div>
        </div>
      )}

      <Card className={`rp-noprint ${viewing ? "hidden" : ""}`}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-wrap gap-2">
            {Object.entries(PRESETS).map(([k, p]) => (
              <button key={k} onClick={() => pick(k)}
                className={`text-xs px-3 py-1.5 rounded-full border transition cursor-pointer ${preset === k ? "border-green-500 text-white bg-green-500/10" : "border-[#333] text-neutral-400 hover:text-white"}`}>{p.label}</button>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <input type="date" className={`${inputCls} !w-auto`} value={from} max={to} onChange={(e) => e.target.value && custom("from", e.target.value)} aria-label="From" />
            <span className="text-neutral-500 text-xs">to</span>
            <input type="date" className={`${inputCls} !w-auto`} value={to} min={from} onChange={(e) => e.target.value && custom("to", e.target.value)} aria-label="To" />
          </div>
        </div>
        <p className="text-[11px] text-neutral-500 mt-3">The period applies to attendance and leave. Workload is today's snapshot and syllabus is progress to date.</p>
      </Card>

      {error && !data ? <ErrorState message={error} onRetry={() => generate(from, to)} />
        : !data ? <Spinner />
        : (
          <div className={`space-y-8 ${loading ? "opacity-60 pointer-events-none" : ""}`}>
            {/* title block (also the print header) */}
            <div className="border-b border-[#2a2a2a] pb-4">
              <p className="text-xs uppercase tracking-widest text-green-500 font-semibold">WorkLens · Department report</p>
              <h2 className="text-2xl font-bold mt-1">{data.meta.department}</h2>
              <p className="text-sm text-neutral-400 mt-1">{fmt(data.meta.period.from)} – {fmt(data.meta.period.to)} ({data.meta.period.days} days) · {data.meta.faculty} faculty · {data.meta.courses} courses</p>
              <p className="text-[11px] text-neutral-600 mt-1">Generated {new Date(data.meta.generatedAt).toLocaleString("en-GB")} by {data.meta.generatedBy}</p>
              {viewing && <p className="text-[11px] text-neutral-500 mt-1 break-all">Saved report “{viewing.title}” · {viewing.verified ? "checksum verified" : "CHECKSUM MISMATCH"} · SHA-256 {viewing.checksum}</p>}
            </div>

            {/* at a glance */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat label="Avg attendance" value={dash(A.summary.percent, "%")} color={attColor(A.summary.percent, A.threshold)} sub={`${A.summary.studentsBelowMin} students below ${A.threshold}%`} />
              <Stat label="Leave days approved" value={L.summary.approvedDays} sub={`${L.summary.pending} pending · ${L.summary.onLeaveToday.length} on leave today`} />
              <Stat label="Dept balance score" value={dash(W.dept.balanceScore)} color={W.dept.balanceScore == null ? undefined : W.dept.balanceScore >= 80 ? good : W.dept.balanceScore >= 60 ? warn : bad} sub={`${W.dept.overloaded} overloaded · ${W.dept.withCapacity} with capacity`} />
              <Stat label="Syllabus covered" value={dash(S.summary.avgProgress, "%")} color={S.summary.avgProgress == null ? undefined : S.summary.avgProgress >= 60 ? good : warn} sub={`${S.summary.topicsDone}/${S.summary.topics} topics · ${S.summary.noSyllabus} without syllabus`} />
            </div>

            {/* highlights */}
            <Card title="Needs your attention">
              {data.highlights.length === 0
                ? <p className="flex items-center gap-2 text-sm text-neutral-400"><CheckCircle2 size={15} className="text-green-500" />Nothing flagged for this period.</p>
                : <ul className="space-y-2">{data.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-neutral-300">
                      {h.level === "warn" ? <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" /> : <Info size={14} className="text-blue-400 mt-0.5 shrink-0" />}
                      <span><Pill color="#9ca3af">{h.section}</Pill> <span className="ml-1">{h.text}</span></span>
                    </li>))}</ul>}
            </Card>

            {/* 1 attendance */}
            <Section n="1" title="Attendance" sub={`Present + late count as attended. Students under ${A.threshold}% are flagged.`}>
              <Card>
                <Table head={<><Th>Course</Th><Th>Teacher</Th><Th right>Sessions</Th><Th right>Present</Th><Th right>Late</Th><Th right>Absent</Th><Th>Attendance</Th><Th right>Below {A.threshold}%</Th></>}
                  empty={A.courses.length === 0 ? "No courses found for this department." : ""}>
                  {A.courses.map((c) => (
                    <tr key={c.courseId}>
                      <Td><span className="font-medium">{c.courseCode}</span> <span className="text-neutral-500">{c.courseName}</span></Td>
                      <Td className="text-neutral-400">{c.teacher}</Td>
                      <Td right>{c.sessions}</Td><Td right>{c.present}</Td><Td right>{c.late}</Td><Td right>{c.absent}</Td>
                      <Td>{c.sessions === 0 ? <span className="text-neutral-500 text-xs">No data</span> : <><span className="font-semibold mr-2" style={{ color: attColor(c.percent, A.threshold) }}>{c.percent}%</span><Meter pct={c.percent} color={attColor(c.percent, A.threshold)} /></>}</Td>
                      <Td right className={c.belowMin ? "text-amber-400" : "text-neutral-500"}>{c.belowMin}</Td>
                    </tr>))}
                </Table>
              </Card>
              {A.atRisk.length > 0 && (
                <Card title={`Students below ${A.threshold}% (lowest ${A.atRisk.length})`}>
                  <Table head={<><Th>Student</Th><Th>ID</Th><Th>Course</Th><Th right>Classes</Th><Th right>Attendance</Th></>}>
                    {A.atRisk.map((s, i) => (
                      <tr key={i}><Td>{s.name}</Td><Td className="text-neutral-400">{s.id || "—"}</Td><Td>{s.course}</Td><Td right>{s.classes}</Td><Td right><span style={{ color: bad }}>{s.percent}%</span></Td></tr>))}
                  </Table>
                </Card>)}
            </Section>

            {/* 2 leave */}
            <Section n="2" title="Leave" sub="Applications whose dates fall inside the period. Days are counted only within the period.">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <Stat label="Applications" value={L.summary.applications} />
                <Stat label="Approved" value={L.summary.approved} color={good} />
                <Stat label="Pending" value={L.summary.pending} color={L.summary.pending ? warn : undefined} />
                <Stat label="Rejected" value={L.summary.rejected} />
                <Stat label="Absence rate" value={dash(L.summary.absenceRate, "%")} sub="approved days ÷ working days" />
              </div>
              {Object.keys(L.summary.byType).length > 0 && (
                <p className="text-xs text-neutral-400">Approved days by type: {Object.entries(L.summary.byType).map(([t, n]) => `${t} ${n}`).join(" · ")}</p>)}
              {L.summary.onLeaveToday.length > 0 && <p className="text-xs text-neutral-400">On leave today: {L.summary.onLeaveToday.join(", ")}</p>}
              <Card>
                <Table head={<><Th>Faculty</Th><Th right>Applications</Th><Th right>Approved days</Th><Th right>Pending</Th><Th right>Rejected</Th></>} empty={L.faculty.length === 0 ? "No faculty found." : ""}>
                  {L.faculty.map((f) => (
                    <tr key={f.facultyId}><Td className="font-medium">{f.name}</Td><Td right>{f.applications}</Td><Td right>{f.approvedDays}</Td>
                      <Td right className={f.pending ? "text-amber-400" : ""}>{f.pending}</Td><Td right>{f.rejected}</Td></tr>))}
                </Table>
              </Card>
            </Section>

            {/* 3 workload */}
            <Section n="3" title="Workload" sub="Load points ≈ hours of work per week (teaching, cover, tasks, papers, duties). Same figures as the Faculty Workload page.">
              <Card>
                <Table head={<><Th>Faculty</Th><Th>Status</Th><Th>Load</Th><Th right>% of avg</Th><Th>Band</Th><Th right>Teaching h/wk</Th><Th right>Courses</Th><Th right>Cover</Th><Th right>Open tasks</Th><Th right>Papers due</Th></>}
                  empty={W.faculty.length === 0 ? "No faculty found." : ""}>
                  {W.faculty.map((f) => (
                    <tr key={f._id}>
                      <Td className="font-medium">{f.name}</Td><Td className="text-neutral-400">{f.status}</Td>
                      <Td><span className="font-semibold mr-2">{f.load}</span><Meter pct={(f.load / Math.max(1, ...W.faculty.map((x) => x.load))) * 100} color={bandColor[f.band]} /></Td>
                      <Td right>{f.ratio}%</Td><Td><Pill color={bandColor[f.band]}>{bandLabel[f.band]}</Pill></Td>
                      <Td right className={f.overNorm ? "text-amber-400" : ""}>{f.teachingHours}</Td><Td right>{f.courses}</Td><Td right>{f.coverClasses}</Td>
                      <Td right className={f.overdueTasks ? "text-red-400" : ""}>{f.openTasks}{f.overdueTasks ? ` (${f.overdueTasks} overdue)` : ""}</Td><Td right>{f.papersDue}</Td>
                    </tr>))}
                </Table>
                <p className="text-[11px] text-neutral-500 mt-3">Teaching norm: {W.teachingNorm} h/week. Average load {dash(W.dept.mean)} pts · balance score {dash(W.dept.balanceScore)}{W.dept.balanceLabel ? ` (${W.dept.balanceLabel})` : ""}.</p>
              </Card>
            </Section>

            {/* 4 syllabus */}
            <Section n="4" title="Syllabus coverage" sub="Topics marked complete by faculty, to date.">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Stat label="Courses" value={S.summary.courses} />
                <Stat label="Completed" value={S.summary.completed} color={good} />
                <Stat label="Behind / not started" value={S.summary.behind} color={S.summary.behind ? warn : undefined} />
                <Stat label="No syllabus" value={S.summary.noSyllabus} color={S.summary.noSyllabus ? "#9ca3af" : undefined} />
              </div>
              <Card>
                <Table head={<><Th>Course</Th><Th>Teacher</Th><Th>Progress</Th><Th right>Topics</Th><Th right>Modules</Th><Th>Status</Th></>} empty={S.courses.length === 0 ? "No courses found." : ""}>
                  {S.courses.map((c) => (
                    <tr key={c.courseId}>
                      <Td><span className="font-medium">{c.courseCode}</span> <span className="text-neutral-500">{c.courseName}</span></Td>
                      <Td className="text-neutral-400">{c.teacher}</Td>
                      <Td>{c.hasSyllabus ? <><span className="font-semibold mr-2">{c.progress}%</span><Meter pct={c.progress} color={sylColor[c.status]} /></> : <span className="text-neutral-500 text-xs">—</span>}</Td>
                      <Td right>{c.hasSyllabus ? `${c.topicsDone}/${c.topics}` : "—"}</Td><Td right>{c.hasSyllabus ? `${c.modulesDone}/${c.modules}` : "—"}</Td>
                      <Td><Pill color={sylColor[c.status]}>{c.status}</Pill></Td>
                    </tr>))}
                </Table>
              </Card>
            </Section>
          </div>
        )}
              <Card className="rp-noprint" title="Saved reports">
        {saved.length === 0
          ? <p className="text-sm text-neutral-500">Nothing saved yet. Use “Save snapshot” to keep a permanent, tamper-evident copy of a report.</p>
          : <div className="divide-y divide-[#2a2a2a]">{saved.map((r) => (
              <div key={r._id} className="flex flex-wrap items-center gap-3 py-2.5">
                <div className="flex-1 min-w-[200px]">
                  <p className="text-sm font-medium">{r.title}</p>
                  <p className="text-[11px] text-neutral-500">{r.period?.from} → {r.period?.to} · saved {new Date(r.createdAt).toLocaleDateString("en-GB")} by {r.createdBy?.name}{r.note ? ` · ${r.note}` : ""}</p>
                </div>
                <span className="text-[10px] text-neutral-600 font-mono">{r.checksum.slice(0, 10)}…</span>
                <button className={btnGhost} onClick={() => openSaved(r._id)}>Open</button>
              </div>))}</div>}
      </Card>
    </div>
  )
}

/* Print = "Save as PDF" from the browser dialog. Hides the app chrome and gives the report a clean white page. */
const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 12mm; }
  html, body, #root, #root > div { height: auto !important; overflow: visible !important; background: #fff !important; }
  aside, header, .rp-noprint, [class*="fixed"] { display: none !important; }
  .h-screen, .overflow-hidden, .overflow-y-auto, main { height: auto !important; max-height: none !important; overflow: visible !important; background: #fff !important; }
  .h-screen { display: block !important; }
  .flex-1.flex.flex-col { display: block !important; }
  main > div { padding: 0 !important; }
  .report-root { color: #111 !important; }
  .report-root * { color: #111 !important; border-color: #d1d5db !important; box-shadow: none !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .report-root .bg-\\[\\#1c1c1c\\], .report-root .bg-\\[\\#141414\\] { background: #fff !important; }
  .report-root .text-green-500 { color: #15803d !important; }
  .report-root .text-amber-400 { color: #b45309 !important; }
  .report-root .text-red-400 { color: #b91c1c !important; }
  aside, aside.h-screen, header, .rp-noprint { display: none !important; }
  .report-root table { font-size: 10.5px !important; }
  .report-root th, .report-root td { padding: 4px 3px !important; font-size: 10.5px !important; }
  .report-root .overflow-x-auto { overflow: visible !important; }
  .rp-section { break-inside: avoid-page; }
  table { page-break-inside: auto; } tr { page-break-inside: avoid; }
}`
