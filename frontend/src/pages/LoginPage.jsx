import React, { useState } from 'react'

const API = `${import.meta.env.VITE_API_URL}/api`
const ROLES = ['Teaching Staff', 'Non-Teaching Staff']

function EyeIcon() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
}
function EyeOffIcon() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
}

export default function LoginPage({ onLogin }) {
  const [role, setRole]         = useState('Teaching Staff')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || 'Login failed')
      } else {
        if (remember) localStorage.setItem('worklens_user', JSON.stringify(data.user))
        if (onLogin) onLogin(data.user)
      }
    } catch {
      setError('Cannot connect to server. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0A0A0A',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        background: '#262626',
        border: '1px solid #333333',
        borderRadius: 16,
        padding: '48px 40px',
        width: '100%',
        maxWidth: 480,
      }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: '#22C55E', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="18" height="18" fill="none" stroke="#000" strokeWidth="2.5" viewBox="0 0 24 24">
                <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
              </svg>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.3px' }}>WorkLensEdu</h1>
          </div>
          <p style={{ fontSize: 13, color: '#6B7280' }}>University Staff Management System</p>
        </div>

        <h2 style={{ fontSize: 16, fontWeight: 600, color: '#9CA3AF', textAlign: 'center', marginBottom: 20 }}>
          Sign in to your account
        </h2>

        {/* Role Tabs */}
        <div style={{
          display: 'flex', background: '#1a1a1a',
          borderRadius: 10, padding: 4, marginBottom: 24, gap: 2,
        }}>
          {ROLES.map(r => (
            <button key={r} onClick={() => setRole(r)} style={{
              flex: 1, padding: '8px 4px', borderRadius: 8, border: 'none',
              cursor: 'pointer', fontSize: 11,
              fontWeight: role === r ? 600 : 400,
              background: role === r ? '#22C55E' : 'transparent',
              color: role === r ? '#000' : '#6B7280',
              transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}>{r}</button>
          ))}
        </div>

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#EF4444',
          }}>{error}</div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input
            type="email" placeholder="you@university.edu"
            value={email} onChange={e => setEmail(e.target.value)} required
            style={{
              background: '#1a1a1a', border: '1px solid #333333',
              borderRadius: 10, padding: '14px 16px', fontSize: 14, color: '#FFFFFF', width: '100%',
            }}
            onFocus={e => (e.target.style.borderColor = '#22C55E')}
            onBlur={e => (e.target.style.borderColor = '#333333')}
          />

          <div style={{ position: 'relative' }}>
            <input
              type={showPass ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password} onChange={e => setPassword(e.target.value)} required
              style={{
                background: '#1a1a1a', border: '1px solid #333333',
                borderRadius: 10, padding: '14px 44px 14px 16px', fontSize: 14, color: '#FFFFFF', width: '100%',
              }}
              onFocus={e => (e.target.style.borderColor = '#22C55E')}
              onBlur={e => (e.target.style.borderColor = '#333333')}
            />
            <button type="button" onClick={() => setShowPass(v => !v)} style={{
              position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: 0,
            }}>
              {showPass ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#9CA3AF' }}>
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#22C55E', cursor: 'pointer' }} />
              Remember me
            </label>
          </div>

          <button type="submit" disabled={loading} style={{
            marginTop: 4, background: loading ? '#16a34a' : '#22C55E',
            border: 'none', borderRadius: 10, padding: '14px',
            fontSize: 14, fontWeight: 600, color: '#000000',
            cursor: loading ? 'not-allowed' : 'pointer', width: '100%',
            transition: 'opacity 0.15s', display: 'flex',
            alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = '0.88' }}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            {loading ? 'Signing in...' : `Sign In as ${role}`}
          </button>
        </form>

        <p style={{ fontSize: 11, color: '#4B5563', textAlign: 'center', marginTop: 20 }}>
          Demo: teaching@gmail.com / 123456
        </p>
      </div>
    </div>
  )
}
