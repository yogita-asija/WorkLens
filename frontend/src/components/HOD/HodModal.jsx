import { useEffect, useState, useCallback } from "react"
import { X } from "lucide-react"

/* Shared modal + small form primitives for the HOD portal (same dark theme as faculty portal) */

export default function HodModal({ open, onClose, title, subtitle, width = 720, children, headerRight }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === "Escape" && onClose?.()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 backdrop-blur-sm bg-black/60" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl w-full max-h-[86vh] flex flex-col shadow-2xl animate-pop"
        style={{ maxWidth: width }}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-[#2a2a2a]">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-white">{title}</h2>
            {subtitle && <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {headerRight}
            <button onClick={onClose} className="text-neutral-500 hover:text-white transition p-1 rounded-lg hover:bg-[#2a2a2a]">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

export const btnPrimary = "bg-green-500 hover:bg-green-600 text-black text-xs font-semibold rounded-lg px-3 py-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
export const btnGhost   = "border border-[#333] text-neutral-300 hover:bg-[#252525] hover:text-white text-xs font-medium rounded-lg px-3 py-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
export const btnDanger  = "bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 text-xs font-semibold rounded-lg px-3 py-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
export const inputCls   = "w-full bg-[#141414] border border-[#333] focus:border-green-500 outline-none rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600"

export function Spinner() {
  return <div className="py-10 text-center text-sm text-neutral-500">Loading…</div>
}

export function EmptyState({ text, sub }) {
  return (
    <div className="py-10 text-center">
      <div className="mx-auto mb-3 w-10 h-10 rounded-full bg-green-500/10 text-green-400 flex items-center justify-center text-lg">✓</div>
      <p className="text-sm font-medium text-white">{text}</p>
      {sub && <p className="text-xs text-neutral-500 mt-1">{sub}</p>}
    </div>
  )
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="py-8 text-center">
      <p className="text-sm text-red-400">{message}</p>
      {onRetry && <button onClick={onRetry} className={`${btnGhost} mt-3`}>Retry</button>}
    </div>
  )
}

/* simple fetch-on-mount hook used by panels */
export function useLoad(fn) {
  const [data, setData]       = useState(null)
  const [error, setError]     = useState("")
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    try { setError(""); setData(await fn()) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { load() }, [load])
  return { data, error, loading, reload: load, setData }
}
