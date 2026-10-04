import { useState } from "react"
import useAppStore from "../../store/useAppStore"
import * as hod from "../../services/HOD/hodApi"
import HodModal, { Spinner, ErrorState, EmptyState, btnPrimary, btnGhost, inputCls, useLoad } from "./HodModal"
import { SubstitutionPanel } from "./ActionPanels"
import { STATUS_META } from "./AvailabilityCard"

const COLOR = Object.fromEntries(Object.values(STATUS_META).map((m) => [m.status, m.color]))
const FILTERS = ["All", "Available", "Teaching", "On Leave", "Other Duty", "Unavailable"]

function FacultyRow({ f, onSaved }) {
  const { showToast } = useAppStore()
  const [editing, setEditing] = useState(false)
  const [status, setStatus]   = useState(f.status === "Other Duty" || f.status === "Unavailable" ? f.status : "Other Duty")
  const [note, setNote]       = useState(f.overridden ? f.note : "")
  const [busy, setBusy]       = useState(false)
  const locked = f.status === "On Leave"

  const save = async (s) => {
    setBusy(true)
    try {
      await hod.setFacultyStatus({ facultyId: f._id, status: s, note })
      showToast(s === "Available" ? `${f.name} marked available` : `${f.name} marked ${s.toLowerCase()}`)
      setEditing(false); onSaved()
    } catch (e) { showToast(e.message, "error") } finally { setBusy(false) }
  }

  return (
    <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{f.name}</p>
          <p className="text-xs text-neutral-500 mt-0.5">
            {f.note || (f.classesToday.length ? `${f.classesToday.length} class${f.classesToday.length > 1 ? "es" : ""} today` : "No classes today")}
          </p>
          {f.classesToday.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {f.classesToday.map((c, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-[#2a2a2a] text-neutral-400">{c.courseCode} · {c.time}</span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <span className="text-[11px] px-2.5 py-1 rounded-full font-medium" style={{ background: COLOR[f.status] + "22", color: COLOR[f.status] }}>{f.status}</span>
          {!locked && !editing && <button className={btnGhost} onClick={() => setEditing(true)}>Set status</button>}
        </div>
      </div>

      {editing && (
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-[#2a2a2a]">
          <select className={`${inputCls} !w-auto`} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option>Other Duty</option><option>Unavailable</option>
          </select>
          <input className={`${inputCls} flex-1 min-w-[140px]`} placeholder="Reason (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className={btnPrimary} disabled={busy} onClick={() => save(status)}>Save</button>
          {f.overridden && <button className={btnGhost} disabled={busy} onClick={() => save("Available")}>Clear</button>}
          <button className={btnGhost} onClick={() => setEditing(false)}>Cancel</button>
        </div>
      )}
    </div>
  )
}

export default function AvailabilityWorkflow({ open, onClose, initialTab = "availability", pendingSubs, onChanged }) {
  const [tab, setTab]       = useState(initialTab)
  const [filter, setFilter] = useState("All")
  // remount body on open so data is always fresh
  return (
    <HodModal open={open} onClose={onClose} width={820} title="Faculty Availability & Substitutions"
              subtitle={new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}>
      {open && <Body tab={tab} setTab={setTab} filter={filter} setFilter={setFilter} pendingSubs={pendingSubs} onChanged={onChanged} />}
    </HodModal>
  )
}

function Body({ tab, setTab, filter, setFilter, pendingSubs, onChanged }) {
  const state = useLoad(hod.getAvailability)
  const refresh = async () => { await state.reload(); onChanged?.() }
  const list = (state.data?.faculty || []).filter((f) => filter === "All" || f.status === filter)

  return (
    <>
      <div className="flex gap-1 bg-[#141414] rounded-xl p-1 mb-5 w-fit">
        {[["availability", "Availability"], ["substitutions", `Substitutions${pendingSubs ? ` (${pendingSubs})` : ""}`]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition ${tab === k ? "bg-green-500 text-black font-semibold" : "text-neutral-400 hover:text-white"}`}>{l}</button>
        ))}
      </div>

      {tab === "availability" ? (
        state.loading ? <Spinner /> : state.error ? <ErrorState message={state.error} onRetry={state.reload} /> : (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              {FILTERS.map((f) => {
                const n = f === "All" ? state.data.faculty.length : state.data.faculty.filter((x) => x.status === f).length
                const on = filter === f
                return (
                  <button key={f} onClick={() => setFilter(f)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition ${on ? "bg-white text-black border-white font-semibold" : "border-[#333] text-neutral-400 hover:text-white"}`}>
                    {f} <span className="opacity-60">{n}</span>
                  </button>
                )
              })}
            </div>
            {list.length === 0 ? <EmptyState text="No faculty in this group" /> : (
              <div className="space-y-2.5">{list.map((f) => <FacultyRow key={f._id} f={f} onSaved={refresh} />)}</div>
            )}
          </>
        )
      ) : (
        <SubstitutionPanel onChanged={onChanged} />
      )}
    </>
  )
}
