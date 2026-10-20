const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000"

// The login token is added to every /api call by authFetch.js
async function req(path, opts = {}) {
  const res = await fetch(`${BASE}/api/faculty-profile${path}`, { headers: { "Content-Type": "application/json" }, ...opts })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.success === false) throw new Error(json.message || `Request failed: ${res.status}`)
  return json.data
}

export const getMyProfile  = ()  => req("/me")                                            // { profile, complete, missing, updatedAt }
export const saveMyProfile = (b) => req("/me", { method: "PUT", body: JSON.stringify(b) })
