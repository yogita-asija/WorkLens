import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Download, Search, ChevronDown } from "lucide-react"
import useAppStore from "../../store/useAppStore"
import * as hod from "../../services/HOD/hodApi"
import { btnPrimary, btnGhost, inputCls, Spinner, ErrorState } from "./HodModal"
import { Badge, STATUS_COLOR, TYPE_COLOR, fmtRange, fmtStamp, dayKey, fmtDay } from "./LeaveUi"

/* History: every leave in the department with filters, search, pagination and CSV export. */

const EMPTY = { status: "", type: "", facultyId: "", from: "", to: "", q: "" }

export default function LeaveHistory({ onGo }) {
  const { showToast } = useAppStore()
  const [sp] = useSearchParams()
  const [filters, setFilters] = useState({ ...EMPTY, facultyId: sp.get("faculty") || "" })     // linked from the Faculty page
  const [q, setQ] = useState("")                       // what the user is typing; copied into filters after a short pause
  const [page, setPage] = useState(1)
  const [faculty, setFaculty] = useState([])
  const [res, setRes] = useState(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    hod.getDeptFaculty().then((list) => {
      setFaculty(list)
      setFilters((f) => (f.facultyId && !list.some((x) => x._id === f.facultyId) ? { ...f, facultyId: "" } : f))   // ignore ids that aren't in this department
    }).catch(() => {})
  }, [])
  useEffect(() => {
    const t = setTimeout(() => { setFilters((f) => (f.q === q ? f : { ...f, q })); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    let alive = true
    setLoading(true)
    hod.getLeaveHistory({ ...filters, page, limit: 15 })
      .then((r) => { if (alive) { setRes(r); setError("") } })
      .catch((e) => { if (alive) setError(e.message) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [filters, page])

  const set = (k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(1) }
  const reset = () => { setFilters(EMPTY); setQ(""); setPage(1) }
  const active = Object.values(filters).some(Boolean)
  const exportCsv = async () => {
    setExporting(true)
    try { await hod.downloadLeavesCsv(filters); showToast("CSV downloaded", "success") }
    catch (e) { showToast(e.message, "error") }
    finally { setExporting(false) }
  }

  const sel = `${inputCls} !w-auto`
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input className={`${inputCls} !pl-9`} placeholder="Search name or reason…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className={sel} value={filters.status} onChange={(e) => set("status", e.target.value)}>
          <option value="">All statuses</option><option>Pending</option><option>Approved</option><option>Rejected</option>
        </select>
        <select className={sel} value={filters.type} onChange={(e) => set("type", e.target.value)}>
          <option value="">All types</option><option>Sick</option><option>Casual</option><option>Earned</option>
        </select>
        <select className={sel} value={filters.facultyId} onChange={(e) => set("facultyId", e.target.value)}>
          <option value="">All faculty</option>
          {faculty.map((f) => <option key={f._id} value={f._id}>{f.name}</option>)}
        </select>
        <input type="date" className={sel} value={filters.from} onChange={(e) => set("from", e.target.value)} title="From" />
        <input type="date" className={sel} value={filters.to} onChange={(e) => set("to", e.target.value)} title="To" />
        {active && <button className={btnGhost} onClick={reset}>Reset</button>}
        <button className={btnPrimary} disabled={exporting} onClick={exportCsv}><Download size={13} className="inline -mt-0.5 mr-1" />{exporting ? "Exporting…" : "Export CSV"}</button>
      </div>

      {error ? <ErrorState message={error} onRetry={() => set("q", filters.q)} />
        : !res ? <Spinner />
        : (
          <>
            <HistoryRows rows={res.data} loading={loading} onGo={onGo} />
            <div className="flex items-center justify-between mt-4 text-xs text-neutral-500">
              <span>{res.total} result{res.total === 1 ? "" : "s"}{active ? " (filtered)" : ""}</span>
              <div className="flex items-center gap-2">
                <button className={btnGhost} disabled={res.page <= 1} onClick={() => setPage(res.page - 1)}>Previous</button>
                <span>Page {res.page} of {res.pages}</span>
                <button className={btnGhost} disabled={res.page >= res.pages} onClick={() => setPage(res.page + 1)}>Next</button>
              </div>
            </div>
          </>
        )}
    </div>
  )
}

export function HistoryRows({ rows, loading = false, onGo, initialOpen = null }) {
  const [open, setOpen] = useState(initialOpen)
  if (!rows.length) return <div className="py-12 text-center text-sm text-neutral-500">No leave requests match these filters.</div>
  return (
    <div className={`space-y-2 ${loading ? "opacity-60" : ""}`}>
      {rows.map((l) => {
        const isOpen = open === l._id
        return (
          <div key={l._id} className="bg-[#141414] border border-[#2a2a2a] rounded-xl">
            <button className="w-full text-left px-4 py-3 flex items-center gap-4 cursor-pointer" onClick={() => setOpen(isOpen ? null : l._id)}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate">{l.facultyName}</p>
                <p className="text-xs text-neutral-400 mt-0.5">{fmtRange(l.fromDate, l.toDate)} · {l.duration} day{l.duration === 1 ? "" : "s"}</p>
              </div>
              <Badge color={TYPE_COLOR[l.type]}>{l.type}</Badge>
              <Badge color={STATUS_COLOR[l.status]}>{l.status}</Badge>
              <span className="hidden md:block text-[11px] text-neutral-500 w-28 text-right">Applied {fmtStamp(l.appliedAt)}</span>
              <ChevronDown size={14} className={`text-neutral-500 transition ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {isOpen && (
              <div className="px-4 pb-4 pt-1 border-t border-[#2a2a2a] text-xs space-y-3">
                <div><p className="text-neutral-500 mb-0.5">Reason</p><p className="text-neutral-200 text-sm">{l.reason}</p></div>
                {l.decidedAt && (
                  <div>
                    <p className="text-neutral-500 mb-0.5">{l.status} on {fmtStamp(l.decidedAt)}</p>
                    <p className="text-neutral-300">{l.adminNote ? `Note: ${l.adminNote}` : "No note was added."}</p>
                  </div>
                )}
                {l.status === "Approved" && (
                  <div>
                    <p className="text-neutral-500 mb-1">Cover arranged</p>
                    {l.substitutions.length === 0 ? <p className="text-neutral-400">No substitutes assigned.</p> : (
                      <ul className="space-y-1">
                        {l.substitutions.map((s) => (
                          <li key={s._id} className="text-neutral-300">{s.courseName} · {fmtDay(s.dateKey)}{s.time ? ` · ${s.time}` : ""} <span className="text-green-400">→ {s.substituteName}</span></li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {l.status === "Pending" && onGo && <button className={btnPrimary} onClick={() => onGo("requests")}>Review in Requests</button>}
                <p className="text-neutral-600">{dayKey(l.fromDate)} → {dayKey(l.toDate)}</p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}