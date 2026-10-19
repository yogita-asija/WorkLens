import { req, post, put, patch, del } from "./httpClient"

// Endpoints used by more than one portal (or by shared UI). Portal-specific endpoints live in
// portals/<portal>/services/.

// Auth
export const loginUser         = (b)          => post("/api/auth/login", b)

// Settings
export const getSettings       = (uid)        => req(`/api/settings/${uid}`)
export const updateSettings    = (uid, b)     => put(`/api/settings/${uid}`, b)

// Dashboard (ProfileSidebar is rendered in every portal layout)
export const getDashboardStats   = (p={})     => req(`/api/dashboard/stats?${new URLSearchParams(p)}`)
export const getDashboardCourses = ()         => req("/api/dashboard/courses")

// Notifications
export const getNotifications     = (p={}) => req(`/api/notifications?${new URLSearchParams(p)}`)
export const createNotification   = (b)    => post("/api/notifications", b)
export const markNotifRead        = (id)   => patch(`/api/notifications/${id}/read`, {})
export const markAllNotifRead     = (b)    => patch("/api/notifications/read-all", b)
export const deleteNotification   = (id)   => del(`/api/notifications/${id}`)
