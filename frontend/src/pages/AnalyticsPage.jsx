import React, { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
  PieChart, Pie, Cell,
} from 'recharts'
import { useC, Card, PageHeader, ErrorBanner, ProgressBar, Icons, ExtraIcons } from '../components/UI'

const API = 'http://localhost:8000/api'
const PIE_COLORS = ['#134e4a', '#22C55E', '#6ee7b7', '#CA8A04', '#374151']

/* ── Chart sub-components ────────────────────────────── */
function ChartTitle({ children }) {
  const C = useC()
  return <p style={{ fontSize: 14, fontWeight: 600, color: C.txt, marginBottom: 16 }}>{children}</p>
}

const BarTooltip = ({ active, payload, label }) => {
  const C = useC()
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px' }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: C.txt, marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 12, color: C.sub }}>hours : {payload[0].value}</p>
    </div>
  )
}

const LineTooltip = ({ active, payload, label }) => {
  const C = useC()
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px' }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: C.txt, marginBottom: 2 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ fontSize: 12, color: C.sub }}>{p.value}{p.unit || ''}</p>
      ))}
    </div>
  )
}

/* ── StatCard ─────────────────────────────────────────── */
function StatCard({ label, value, sub, subColor, icon, trend }) {
  const C = useC()
  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 12, color: C.sub, marginBottom: 6 }}>{label}</p>
          <p style={{ fontSize: 28, fontWeight: 700, color: C.txt, lineHeight: 1 }}>{value}</p>
        </div>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: C.inner, display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: C.sub,
        }}>
          {icon}
        </div>
      </div>
      <p style={{ fontSize: 12, color: subColor ?? C.accent }}>
        {trend && <span style={{ marginRight: 2 }}>↑</span>}{sub}
      </p>
    </Card>
  )
}

/* ── InsightCard ─────────────────────────────────────── */
function InsightCard({ title, body, color }) {
  const C = useC()
  return (
    <div style={{
      flex: 1, background: color + '18',
      border: `1px solid ${color}44`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 8, padding: '14px 16px',
    }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: C.txt, marginBottom: 6 }}>{title}</p>
      <p style={{ fontSize: 12, color: C.sub, lineHeight: 1.5 }}>{body}</p>
    </div>
  )
}

/* ── Main Page ───────────────────────────────────────── */
export default function AnalyticsPage({ user }) {
  const C = useC()
  const [activeBar, setActiveBar] = useState(null)
  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  
  useEffect(() => {
    const role = user?.role || "teaching";
    setLoading(true);
    fetch(`${API}/analytics?role=${role}`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setError('Could not load analytics data.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: C.sub, fontSize: 14 }}>Loading analytics...</p>
    </div>
  )

  const stats           = data?.stats           || {}
  const weeklyActivity  = data?.weeklyActivity  || []
  const timeSpentTrend  = data?.timeSpentTrend  || []
  const attendanceTrend = data?.attendanceTrend || []
  const courseWorkload  = data?.courseWorkload  || []
  const courses         = data?.courses         || []
  const insights        = data?.insights        || []

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: '32px 28px', transition: 'background 0.3s' }}>
      <PageHeader
        title="Performance Analytics"
        subtitle="Comprehensive insights into your teaching activities and performance"
      />

      <ErrorBanner message={error} />

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <StatCard label="Activity Score" value={stats.activityScore  || '—'} sub={stats.activityTrend    || ''} subColor={C.warn}   icon={<ExtraIcons.Trend />} />
        <StatCard label="Active Classes" value={stats.activeClasses  ?? '—'} sub={stats.classesTrend     || ''} subColor={C.accent} icon={<ExtraIcons.Book />} trend />
        <StatCard label="Assignments"    value={stats.assignments    ?? '—'} sub={stats.assignmentsTrend || ''} subColor={C.accent} icon={<ExtraIcons.File />} trend />
        <StatCard label="Weekly Hours"   value={stats.weeklyHours    ?? '—'} sub={stats.hoursTrend       || ''} subColor={C.accent} icon={<ExtraIcons.Clock />} trend />
      </div>

      {/* Charts row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card>
          <ChartTitle>Weekly Activity Distribution</ChartTitle>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weeklyActivity} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
              onMouseLeave={() => setActiveBar(null)}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis dataKey="day"   tick={{ fill: C.sub, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis                 tick={{ fill: C.sub, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(128,128,128,0.08)' }} />
              <Bar dataKey="hours" radius={[4, 4, 0, 0]} onMouseEnter={(_, i) => setActiveBar(i)}>
                {weeklyActivity.map((_, i) => (
                  <Cell key={i} fill={i === activeBar ? C.sub : C.accent} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <ChartTitle>Time Spent Trend</ChartTitle>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={timeSpentTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis dataKey="week"  tick={{ fill: C.sub, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 50]} tick={{ fill: C.sub, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<LineTooltip />} />
              <Line type="monotone" dataKey="hours" stroke={C.accent} strokeWidth={2} dot={{ fill: C.accent, r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <Card>
          <ChartTitle>Course Workload Distribution</ChartTitle>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={courseWorkload} cx="50%" cy="50%" outerRadius={90} dataKey="value"
                label={({ name, cx, cy, midAngle, outerRadius }) => {
                  const R = Math.PI / 180
                  const r = outerRadius + 28
                  const x = cx + r * Math.cos(-midAngle * R)
                  const y = cy + r * Math.sin(-midAngle * R)
                  return <text x={x} y={y} fill={C.sub} textAnchor="middle" fontSize={11}>{name}</text>
                }}
                labelLine={false}
              >
                {courseWorkload.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />
                ))}
              </Pie>
              <Tooltip
                formatter={v => [`${v}%`, 'Share']}
                contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <ChartTitle>Attendance Trend</ChartTitle>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={attendanceTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis dataKey="week" tick={{ fill: C.sub, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[75, 100]} tick={{ fill: C.sub, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<LineTooltip />} />
              <Line type="monotone" dataKey="pct" stroke={C.accent} strokeWidth={2} dot={{ fill: C.accent, r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Key Insights */}
      {insights.length > 0 && (
        <Card style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: C.txt, marginBottom: 14 }}>Key Insights</p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {insights.map((ins, i) => (
              <InsightCard key={i} title={ins.title} body={ins.body} color={ins.color} />
            ))}
          </div>
        </Card>
      )}

      {/* Course Performance Table */}
      {courses.length > 0 && (
        <Card>
          <p style={{ fontSize: 14, fontWeight: 600, color: C.txt, marginBottom: 16 }}>Course Performance Overview</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {['Course', 'Students', 'Avg Attendance', 'Assignments', 'Performance'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {courses.map((row, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.inner)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '12px', color: C.txt, fontWeight: 500 }}>{row.course}</td>
                  <td style={{ padding: '12px', color: C.sub }}>{row.students}</td>
                  <td style={{ padding: '12px', color: C.sub }}>{row.attendance}%</td>
                  <td style={{ padding: '12px', color: C.sub }}>{row.assignments}</td>
                  <td style={{ padding: '12px', minWidth: 140 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1 }}><ProgressBar value={row.perf} /></div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.accent, minWidth: 34 }}>{row.perf}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
