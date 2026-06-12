import React, { useEffect, useState } from 'react'

const UsersIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)
const CheckCircleIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
)
const XCircleIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
)
const TrendingUpIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
)

function useCountUp(target, duration = 600) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let start = 0
    const step = target / (duration / 16)
    const timer = setInterval(() => {
      start += step
      if (start >= target) { setValue(target); clearInterval(timer) }
      else setValue(Math.floor(start))
    }, 16)
    return () => clearInterval(timer)
  }, [target, duration])
  return value
}

function StatCard({ icon, label, value, suffix, subLabel, delay, accentColor }) {
  const animated = useCountUp(typeof value === 'number' ? value : 0)
  return (
    <div
      className="stat-card animate-slide-up"
      style={{ animationDelay: delay, animationFillMode: 'both', opacity: 0 }}
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.06)', color: accentColor || '#9CA3AF' }}
        >
          {icon}
        </div>
      </div>
      <div className="flex items-end gap-1">
        <span className="text-3xl font-bold text-white tracking-tight">
          {typeof value === 'number' ? animated : value}
        </span>
        {suffix && <span className="text-lg font-semibold mb-0.5" style={{ color: accentColor || '#9CA3AF' }}>{suffix}</span>}
      </div>
      <p className="text-sm mt-1 font-medium" style={{ color: '#9CA3AF' }}>{label}</p>
      {subLabel && <p className="text-xs mt-2 font-medium" style={{ color: '#6b7280' }}>{subLabel}</p>}
    </div>
  )
}

export default function StatsCards({ total, present, absent, late }) {
  const pct = total > 0 ? Math.round((present / total) * 100) : 0

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard delay="0ms"    icon={<UsersIcon />}       label="Total Students"   value={total}   subLabel={`${total} enrolled`} />
      <StatCard delay="80ms"   icon={<CheckCircleIcon />} label="Present"          value={present} accentColor="#9CA3AF" subLabel={late > 0 ? `+${late} late` : 'All on time'} />
      <StatCard delay="160ms"  icon={<XCircleIcon />}     label="Absent"           value={absent}  accentColor="#9CA3AF" subLabel={absent === 0 ? 'Full attendance!' : `${absent} missing`} />
      <StatCard delay="240ms"  icon={<TrendingUpIcon />}  label="Attendance Rate"  value={pct}     suffix="%" subLabel={pct >= 75 ? '↑ Good standing' : pct >= 50 ? '~ Needs attention' : '↓ Critical'} />
    </div>
  )
}
