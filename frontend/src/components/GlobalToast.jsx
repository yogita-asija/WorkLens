import useAppStore from "../store/useAppStore"

export default function GlobalToast() {
  const { toast } = useAppStore()
  if (!toast) return null

  const colors = {
    success: { bg: "#22C55E", text: "#000" },
    error:   { bg: "#EF4444", text: "#fff" },
    info:    { bg: "#3B82F6", text: "#fff" },
    warn:    { bg: "#EAB308", text: "#000" },
  }
  const c = colors[toast.type] || colors.success

  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      background: c.bg, color: c.text,
      fontSize: 13, fontWeight: 600,
      padding: "10px 20px", borderRadius: 10,
      boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
      animation: "slideUp 0.2s ease",
      maxWidth: 340,
    }}>
      {toast.msg}
    </div>
  )
}
