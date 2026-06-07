import { Routes, Route, Navigate } from "react-router-dom"
import useAppStore from "../../store/useAppStore"
import AdminSidebar   from "../../components/admin/AdminSidebar"
import AdminTopbar    from "../../components/admin/AdminTopbar"
import GlobalToast    from "../../components/GlobalToast"
import NotifPanel     from "../../components/NotifPanel"
import ProfileSidebar from "../../components/ProfileSidebar"

import AdminDashboard    from "./AdminDashboard"
import AdminTeachers     from "./AdminTeachers"
import AdminCourses      from "./AdminCourses"
import AdminDepartments  from "./AdminDepartments"
import AdminLeaves       from "./AdminLeaves"
import AdminCommunication from "./AdminCommunication"
import AdminReports      from "./AdminReports"
import AdminSettings     from "./AdminSettings"
import AdminAuditLogs    from "./AdminAuditLogs"

export default function AdminLayout() {
  const { user, logout, profileOpen, closeProfile, notifOpen, closeNotif } = useAppStore()

  return (
    <div className="flex h-screen bg-neutral-950 text-white overflow-hidden">
      <AdminSidebar onLogout={logout} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <AdminTopbar user={user} />
        <main className="flex-1 overflow-y-auto bg-[#0A0A0A]">
          <div className="p-6">
            <Routes>
              <Route index                   element={<AdminDashboard />} />
              <Route path="teachers"         element={<AdminTeachers />} />
              <Route path="courses"          element={<AdminCourses />} />
              <Route path="departments"      element={<AdminDepartments />} />
              <Route path="leaves"           element={<AdminLeaves />} />
              <Route path="communication"    element={<AdminCommunication />} />
              <Route path="reports"          element={<AdminReports />} />
              <Route path="settings"         element={<AdminSettings />} />
              <Route path="audit-logs"       element={<AdminAuditLogs />} />
              <Route path="*"               element={<Navigate to="/admin" replace />} />
            </Routes>
          </div>
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
