import React, { useEffect } from "react"
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { ThemeProvider } from "./ThemeContext"
import useAppStore from "./store/useAppStore"

// ── Components ────────────────────────────────────────────────────────────────
import Sidebar        from "./components/Sidebar"
import Topbar         from "./components/Topbar"
import ProfileSidebar from "./components/ProfileSidebar"
import NotifPanel     from "./components/NotifPanel"
import GlobalToast    from "./components/GlobalToast"

// ── Faculty pages ─────────────────────────────────────────────────────────────
import LoginPage        from "./pages/LoginPage"
import Dashboard        from "./pages/Dashboard"
import LeaveManagement  from "./pages/LeaveManagement"
import WorkflowReview   from "./pages/WorkflowReview"
import AttendancePage   from "./pages/Attendance"
import ActivityLogs     from "./pages/ActivityLogs"
import CoursesPage      from "./pages/CoursesPage"
import AssignmentsPage  from "./pages/AssignmentsPage"
import ExtraDutiesPage  from "./pages/ExtraDutiesPage"
import StudentProfile   from "./pages/StudentProfile"
import InternalMarksPage from "./pages/InternalMarksPage"
import SettingsPage     from "./pages/SettingsPage"
import { useNotifications } from "./hooks/useData"

// ── Admin module ──────────────────────────────────────────────────────────────
import AdminLayout from "./pages/admin/AdminLayout"

// ── Hash-based student profile overlay ───────────────────────────────────────
function HashStudentProfile() {
  const [studentId, setStudentId] = React.useState(null)
  useEffect(() => {
    const check = () => {
      const m = window.location.hash.match(/^#\/student\/(.+)$/)
      setStudentId(m ? decodeURIComponent(m[1]) : null)
    }
    check()
    window.addEventListener("hashchange", check)
    return () => window.removeEventListener("hashchange", check)
  }, [])
  if (!studentId) return null
  return <StudentProfile studentId={studentId} onClose={() => {
    window.history.pushState(null, "", window.location.pathname)
    window.dispatchEvent(new HashChangeEvent("hashchange"))
  }} />
}

// ── Faculty layout (only accessible to non-admin users) ───────────────────────
function FacultyLayout() {
  const { user, logout, profileOpen, closeProfile, notifOpen, closeNotif } = useAppStore()
  useNotifications(user?._id)

  return (
    <div className="flex h-screen bg-neutral-950 text-white overflow-hidden">
      <Sidebar onLogout={logout} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Topbar user={user} onLogout={logout} />
        <main className="flex-1 overflow-y-auto bg-[#0A0A0A]">
          <div className="p-6">
            <Routes>
              <Route path="/"                 element={<Dashboard />} />
              <Route path="/leave-management" element={<LeaveManagement />} />
              <Route path="/workflow"         element={<WorkflowReview />} />
              <Route path="/attendance"       element={<AttendancePage />} />
              <Route path="/activity-logs"    element={<ActivityLogs />} />
              <Route path="/courses"          element={<CoursesPage />} />
              <Route path="/assignments"      element={<AssignmentsPage />} />
              <Route path="/extra-duties"     element={<ExtraDutiesPage />} />
              <Route path="/internal-marks"   element={<InternalMarksPage />} />
              <Route path="/settings"         element={<SettingsPage user={user} />} />
              <Route path="*"                 element={<Navigate to="/" replace />} />
            </Routes>
          </div>
          <HashStudentProfile />
        </main>
      </div>

      <ProfileSidebar open={profileOpen} onClose={closeProfile} user={user} />
      {profileOpen && <div className="fixed inset-0 bg-black/50 z-30" onClick={closeProfile} />}

      <NotifPanel open={notifOpen} onClose={closeNotif} />
      {notifOpen && <div className="fixed inset-0 bg-black/40 z-30" onClick={closeNotif} />}

      <GlobalToast />
    </div>
  )
}

// ── Root component with strict role-based routing ─────────────────────────────
export default function App() {
  const { user, setUser } = useAppStore()

  // Not logged in → show login
  if (!user) {
    return (
      <ThemeProvider>
        <LoginPage onLogin={setUser} />
      </ThemeProvider>
    )
  }

  const isAdmin = user.role === "admin"

  return (
    <ThemeProvider>
      <Router>
        <Routes>
          {isAdmin ? (
            // Admin users: ONLY admin routes; any other path redirects to /admin
            <>
              <Route path="/admin/*" element={<AdminLayout />} />
              <Route path="*"        element={<Navigate to="/admin" replace />} />
            </>
          ) : (
            // Faculty/staff users: ONLY faculty routes; /admin is blocked
            <>
              <Route path="/admin/*" element={<Navigate to="/" replace />} />
              <Route path="/*"       element={<FacultyLayout />} />
            </>
          )}
        </Routes>
      </Router>
    </ThemeProvider>
  )
}
