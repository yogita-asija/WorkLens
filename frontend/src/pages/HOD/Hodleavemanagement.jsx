import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Inbox, History, CalendarDays, Wallet, UserCheck, BarChart3 } from "lucide-react"
import * as hod from "../../services/HOD/hodApi"

import LeaveStats     from "../../components/HOD/LeaveStats"
import LeaveHistory   from "../../components/HOD/LeaveHistory"
import LeaveCalendar  from "../../components/HOD/LeaveCalendar"
import LeaveBalances  from "../../components/HOD/LeaveBalances"
import LeaveInsights  from "../../components/HOD/LeaveInsights"
import { Card }       from "../../components/HOD/LeaveUi"
import { LeavePanel, SubstitutionPanel } from "../../components/HOD/ActionPanels"

/* One place for everything about leave: review requests (with impact + cover), history, calendar,
   balances, substitutions and insights. The active tab lives in the URL (?tab=history) so it can be linked to. */

const TABS = [
  { key: "requests", label: "Requests",  icon: Inbox,        badge: (o) => o.counts.pending,          hint: "Review pending leave. Open the impact analysis to see uncovered classes and suggested substitutes before you decide." },
  { key: "history",  label: "History",   icon: History,      hint: "Every leave request in your department. Filter, search and export." },
  { key: "calendar", label: "Calendar",  icon: CalendarDays, hint: "See who is away on any day, including public holidays and heavily-staffed-down days." },
  { key: "balances", label: "Balances",  icon: Wallet,       hint: "Leave allocation versus days used for each faculty member." },
  { key: "cover",    label: "Cover",     icon: UserCheck,    badge: (o) => o.counts.uncoveredClasses, hint: "Classes of approved leaves that still need a substitute (next 7 days)." },
  { key: "insights", label: "Insights",  icon: BarChart3,    hint: "Leave patterns across the year." },
]

export default function HodLeaveManagement() {
  const [sp, setSp] = useSearchParams()
  const tab = TABS.some((t) => t.key === sp.get("tab")) ? sp.get("tab") : "requests"
  const go = (key) => setSp({ tab: key }, { replace: true })

  const [overview, setOverview] = useState(null)
  const [error, setError] = useState("")
  const loadOverview = useCallback(async () => {
    try { setOverview(await hod.getLeaveOverview()); setError("") }
    catch (e) { setError(e.message) }
  }, [])
  useEffect(() => {
    loadOverview()
    const t = setInterval(loadOverview, 60000)
    return () => clearInterval(t)
  }, [loadOverview])

  const active = TABS.find((t) => t.key === tab)
  return (
    <div className="space-y-6 text-white font-sans">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Leave Management</h1>
        <p className="text-sm text-neutral-400 mt-1">Review requests, arrange cover and keep track of leave across your department.</p>
      </div>

      {overview ? <LeaveStats overview={overview} onGo={go} />
        : error ? (
          <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl p-6 text-center">
            <p className="text-sm text-red-400">{error}</p>
            <button onClick={loadOverview} className="mt-3 text-xs border border-[#333] rounded-lg px-3 py-1.5 text-neutral-300 hover:bg-[#252525]">Retry</button>
          </div>
        ) : <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">{[...Array(5)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-[#1c1c1c] border border-[#2a2a2a] animate-pulse" />)}</div>}

      <div className="flex items-center gap-1 border-b border-[#2a2a2a] overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon, badge }) => {
          const n = overview && badge ? badge(overview) : 0
          return (
            <button key={key} onClick={() => go(key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition cursor-pointer ${tab === key ? "border-green-500 text-white font-semibold" : "border-transparent text-neutral-400 hover:text-white"}`}>
              <Icon size={15} />{label}
              {n > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${key === "cover" ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"}`}>{n}</span>}
            </button>
          )
        })}
      </div>

      <p className="text-xs text-neutral-500 -mt-3">{active.hint}</p>

      <Card>
        {tab === "requests" && <LeavePanel onChanged={loadOverview} />}
        {tab === "history"  && <LeaveHistory onGo={go} />}
        {tab === "calendar" && <LeaveCalendar />}
        {tab === "balances" && <LeaveBalances />}
        {tab === "cover"    && <SubstitutionPanel onChanged={loadOverview} />}
        {tab === "insights" && <LeaveInsights />}
      </Card>
    </div>
  )
}