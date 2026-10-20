import useAppStore from "../../../store/useAppStore"

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000"

// Same convention as dutyAllocationApi.js (the login token is added to every /api call by authFetch.js).
// Errors keep the server's `code` + extra fields, so the UI can react to e.g. REPLACES_EXISTING / STALE.
async function req(path, opts = {}) {
  const res = await fetch(`${BASE}/api/hod/course-allocation${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "x-user-id": useAppStore.getState().user?._id || "",
    },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.success === false) {
    throw Object.assign(new Error(json.message || `Request failed: ${res.status}`), { code: json.code, details: json, status: res.status })
  }
  return json.data
}

const body = (method, b) => ({ method, body: JSON.stringify(b ?? {}) })
const qs = (p = {}) => {
  const s = new URLSearchParams()
  Object.entries(p).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") s.set(k, v) })
  const t = s.toString()
  return t ? `?${t}` : ""
}

export const getCourses        = ()          => req("/courses")
export const recommend         = (b)         => req("/recommendations", body("POST", b))
export const assign            = (b)         => req("/assign", body("POST", b))
export const getHistory        = (f = {})    => req(`/history${qs(f)}`)
export const cancelAllocation  = (id, reason) => req(`/history/${id}/cancel`, body("POST", { reason }))
export const getSettings       = ()          => req("/settings")
export const saveSettings      = (b)         => req("/settings", body("PUT", b))
export const getProfiles       = ()          => req("/faculty-profiles")
export const remindProfiles    = ()          => req("/faculty-profiles/remind", body("POST", {}))
export const getRequirement    = (courseId)  => req(`/courses/${courseId}/requirement`)
export const saveRequirement   = (courseId, b) => req(`/courses/${courseId}/requirement`, body("PUT", b))
