const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000"

async function req(path, opts = {}) {
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

const post = (p, b)       => req(p, { method: "POST",   body: JSON.stringify(b) })
const put  = (p, b)       => req(p, { method: "PUT",    body: JSON.stringify(b) })
const patch= (p, b)       => req(p, { method: "PATCH",  body: JSON.stringify(b) })
const del  = (p)          => req(p, { method: "DELETE" })

// Auth
export const loginUser         = (b)          => post("/api/auth/login", b)

// Settings
export const getSettings       = (uid)        => req(`/api/settings/${uid}`)
export const updateSettings    = (uid, b)     => put(`/api/settings/${uid}`, b)

// Analytics
// export const getAnalytics      = (role)       => req(`/api/analytics?role=${role}`)

// Dashboard
export const getDashboardStats   = (p={})     => req(`/api/dashboard/stats?${new URLSearchParams(p)}`)
export const getDashboardToday   = (p={})     => req(`/api/dashboard/today?${new URLSearchParams(p)}`)
export const getWeeklyActivity   = ()         => req("/api/dashboard/weekly-activity")
export const getDashboardHours   = ()         => req("/api/dashboard/hours")
export const getRecentActivity   = ()         => req("/api/dashboard/recent-activity")
export const getDashboardCourses = ()         => req("/api/dashboard/courses")
export const getUpcomingTasks    = (p={})     => req(`/api/dashboard/upcoming-tasks?${new URLSearchParams(p)}`)

// Courses
export const getCourses          = (params = {}) => req(`/api/courses?${new URLSearchParams(params)}`)
export const getCourseById       = (id)       => req(`/api/courses/${id}`)
export const createCourse        = (b)        => post("/api/courses", b)
export const updateCourse        = (id, b)    => put(`/api/courses/${id}`, b)
export const deleteCourse        = (id)       => del(`/api/courses/${id}`)
export const enrollStudents      = (id, b)    => post(`/api/courses/${id}/enroll`, b)
export const unenrollStudent     = (id, sid)  => del(`/api/courses/${id}/enroll/${sid}`)
export const getCourseAnalytics  = (id)       => req(`/api/courses/${id}/analytics`)
export const getEnrolledStudents = (id)       => req(`/api/courses/${id}/enrolled-students`)
export const getAttendanceRoster = (cid) => {
  console.log("Fetching roster for:", cid)
  return req(`/api/attendance/roster/${cid}`)
}

// Assignments
export const getAssignments          = (p={})    => req(`/api/assignments?${new URLSearchParams(p)}`)
export const getAssignmentById       = (id)      => req(`/api/assignments/${id}`)
export const createAssignment        = (b)       => post("/api/assignments", b)
export const updateAssignment        = (id, b)   => put(`/api/assignments/${id}`, b)
export const deleteAssignment        = (id)      => del(`/api/assignments/${id}`)
export const getAssignmentsByCourse  = (cid)     => req(`/api/assignments/course/${cid}`)
export const submitAssignment        = (id, b)   => post(`/api/assignments/${id}/submit`, b)
export const gradeSubmission         = (id,sid,b)=> put(`/api/assignments/${id}/grade/${sid}`, b)
export const getAssignmentAnalytics  = ()        => req("/api/assignments/analytics")
export const getAssignmentStudentsMarks = (id)   => req(`/api/assignments/${id}/students-marks`)
export const bulkSaveMarks           = (id, b)   => put(`/api/assignments/${id}/bulk-marks`, b)

// Attendance
export const getAllAttendance      = ()                 => req("/api/attendance")
export const getAttendanceByDate  = (cid, date)        => req(`/api/attendance/${cid}/${date}`)
export const saveAttendance        = (b)               => post("/api/attendance", b)
export const deleteAttendance     = (id)               => del(`/api/attendance/${id}`)
export const getStudentHistory    = (sid)              => req(`/api/attendance/student/${sid}`)
export const exportAttendanceCSV  = (cid, date)        => `${BASE}/api/attendance/${cid}/${date}/export`

// Activity Logs
export const getActivityLogs      = (p={}) => {
  const q = new URLSearchParams()
  if (p.from) q.set("from", p.from)
  if (p.to)   q.set("to",   p.to)
  if (p.type && p.type !== "all") q.set("type", p.type)
  return req(`/api/activity-logs?${q}`)
}
export const createActivityLog    = (b)   => post("/api/activity-logs", b)
export const deleteActivityLog    = (id)  => del(`/api/activity-logs/${id}`)
export const clearAllActivityLogs = ()    => del("/api/activity-logs")

// Leaves
export const getLeaves            = (p={}) => req(`/api/leaves?${new URLSearchParams(p)}`)
export const getLeaveBalance      = ()     => req("/api/leaves/balance")
export const getMonthlyLeaves     = ()     => req("/api/leaves/monthly")
export const applyLeave           = (b)    => post("/api/leaves", b)
export const updateLeaveStatus    = (id,b) => patch(`/api/leaves/${id}/status`, b)
export const deleteLeave          = (id)   => del(`/api/leaves/${id}`)
export const getHolidays          = ()     => req("/api/leaves/holidays")

// Extra Duties
export const getExtraDuties       = ()     => req("/api/duties")
export const createExtraDuty      = (b)    => post("/api/duties", b)
export const updateExtraDuty      = (id,b) => put(`/api/duties/${id}`, b)
export const deleteExtraDuty      = (id)   => del(`/api/duties/${id}`)

// Workflow
export const submitWorkflowFeedback = (b) => post("/api/workflow/feedback", b)
export const getWorkflowFeedback    = ()  => req("/api/workflow/feedback")

// Notifications
export const getNotifications     = (p={}) => req(`/api/notifications?${new URLSearchParams(p)}`)
export const createNotification   = (b)    => post("/api/notifications", b)
export const markNotifRead        = (id)   => patch(`/api/notifications/${id}/read`, {})
export const markAllNotifRead     = (b)    => patch("/api/notifications/read-all", b)
export const deleteNotification   = (id)   => del(`/api/notifications/${id}`)

// Internal Marks
export const getTeacherStudents  = (teacherId) => req(`/api/internal-marks/students?teacherId=${teacherId}`)
export const getStudentMarks     = (sid, tid)  => req(`/api/internal-marks/${sid}?teacherId=${tid}`)
export const addInternalMark     = (b)         => post("/api/internal-marks", b)
export const updateInternalMark  = (id, b)     => put(`/api/internal-marks/${id}`, b)
export const deleteInternalMark  = (id)        => del(`/api/internal-marks/${id}`)
