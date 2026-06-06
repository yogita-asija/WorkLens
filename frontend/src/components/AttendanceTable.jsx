import React, { useState } from 'react'

const EditIcon = () => (
  <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)
const CheckIcon = () => (
  <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)
const XIcon = () => (
  <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)
const UsersCheckIcon = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <polyline points="16 11 18 13 22 9" />
  </svg>
)
const UsersXIcon = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <line x1="17" y1="9" x2="23" y2="15" /><line x1="23" y1="9" x2="17" y2="15" />
  </svg>
)
const UserIcon = () => (
  <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
)
const TableIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/>
    <line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>
  </svg>
)
const GridIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
  </svg>
)
const DownloadIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)

const STATUS_CYCLE = ['present', 'absent', 'late']

const STATUS_STYLE = {
  present: { label: 'Present', bg: 'rgba(22,163,74,0.15)',  color: '#4ade80', border: '1px solid rgba(22,163,74,0.4)',  dot: '#4ade80' },
  absent:  { label: 'Absent',  bg: 'rgba(220,38,38,0.12)',  color: '#f87171', border: '1px solid rgba(220,38,38,0.5)',  dot: '#f87171' },
  late:    { label: 'Late',    bg: 'rgba(202,138,4,0.15)',  color: '#facc15', border: '1px solid rgba(202,138,4,0.4)', dot: '#facc15' },
}

