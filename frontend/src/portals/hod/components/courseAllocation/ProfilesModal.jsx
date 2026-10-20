import { useEffect, useState } from "react"
import { ChevronDown, ChevronUp, Bell } from "lucide-react"
import HodModal, { Spinner, ErrorState, btnGhost, btnPrimary } from "../HodModal"
import { Pill, fmtDateTime } from "./shared"
import * as api from "../../services/courseAllocationApi"
import useAppStore from "../../../../store/useAppStore"

function Detail({ p }) {
  const line = (label, value) => (
    <p className="text-xs text-neutral-300"><span className="text-neutral-500">{label}: </span>{value}</p>
  )
  return (
    <div className="mt-3 space-y-1.5">
      {line("Qualifications", p.qualifications.length ? p.qualifications.map((q) => `${q.level} in ${q.field}${q.institution ? `, ${q.institution}` : ""}${q.year ? ` (${q.year})` : ""}`).join(" · ") : "not entered")}
      {line("Specializations", p.specializations.join(", ") || "not entered")}
      {line("Research areas", p.researchAreas.join(", ") || "—")}
      {line("Academic experience", p.academicExperienceYears === null ? "not entered" : `${p.academicExperienceYears} years`)}
      {line("Practical experience", p.noPracticalExperience ? "none (declared)" : p.practicalExperience.length ? p.practicalExperience.map((x) => `${x.title || x.domain}${x.title && x.domain ? ` – ${x.domain}` : ""} (${x.years}y)`).join(" · ") : "not entered")}
      {line("Courses taught before", p.noPriorTeaching ? "none (declared)" : p.teachingHistory.length ? p.teachingHistory.map((h) => `${h.courseCode || h.courseName}${h.courseCode && h.courseName ? ` ${h.courseName}` : ""} ×${h.terms}`).join(" · ") : "not entered")}
    </div>
  )
}

/** Read-only: what each faculty member entered in Settings → Academic Profile. The HOD cannot edit it. */
export default function ProfilesModal({ onClose }) {
  const { showToast } = useAppStore()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState("")
  const [open, setOpen] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = () => api.getProfiles().then(setRows).catch((e) => setError(e.message))
  useEffect(() => { load() }, [])

  const incomplete = (rows || []).filter((r) => !r.complete)
  const remind = async () => {
    setBusy(true)
    try { const r = await api.remindProfiles(); showToast(`Reminder sent to ${r.reminded} faculty`) }
    catch (e) { showToast(e.message, "error") } finally { setBusy(false) }
  }

  return (
    <HodModal open onClose={onClose} width={820} title="Faculty profiles"
      subtitle="Entered by each faculty member in Settings and used automatically to rate them for allocation"
      headerRight={incomplete.length > 0 && <button className={`${btnGhost} inline-flex items-center gap-1.5`} disabled={busy} onClick={remind}><Bell size={13} /> Remind {incomplete.length} incomplete</button>}>
      {error ? <ErrorState message={error} /> : !rows ? <Spinner /> : rows.length === 0 ? <p className="text-sm text-neutral-500">No teaching faculty in your department.</p> : (
        <div className="divide-y divide-[#2a2a2a]">
          {rows.map((r) => (
            <div key={r.facultyId} className="py-3">
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{r.name}</p>
                  <p className="text-[11px] text-neutral-500">
                    {r.complete ? `Completed${r.updatedAt ? ` · updated ${fmtDateTime(r.updatedAt)}` : ""}` : `Missing: ${r.missing.join(", ")}`}
                  </p>
                </div>
                <Pill color={r.complete ? "#22c55e" : "#f59e0b"}>{r.complete ? "Complete" : `${r.completeness}% complete`}</Pill>
                {r.profile && (
                  <button className="text-neutral-400 hover:text-white" onClick={() => setOpen(open === r.facultyId ? null : r.facultyId)} title="View details">
                    {open === r.facultyId ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                )}
              </div>
              {open === r.facultyId && r.profile && <Detail p={r.profile} />}
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-end mt-5"><button className={btnPrimary} onClick={onClose}>Close</button></div>
    </HodModal>
  )
}
