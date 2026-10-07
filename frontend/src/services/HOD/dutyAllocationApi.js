import useAppStore from "../../store/useAppStore"

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000"

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}/api/hod/duty-allocation${path}`, {
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

export const previewCandidates = (b)       => req("/candidates", body("POST", b)).then((r) => r.data)
export const getDuties         = ()        => req("").then((r) => r.data)
export const createDuty        = (b)       => req("", body("POST", b)).then((r) => r.data)
export const setAssignees      = (id, ids) => req(`/${id}/assignees`, body("PUT", { facultyIds: ids })).then((r) => r.data)
export const deleteDuty        = (id)      => req(`/${id}`, { method: "DELETE" })
