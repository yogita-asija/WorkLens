import React, { useState, useEffect, useCallback } from "react"
import CourseSelector from "../components/CourseSelector"
import StatsCards from "../components/StatsCards"
import AttendanceTable from "../components/AttendanceTable"
import {
  getCourses,
  getAttendanceRoster,
  getAttendanceByDate,
  saveAttendance,
  exportAttendanceCSV,
} from "../services/api"

const todayStr = () => new Date().toISOString().slice(0, 10)

// ── Error Banner ──────────────────────────────────────────────────────────────
function ErrorBanner({ message, onRetry }) {
  return (
    <div
      className="rounded-xl p-5 flex items-center justify-between gap-4"
      style={{ background: "#1a0f0f", border: "1px solid #4b1c1c" }}
    >
      <div className="flex items-center gap-3">
        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="#f87171" strokeWidth="1.75" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <div>
          <p className="text-sm font-semibold" style={{ color: "#f87171" }}>
            Could not connect to server
          </p>
          <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>
            {message || "Make sure the backend is running on localhost:8000"}
          </p>
        </div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg flex-shrink-0"
          style={{ background: "#2a1010", border: "1px solid #4b1c1c", color: "#f87171" }}
        >
          Retry
        </button>
      )}
    </div>
  )
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ message, type }) {
  if (!message) return null
  const isError = type === "error"
  return (
    <div
      className="fixed bottom-6 right-6 px-5 py-3 rounded-xl text-sm font-semibold shadow-lg z-50 flex items-center gap-2"
      style={{
        background: isError ? "#1a0f0f" : "#0f1a10",
        border:     isError ? "1px solid #4b1c1c" : "1px solid #1c4b1c",
        color:      isError ? "#f87171" : "#4ade80",
      }}
    >
      {isError ? "✕" : "✓"} {message}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AttendancePage() {
  const [courses, setCourses]               = useState([])
  const [selectedCourse, setSelectedCourse] = useState("")
  const [selectedDate, setSelectedDate]     = useState(todayStr())
  const [students, setStudents]             = useState([])
  const [loading, setLoading]               = useState(false)
  const [loaded, setLoaded]                 = useState(false)
  const [savedSnapshot, setSavedSnapshot]   = useState([])
  const [saving, setSaving]                 = useState(false)

  const [showModal, setShowModal] = useState(false)
  const [topic, setTopic] = useState("")
  const [topicError, setTopicError] = useState("")

  const [coursesError, setCoursesError]   = useState(false)
  const [studentsError, setStudentsError] = useState(false)

  const [toast, setToast] = useState({ message: "", type: "" })

  const showToast = (message, type = "success") => {
    setToast({ message, type })
    setTimeout(() => setToast({ message: "", type: "" }), 3000)
  }

  // ── Fetch courses on mount ────────────────────────────────────────────────
  const fetchCourses = useCallback(() => {
    setCoursesError(false)
    getCourses()
      .then((data) => {
        setCourses(data)
        if (data.length > 0) setSelectedCourse(data[0].courseId)
      })
      .catch(() => setCoursesError(true))
  }, [])

  useEffect(() => {
    fetchCourses()
  }, [fetchCourses])

  // ── Fetch students — try saved record first, fall back to roster ──────────
  const fetchStudents = useCallback((courseId, date) => {
    if (!courseId || !date) return

    setLoading(true)
    setLoaded(false)
    setStudentsError(false)

    getAttendanceByDate(courseId, date)
      .then((data) => {
        // Saved record found — use it
        setStudents(data.students || [])
        setSavedSnapshot(data.students || [])
        setLoading(false)
        setLoaded(true)
      })
      .catch(() => {
        // No saved record for this date — load fresh roster with default "present"
        getAttendanceRoster(courseId)
          .then((data) => {
            setStudents(data.students || [])
            setSavedSnapshot(data.students || [])
            setLoading(false)
            setLoaded(true)
          })
          .catch(() => {
            setStudentsError(true)
            setLoading(false)
          })
      })
  }, [])

  useEffect(() => {
    fetchStudents(selectedCourse, selectedDate)
  }, [selectedCourse, selectedDate, fetchStudents])

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleStatusChange = useCallback((id, newStatus) => {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s)))
  }, [])

  const handleMarkAll = useCallback((targetStatus) => {
    setStudents((prev) => prev.map((s) => ({ ...s, status: targetStatus })))
  }, [])

  const handleNoteChange = useCallback((id, note) => {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, notes: note } : s)))
  }, [])

  const handleReset = useCallback(() => {
    setStudents(savedSnapshot.map((s) => ({ ...s })))
  }, [savedSnapshot])

  // ── Save — backend automatically logs the activity ────────────────────────
  const handleSaveClick = () => {
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!topic.trim()) {
      setTopicError("Topic is required")
      return
    }
  
    setTopicError("")
    setSaving(true)
    
  
    const courseName = courses.find((c) => c.courseId === selectedCourse)?.label || selectedCourse
  
    const payload = {
      courseId: selectedCourse,
      courseName: courseName,
      date: selectedDate,
      topic: topic, 
      students: students.map(({ id, name, status, notes }) => ({
        id,
        name,
        status,
        notes: notes || "",
      })),
    }
  
    try {
      await saveAttendance(payload)
      setSavedSnapshot(students.map((s) => ({ ...s })))
      showToast("Attendance saved successfully!")
      setShowModal(false)
      setTopic("")
    } catch (err) {
      showToast("Could not save — check if server is running.", "error")
    } finally {
      setSaving(false)
    }
  }

  // ── Export CSV ────────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    if (!selectedCourse || !selectedDate) return
    const url = exportAttendanceCSV(selectedCourse, selectedDate)
    const a = document.createElement("a")
    a.href = url
    a.download = `attendance_${selectedCourse}_${selectedDate}.csv`
    a.click()
  }

  // ── Derived stats ──────────────────────────────────────────────────────────
  const total   = students.length
  const present = students.filter((s) => s.status === "present").length
  const absent  = students.filter((s) => s.status === "absent").length
  const late    = students.filter((s) => s.status === "late").length

  const displayDate = selectedDate
    ? new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        year:    "numeric",
        month:   "long",
        day:     "numeric",
      })
    : ""

  return (
    <div
      className="min-h-screen px-4 sm:px-8 py-8 max-w-[1400px] mx-auto space-y-6"
      style={{ background: "#0A0A0A" }}
    >
      {/* Header */}
      <div>
        <h1 className="font-semibold text-white" style={{ fontSize: "24px" }}>
          Attendance Management
        </h1>
        <p className="mt-1" style={{ fontSize: "15px", color: "#9CA3AF" }}>
          Track and manage student attendance for your courses
        </p>
      </div>

      {/* Courses error */}
      {coursesError && (
        <ErrorBanner
          message="Backend se courses load nahi hue. Make sure node server.js chal raha hai on port 8000."
          onRetry={fetchCourses}
        />
      )}

      {/* Course + date selector */}
      {!coursesError && (
        <CourseSelector
          courses={courses}
          selectedCourse={selectedCourse}
          setSelectedCourse={setSelectedCourse}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          loading={loading}
        />
      )}

      {/* Loading */}
      {loading && (
        <p style={{ color: "#9CA3AF", textAlign: "center", paddingTop: "40px" }}>
          Loading students...
        </p>
      )}

      {/* Students error */}
      {studentsError && !loading && (
        <ErrorBanner
          message="Students load nahi hue. Server check karo aur retry karo."
          onRetry={() => fetchStudents(selectedCourse, selectedDate)}
        />
      )}

      {/* Main content */}
      {!loading && loaded && !studentsError && (
        <>
          <StatsCards total={total} present={present} absent={absent} late={late} />

          <div className="flex items-center gap-4">
            <div className="flex-1 h-px" style={{ background: "#2D2D2D" }} />
            <span className="text-xs font-medium whitespace-nowrap" style={{ color: "#6b7280" }}>
              Session · {displayDate}
            </span>
            <div className="flex-1 h-px" style={{ background: "#2D2D2D" }} />
          </div>

          <AttendanceTable
            students={students}
            onStatusChange={handleStatusChange}
            onNoteChange={handleNoteChange}
            onMarkAll={handleMarkAll}
            onExportCSV={handleExportCSV}
          />

          <div className="flex justify-end gap-3 pb-8">
            <button
              onClick={handleReset}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ color: "#9CA3AF", border: "1px solid #2D2D2D", background: "transparent" }}
            >
              Reset
            </button>
            <button
              onClick={handleSaveClick}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background:    saving ? "#15803d" : "#22C55E",
                color:         "#000",
                border:        "none",
                cursor:        saving ? "not-allowed" : "pointer",
                opacity:       saving ? 0.8 : 1,
              }}
            >
              {saving ? "Saving..." : "Save Attendance"}
            </button>
          </div>
        </>
      )}
      {showModal && (
  <div className="fixed inset-0 flex items-center justify-center z-50">
    {/* Background overlay */}
    <div
      className="absolute inset-0"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={() => setShowModal(false)}
    />

    {/* Modal */}
    <div
      className="relative w-full max-w-md p-6 rounded-xl"
      style={{ background: "#111", border: "1px solid #2D2D2D" }}
    >
      <h2 className="text-white font-semibold text-lg mb-3">
        Enter Today's Topic
      </h2>

      <input
        type="text"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="e.g. React Hooks, DBMS Normalization..."
        className="w-full px-4 py-2 rounded-lg text-sm"
        style={{
          background: "#0A0A0A",
          border: "1px solid #2D2D2D",
          color: "#fff",
        }}
      />

      {topicError && (
        <p className="text-xs mt-1" style={{ color: "#f87171" }}>
          {topicError}
        </p>
      )}

      <div className="flex justify-end gap-3 mt-5">
        <button
          onClick={() => setShowModal(false)}
          className="px-4 py-2 text-sm rounded-lg"
          style={{ color: "#9CA3AF", border: "1px solid #2D2D2D" }}
        >
          Cancel
        </button>

        <button
          onClick={handleSave}
          className="px-4 py-2 text-sm rounded-lg"
          style={{ background: "#22C55E", color: "#000" }}
        >
          Save
        </button>
      </div>
    </div>
  </div>
)}

      <Toast message={toast.message} type={toast.type} />
    </div>
  )
}
