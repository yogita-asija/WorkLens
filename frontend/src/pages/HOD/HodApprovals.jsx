import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { CheckCircle2 } from "lucide-react"
import * as hod from "../../services/HOD/hodApi"
import { PANELS } from "../../components/HOD/ActionPanels"
import { META } from "../../components/HOD/ActionRequired"
import { Card } from "../../components/HOD/LeaveUi"
import { Spinner, ErrorState } from "../../components/HOD/HodModal"

/* Approvals: everything waiting for the HOD's decision, in one inbox.
   It reuses the dashboard's six action panels as tabs and its action counts, so there is nothing new to keep in sync. */

const ORDER = ["leaves", "substitutions", "papers", "escalations", "tasks", "conflicts"]       // decisions first, follow-ups after
const SHORT = { leaves: "Leave", substitutions: "Substitutions", papers: "Papers", escalations: "Escalations", tasks: "Overdue tasks", conflicts: "Conflicts" }

export function ApprovalsSummary({ actions }) {
  const total = actions.reduce((n, a) => n + a.count, 0)
  const urgent = actions.filter((a) => a.urgent && a.count > 0).length
  if (total === 0) {
    return (
      <div className="flex items-center gap-3 bg-green-500/5 border border-green-500/20 rounded-2xl px-5 py-4">
        <CheckCircle2 className="text-green-400" size={22} />
        <div><p className="text-sm font-semibold text-white">You're all caught up</p><p className="text-xs text-neutral-400">Nothing is waiting for your decision right now.</p></div>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-4 bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl px-5 py-4">
      <p className="text-3xl font-bold text-white">{total}</p>
      <div>
        <p className="text-sm font-semibold text-white">item{total === 1 ? "" : "s"} waiting for you</p>
        <p className={`text-xs ${urgent ? "text-amber-400" : "text-neutral-400"}`}>{urgent ? `${urgent} categor${urgent === 1 ? "y is" : "ies are"} urgent` : "Nothing is urgent"}</p>
      </div>
    </div>
  )
}

export function ApprovalTabs({ actions, tab, onTab }) {
  const byKey = Object.fromEntries(actions.map((a) => [a.key, a]))
  return (
    <div className="flex items-center gap-1 border-b border-[#2a2a2a] overflow-x-auto">
      {ORDER.filter((k) => byKey[k]).map((k) => {
        const { Icon, accent } = META[k]
        const a = byKey[k]
        return (
          <button key={k} onClick={() => onTab(k)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition cursor-pointer ${tab === k ? "border-green-500 text-white font-semibold" : "border-transparent text-neutral-400 hover:text-white"}`}>
            <Icon size={15} style={{ color: a.count ? accent : undefined }} />{SHORT[k]}
            {a.count > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: (a.urgent ? "#ef4444" : accent) + "22", color: a.urgent ? "#f87171" : accent }}>{a.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

export default function HodApprovals() {
  const [sp, setSp] = useSearchParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState("")
  const [tab, setTab] = useState(() => (ORDER.includes(sp.get("tab")) ? sp.get("tab") : null))

  const refresh = useCallback(async () => {
    try { setData(await hod.getHodDashboard()); setError("") }
    catch (e) { setError(e.message) }
  }, [])
  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 60000)
    return () => clearInterval(t)
  }, [refresh])

  // first visit: open the first category that has work; after that only the user changes tabs
  useEffect(() => {
    if (data && !tab) setTab(ORDER.find((k) => data.actions.find((a) => a.key === k)?.count > 0) || "leaves")
  }, [data, tab])
  const go = (k) => { setTab(k); setSp({ tab: k }, { replace: true }) }

  const panel = tab ? PANELS[tab] : null
  return (
    <div className="space-y-6 text-white font-sans">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Approvals</h1>
        <p className="text-sm text-neutral-400 mt-1">Everything waiting for your decision, in one place.</p>
      </div>

      {error && !data ? <ErrorState message={error} onRetry={refresh} />
        : !data ? <Spinner />
        : (
          <>
            <ApprovalsSummary actions={data.actions} />
            <ApprovalTabs actions={data.actions} tab={tab} onTab={go} />
            {panel && (
              <>
                <p className="text-xs text-neutral-500 -mt-3">{panel.subtitle}</p>
                <Card><panel.Component key={tab} onChanged={refresh} showManageLink={tab === "leaves"} /></Card>
              </>
            )}
          </>
        )}
    </div>
  )
}