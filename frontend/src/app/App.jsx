import React from "react"
import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import { ThemeProvider } from "./providers/ThemeContext"
import useAppStore from "../store/useAppStore"

import LoginPage from "../shared/pages/LoginPage"
import HodLayout from "../portals/hod/layouts/HodLayout"
import FacultyLayout from "../portals/teaching/layouts/FacultyLayout"

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
          {/* "hod" gets the HOD portal; every other role (teaching, non-teaching, admin) gets FacultyLayout.
              There is no separate Non-Teaching UI in the codebase. */}
          <Route path="/*" element={user.role === "hod" ? <HodLayout /> : <FacultyLayout />} />
        </Routes>
      </Router>
    </ThemeProvider>
  )
}
