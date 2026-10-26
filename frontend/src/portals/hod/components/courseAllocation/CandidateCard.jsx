import { useState } from "react"
import { ChevronDown, ChevronUp, TriangleAlert, Scale } from "lucide-react"
import { ComponentBar, EligibilityBadge, CheckIcon, Pill, scoreColor } from "./shared"
import { btnPrimary, btnGhost } from "../HodModal"

/** One ranked faculty recommendation: score, eligibility, workload, per-component breakdown and the "why". */
export default function CandidateCard({ c, comparing, compareFull, onToggleCompare, onSelect }) {
  const [open, setOpen] = useState(false)
  const blocked = c.eligibility.status === "ineligible"
  const w = c.workload
  const failing = c.eligibility.checks.filter((k) => k.status === "fail")
  const attention = c.eligibility.checks.filter((k) => k.status === "warn" || k.status === "unknown")

  return (
    <div className={`rounded-xl border p-4 transition ${blocked ? "border-[#2a2a2a] bg-[#141414] opacity-80" : comparing ? "border-green-500/60 bg-green-500/5" : "border-[#2a2a2a] bg-[#141414] hover:border-[#3a3a3a]"}`}>
      <div className="flex items-start gap-4">
        {/* rank */}
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${blocked ? "bg-[#2a2a2a] text-neutral-500" : "bg-green-500 text-black"}`}>
          {c.rank ?? "–"}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{c.name}</p>
              {c.email && <p className="text-[11px] text-neutral-500 truncate">{c.email}</p>}
              {c.alsoTeaches?.length > 0 && <p className="text-[11px] text-sky-300 mt-0.5">Already teaches {c.alsoTeaches.join(", ")} of this course — hours and clashes below include it</p>}
            </div>
            <div className="flex items-center gap-2">
              <Pill color="#9ca3af" title="Share of the score weights for which real data exists">Data {c.completeness}%</Pill>
              <EligibilityBadge status={c.eligibility.status} />
              <div className="text-right pl-2">
                <p className="text-2xl font-bold leading-none" style={{ color: scoreColor(c.score) }}>{c.score}</p>
                <p className="text-[10px] text-neutral-500 mt-0.5">out of 100</p>
              </div>
            </div>
          </div>

          <div className="h-1.5 rounded-full bg-[#2a2a2a] mt-3 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${c.score}%`, background: scoreColor(c.score) }} />
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-xs text-neutral-300">
            <span>Workload now: <b className="text-white">{w.currentHours}h</b></span>
            <span>With this course: <b className="text-white">{w.projectedHours}h</b> <span className="text-neutral-500">/ {w.maxHours}h per week{w.estimated ? " (partly estimated)" : ""}</span></span>
            <span>Courses: <b className="text-white">{w.currentCourses}</b> → <b className="text-white">{w.projectedCourses}</b> <span className="text-neutral-500">/ {w.maxCourses}</span></span>
          </div>

          {/* blockers always visible; warnings & unknowns right below */}
          {failing.length > 0 && (
            <ul className="mt-3 space-y-1">
              {failing.map((k) => (
                <li key={k.key} className="flex items-start gap-1.5 text-[11px] text-red-400"><CheckIcon status="fail" size={12} /> <span><b>{k.label}:</b> {k.detail}</span></li>
              ))}
            </ul>
          )}
          {attention.length > 0 && !blocked && (
            <ul className="mt-3 space-y-1">
              {attention.map((k) => (
                <li key={k.key} className="flex items-start gap-1.5 text-[11px] text-amber-400"><TriangleAlert size={12} className="mt-0.5 flex-shrink-0" /> <span><b>{k.label}:</b> {k.detail}</span></li>
              ))}
            </ul>
          )}

          <button onClick={() => setOpen((o) => !o)} className="mt-3 inline-flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white transition">
            {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />} {open ? "Hide" : "Show"} score breakdown, explanation & eligibility checks
          </button>

          {open && (
            <div className="mt-4 grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-3">Score breakdown</p>
                <div className="space-y-3.5">{c.components.map((k) => <ComponentBar key={k.key} c={k} />)}</div>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-3">Mandatory eligibility checks <span className="normal-case text-neutral-600">(not part of the score)</span></p>
                <ul className="space-y-2">
                  {c.eligibility.checks.map((k) => (
                    <li key={k.key} className="flex items-start gap-2 text-xs">
                      <CheckIcon status={k.status} />
                      <span className="text-neutral-300"><b className="text-white">{k.label}</b> — {k.detail}</span>
                    </li>
                  ))}
                </ul>
                {c.unknownFields.length > 0 && (
                  <p className="text-[11px] text-neutral-500 mt-4">
                    Unknown (no data on record, so not guessed): {c.unknownFields.join(" · ")}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-[#2a2a2a]">
        <button
          className={`${btnGhost} inline-flex items-center gap-1.5 ${comparing ? "!border-green-500 !text-green-400" : ""}`}
          onClick={onToggleCompare} disabled={!comparing && compareFull}
          title={!comparing && compareFull ? "Compare up to 3 candidates" : ""}
        >
          <Scale size={13} /> {comparing ? "Added to compare" : "Compare"}
        </button>
        <button className={`${btnPrimary} !px-4 !py-1.5`} disabled={blocked} onClick={onSelect}>Select</button>
      </div>
    </div>
  )
}