function NotePopup({ note, onSave, onClose }) {
  const [draft, setDraft] = useState(note)
  return (
    <div style={{
      position: 'absolute', bottom: '110%', left: '50%', transform: 'translateX(-50%)',
      zIndex: 50, width: '190px',
      background: '#1c1c1c', border: '1px solid #3a3a3a', borderRadius: '10px',
      padding: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
    }}>
      <p style={{ fontSize: '10px', color: '#9CA3AF', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Note</p>
      <input
        autoFocus value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { onSave(draft); onClose() } if (e.key === 'Escape') onClose() }}
        placeholder="Add a note..."
        style={{ width: '100%', background: '#111', border: '1px solid #333', borderRadius: '6px', padding: '6px 8px', fontSize: '12px', color: '#fff', outline: 'none', boxSizing: 'border-box' }}
      />
      <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
        <button onClick={() => { onSave(draft); onClose() }}
          style={{ flex: 1, padding: '5px', background: 'rgba(22,163,74,0.15)', border: '1px solid rgba(22,163,74,0.4)', borderRadius: '6px', color: '#4ade80', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
          <CheckIcon /> Save
        </button>
        <button onClick={onClose}
          style={{ flex: 1, padding: '5px', background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '6px', color: '#f87171', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
          <XIcon /> Cancel
        </button>
      </div>
    </div>
  )
}

function openStudentProfile(studentId) {
  window.location.hash = `/student/${encodeURIComponent(studentId)}`
}

function StudentCard({ student, index, onStatusChange, onNoteChange }) {
  const [showNote, setShowNote] = useState(false)
  const cfg = STATUS_STYLE[student.status] ?? STATUS_STYLE.present

  const cycleStatus = () => {
    const next = (STATUS_CYCLE.indexOf(student.status) + 1) % STATUS_CYCLE.length
    onStatusChange(student.id, STATUS_CYCLE[next])
  }

  return (
    <div
      className="animate-fade-in"
      style={{
        background: '#161616', border: '1px solid #2a2a2a', borderRadius: '12px',
        padding: '14px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: '9px', position: 'relative',
        animationDelay: `${index * 30}ms`, animationFillMode: 'both', opacity: 0,
        transition: 'border-color 0.2s, transform 0.2s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#3a3a3a'; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      <span style={{ position: 'absolute', top: '8px', left: '10px', fontSize: '9px', color: '#4b5563', fontFamily: 'monospace' }}>
        {String(index + 1).padStart(2, '0')}
      </span>

      <div
        onClick={() => openStudentProfile(student.id)}
        title="View student profile"
        style={{
          width: '50px', height: '50px', borderRadius: '50%',
          background: '#222', border: `2px solid ${cfg.dot}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#555', marginTop: '6px', transition: 'border-color 0.3s, opacity 0.2s',
          cursor: 'pointer',
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
      >
        <UserIcon />
      </div>

      <div style={{ textAlign: 'center', width: '100%' }}>
        <p
          onClick={() => openStudentProfile(student.id)}
          title="View student profile"
          style={{
            fontSize: '12px', fontWeight: 600, color: '#ffffff', margin: 0, lineHeight: 1.3,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            cursor: 'pointer', transition: 'color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#60a5fa'}
          onMouseLeave={e => e.currentTarget.style.color = '#ffffff'}
        >
          {student.name}
        </p>
        <p style={{ fontSize: '10px', color: '#6b7280', fontFamily: 'monospace', margin: '2px 0 0' }}>
          {student.id}
        </p>
      </div>

      <button
        onClick={cycleStatus}
        title="Click: Present → Absent → Late → Present"
        style={{
          width: '100%', padding: '5px 0', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
          background: cfg.bg, color: cfg.color, border: cfg.border,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
          transition: 'all 0.2s', letterSpacing: '0.02em',
        }}
      >
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: cfg.dot }} />
        {cfg.label}
      </button>

      <div style={{ width: '100%', position: 'relative' }}>
        <button
          onClick={() => setShowNote(!showNote)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px',
            fontSize: '10px', color: student.notes ? '#a0aec0' : '#4b5563',
            fontStyle: student.notes ? 'normal' : 'italic',
            background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
          }}
        >
          <EditIcon />
          <span style={{ maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {student.notes || 'Add note…'}
          </span>
        </button>
        {showNote && (
          <NotePopup
            note={student.notes}
            onSave={(note) => onNoteChange(student.id, note)}
            onClose={() => setShowNote(false)}
          />
        )}
      </div>
    </div>
  )
}

function TableRow({ student, index, onStatusChange, onNoteChange }) {
  const [showNote, setShowNote] = useState(false)
  const cfg = STATUS_STYLE[student.status] ?? STATUS_STYLE.present

  const cycleStatus = () => {
    const next = (STATUS_CYCLE.indexOf(student.status) + 1) % STATUS_CYCLE.length
    onStatusChange(student.id, STATUS_CYCLE[next])
  }

  return (
    <tr
      style={{ borderBottom: '1px solid #1f1f1f', transition: 'background 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.background = '#161616'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <td style={{ padding: '10px 16px', fontSize: '11px', color: '#4b5563', fontFamily: 'monospace', width: '40px' }}>
        {String(index + 1).padStart(2, '0')}
      </td>
      <td style={{ padding: '10px 16px', fontSize: '13px', fontWeight: 600, color: '#fff' }}>
        <span
          onClick={() => openStudentProfile(student.id)}
          title="View student profile"
          style={{ cursor: 'pointer', transition: 'color 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.color = '#60a5fa'}
          onMouseLeave={e => e.currentTarget.style.color = '#fff'}
        >
          {student.name}
        </span>
      </td>
      <td style={{ padding: '10px 16px', fontSize: '11px', color: '#6b7280', fontFamily: 'monospace' }}>
        {student.id}
      </td>
      <td style={{ padding: '10px 16px' }}>
        <button
          onClick={cycleStatus}
          title="Click to cycle status"
          style={{
            padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
            background: cfg.bg, color: cfg.color, border: cfg.border,
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px',
            transition: 'all 0.2s',
          }}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: cfg.dot }} />
          {cfg.label}
        </button>
      </td>
      <td style={{ padding: '10px 16px', position: 'relative' }}>
        <button
          onClick={() => setShowNote(!showNote)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            fontSize: '11px', color: student.notes ? '#a0aec0' : '#4b5563',
            fontStyle: student.notes ? 'normal' : 'italic',
            background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
            maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          <EditIcon />
          {student.notes || 'Add note…'}
        </button>
        {showNote && (
          <NotePopup
            note={student.notes}
            onSave={(note) => onNoteChange(student.id, note)}
            onClose={() => setShowNote(false)}
          />
        )}
      </td>
    </tr>
  )
}

export default function AttendanceTable({ students, onStatusChange, onNoteChange, onMarkAll, onExportCSV }) {
  const [search, setSearch]     = useState('')
  const [viewMode, setViewMode] = useState('grid')

  const presentCount  = students.filter(s => s.status === 'present').length
  const absentCount   = students.filter(s => s.status === 'absent').length
  const lateCount     = students.filter(s => s.status === 'late').length
  const allPresent    = students.length > 0 && students.every(s => s.status === 'present')
  const attendancePct = students.length > 0 ? Math.round((presentCount / students.length) * 100) : 0

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.id.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ background: '#111111', border: '1px solid #2D2D2D', borderRadius: '14px', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #2D2D2D', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff', margin: 0 }}>Student Attendance</h2>
          <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '3px 0 0' }}>
            {students.length} students &nbsp;·&nbsp; {attendancePct}% present &nbsp;·&nbsp; click badge to change status
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <svg style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280', pointerEvents: 'none' }} width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search student…"
              style={{ background: '#1c1c1c', border: '1px solid #333', borderRadius: '8px', padding: '7px 10px 7px 26px', fontSize: '12px', color: '#fff', outline: 'none', width: '155px' }}
            />
          </div>

          {/* Grid / Table toggle */}
          <div style={{ display: 'flex', background: '#1c1c1c', border: '1px solid #2D2D2D', borderRadius: '8px', overflow: 'hidden' }}>
            <button
              onClick={() => setViewMode('grid')}
              title="Card grid view"
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '7px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: 'none',
                background: viewMode === 'grid' ? '#2a2a2a' : 'transparent',
                color: viewMode === 'grid' ? '#ffffff' : '#6b7280',
                transition: 'all 0.15s',
              }}
            >
              <GridIcon /> Grid
            </button>
            <button
              onClick={() => setViewMode('table')}
              title="Table view"
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '7px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: 'none',
                background: viewMode === 'table' ? '#2a2a2a' : 'transparent',
                color: viewMode === 'table' ? '#ffffff' : '#6b7280',
                transition: 'all 0.15s',
              }}
            >
              <TableIcon /> Table
            </button>
          </div>

          {/* Export CSV */}
          {onExportCSV && (
            <button
              onClick={onExportCSV}
              title="Download CSV for current date"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', border: '1px solid rgba(59,130,246,0.4)',
                background: 'rgba(59,130,246,0.12)', color: '#60a5fa',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.2)'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.6)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.12)'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)' }}
            >
              <DownloadIcon /> Export CSV
            </button>
          )}

          {/* Mark All */}
          <button
            onClick={() => onMarkAll(allPresent ? 'absent' : 'present')}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
              cursor: 'pointer', border: 'none',
              background: allPresent ? 'rgba(220,38,38,0.15)' : 'rgba(22,163,74,0.15)',
              color: allPresent ? '#f87171' : '#4ade80',
              transition: 'all 0.2s',
            }}
          >
            {allPresent ? <UsersXIcon /> : <UsersCheckIcon />}
            {allPresent ? 'Mark All Absent' : 'Mark All Present'}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ padding: '10px 20px', borderBottom: '1px solid #1f1f1f', display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          { label: 'Present', color: '#4ade80', count: presentCount },
          { label: 'Absent',  color: '#f87171', count: absentCount },
          { label: 'Late',    color: '#facc15', count: lateCount },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color }} />
            <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{item.label}:</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: item.color }}>{item.count}</span>
          </div>
        ))}
        {search && (
          <span style={{ fontSize: '11px', color: '#6b7280', marginLeft: 'auto' }}>
            Showing {filtered.length} of {students.length}
          </span>
        )}
      </div>

      {/* Content */}
      {viewMode === 'grid' ? (
        <div style={{ padding: '20px' }}>
          {filtered.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '13px', padding: '40px 0' }}>No students found</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: '12px' }}>
              {filtered.map((student, idx) => (
                <StudentCard
                  key={student.id}
                  student={student}
                  index={idx}
                  onStatusChange={onStatusChange}
                  onNoteChange={onNoteChange}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          {filtered.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '13px', padding: '40px 0' }}>No students found</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #2D2D2D' }}>
                  {['#', 'Name', 'ID', 'Status', 'Notes'].map(col => (
                    <th key={col} style={{
                      padding: '10px 16px', textAlign: 'left',
                      fontSize: '11px', fontWeight: 600, color: '#6b7280',
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((student, idx) => (
                  <TableRow
                    key={student.id}
                    student={student}
                    index={idx}
                    onStatusChange={onStatusChange}
                    onNoteChange={onNoteChange}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{ padding: '10px 20px', borderTop: '1px solid #2D2D2D', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: '11px', color: '#4b5563', margin: 0 }}>
          Click <span style={{ color: '#d1d5db' }}>badge</span> to cycle status &nbsp;·&nbsp; Click <span style={{ color: '#d1d5db' }}>pencil</span> to add note
        </p>
        <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>
          {students.length > 0 && `${presentCount}/${students.length} present`}
        </p>
      </div>
    </div>
  )
}
