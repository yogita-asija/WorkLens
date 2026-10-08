/* Shared pieces for the HOD "Faculty" page (workload + fairness) */

// the five parts of the load index, in the order they are stacked
export const PARTS = [
    { key: "teaching", label: "Teaching",   color: "#3b82f6" },
    { key: "cover",    label: "Cover",      color: "#a855f7" },
    { key: "tasks",    label: "Tasks",      color: "#f59e0b" },
    { key: "papers",   label: "Papers",     color: "#ec4899" },
    { key: "duty",     label: "Other duty", color: "#14b8a6" },
  ]
  export const BAND = {
    overloaded: { label: "Overloaded",   color: "#ef4444" },
    balanced:   { label: "Balanced",     color: "#22c55e" },
    capacity:   { label: "Has capacity", color: "#3b82f6" },
  }
  export const FACULTY_STATUS_COLOR = { Available: "#22c55e", Teaching: "#3b82f6", "On Leave": "#f59e0b", "Other Duty": "#a855f7", Unavailable: "#ef4444" }
  
  export const initials = (name = "") => name.split(" ").filter((w) => w && !/^(dr|prof|mr|mrs|ms)\.?$/i.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?"
  
  export const Avatar = ({ name }) => (
    <span className="w-9 h-9 rounded-full bg-[#262626] border border-[#333] flex items-center justify-center text-xs font-semibold text-neutral-200 flex-shrink-0">{initials(name)}</span>
  )
  
  /* One stacked bar per person. `max` is the heaviest load in the department, so every bar is comparable. */
  export function StackedBar({ components, max, height = 10 }) {
    const scale = max > 0 ? max : 1
    return (
      <div className="flex rounded-full bg-[#262626] overflow-hidden w-full" style={{ height }}>
        {PARTS.map((p) => {
          const v = components[p.key] || 0
          return v > 0 ? <div key={p.key} title={`${p.label}: ${v}`} style={{ width: `${(v / scale) * 100}%`, background: p.color }} /> : null
        })}
      </div>
    )
  }
  
  export const Legend = () => (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-neutral-500">
      {PARTS.map((p) => <span key={p.key} className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm" style={{ background: p.color }} />{p.label}</span>)}
    </div>
  )