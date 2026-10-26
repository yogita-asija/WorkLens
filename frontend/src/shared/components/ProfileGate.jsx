import { useEffect, useState } from "react"
import { T } from "./UI"
import AcademicProfileForm from "./AcademicProfileForm"
import { getMyProfile } from "../services/facultyProfileApi"

/**
 * Blocks the faculty portal until the mandatory academic profile is complete.
 * (If the status cannot be loaded, the portal stays usable — the HOD still sees the profile as incomplete.)
 */
export default function ProfileGate({ user, onLogout }) {
  const [complete, setComplete] = useState(true)

  useEffect(() => {
    if (user?.role !== "teaching") return
    getMyProfile().then((d) => setComplete(d.complete)).catch(() => setComplete(true))
  }, [user?._id, user?.role])

  if (user?.role !== "teaching" || complete) return null

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.85)", overflowY: "auto", padding: 20, display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 28, width: "100%", maxWidth: 720, margin: "24px 0" }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: T.txt, margin: 0 }}>Complete your academic profile</h2>
        <p style={{ fontSize: 13, color: T.sub, margin: "6px 0 0", lineHeight: 1.5 }}>
          This is required once. WorkLens uses your qualifications and experience to match you with the right courses when your HOD allocates them. You can edit it any time in Settings.
        </p>
        <AcademicProfileForm submitLabel="Save and continue" onSaved={(d) => d.complete && setComplete(true)} />
        <div style={{ textAlign: "center", marginTop: 14 }}>
          <button onClick={onLogout} style={{ background: "none", border: "none", color: T.muted, fontSize: 12, cursor: "pointer" }}>Log out</button>
        </div>
      </div>
    </div>
  )
}
