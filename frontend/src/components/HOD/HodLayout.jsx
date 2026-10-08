import { Routes, Route, Navigate } from "react-router-dom"
import useAppStore from "../../store/useAppStore"
import { useNotifications } from "../../hooks/useData"

import HodSidebar     from "./HodSidebar"
import Topbar         from "../Topbar"
import ProfileSidebar from "../ProfileSidebar"
import NotifPanel     from "../NotifPanel"
import GlobalToast    from "../GlobalToast"

import HodDashboard from "../../pages/HOD/HodDashboard"
import DutyAllocationPage from "../../pages/HOD/DutyAllocationPage"
import HodFaculty from "../../pages/HOD/HodFaculty"
import HodLeaveManagement from "../../pages/HOD/Hodleavemanagement"
import SettingsPage from "../../pages/SettingsPage"

function ComingSoon({ title, desc }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 360, gap: 14 }}>
      <div style={{ width: 52, height: 52, borderRadius: 16, background: "rgba(34,197,94,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🚧</div>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 17, fontWeight: 600, color: "#fff", marginBottom: 6 }}>{title}</p>
        <p style={{ fontSize: 13, color: "#6b7280", maxWidth: 320, lineHeight: 1.6 }}>{desc || "This page is under construction and will be available soon."}</p>
      </div>
    </div>
  )
}

export default function HodLayout() {
  const { user, logout, profileOpen, closeProfile, notifOpen, closeNotif } = useAppStore()
  useNotifications(user?._id)

  return (
    <div className="flex h-screen bg-neutral-950 text-white overflow-hidden">
      <HodSidebar onLogout={logout} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Topbar user={user} onLogout={logout} />
        <main className="flex-1 overflow-y-auto bg-[#0A0A0A]">
          <div className="p-6">
            <Routes>
              <Route path="/"                element={<HodDashboard />} />
              <Route path="/duty-allocation" element={<DutyAllocationPage />} />
              <Route path="/faculty"          element={<HodFaculty />} />
              <Route path="/leave-management" element={<HodLeaveManagement />} />
              <Route path="/settings"        element={<SettingsPage user={user} />} />
              <Route path="*"                element={<Navigate to="/" replace />} />
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