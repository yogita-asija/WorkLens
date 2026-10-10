import useAppStore from "../../store/useAppStore"

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000"

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}/api/hod${path}`, {
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

// { a: 1, b: "", c: undefined } -> "?a=1"   (empty values are skipped)
const qs = (params = {}) => {
  const p = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") p.set(k, v) })
  const s = p.toString()
  return s ? `?${s}` : ""
}

// Dashboard
export const getHodDashboard      = ()        => req("/dashboard").then(r => r.data)

// Leaves
export const getPendingLeaves     = ()        => req("/leaves/pending").then(r => r.data)
export const reviewLeave          = (id, b)   => req(`/leaves/${id}`, body("PATCH", b))

// Leave management page
export const getLeaveOverview     = ()        => req("/leaves/overview").then(r => r.data)
export const getLeaveHistory      = (f = {})  => req(`/leaves/history${qs(f)}`)                 // full JSON: { data, total, page, pages }
export const getLeaveCalendar     = (month)   => req(`/leaves/calendar${qs({ month })}`).then(r => r.data)
export const getLeaveBalances     = (year)    => req(`/leaves/balances${qs({ year })}`).then(r => r.data)
export const getLeaveInsights     = (year)    => req(`/leaves/insights${qs({ year })}`).then(r => r.data)
export const getLeaveImpact       = (id)      => req(`/leaves/${id}/impact`).then(r => r.data)
export const approveLeaveWithCover = (id, b)  => req(`/leaves/${id}/approve-with-cover`, body("POST", b))   // full JSON: { data: { leave, assigned } }

// CSV download (can't go through req(): the response is a file, not JSON)
export async function downloadLeavesCsv(filters = {}) {
  const res = await fetch(`${BASE}/api/hod/leaves/export${qs(filters)}`, {
    headers: { "x-user-id": useAppStore.getState().user?._id || "" },
  })
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error(json.message || `Export failed: ${res.status}`)
  }
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement("a")
  a.href = url
  a.download = `leaves-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// Availability
export const getAvailability      = ()        => req("/availability").then(r => r.data)
export const setFacultyStatus     = (b)       => req("/availability/status", body("POST", b))

// Substitutions
export const getSubstitutions     = ()        => req("/substitutions").then(r => r.data)
export const assignSubstitute     = (b)       => req("/substitutions", body("POST", b))
export const removeSubstitution   = (id)      => req(`/substitutions/${id}`, { method: "DELETE" })

// Timetable conflicts
export const getConflicts         = ()        => req("/conflicts")                      // { data, rooms }
export const resolveConflict      = (b)       => req("/conflicts/resolve", body("PATCH", b))

// Faculty tasks
export const getDeptFaculty       = ()        => req("/faculty").then(r => r.data)
export const getWorkload          = ()        => req("/faculty/workload").then(r => r.data)
export const getFacultyWorkload   = (id)      => req(`/faculty/${id}/workload`).then(r => r.data)
export const getOverdueTasks      = ()        => req("/tasks/overdue").then(r => r.data)
export const createHodTask        = (b)       => req("/tasks", body("POST", b))
export const updateHodTask        = (id, b)   => req(`/tasks/${id}`, body("PATCH", b))
export const remindHodTask        = (id)      => req(`/tasks/${id}/remind`, body("POST", {}))

// Question papers
export const getPendingPapers     = ()        => req("/papers/pending").then(r => r.data)
export const reviewPaper          = (id, b)   => req(`/papers/${id}/review`, body("PATCH", b))

// Escalations
export const getOpenEscalations   = ()        => req("/escalations/open").then(r => r.data)
export const resolveEscalation    = (id, b)   => req(`/escalations/${id}/resolve`, body("PATCH", b))

// Deadlines
export const getHodDeadlines      = ()        => req("/deadlines").then(r => r.data)
export const createDeadline       = (b)       => req("/deadlines", body("POST", b))
export const completeDeadline     = (id)      => req(`/deadlines/${id}/complete`, body("PATCH", {}))
export const deleteDeadline       = (id)      => req(`/deadlines/${id}`, { method: "DELETE" })

// Reports
export const getDepartmentReport = (f = {}) => req(`/reports/department${qs(f)}`).then(r => r.data)


