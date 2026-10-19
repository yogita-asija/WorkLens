import React from 'react'

const ChevronDown = () => (
  <svg className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

const BookIcon = () => (
  <svg className="w-4 h-4 text-sky-400" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
)

const CalendarIcon = () => (
  <svg className="w-4 h-4 text-sky-400" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)

const LoadIcon = ({ spinning }) => (
  <svg
    className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`}
    fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
  >
    {spinning
      ? <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
      : <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>
    }
  </svg>
)

export default function CourseSelector({
  courses,
  selectedCourse,
  setSelectedCourse,
  selectedDate,
  setSelectedDate,
  loading,
}) {
  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--bg-1c1c1c)', border: '1px solid var(--b-2d2d2d)' }}>
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">

        {/* Course Dropdown */}
        <div className="flex-1 min-w-0">
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--t-9ca3af)' }}>
            Select Course
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2"><BookIcon /></div>
            <select
              value={selectedCourse}
              onChange={e => setSelectedCourse(e.target.value)}
              className="input-dark pl-9 pr-9 appearance-none cursor-pointer w-full"
            >
              {courses.map(course => (
                <option key={course.courseId} value={course.courseId}>
                  {course.label}
                </option>
              ))}
            </select>
            <ChevronDown />
          </div>
        </div>

        {/* Date Picker */}
        <div className="flex-1 min-w-0 sm:max-w-[220px]">
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--t-9ca3af)' }}>
            Select Date
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2"><CalendarIcon /></div>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="input-dark pl-9 w-full [color-scheme:dark]"
            />
          </div>
        </div>

        {/* Loading indicator */}
        <div className="flex items-end pb-[10px]">
          <div
            className="flex items-center gap-2 text-sm font-medium transition-opacity duration-300"
            style={{ color: 'var(--t-9ca3af)', opacity: loading ? 1 : 0 }}
          >
            <LoadIcon spinning={true} />
            Loading…
          </div>
        </div>

      </div>
    </div>
  )
}