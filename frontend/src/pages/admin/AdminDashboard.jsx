import { useState, useEffect } from "react"
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { Users, BookOpen, Building2, CalendarCheck, BellRing, Activity, TrendingUp, Clock } from "lucide-react"
import { T, Card, StatMiniCard, Badge } from "../../components/UI"
import * as adminApi from "../../services/adminApi"
import useAppStore from "../../store/useAppStore"

const COLORS = ["#22C55E", "#3B82F6", "#EF4444", "#CA8A04", "#06B6D4", "#8B5CF6"]

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const MODULE_COLORS = {
  teacher:       { color: "#22C55E", bg: "rgba(34,197,94,0.12)" },
  course:        { color: "#3B82F6", bg: "rgba(59,130,246,0.12)" },
  department:    { color: "#06B6D4", bg: "rgba(6,182,212,0.12)" },
  leave:         { color: "#CA8A04", bg: "rgba(202,138,4,0.12)" },
  communication: { color: "#8B5CF6", bg: "rgba(139,92,246,0.12)" },
  settings:      { color: "#9CA3AF", bg: "rgba(156,163,175,0.12)" },
}

export default function AdminDashboard() {
  const { showToast } = useAppStore()
  const [stats,    setStats]    = useState(null)
  const [charts,   setCharts]   = useState(null)
  const [activity, setActivity] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [s, c, a] = await Promise.all([
          adminApi.getAdminStats(),
          adminApi.getAdminCharts(),
          adminApi.getAdminRecentActivity(),
        ])
        setStats(s.data)
        setCharts(c.data)
        setActivity(a.data || [])
      } catch (err) {
        showToast(err.message || "Failed to load dashboard", "error")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
        <div style={{ color: T.sub, fontSize: 14 }}>Loading dashboard…</div>
      </div>
    )
  }

  const statCards = [
    { label: "Total Teachers",    value: stats?.totalTeachers    ?? 0, icon: <Users size={16} />,        color: "#22C55E" },
    { label: "Active Courses",    value: stats?.activeCourses    ?? 0, icon: <BookOpen size={16} />,     color: "#3B82F6" },
    { label: "Departments",       value: stats?.totalDepartments ?? 0, icon: <Building2 size={16} />,    color: "#06B6D4" },
    { label: "Pending Leaves",    value: stats?.pendingLeaves    ?? 0, icon: <CalendarCheck size={16} />,color: "#CA8A04" },
    { label: "Notifications",     value: stats?.systemNotifications ?? 0, icon: <BellRing size={16} />, color: "#8B5CF6" },
    { label: "Recent Activities", value: stats?.recentActivityCount ?? 0, icon: <Activity size={16} />, color: "#EF4444" },
  ]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: T.txt }}>Admin Dashboard</h1>
        <p style={{ fontSize: 13, color: T.sub, marginTop: 4 }}>System overview and quick stats</p>
      </div>

      {/* Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
        {statCards.map(s => (
          <StatMiniCard key={s.label} label={s.label} value={s.value} icon={s.icon} color={s.color} />
        ))}
      </div>

      {/* Charts Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Leave Trend */}
        <Card style={{ padding: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: T.txt, marginBottom: 16 }}>Leave Applications (6 months)</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={charts?.leaveTrend || []}>
              <XAxis dataKey="month" tick={{ fill: T.sub, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: T.sub, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, color: T.txt, fontSize: 12 }} />
              <Bar dataKey="leaves" fill="#22C55E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Leave Status Pie */}
        <Card style={{ padding: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: T.txt, marginBottom: 16 }}>Leave Status Breakdown</p>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie
                  data={[
                    { name: "Pending",  value: charts?.leaveStatus?.pending  || 0 },
                    { name: "Approved", value: charts?.leaveStatus?.approved || 0 },
                    { name: "Rejected", value: charts?.leaveStatus?.rejected || 0 },
                  ]}
                  cx="50%" cy="50%" innerRadius={40} outerRadius={65}
                  dataKey="value" paddingAngle={3}
                >
                  <Cell fill="#CA8A04" />
                  <Cell fill="#22C55E" />
                  <Cell fill="#EF4444" />
                </Pie>
                <Tooltip contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "Pending",  val: charts?.leaveStatus?.pending  || 0, color: "#CA8A04" },
                { label: "Approved", val: charts?.leaveStatus?.approved || 0, color: "#22C55E" },
                { label: "Rejected", val: charts?.leaveStatus?.rejected || 0, color: "#EF4444" },
              ].map(item => (
                <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: T.sub }}>{item.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.txt, marginLeft: "auto" }}>{item.val}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Teachers by Department */}
      <Card style={{ padding: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: T.txt, marginBottom: 16 }}>Teachers by Department</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={charts?.teachersByDept || []}>
            <XAxis dataKey="dept" tick={{ fill: T.sub, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: T.sub, fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, color: T.txt, fontSize: 12 }} />
            <Bar dataKey="teachers" radius={[4, 4, 0, 0]}>
              {(charts?.teachersByDept || []).map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Recent Audit Activity */}
      <Card style={{ padding: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: T.txt, marginBottom: 16 }}>Recent Admin Activity</p>
        {activity.length === 0 ? (
          <p style={{ color: T.muted, fontSize: 13 }}>No recent activity</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {activity.slice(0, 10).map((log, i) => {
              const mc = MODULE_COLORS[log.module] || { color: T.sub, bg: T.inner }
              return (
                <div key={log._id || i} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 0",
                  borderBottom: i < activity.length - 1 ? `1px solid ${T.border}` : "none",
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: mc.bg, display: "flex", alignItems: "center",
                    justifyContent: "center", color: mc.color, fontSize: 12, fontWeight: 700,
                  }}>
                    {(log.module || "?")[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, color: T.txt, fontWeight: 500 }}>{log.detail || log.action}</p>
                    <p style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{log.adminName} · {log.module}</p>
                  </div>
                  <span style={{ fontSize: 11, color: T.muted, flexShrink: 0 }}>{timeAgo(log.timestamp)}</span>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
