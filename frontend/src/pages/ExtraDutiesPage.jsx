import React, { useState, useEffect } from 'react'
import { Badge, Icons, T } from '../components/UI'
import * as api from '../services/api'

/* ── Sample data ── */
// const DUTIES = [
//   { date: '2026-02-20', type: 'Substitution Class', course: 'CS201 – Programming II',        reason: 'Dr. rahul on medical leave',               hours: '2h',   status: 'Approved' },
//   { date: '2026-02-18', type: 'Extra Class',         course: 'CS401 – Advanced Algorithms',  reason: 'Makeup class for mid-term preparation',        hours: '1.5h', status: 'Logged'   },
//   { date: '2026-02-15', type: 'Invigilation',        course: 'CS301 – Data Structures',      reason: 'Mid-term examination',                         hours: '3h',   status: 'Approved' },
//   { date: '2026-02-12', type: 'Substitution Class',  course: 'CS101 – Introduction to CS',   reason: 'Dr. sonia at conference',                   hours: '2h',   status: 'Approved' },
//   { date: '2026-02-10', type: 'Extra Class',         course: 'CS450 – Machine Learning',     reason: 'Additional tutorial session requested by students', hours: '2h', status: 'Logged' },
// ]

const DUTY_TYPE_COLORS = {
  'Substitution Class': { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  'Extra Class':        { color: '#22C55E', bg: 'rgba(34,197,94,0.12)'  },
  'Invigilation':       { color: '#CA8A04', bg: 'rgba(202,138,4,0.12)'  },
}

// const STATUS_COLORS = {
//   Approved: { color: '#22C55E', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)'  },
//   Logged:   { color: '#CA8A04', bg: 'rgba(202,138,4,0.12)',  border: 'rgba(202,138,4,0.3)'  },
//   Pending:  { color: '#EF4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)'  },
// }

const ALL_MONTHS = ['All Months','January','February','March','April','May','June','July','August','September','October','November','December']
const ALL_TYPES  = ['All Duty Types','Substitution Class','Extra Class','Invigilation']

export default function ExtraDutiesPage() {
  const [monthFilter, setMonthFilter] = useState('All Months')
  const [typeFilter,  setTypeFilter]  = useState('All Duty Types')
  const [duties, setDuties] = useState([])
   useEffect(() => {
    loadDuties()
  }, [])

  const loadDuties = async () => {
    try {
      const data = await api.getExtraDuties()
      setDuties(data)
    } catch (err) {
      console.error(err)
    }
  }

  const filtered = duties.filter(d => {
    const matchMonth = monthFilter === 'All Months' || d.date.includes('-02-') /* demo */
    const matchType  = typeFilter  === 'All Duty Types' || d.type === typeFilter
    return matchMonth && matchType
  })

  const totalHrs  = duties.reduce((s, d) => s + parseFloat(d.hours), 0)
  const subs      = duties.filter(d => d.type === 'Substitution Class').length
  const invigs    = duties.filter(d => d.type === 'Invigilation').length
  const lastDate = duties.length
  ? new Date(
      duties.reduce(
        (latest, d) => d.date > latest ? d.date : latest,
        duties[0].date
      )
    ).toISOString().split("T")[0]
  : "-"

  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: '28px 28px' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: T.txt }}>Substitutions & Extra Duties</h1>
        <p style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>
          Track additional academic responsibilities beyond regular classes
        </p>
      </div>

      {/* ── Stat cards row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label="Total Extra Duties" value={duties.length} sub="This month" icon={Icons.layers}   iconBg="#0e3a1f" iconColor={T.accent} />
        <StatCard label="Substitutions Taken" value={subs}          sub="Classes covered" icon={Icons.users}  iconBg="#1e3a5f" iconColor="#3B82F6" />
        <StatCard label="Invigilation Duties" value={invigs}         sub="Exam monitoring" icon={Icons.file}  iconBg="#3d2a00" iconColor="#CA8A04" />
        <StatCard label="Last Activity"       value={lastDate}       sub="Most recent entry" icon={Icons.clock} iconBg="#1a1a3a" iconColor="#A855F7" />
      </div>

      {/* ── Table card ── */}
      <div style={{
        background: T.card, border: `1px solid ${T.border}`,
        borderRadius: 12, overflow: 'hidden',
      }}>
        {/* Table toolbar */}
        <div style={{
          padding: '14px 20px',
          borderBottom: `1px solid ${T.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
        }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: T.txt }}>Extra Duties Log</p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: T.muted }}>{Icons.filter}</span>
            <FilterSelect value={monthFilter} onChange={setMonthFilter} options={ALL_MONTHS} />
            <FilterSelect value={typeFilter}  onChange={setTypeFilter}  options={ALL_TYPES} />
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                {['Date', 'Duty Type', 'Course / Subject', 'Reason', 'Hours'].map((h, i) => (
                  <th key={h} style={{
                    padding: '11px 16px', textAlign: 'left',
                    fontSize: 10, fontWeight: 700, color: T.sub,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((d, i) => {
                const tc = DUTY_TYPE_COLORS[d.type] ?? { color: T.sub, bg: 'rgba(156,163,175,0.1)' }
                // const sc = STATUS_COLORS[d.status]  ?? STATUS_COLORS.Pending
                return (
                  <tr
                    key={i}
                    style={{ borderBottom: i < filtered.length - 1 ? `1px solid #1e1e1e` : 'none', transition: 'background 0.12s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#2a2a2a')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Date */}
                    <td style={{ padding: '13px 16px', fontSize: 13, color: T.sub, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                     {new Date(d.date).toISOString().split("T")[0]}
                    </td>
                    {/* Duty type badge */}
                    <td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}>
                      <Badge label={d.type} color="#FFFFFF"  />
                    </td>
                    {/* Course */}
                    <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 500, color: T.txt, whiteSpace: 'nowrap' }}>
                      {d.course}
                    </td>
                    {/* Reason */}
                    <td style={{ padding: '13px 16px', fontSize: 13, color: T.sub, minWidth: 200 }}>
                      {d.reason}
                    </td>
                    {/* Hours */}
                    <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 600, color: T.txt, whiteSpace: 'nowrap' }}>
                      {d.hours}
                    </td>
                    {/* Status badge */}
                    {/* <td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600,
                        padding: '3px 10px', borderRadius: 6,
                        background: sc.bg, color: "var(--t-ffffff)",
                        border: `1px solid ${sc.border}`,
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                      }}>
                        {d.status === 'Approved' && <span style={{ fontSize: 9 }}></span>}
                        {d.status}
                      </span>
                    </td> */}
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: T.muted }}>
                    No duties match the selected filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer total */}
        <div style={{
          padding: '12px 20px',
          borderTop: `1px solid #1e1e1e`,
          display: 'flex', justifyContent: 'flex-end', gap: 24,
        }}>
          <span style={{ fontSize: 12, color: T.muted }}>
            Total entries: <strong style={{ color: T.txt }}>{filtered.length}</strong>
          </span>
          <span style={{ fontSize: 12, color: T.muted }}>
            Total hours: <strong style={{ color: T.txt }}>{totalHrs}h</strong>
          </span>
        </div>
      </div>
    </div>
  )
}

/* ── Stat card ── */
function StatCard({ label, value, sub, icon, iconBg, iconColor }) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderRadius: 12, padding: '18px 20px',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    }}>
      <div>
        <p style={{ fontSize: 11, color: T.sub, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
        <p style={{ fontSize: 26, fontWeight: 700, color: T.txt, lineHeight: 1, marginBottom: 6 }}>{value}</p>
        <p style={{ fontSize: 11, color: T.muted }}>{sub}</p>
      </div>
      <div style={{
        width: 34, height: 34, borderRadius: 8,
        background: iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: iconColor, flexShrink: 0,
      }}>{icon}</div>
    </div>
  )
}

/* ── Filter select ── */
function FilterSelect({ value, onChange, options }) {
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          background: T.inner, border: `1px solid ${T.border}`,
          borderRadius: 7, padding: '6px 28px 6px 10px',
          fontSize: 12, color: T.txt, cursor: 'pointer',
          appearance: 'none',
        }}
      >
        {options.map(o => (
          <option key={o} value={o} style={{ background: 'var(--bg-1a1a1a)' }}>{o}</option>
        ))}
      </select>
      <span style={{
        position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
        color: T.muted, pointerEvents: 'none',
      }}>{Icons.chevron}</span>
    </div>
  )
}
