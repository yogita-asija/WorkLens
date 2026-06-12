import { X, Bell, CheckCheck, Trash2 } from "lucide-react"
import useAppStore from "../store/useAppStore"
import * as api from "../services/api"
import { T } from "./UI"

export default function NotifPanel({ open, onClose }) {
  const { notifications, unreadCount, markNotifRead , markAllNotifRead, user } = useAppStore()

  const handleRead = async (id) => {
    try {
      await api.markNotifRead(id)
      markNotifRead(id)
    } catch {}
  }

  const handleReadAll = async () => {
    try {
      await api.markAllNotifRead({ userId: user?._id })
      markAllNotifRead()
    } catch {}
  }


  const handleDelete = async (id, e) => {
  e.stopPropagation()

  

  try {
    await api.deleteNotification(id)

    useAppStore.setState((state) => ({
      notifications: state.notifications.filter(
        (n) => n._id !== id
      ),
      unreadCount:
        state.notifications.find(
          (n) => n._id === id && !n.read
        )
          ? Math.max(0, state.unreadCount - 1)
          : state.unreadCount,
    }))
  } catch (err) {
    console.error(err)
  }
}

  const typeColor = (t) => ({
    assignment: "#3B82F6", submission: "#22C55E", course: "#F97316",
    enrollment: "#A855F7", grade: "#EAB308", system: "#6B7280",
  }[t] || "#6B7280")

  return (
    <aside style={{
      position: "fixed", top: 0, right: 0, height: "100vh", width: 360,
      background: "#0a0a0a", borderLeft: "1px solid #262626",
      zIndex: 40, overflowY: "auto",
      transform: open ? "translateX(0)" : "translateX(100%)",
      transition: "transform 0.28s cubic-bezier(.4,0,.2,1)",
    }}>
      <div style={{ padding: "18px 20px", borderBottom: "1px solid #1f1f1f", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Bell size={15} color="#fff" />
          <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", margin: 0 }}>Notifications</p>
          {unreadCount > 0 && (
            <span style={{ background: "#ef4444", color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 10 }}>{unreadCount}</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {unreadCount > 0 && (
            <button onClick={handleReadAll} title="Mark all read" style={{ background: "#1c1c1c", border: "1px solid #333", borderRadius: 8, padding: 6, cursor: "pointer", color: "#9ca3af", display: "flex" }}>
              <CheckCheck size={14} />
            </button>
          )}
          <button onClick={onClose} style={{ background: "#1c1c1c", border: "1px solid #333", borderRadius: 8, padding: 6, cursor: "pointer", color: "#9ca3af", display: "flex" }}
          onMouseEnter={(e) => {
    e.currentTarget.style.color = "#ef4444"
    e.currentTarget.style.opacity = "1"
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.color = "#6b7280"
    e.currentTarget.style.opacity = "0.4"
  }}>
            <X size={15} />
          </button>
        </div>
      </div>

      <div>
        {notifications.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <Bell size={32} color="#333" style={{ margin: "0 auto 12px" }} />
            <p style={{ fontSize: 13, color: "#6b7280" }}>No notifications yet</p>
          </div>
        ) : (
          notifications.map(n => (
            <div
              key={n._id}
              onClick={() => !n.read && handleRead(n._id)}
              style={{
                padding: "14px 20px",
                borderBottom: "1px solid #111",
                background: n.read ? "transparent" : "#0d1a0d",
                cursor: n.read ? "default" : "pointer",
                transition: "background 0.15s",
              }}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: n.read ? "#333" : typeColor(n.type), flexShrink: 0, marginTop: 5 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
    }}
  >
    <p
      style={{
        fontSize: 12,
        fontWeight: 600,
        color: n.read ? "#9ca3af" : "#fff",
        margin: 0,
      }}
    >
      {n.title}
    </p>

    <button
  onClick={(e) => handleDelete(n._id, e)}
  onMouseEnter={(e) => {
    e.currentTarget.style.color = "#ef4444"
    e.currentTarget.style.opacity = "1"
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.color = "#6b7280"
    e.currentTarget.style.opacity = "0.4"
  }}
  style={{
    opacity: 0.4,
    transition: "all 0.2s",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "#6b7280",
    padding: "2px",
  }}
>
  <X size={14} />
</button>
  </div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: n.read ? "#9ca3af" : "#fff", margin: 0 }}>{n.title}</p>
                  <p style={{ fontSize: 11, color: "#6b7280", margin: "3px 0 0", lineHeight: 1.4 }}>{n.message}</p>
                  <p style={{ fontSize: 10, color: "#4b5563", margin: "5px 0 0" }}>
                    {new Date(n.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  )
}
