import { useEffect, useCallback } from "react"
import useAppStore from "../../store/useAppStore"
import * as api from "../services/api"

// Load notifications
export function useNotifications(userId) {
  const { setNotifications } = useAppStore()
  const reload = useCallback(async () => {
    if (!userId) return
    try {
      const data = await api.getNotifications({ userId })
      setNotifications(data.notifications || [], data.unreadCount || 0)
    } catch {}
  }, [userId, setNotifications])

  useEffect(() => {
    reload()
    // Poll every 30 seconds for new real-time notifications
    const interval = setInterval(reload, 30000)
    return () => clearInterval(interval)
  }, [reload])

  return { reload }
}
