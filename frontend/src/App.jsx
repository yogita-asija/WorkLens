import React, { useEffect } from "react"
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { ThemeProvider } from "./ThemeContext"
import useAppStore from "./store/useAppStore"

// ── Layout components ──────────────────────────────────────────────────────
import Sidebar        from "./components/Sidebar"
import Topbar         from "./components/Topbar"
import ProfileSidebar from "./components/ProfileSidebar"
import NotifPanel     from "./components/NotifPanel"
import GlobalToast    from "./components/GlobalToast"
import LoginPage from "./pages/LoginPage"
import HodLayout from "./components/hod/HodLayout"

// ── Existing faculty pages ─────────────────────────────────────────────────
import Dashboard         from "./pages/Dashboard"
import LeaveManagement   from "./pages/LeaveManagement"
import WorkflowReview    from "./pages/WorkflowReview"
import AttendancePage    from "./pages/Attendance"
import ActivityLogs      from "./pages/ActivityLogs"
import CoursesPage       from "./pages/CoursesPage"
import AssignmentsPage   from "./pages/AssignmentsPage"
import ExtraDutiesPage   from "./pages/ExtraDutiesPage"
import StudentProfile    from "./pages/StudentProfile"
import SettingsPage      from "./pages/SettingsPage"
import LessonPlansPage   from "./pages/LessonPlansPage"
import StudyMaterialsPage from "./pages/StudyMaterialsPage"
// import SyllabusPage      from "./pages/SyllabusPage"
import OnlineClassesPage from "./pages/OnlineClassesPage"
import TimetablePage     from "./pages/TimetablePage"
import StudentMessages    from "./pages/StudentMessages"
import { useNotifications } from "./hooks/useData"

// ── Coming soon placeholder ────────────────────────────────────────────────
function ComingSoon({ title, desc }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: 360, gap: 14,
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 16,
        background: "rgba(34,197,94,0.1)",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
      }}>🚧</div>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 17, fontWeight: 600, color: "#fff", marginBottom: 6 }}>{title}</p>
        <p style={{ fontSize: 13, color: "#6b7280", maxWidth: 320, lineHeight: 1.6 }}>
          {desc || "This page is under construction and will be available soon."}
        </p>
      </div>
    </div>
  )
}

// ── Hash-based student profile overlay ────────────────────────────────────
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
  return (
    <StudentProfile
      studentId={studentId}
      onClose={() => {
        window.history.pushState(null, "", window.location.pathname)
        window.dispatchEvent(new HashChangeEvent("hashchange"))
      }}
    />
  )
}

// ── Faculty layout ─────────────────────────────────────────────────────────
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
              {/* ── Dashboard ── */}
              <Route path="/"               element={<Dashboard />} />

              {/* ── Teaching group ── */}
              <Route path="/attendance"     element={<AttendancePage />} />
              <Route path="/courses"        element={<CoursesPage />} />
              <Route path="/assignments"    element={<AssignmentsPage />} />
              <Route path="/materials"      element={<StudyMaterialsPage />} />
              <Route path="/lesson-plans"   element={<LessonPlansPage />} />
               {/* <Route path="/syllabus"       element={<SyllabusPage />} /> */}
              <Route path="/online-classes" element={<OnlineClassesPage />} />
              <Route path="/lesson-plans"   element={<ComingSoon title="Lesson Plans" desc="Plan and track lesson delivery across your courses for the semester." />} />
              {/* <Route path="/syllabus"       element={<ComingSoon title="Syllabus Progress" desc="Monitor how much of the syllabus has been covered per course." />} /> */}
              <Route path="/online-classes" element={<ComingSoon title="Online Classes" desc="Schedule and conduct live online classes and track student participation." />} />
              {/* <Route path="/obe-mapping"    element={<ComingSoon title="OBE Mapping" desc="Map course outcomes to program outcomes for outcome-based education compliance." />} /> */}

              {/* ── Assessment group ── */}
              {/* <Route path="/grades"           element={<ComingSoon title="Grades & Rubrics" desc="Submit final grades and use rubric-based evaluation for assignments." />} /> */}
              <Route path="/performance"      element={<ComingSoon title="Performance Analytics" desc="View student performance trends across tests and assignments." />} />

              {/* ── Students group ── */}
              {/* <Route path="/student-attendance"  element={<ComingSoon title="Attendance Reports" desc="Per-student attendance summary across all your courses." />} /> */}
              {/* <Route path="/student-performance" element={<ComingSoon title="Performance Reports" desc="Detailed performance breakdown per student." />} />
              <Route path="/at-risk"             element={<ComingSoon title="At-Risk Students" desc="Students flagged for low attendance or poor performance — act before it's too late." />} /> */}
              <Route path="/student-messages"    element={<StudentMessages />} />
              {/* ── Self-Service group ── */}
              <Route path="/leave-management" element={<LeaveManagement />} />
              <Route path="/timetable"        element={<TimetablePage />} />
              {/* <Route path="/workload"         element={<ComingSoon title="Workload" desc="Your current workload score based on courses, duties, and assignments." />} /> */}
              {/* <Route path="/kpi"              element={<ComingSoon title="KPI Dashboard" desc="Your personal KPIs — attendance %, assignment completion, student scores." />} /> */}
              <Route path="/extra-duties"     element={<ExtraDutiesPage />} />
              <Route path="/workflow"         element={<WorkflowReview />} />
              <Route path="/activity-logs"    element={<ActivityLogs />} />

              {/* ── Settings ── */}
              <Route path="/settings" element={<SettingsPage user={user} />} />

              <Route path="*" element={<Navigate to="/" replace />} />
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

// ── Root ───────────────────────────────────────────────────────────────────
export default function App() {
  const { user, setUser } = useAppStore()

  if (!user) {
    return (
      <ThemeProvider>
        <LoginPage onLogin={setUser} />
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/*" element={user.role === "hod" ? <HodLayout /> : <FacultyLayout />} />
        </Routes>
      </Router>
    </ThemeProvider>
  )
}
