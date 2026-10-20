import { useEffect, useState } from "react"
import HodModal, { Spinner, ErrorState, btnGhost, inputCls } from "../HodModal"
import { Label, btnSolid } from "./shared"
import * as api from "../../services/courseAllocationApi"
import useAppStore from "../../../../store/useAppStore"

/** What the HOD requires for one course: topics, minimum qualification, optional hard subject match. */
export default function RequirementModal({ course, onClose, onSaved }) {
  const { showToast } = useAppStore()
  const [r, setR] = useState(null)
  const [tags, setTags] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.getRequirement(course._id).then((x) => { setR(x); setTags((x.subjectTags || []).join(", ")) }).catch((e) => setError(e.message))
  }, [course._id])

  const title = `Course requirements — ${course.courseCode}`
  if (error) return <HodModal open onClose={onClose} title={title}><ErrorState message={error} /></HodModal>
  if (!r) return <HodModal open onClose={onClose} title={title}><Spinner /></HodModal>

  const save = async () => {
    setSaving(true)
    try {
      await api.saveRequirement(course._id, { ...r, subjectTags: tags.split(/[,\n]/).map((t) => t.trim()).filter(Boolean) })
      showToast("Course requirements saved")
      onSaved?.()
      onClose()
    } catch (e) { showToast(e.message, "error"); setSaving(false) }
  }

  return (
    <HodModal open onClose={onClose} width={560} title={title} subtitle={course.courseName}>
      <Label hint="comma separated">Subject topics a teacher should know</Label>
      <input className={inputCls} placeholder="e.g. Algorithms, Graph Theory" value={tags} onChange={(e) => setTags(e.target.value)} />
      <p className="text-[11px] text-neutral-500 mt-1.5">Leave empty to use the words of the course title.</p>

      <div className="mt-4">
        <Label>Minimum qualification (mandatory check)</Label>
        <select className={inputCls} value={r.minQualification} onChange={(e) => setR({ ...r, minQualification: e.target.value })}>
          <option value="">No minimum</option>
          <option value="Diploma">Diploma or higher</option>
          <option value="Bachelors">Bachelors or higher</option>
          <option value="Masters">Masters or higher</option>
          <option value="PhD">PhD</option>
        </select>
      </div>
      <label className="flex items-start gap-2 text-xs text-neutral-300 mt-4 cursor-pointer">
        <input type="checkbox" className="mt-0.5 accent-green-500" checked={r.requireSubjectMatch} onChange={(e) => setR({ ...r, requireSubjectMatch: e.target.checked })} />
        <span>Make a subject match mandatory (faculty whose recorded expertise matches none of the topics become not eligible)</span>
      </label>

      <div className="flex justify-end gap-2 mt-6">
        <button className={btnGhost} onClick={onClose}>Cancel</button>
        <button className={btnSolid} disabled={saving} onClick={save}>{saving ? "Saving…" : "Save requirements"}</button>
      </div>
    </HodModal>
  )
}
