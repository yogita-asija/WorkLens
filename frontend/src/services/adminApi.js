// Admin API Service — follows same pattern as src/services/api.js
// Add this file at: src/services/adminApi.js

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000"

// Read admin ID from localStorage (set at login)
const getAdminId = () => {
  try {
    const u = JSON.parse(localStorage.getItem("worklens_user"))
    return u?._id || ""
  } catch { return "" }
}

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      "x-admin-id": getAdminId(),
    },
    ...opts,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Request failed: ${res.status}`)
  }
  return res.json()
}

const post  = (p, b) => req(p, { method: "POST",   body: JSON.stringify(b) })
const put   = (p, b) => req(p, { method: "PUT",    body: JSON.stringify(b) })
const patch = (p, b) => req(p, { method: "PATCH",  body: JSON.stringify(b) })
const del   = (p)    => req(p, { method: "DELETE" })

// ── Admin Dashboard ───────────────────────────────────────────────────────────
export const getAdminStats          = ()         => req("/api/admin/dashboard/stats")
export const getAdminCharts         = ()         => req("/api/admin/dashboard/charts")
export const getAdminRecentActivity = ()         => req("/api/admin/dashboard/recent-activity")

// ── Teacher Management ────────────────────────────────────────────────────────
export const getAdminTeachers       = (p={})     => req(`/api/admin/teachers?${new URLSearchParams(p)}`)
export const getAdminTeacherById    = (id)       => req(`/api/admin/teachers/${id}`)
export const createAdminTeacher     = (b)        => post("/api/admin/teachers", b)
export const updateAdminTeacher     = (id, b)    => put(`/api/admin/teachers/${id}`, b)
export const deleteAdminTeacher     = (id)       => del(`/api/admin/teachers/${id}`)
export const resetTeacherPassword   = (id, b)    => patch(`/api/admin/teachers/${id}/reset-password`, b)
export const assignTeacherDept      = (id, b)    => patch(`/api/admin/teachers/${id}/assign-department`, b)

// ── Department Management ─────────────────────────────────────────────────────
export const getAdminDepartments    = (p={})     => req(`/api/admin/departments?${new URLSearchParams(p)}`)
export const getAdminDepartmentById = (id)       => req(`/api/admin/departments/${id}`)
export const createAdminDepartment  = (b)        => post("/api/admin/departments", b)
export const updateAdminDepartment  = (id, b)    => put(`/api/admin/departments/${id}`, b)
export const deleteAdminDepartment  = (id)       => del(`/api/admin/departments/${id}`)
export const assignDeptHOD          = (id, b)    => patch(`/api/admin/departments/${id}/hod`, b)

// ── Course Management ─────────────────────────────────────────────────────────
export const getAdminCourses        = (p={})     => req(`/api/admin/courses?${new URLSearchParams(p)}`)
export const getAdminCourseStats    = ()         => req("/api/admin/courses/stats")
export const createAdminCourse      = (b)        => post("/api/admin/courses", b)
export const updateAdminCourse      = (id, b)    => put(`/api/admin/courses/${id}`, b)
export const deleteAdminCourse      = (id)       => del(`/api/admin/courses/${id}`)
export const assignCourseTeacher    = (id, b)    => patch(`/api/admin/courses/${id}/assign-teacher`, b)

// ── Leave Management ──────────────────────────────────────────────────────────
export const getAdminLeaves         = (p={})     => req(`/api/admin/leaves?${new URLSearchParams(p)}`)
export const getAdminLeaveSummary   = ()         => req("/api/admin/leaves/summary")
export const adminUpdateLeaveStatus = (id, b)    => patch(`/api/admin/leaves/${id}/status`, b)

// ── Communications ────────────────────────────────────────────────────────────
export const sendAdminNotification  = (b)        => post("/api/admin/communications/send", b)
export const getCommHistory         = (p={})     => req(`/api/admin/communications/history?${new URLSearchParams(p)}`)
export const getCommRecipients      = (p={})     => req(`/api/admin/communications/recipients?${new URLSearchParams(p)}`)

// ── Reports ───────────────────────────────────────────────────────────────────
export const getAttendanceReport    = (p={})     => req(`/api/admin/reports/attendance?${new URLSearchParams(p)}`)
export const getLeaveReport         = (p={})     => req(`/api/admin/reports/leaves?${new URLSearchParams(p)}`)
export const getTeacherPerfReport   = ()         => req("/api/admin/reports/teacher-performance")

// ── System Settings ───────────────────────────────────────────────────────────
export const getAdminSettings       = ()         => req("/api/admin/settings")
export const updateAdminSettings    = (b)        => put("/api/admin/settings", b)

// ── Audit Logs ────────────────────────────────────────────────────────────────
export const getAuditLogs           = (p={})     => req(`/api/admin/audit-logs?${new URLSearchParams(p)}`)
