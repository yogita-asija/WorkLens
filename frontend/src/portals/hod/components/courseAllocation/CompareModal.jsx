import HodModal, { btnPrimary, btnGhost } from "../HodModal"
import { EligibilityBadge, CheckIcon, scoreColor } from "./shared"

/** Side-by-side comparison of up to three candidates. The best value in each row is highlighted. */
export default function CompareModal({ candidates, onClose, onSelect, onRemove }) {
  const cols = candidates
  const best = (vals, higher = true) => {
    const known = vals.filter((v) => v !== null && v !== undefined)
    if (known.length < 2) return null
    return higher ? Math.max(...known) : Math.min(...known)
  }

  const Row = ({ label, children, sub }) => (
    <tr className="border-t border-[#2a2a2a] align-top">
      <th className="text-left text-xs font-medium text-neutral-400 py-3 pr-4 w-48">{label}{sub && <span className="block text-[10px] text-neutral-600 font-normal">{sub}</span>}</th>
      {children}
    </tr>
  )

  const scoreBest = best(cols.map((c) => c.score))
  const hoursBest = best(cols.map((c) => c.workload.projectedHours), false)

  return (
    <HodModal open onClose={onClose} width={980} title="Compare candidates" subtitle="Scores, eligibility, workload and warnings side by side">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr>
              <th />
              {cols.map((c) => (
                <th key={c.facultyId} className="text-left px-3 pb-3">
                  <p className="text-sm font-semibold text-white">{c.name}</p>
                  <p className="text-[11px] text-neutral-500 font-normal">{c.rank ? `Rank #${c.rank}` : "Not ranked"}</p>
                  <button onClick={() => onRemove(c.facultyId)} className="text-[11px] text-neutral-500 hover:text-red-400 mt-1">Remove</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Row label="Overall score">
              {cols.map((c) => (
                <td key={c.facultyId} className="px-3 py-3">
                  <span className={`text-xl font-bold ${c.score === scoreBest ? "underline decoration-green-500 underline-offset-4" : ""}`} style={{ color: scoreColor(c.score) }}>{c.score}</span>
                  <span className="text-[11px] text-neutral-500"> · data {c.completeness}%</span>
                </td>
              ))}
            </Row>
            <Row label="Eligibility">
              {cols.map((c) => <td key={c.facultyId} className="px-3 py-3"><EligibilityBadge status={c.eligibility.status} /></td>)}
            </Row>

            {cols[0].components.map((comp, i) => {
              const vals = cols.map((c) => c.components[i].raw)
              const top = best(vals)
              return (
                <Row key={comp.key} label={comp.label} sub={`weight ${comp.weight}%`}>
                  {cols.map((c) => {
                    const k = c.components[i]
                    return (
                      <td key={c.facultyId} className="px-3 py-3">
                        {k.known
                          ? <p className={`text-sm font-semibold ${k.raw === top ? "text-green-400" : "text-white"}`}>{k.raw}<span className="text-[11px] text-neutral-500 font-normal"> /100</span></p>
                          : <p className="text-sm font-medium text-amber-400">Unknown</p>}
                        <p className="text-[11px] text-neutral-500 leading-snug mt-1">{k.detail}</p>
                      </td>
                    )
                  })}
                </Row>
              )
            })}

            <Row label="Weekly teaching hours" sub="now → with this course">
              {cols.map((c) => (
                <td key={c.facultyId} className="px-3 py-3 text-xs text-neutral-300">
                  {c.workload.currentHours}h → <b className={c.workload.projectedHours === hoursBest ? "text-green-400" : "text-white"}>{c.workload.projectedHours}h</b> <span className="text-neutral-500">/ {c.workload.maxHours}h{c.workload.estimated ? " (est.)" : ""}</span>
                </td>
              ))}
            </Row>
            <Row label="Concurrent courses" sub="now → with this course">
              {cols.map((c) => <td key={c.facultyId} className="px-3 py-3 text-xs text-neutral-300">{c.workload.currentCourses} → <b className="text-white">{c.workload.projectedCourses}</b> <span className="text-neutral-500">/ {c.workload.maxCourses}</span></td>)}
            </Row>

            <Row label="Constraints & warnings">
              {cols.map((c) => (
                <td key={c.facultyId} className="px-3 py-3">
                  <ul className="space-y-1.5">
                    {c.eligibility.checks.filter((k) => k.status !== "pass" && k.status !== "na").map((k) => (
                      <li key={k.key} className="flex items-start gap-1.5 text-[11px] text-neutral-300"><CheckIcon status={k.status} size={12} /> <span><b>{k.label}:</b> {k.detail}</span></li>
                    ))}
                    {c.eligibility.checks.every((k) => k.status === "pass" || k.status === "na") && <li className="text-[11px] text-green-400">All checks passed</li>}
                  </ul>
                </td>
              ))}
            </Row>

            <Row label="">
              {cols.map((c) => (
                <td key={c.facultyId} className="px-3 py-3">
                  <button className={`${btnPrimary} !px-4 !py-1.5`} disabled={c.eligibility.status === "ineligible"} onClick={() => onSelect(c)}>Select {c.name.split(" ").slice(-1)[0]}</button>
                </td>
              ))}
            </Row>
          </tbody>
        </table>
      </div>
      <div className="flex justify-end mt-4"><button className={btnGhost} onClick={onClose}>Close</button></div>
    </HodModal>
  )
}
