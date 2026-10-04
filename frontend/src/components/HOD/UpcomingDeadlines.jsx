import { useState } from "react"
import { Plus, Check, Trash2 } from "lucide-react"
import useAppStore from "../../store/useAppStore"
import * as hod from "../../services/HOD/hodApi"
import HodModal, { btnPrimary, btnGhost, inputCls } from "./HodModal"

const TYPE_COLOR = { "question-paper": "#a855f7", "internal-marks": "#3b82f6", nba: "#06b6d4", meeting: "#22c55e", task: "#f59e0b", other: "#9ca3af" }

function AddModal({ open, onClose, onSaved }) {
  const { showToast } = useAppStore()
  const [kind, setKind]   = useState("deadline")
  const [title, setTitle] = useState("")
  const [type, setType]   = useState("other")
  const [date, setDate]   = useState("")
  const [assignee, setAssignee] = useState("")
  const [priority, setPriority] = useState("Medium")
  const [faculty, setFaculty]   = useState(null)
  const [busy, setBusy]   = useState(false)

  const pickTask = async () => {
    setKind("task")
    if (!faculty) { try { setFaculty(await hod.getDeptFaculty()) } catch (e) { showToast(e.message, "error") } }
  }
  const submit = async (e) => {
    e.preventDefault(); setBusy(true)
    try {
      if (kind === "task") await hod.createHodTask({ title, assignedToId: assignee, dueDate: date, priority })
      else await hod.createDeadline({ title, type, dueDate: date })
      showToast(kind === "task" ? "Task assigned" : "Deadline added")
      setTitle(""); setDate(""); setAssignee(""); onSaved(); onClose()
    } catch (err) { showToast(err.message, "error") } finally { setBusy(false) }
  }

  return (
    <HodModal open={open} onClose={onClose} title="Add to deadlines" width={480}>
      <form onSubmit={submit} className="space-y-3">
        <div className="flex gap-1 bg-[#141414] rounded-xl p-1">
          {[["deadline", "Department deadline"], ["task", "Faculty task"]].map(([k, l]) => (
            <button type="button" key={k} onClick={() => (k === "task" ? pickTask() : setKind(k))}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${kind === k ? "bg-green-500 text-black font-semibold" : "text-neutral-400 hover:text-white"}`}>{l}</button>
          ))}
        </div>
        <input className={inputCls} required placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        {kind === "deadline" ? (
          <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="question-paper">Question paper</option><option value="internal-marks">Internal marks</option>
            <option value="nba">NBA documentation</option><option value="meeting">Meeting</option><option value="other">Other</option>
          </select>
        ) : (
          <div className="flex gap-2">
            <select className={inputCls} required value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">Assign to…</option>
              {(faculty || []).map((f) => <option key={f._id} value={f._id}>{f.name}</option>)}
            </select>
            <select className={`${inputCls} !w-auto`} value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option>Low</option><option>Medium</option><option>High</option>
            </select>
          </div>
        )}
        <input type="date" required className={`${inputCls} [color-scheme:dark]`} value={date} onChange={(e) => setDate(e.target.value)} />
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button type="submit" className={btnPrimary} disabled={busy}>{kind === "task" ? "Assign task" : "Add deadline"}</button>
        </div>
      </form>
    </HodModal>
  )
}

export default function UpcomingDeadlines({ deadlines, onChanged }) {
  const { showToast } = useAppStore()
  const [adding, setAdding] = useState(false)
  const { items, overdueCount } = deadlines

  const done = async (it) => {
    try {
      if (it.kind === "task") await hod.updateHodTask(it.id, { status: "Completed" })
      else await hod.completeDeadline(it.id)
      showToast("Marked done"); onChanged()
    } catch (e) { showToast(e.message, "error") }
  }
  const remove = async (it) => {
    try { await hod.deleteDeadline(it.id); showToast("Deadline removed"); onChanged() }
    catch (e) { showToast(e.message, "error") }
  }

  return (
    <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Upcoming Deadlines</h2>
          {overdueCount > 0 && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-medium">{overdueCount} overdue</span>}
        </div>
        <button onClick={() => setAdding(true)} className="w-7 h-7 rounded-lg border border-[#333] text-neutral-400 hover:text-white hover:bg-[#252525] flex items-center justify-center transition" title="Add">
          <Plus size={15} />
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-neutral-500 py-6 text-center">No upcoming deadlines</p>
      ) : items.map((it) => {
        const c = it.overdue ? "#ef4444" : it.daysLeft <= 1 ? "#f59e0b" : TYPE_COLOR[it.type] || "#9ca3af"
        return (
          <div key={it.kind + it.id}
               className={`group flex items-center gap-3 py-3 px-2 -mx-2 rounded-lg border-b border-[#2a2a2a] last:border-b-0 ${it.overdue ? "bg-red-500/5" : ""}`}>
            <div className="w-1 h-9 rounded-full flex-shrink-0" style={{ background: c }} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${it.overdue ? "text-red-300" : "text-white"}`}>{it.title}</p>
              <p className="text-xs text-neutral-500 mt-0.5 truncate">
                {new Date(it.dueDate).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}{it.sub ? ` · ${it.sub}` : ""}
              </p>
            </div>
            <span className="text-[11px] px-2 py-1 rounded-full font-semibold whitespace-nowrap" style={{ background: c + "22", color: c }}>{it.label}</span>
            <div className="flex md:hidden md:group-hover:flex items-center gap-1">
              <button onClick={() => done(it)} title="Mark done" className="p-1.5 rounded-md text-neutral-500 hover:text-green-400 hover:bg-[#2a2a2a]"><Check size={14} /></button>
              {it.kind === "deadline" && <button onClick={() => remove(it)} title="Delete" className="p-1.5 rounded-md text-neutral-500 hover:text-red-400 hover:bg-[#2a2a2a]"><Trash2 size={14} /></button>}
            </div>
          </div>
        )
      })}
      <AddModal open={adding} onClose={() => setAdding(false)} onSaved={onChanged} />
    </div>
  )
}
