import { Bell, Search } from "lucide-react"
import useAppStore from "../store/useAppStore"

export default function Topbar({ user }) {
  const { openProfile, openNotif, unreadCount } = useAppStore()

  const displayName = user?.name || "Dr. Sarah Chen"
  const displayDept = user?.department || "Computer Science"
  const initials    = displayName.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()

  return (
    <header className="bg-black border-b border-neutral-800 px-6 py-4 flex justify-between items-center flex-shrink-0">
      <div className="relative w-[480px] max-w-full">
        {/* <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
        <input
          type="text"
          placeholder="Search courses, students, assignments..."
          className="w-full pl-9 pr-4 py-2 rounded-xl bg-neutral-900 text-white border border-neutral-800 text-sm placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/20"
        /> */}
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

        <button onClick={openProfile} className="flex items-center gap-3 hover:opacity-80 transition cursor-pointer">
          <div className="text-right">
            <p className="text-sm font-semibold leading-tight">{displayName}</p>
            <p className="text-xs text-neutral-400">{displayDept}</p>
          </div>
          <div className="w-9 h-9 bg-green-500 text-black rounded-full flex items-center justify-center font-bold text-sm hover:ring-2 hover:ring-white/30 transition flex-shrink-0">
            {initials}
          </div>
        </button>
      </div>
    </header>
  )
}
