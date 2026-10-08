import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Search, RefreshCw } from "lucide-react"
import * as hod from "../../services/HOD/hodApi"
import FacultyBalance from "../../components/HOD/FacultyBalance"
import FacultyCard from "../../components/HOD/FacultyCard"
import { Legend, BAND } from "../../components/HOD/FacultyUi"
import { Card } from "../../components/HOD/LeaveUi"
import { btnGhost, inputCls, Spinner, ErrorState } from "../../components/HOD/HodModal"

/* Faculty: who is carrying how much, and who has room. The load index and fairness maths live on the server
   (GET /api/hod/faculty/workload); this page only sorts, filters and displays it. */

const SORTS = {
  "load-desc": { label: "Most loaded first", fn: (a, b) => b.load - a.load || a.name.localeCompare(b.name) },
  "load-asc":  { label: "Most room first",   fn: (a, b) => a.load - b.load || a.name.localeCompare(b.name) },
  name:        { label: "Name (A–Z)",        fn: (a, b) => a.name.localeCompare(b.name) },
  overdue:     { label: "Most overdue work", fn: (a, b) => (b.tasks.overdue + b.papers.overdue) - (a.tasks.overdue + a.papers.overdue) || b.load - a.load },
}

export default function HodFaculty() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")
  const [band, setBand] = useState("all")
  const [sort, setSort] = useState("load-desc")
  const [open, setOpen] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await hod.getWorkload()); setError("") }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const max = useMemo(() => (data ? Math.max(1, ...data.faculty.map((f) => f.load)) : 1), [data])
  const visible = useMemo(() => {
    if (!data) return []
    const term = q.trim().toLowerCase()
    return data.faculty
      .filter((f) => (band === "all" ? true : band === "onleave" ? f.status === "On Leave" : f.band === band))
      .filter((f) => !term || f.name.toLowerCase().includes(term) || (f.email || "").toLowerCase().includes(term))
      .sort(SORTS[sort].fn)
  }, [data, q, band, sort])

  const focus = (id) => {
    setQ(""); setBand("all"); setOpen(id)
    setTimeout(() => document.getElementById(`fac-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60)
  }
  const chips = data ? [
    ["all", `All (${data.faculty.length})`],
    ["overloaded", `${BAND.overloaded.label} (${data.dept.overloaded})`],
    ["balanced", `${BAND.balanced.label} (${data.faculty.filter((f) => f.band === "balanced").length})`],
    ["capacity", `${BAND.capacity.label} (${data.dept.withCapacity})`],
    ["onleave", `On leave today (${data.faculty.filter((f) => f.status === "On Leave").length})`],
  ] : []

  return (
    <div className="space-y-6 text-white font-sans">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Faculty Workload</h1>
          <p className="text-sm text-neutral-400 mt-1">See who is carrying how much work, and who has room, before you assign the next task, class or substitute.</p>
        </div>
        <button className={`${btnGhost} flex items-center gap-1.5`} onClick={load} disabled={loading}><RefreshCw size={13} className={loading ? "animate-spin" : ""} />Refresh</button>
      </div>

      {error && !data ? <ErrorState message={error} onRetry={load} />
        : !data ? <Spinner />
        : (
          <>
            <FacultyBalance data={data} onFocus={focus} />
            <Card>
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <div className="relative flex-1 min-w-[180px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input className={`${inputCls} !pl-9`} placeholder="Search faculty…" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                <select className={`${inputCls} !w-auto`} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
                  {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex flex-wrap gap-2">
                  {chips.map(([k, label]) => (
                    <button key={k} onClick={() => setBand(k)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition cursor-pointer ${band === k ? "border-green-500 text-white bg-green-500/10" : "border-[#333] text-neutral-400 hover:text-white"}`}>{label}</button>
                  ))}
                </div>
                <Legend />
              </div>
              {visible.length === 0 ? <p className="py-10 text-center text-sm text-neutral-500">No faculty match these filters.</p> : (
                <div className="space-y-2">
                  {visible.map((f) => (
                    <FacultyCard key={f._id} f={f} max={max} open={open === f._id}
                      onToggle={() => setOpen(open === f._id ? null : f._id)}
                      onViewLeaves={(id) => navigate(`/leave-management?tab=history&faculty=${id}`)} />
                  ))}
                </div>
              )}
              <p className="text-[11px] text-neutral-600 mt-4">Bars are scaled to the most loaded person, so they can be compared side by side. Points ≈ hours of work per week.</p>
            </Card>
          </>
        )}
    </div>
  )
}