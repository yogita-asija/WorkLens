export const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000"

export async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Request failed: ${res.status}`)
  }
  return res.json()
}

export const post  = (p, b) => req(p, { method: "POST",   body: JSON.stringify(b) })
export const put   = (p, b) => req(p, { method: "PUT",    body: JSON.stringify(b) })
export const patch = (p, b) => req(p, { method: "PATCH",  body: JSON.stringify(b) })
export const del   = (p)    => req(p, { method: "DELETE" })
