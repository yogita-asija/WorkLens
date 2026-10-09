import React from 'react'
import { useTheme, getColors } from '../ThemeContext'

/* ── useC: get current color tokens (theme-aware) ── */
export function useC() {
  const { darkMode } = useTheme()
  return getColors(darkMode)
}

/* ── Design tokens (inline style values — dark mode defaults) ── */
export const T = {
  bg:      'var(--k-bg)',
  card:    'var(--k-card)',
  inner:   'var(--k-inner)',
  border:  'var(--k-border)',
  accent:  '#22C55E',
  warn:    '#CA8A04',
  danger:  '#EF4444',
  blue:    '#3B82F6',
  cyan:    '#06B6D4',
  txt:     'var(--k-txt)',
  sub:     'var(--k-sub)',
  muted:   'var(--k-muted)',
}

/* ── Card wrapper ── */
export function Card({ children, style }) {
  const C = useC()
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      padding: 24,
      transition: 'background 0.25s, border-color 0.25s',
      ...style,
    }}>{children}</div>
  )
}

/* ── Small stat card (used in sidebar and extra duties) ── */
export function StatMiniCard({ label, value, sub, color, icon, style }) {
  const C = useC()
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      padding: '16px 20px',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      transition: 'background 0.25s, border-color 0.25s',
      ...style,
    }}>
      <div>
        <p style={{ fontSize: 11, color: C.sub, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
        <p style={{ fontSize: 26, fontWeight: 700, color: color ?? C.txt, lineHeight: 1 }}>{value}</p>
        {sub && <p style={{ fontSize: 11, color: C.muted, marginTop: 5 }}>{sub}</p>}
      </div>
      {icon && (
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: C.inner, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: C.sub, flexShrink: 0,
        }}>{icon}</div>
      )}
    </div>
  )
}

/* ── Progress bar ── */
export function ProgressBar({ value, max = 100 }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

/* badge */
export function Badge({ label, color, bg }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
      padding: '3px 8px', borderRadius: 5,
      background: bg ?? 'rgba(34,197,94,0.12)',
      color: color ?? T.accent,
      border: `1px solid ${color ?? T.accent}33`,
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }}>{label}</span>
  )
}

/* ── Icon button ── */
export function IconBtn({ icon, onClick, title, danger }) {
  const [hov, setHov] = React.useState(false)
  return (
    <button
      onClick={onClick} title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? (danger ? 'rgba(239,68,68,0.12)' : T.inner) : 'transparent',
        border: 'none', borderRadius: 6, padding: 6,
        cursor: 'pointer', color: hov && danger ? T.danger : T.sub,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
      }}
    >{icon}</button>
  )
}

/* ── Modal backdrop and box ── */
export function Modal({ children, onClose }) {
  React.useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box">
        {children}
      </div>
    </div>
  )
}

/* ── Modal button row ── */
export function ModalBtn({ label, onClick, variant = 'primary', style }) {
  const [hov, setHov] = React.useState(false)
  const isPrimary = variant === 'primary'
  const isDanger  = variant === 'danger'
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '9px 22px', borderRadius: 8,
        fontSize: 13, fontWeight: 600, cursor: 'pointer',
        transition: 'all 0.15s',
        background: isPrimary
          ? (hov ? '#16a34a' : '#22C55E')
          : isDanger
            ? (hov ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.1)')
            : (hov ? '#3a3a3a' : '#2f2f2f'),
        color: isPrimary ? '#000' : isDanger ? T.danger : T.sub,
        border: isDanger ? `1px solid rgba(239,68,68,0.3)` : `1px solid ${T.border}`,
        ...style,
      }}
    >{label}</button>
  )
}

/* ── SVG Icons ── */
export const Icons = {
  eye:     <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  edit:    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  trash:   <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  plus:    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  users:   <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  calendar:<svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  clock:   <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  check:   <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>,
  upload:  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  file:    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  bell:    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  layers:  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
  activity:<svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  filter:  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  chevron: <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>,
  send:    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  star:    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
}

/* ── Theme-aware components needed by Analytics & Settings pages ── */

export function PageHeader({ title, subtitle }) {
  const C = useC()
  return (
    <div style={{ marginBottom: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, color: C.txt }}>{title}</h1>
      {subtitle && <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{subtitle}</p>}
    </div>
  )
}

export function ErrorBanner({ message }) {
  if (!message) return null
  return (
    <div style={{
      background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
      borderRadius: 8, padding: '10px 14px',
      marginBottom: 16, fontSize: 13, color: '#EF4444',
    }}>{message}</div>
  )
}

export function SectionHeader({ icon, title, subtitle }) {
  const C = useC()
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: C.inner, display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexShrink: 0, color: C.sub,
      }}>{icon}</div>
      <div>
        <p style={{ fontSize: 15, fontWeight: 600, color: C.txt }}>{title}</p>
        {subtitle && <p style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{subtitle}</p>}
      </div>
    </div>
  )
}

export function InputField({ label, value, onChange, type = 'text', placeholder }) {
  const C = useC()
  const [focused, setFocused] = React.useState(false)
  return (
    <div>
      {label && <label style={{ fontSize: 12, color: C.sub, display: 'block', marginBottom: 6 }}>{label}</label>}
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          width: '100%', background: C.inner,
          border: `1px solid ${focused ? C.accent : C.border}`,
          borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.txt,
          transition: 'border-color 0.15s',
        }}
      />
    </div>
  )
}

export function Toggle({ checked, onChange }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="toggle-slider" />
    </label>
  )
}

export function ToggleRow({ label, description, checked, onChange }) {
  const C = useC()
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 0', borderBottom: `1px solid ${C.border}`,
    }}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 500, color: C.txt }}>{label}</p>
        {description && <p style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{description}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  )
}

export function SidebarRow({ label, value, highlight }) {
  const C = useC()
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 0', borderBottom: `1px solid ${C.border}`,
    }}>
      <span style={{ fontSize: 13, color: C.sub }}>{label}</span>
      <span style={{
        fontSize: 13, fontWeight: 500,
        color: highlight ? C.accent : C.txt,
        background: highlight ? 'rgba(34,197,94,0.12)' : 'transparent',
        padding: highlight ? '2px 10px' : 0,
        borderRadius: highlight ? 6 : 0,
      }}>{value}</span>
    </div>
  )
}

export function SidebarButton({ label, onClick }) {
  const C = useC()
  const [hov, setHov] = React.useState(false)
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', textAlign: 'left',
        background: hov ? C.inner : 'transparent',
        border: 'none', borderBottom: `1px solid ${C.border}`,
        padding: '13px 0', fontSize: 13, color: C.txt,
        cursor: 'pointer', transition: 'background 0.15s',
        borderRadius: hov ? 6 : 0, paddingLeft: hov ? 8 : 0,
      }}
    >{label}</button>
  )
}

/* ── Additional Icons for Analytics/Settings (merged separately) ── */
export const ExtraIcons = {
  User:     () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Bell:     () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  Cog:      () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  Moon:     () => <svg width="16" height="16" fill="none" stroke="#9CA3AF" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  Sun:      () => <svg width="16" height="16" fill="none" stroke="#CA8A04" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  Save:     () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  Trend:    () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  Book:     () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  File:     () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  Clock:    () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Eye:      () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  EyeOff:   () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
}
