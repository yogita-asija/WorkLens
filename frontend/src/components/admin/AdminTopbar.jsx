import { Bell, Shield } from "lucide-react"
import useAppStore from "../../store/useAppStore"

export default function AdminTopbar({ user }) {
  const { openNotif, unreadCount } = useAppStore()

  const displayName = user?.name || "Admin"
  const initials    = displayName.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()

  return (
    <header className="bg-black border-b border-neutral-800 px-6 py-4 flex justify-between items-center flex-shrink-0">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded bg-green-500/20 flex items-center justify-center">
          <Shield size={11} className="text-green-400" />
        </div>
        <span className="text-xs text-neutral-500 font-medium tracking-wide uppercase">Admin Panel</span>
      </div>

      <div className="flex items-center gap-5">
        <button onClick={openNotif} className="relative cursor-pointer">
          <Bell size={20} className="text-neutral-200 hover:text-white transition" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-red-500 rounded-full border-2 border-black text-[9px] font-bold text-white flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-semibold leading-tight">{displayName}</p>
            <p className="text-xs text-neutral-400">{user?.department || "Admin"}</p>
          </div>
          <div className="w-9 h-9 bg-green-500 text-black rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
            {initials}
          </div>
        </div>
      </div>
    </header>
  )
}
