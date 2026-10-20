import { useEffect, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { T } from "./UI"
import { getMyProfile, saveMyProfile } from "../services/facultyProfileApi"

/**
 * Faculty academic profile (mandatory for teaching staff).
 * WorkLens reads this to rate the faculty member for course allocation — nothing here is guessed,
 * and anything left out is treated as "unknown" by the HOD's recommendations.
 */
const LEVELS = ["Diploma", "Bachelors", "Masters", "PhD", "Other"]

const inp = { background: T.inner, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 10px", color: T.txt, fontSize: 13, width: "100%", outline: "none", boxSizing: "border-box" }
const lbl = { display: "block", fontSize: 11, color: T.sub, marginBottom: 5, fontWeight: 500 }
const ghost = { background: "transparent", border: `1px solid ${T.border}`, color: T.sub, borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }

function Section({ title, required, hint, children, action }) {
  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: T.txt, margin: 0 }}>
          {title}{required && <span style={{ color: "#ef4444" }}> *</span>}
          {hint && <span style={{ fontWeight: 400, color: T.muted, fontSize: 11 }}> · {hint}</span>}
        </p>
        {action}
      </div>
      {children}
    </div>
  )
}

function Rows({ rows, setRows, blank, cols }) {
  const change = (i, k, v) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)))
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {cols.map((c) => (
            <div key={c.key} style={{ flex: c.flex || 1, minWidth: 0 }}>
              {c.options
                ? <select style={inp} value={r[c.key] ?? ""} onChange={(e) => change(i, c.key, e.target.value)}>{c.options.map((o) => <option key={o}>{o}</option>)}</select>
                : <input style={inp} type={c.type || "text"} min={c.min} placeholder={c.label} value={r[c.key] ?? ""} onChange={(e) => change(i, c.key, e.target.value)} />}
            </div>
          ))}
          <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", padding: 4 }} title="Remove"><Trash2 size={14} /></button>
        </div>
      ))}
    </div>
  )
}

export default function AcademicProfileForm({ onSaved, submitLabel = "Save academic profile" }) {
  const [state, setState] = useState({ loading: true, error: "" })
  const [quals, setQuals] = useState([])
  const [spec, setSpec] = useState("")
  const [research, setResearch] = useState("")
  const [years, setYears] = useState("")
  const [prac, setPrac] = useState([])
  const [noPrac, setNoPrac] = useState(false)
  const [hist, setHist] = useState([])
  const [noHist, setNoHist] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState({ type: "", text: "" })
  const [missing, setMissing] = useState([])

  const hydrate = (d) => {
    const p = d.profile
    setQuals(p.qualifications.map((q) => ({ ...q, year: q.year ?? "" })))
    setSpec(p.specializations.join(", ")); setResearch(p.researchAreas.join(", "))
    setYears(p.academicExperienceYears ?? "")
    setPrac(p.practicalExperience); setNoPrac(p.noPracticalExperience)
    setHist(p.teachingHistory); setNoHist(p.noPriorTeaching)
    setMissing(d.missing)
  }

  useEffect(() => {
    getMyProfile().then((d) => { hydrate(d); setState({ loading: false, error: "" }) }).catch((e) => setState({ loading: false, error: e.message }))
  }, [])

  const list = (s) => s.split(/[,\n]/).map((t) => t.trim()).filter(Boolean)

  const save = async (e) => {
    e.preventDefault()
    setSaving(true); setMsg({ type: "", text: "" })
    try {
      const d = await saveMyProfile({
        qualifications: quals, specializations: list(spec), researchAreas: list(research),
        academicExperienceYears: years === "" ? null : Number(years),
        practicalExperience: prac, noPracticalExperience: noPrac, teachingHistory: hist, noPriorTeaching: noHist,
      })
      hydrate(d)
      setMsg({ type: "ok", text: "Academic profile saved" })
      onSaved?.(d)
    } catch (err) { setMsg({ type: "err", text: err.message }) } finally { setSaving(false) }
  }

  if (state.loading) return <p style={{ color: T.muted, fontSize: 13 }}>Loading your academic profile…</p>
  if (state.error) return <p style={{ color: "#ef4444", fontSize: 13 }}>{state.error}</p>

  return (
    <form onSubmit={save}>
      {missing.length > 0 && (
        <div style={{ background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.3)", color: "#EAB308", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
          Still required: {missing.join(" · ")}
        </div>
      )}

      <Section title="Qualifications" required action={<button type="button" style={ghost} onClick={() => setQuals([...quals, { level: "Masters", field: "", institution: "", year: "" }])}><Plus size={12} /> Add</button>}>
        <Rows rows={quals} setRows={setQuals}
          cols={[{ key: "level", options: LEVELS, flex: 1 }, { key: "field", label: "Field (e.g. Computer Science)", flex: 2 }, { key: "institution", label: "Institution", flex: 2 }, { key: "year", label: "Year", type: "number", flex: 1 }]} />
        {quals.length === 0 && <p style={{ fontSize: 11, color: T.muted }}>Add at least one qualification.</p>}
      </Section>

      <Section title="Specializations" required hint="subjects you can teach, comma separated">
        <input style={inp} value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="e.g. Algorithms, Machine Learning, Databases" />
      </Section>

      <Section title="Research areas" hint="optional, comma separated">
        <input style={inp} value={research} onChange={(e) => setResearch(e.target.value)} />
      </Section>

      <Section title="Academic experience (years)" required>
        <input style={{ ...inp, maxWidth: 200 }} type="number" min="0" max="60" value={years} onChange={(e) => setYears(e.target.value)} placeholder="e.g. 8" />
      </Section>

      <Section title="Practical / industry experience" required
        action={!noPrac && <button type="button" style={ghost} onClick={() => setPrac([...prac, { title: "", domain: "", years: "" }])}><Plus size={12} /> Add</button>}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: T.sub, marginBottom: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={noPrac} onChange={(e) => setNoPrac(e.target.checked)} /> I have no practical / industry experience
        </label>
        {!noPrac && <Rows rows={prac} setRows={setPrac} cols={[{ key: "title", label: "Role / title", flex: 2 }, { key: "domain", label: "Domain (e.g. Networking)", flex: 2 }, { key: "years", label: "Years", type: "number", flex: 1 }]} />}
      </Section>

      <Section title="Courses you have taught before" required hint="outside WorkLens, or before it was used"
        action={!noHist && <button type="button" style={ghost} onClick={() => setHist([...hist, { courseCode: "", courseName: "", terms: 1, institution: "" }])}><Plus size={12} /> Add</button>}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: T.sub, marginBottom: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={noHist} onChange={(e) => setNoHist(e.target.checked)} /> I have not taught any course before
        </label>
        {!noHist && <Rows rows={hist} setRows={setHist} cols={[{ key: "courseCode", label: "Code", flex: 1 }, { key: "courseName", label: "Course name", flex: 2 }, { key: "terms", label: "Terms", type: "number", min: 1, flex: 1 }, { key: "institution", label: "Institution", flex: 2 }]} />}
        <p style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>Courses you teach through WorkLens are picked up automatically.</p>
      </Section>

      {msg.text && <p style={{ fontSize: 12, marginTop: 16, color: msg.type === "ok" ? "#22C55E" : "#ef4444" }}>{msg.text}</p>}

      <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end" }}>
        <button disabled={saving} style={{ background: "#22C55E", color: "#000", border: "none", borderRadius: 8, padding: "9px 22px", fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
          {saving ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  )
}
