import { Bell, Sun, Moon } from "lucide-react"
import { useTheme } from "../ThemeContext"
import useAppStore from "../store/useAppStore"

export default function Topbar({ user }) {
  const { openProfile, openNotif, unreadCount } = useAppStore()
  const { resolvedTheme, toggleTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  const displayName = user?.name || "Dr. Sarah Chen"
  const displayDept = user?.department || "Computer Science"
  const initials    = displayName.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()

  return (
    <header className="topbar-root bg-black border-b border-neutral-800 px-6 py-4 flex justify-between items-center flex-shrink-0" style={{ transition: 'background-color 0.25s, border-color 0.25s' }}>
      <div className="relative w-[480px] max-w-full">
        {/* Search bar placeholder */}
      </div>

      <div className="flex items-center gap-5">
        <button
          onClick={toggleTheme}
          aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
          title={isDark ? "Switch to light theme" : "Switch to dark theme"}
          className="topbar-bell text-neutral-200 hover:text-white transition cursor-pointer"
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <button onClick={openNotif} className="relative cursor-pointer">
          <Bell size={20} className="topbar-bell text-neutral-200 hover:text-white transition" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-red-500 rounded-full border-2 border-black text-[9px] font-bold text-white flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        <button onClick={openProfile} className="flex items-center gap-3 hover:opacity-80 transition cursor-pointer">
          <div className="text-right">
            <p className="topbar-name text-sm font-semibold leading-tight">{displayName}</p>
            <p className="topbar-dept text-xs text-neutral-400">{displayDept}</p>
          </div>
          <div className="w-9 h-9 bg-green-500 text-black rounded-full flex items-center justify-center font-bold text-sm hover:ring-2 hover:ring-white/30 transition flex-shrink-0">
            {initials}
          </div>
        </button>
      </div>
    </header>
  )
}
