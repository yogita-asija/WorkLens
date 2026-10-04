import { useCallback, useEffect, useState } from "react"
import useAppStore from "../../store/useAppStore"
import * as hod from "../../services/HOD/hodApi"

import SnapshotCards        from "../../components/HOD/SnapshotCards"
import ActionRequired       from "../../components/HOD/ActionRequired"
import AvailabilityCard     from "../../components/HOD/AvailabilityCard"
import AvailabilityWorkflow from "../../components/HOD/AvailabilityWorkflow"
import UpcomingDeadlines    from "../../components/HOD/UpcomingDeadlines"
import HodModal             from "../../components/HOD/HodModal"
import { PANELS }           from "../../components/HOD/ActionPanels"

const TITLES = /^(dr|prof|mr|mrs|ms)\.?$/i

export default function HodDashboard() {
  const { user } = useAppStore()
  const [data, setData]   = useState(null)
  const [error, setError] = useState("")
  const [panel, setPanel] = useState(null)        // key of the open action panel
  const [availOpen, setAvailOpen] = useState(false)

  const load = useCallback(async () => {
    try { setData(await hod.getHodDashboard()); setError("") }
    catch (e) { setError(e.message) }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 60000)      // keep numbers fresh
    return () => clearInterval(t)
  }, [load])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
  const firstName = (user?.name || "").split(" ").find((w) => w && !TITLES.test(w)) || "HOD"
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })

  if (!data) {
    return error ? (
      <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl p-8 text-center">
        <p className="text-sm text-red-400">{error}</p>
        <button onClick={load} className="mt-4 text-xs border border-[#333] rounded-lg px-3 py-1.5 text-neutral-300 hover:bg-[#252525]">Retry</button>
      </div>
    ) : (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => <div key={i} className="h-28 rounded-2xl bg-[#1c1c1c] border border-[#2a2a2a] animate-pulse" />)}
      </div>
    )
  }

  const pendingSubs = data.actions.find((a) => a.key === "substitutions")?.count || 0
  const active = panel ? PANELS[panel] : null

  return (
    <div className="space-y-6 text-white font-sans">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting}, <span className="text-green-400">{firstName}</span>
          </h1>
          <p className="text-sm text-neutral-400 mt-1">{today}{data.department ? ` · ${data.department} Department` : ""}</p>
        </div>
        <div className="flex items-center gap-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl px-4 py-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-neutral-400">Head of Department</span>
        </div>
      </div>

      <SnapshotCards snapshot={data.snapshot} onOpenAction={setPanel} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
        <div className="xl:col-span-2">
          <ActionRequired actions={data.actions} onOpen={setPanel} />
        </div>
        <div className="space-y-5">
          <AvailabilityCard availability={data.availability} pendingSubs={pendingSubs} onOpen={() => setAvailOpen(true)} />
          <UpcomingDeadlines deadlines={data.deadlines} onChanged={load} />
        </div>
      </div>

      {/* Action Required drawer */}
      <HodModal open={!!active} onClose={() => setPanel(null)} title={active?.title} subtitle={active?.subtitle}>
        {active && <active.Component onChanged={load} />}
      </HodModal>

      {/* Availability / substitution workflow */}
      <AvailabilityWorkflow open={availOpen} onClose={() => setAvailOpen(false)} pendingSubs={pendingSubs} onChanged={load} />
    </div>
  )
}
