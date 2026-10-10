import useAppStore from "../../store/useAppStore"

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000"

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}/api/hod/workflow-insights${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "x-user-id": useAppStore.getState().user?._id || "",
    },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.success === false) throw new Error(json.message || `Request failed: ${res.status}`)
  return json
}

const body = (method, b) => ({ method, body: JSON.stringify(b ?? {}) })

export const getInsights   = (days)   => req(`?days=${days}`).then((r) => r.data)
export const startAction   = (b)      => req("/actions", body("POST", b)).then((r) => r.data)
export const resolveAction = (id, b)  => req(`/actions/${id}/resolve`, body("PATCH", b)).then((r) => r.data)
export const deleteAction  = (id)     => req(`/actions/${id}`, { method: "DELETE" })
