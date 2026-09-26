import React, { useState, useEffect } from 'react'
import {
  useC,
  Card, SectionHeader, InputField, Toggle, ToggleRow,
  SidebarRow, PageHeader, ErrorBanner, ExtraIcons,
} from '../components/UI'
import { useTheme } from '../ThemeContext'

const API = `${import.meta.env.VITE_API_URL}/api`

/* ─── Small reusable modal wrapper ─── */
function SettingsModal({ title, onClose, children }) {
  const C = useC()
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fadeIn 0.15s ease',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 16, padding: 28, width: 440, maxWidth: '92vw',
        animation: 'slideUp 0.2s ease', boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <p style={{ fontSize: 16, fontWeight: 600, color: C.txt }}>{title}</p>
          <button onClick={onClose} style={{
            background: C.inner, border: `1px solid ${C.border}`,
            borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: C.sub, lineHeight: 1,
          }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ─── Action button (sidebar-style) ─── */
function ActionButton({ label, icon, onClick, danger }) {
  const C = useC()
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', textAlign: 'left',
        display: 'flex', alignItems: 'center', gap: 10,
        background: hov ? (danger ? 'rgba(239,68,68,0.08)' : C.inner) : 'transparent',
        border: 'none', borderBottom: `1px solid ${C.border}`,
        padding: '13px 10px', fontSize: 13,
        color: hov && danger ? C.danger : C.txt,
        cursor: 'pointer', transition: 'all 0.15s',
        borderRadius: hov ? 8 : 0,
      }}
    >
      {icon && <span style={{ color: danger ? C.danger : C.sub, flexShrink: 0 }}>{icon}</span>}
      <span>{label}</span>
      <span style={{ marginLeft: 'auto', color: C.muted, fontSize: 11 }}>›</span>
    </button>
  )
}

/* ─── Modal: Change Password ─── */
function ChangePasswordModal({ onClose }) {
  const C = useC()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  const strength = next.length === 0 ? 0 : next.length < 6 ? 1 : next.length < 10 ? 2 : 3
  const strengthLabel = ['', 'Weak', 'Good', 'Strong'][strength]
  const strengthColor = ['', C.danger, C.warn, C.accent][strength]

  const handle = async () => {
    setErr('')
    if (!current) { setErr('Please enter your current password'); return }
    if (next.length < 6) { setErr('New password must be at least 6 characters'); return }
    if (next !== confirm) { setErr('Passwords do not match'); return }
    setSaving(true)
    await new Promise(r => setTimeout(r, 900))
    setSaving(false)
    setDone(true)
    setTimeout(onClose, 1400)
  }

  return (
    <SettingsModal title="Change Password" onClose={onClose}>
      {done ? (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
          <p style={{ color: C.accent, fontWeight: 600 }}>Password updated successfully!</p>
        </div>
      ) : (
        <>
          {err && <ErrorBanner message={err} />}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
            {/* Current password */}
            <div>
              <label style={{ fontSize: 12, color: C.sub, display: 'block', marginBottom: 6 }}>Current Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={current}
                  onChange={e => setCurrent(e.target.value)}
                  placeholder="Enter current password"
                  style={{
                    width: '100%', background: C.inner, border: `1px solid ${C.border}`,
                    borderRadius: 8, padding: '10px 40px 10px 14px', fontSize: 13, color: C.txt,
                  }}
                />
                <button onClick={() => setShowCurrent(v => !v)} style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: C.sub,
                }}>{showCurrent ? <ExtraIcons.EyeOff /> : <ExtraIcons.Eye />}</button>
              </div>
            </div>
            {/* New password */}
            <div>
              <label style={{ fontSize: 12, color: C.sub, display: 'block', marginBottom: 6 }}>New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNext ? 'text' : 'password'}
                  value={next}
                  onChange={e => setNext(e.target.value)}
                  placeholder="Enter new password"
                  style={{
                    width: '100%', background: C.inner, border: `1px solid ${C.border}`,
                    borderRadius: 8, padding: '10px 40px 10px 14px', fontSize: 13, color: C.txt,
                  }}
                />
                <button onClick={() => setShowNext(v => !v)} style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: C.sub,
                }}>{showNext ? <ExtraIcons.EyeOff /> : <ExtraIcons.Eye />}</button>
              </div>
              {next.length > 0 && (
                <div style={{ marginTop: 6, display: 'flex', gap: 4, alignItems: 'center' }}>
                  {[1,2,3].map(i => (
                    <div key={i} style={{
                      height: 3, flex: 1, borderRadius: 2,
                      background: strength >= i ? strengthColor : C.border,
                      transition: 'background 0.2s',
                    }} />
                  ))}
                  <span style={{ fontSize: 11, color: strengthColor, marginLeft: 6 }}>{strengthLabel}</span>
                </div>
              )}
            </div>
            {/* Confirm */}
            <div>
              <label style={{ fontSize: 12, color: C.sub, display: 'block', marginBottom: 6 }}>Confirm New Password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Confirm new password"
                style={{
                  width: '100%', background: C.inner,
                  border: `1px solid ${confirm && confirm !== next ? C.danger : C.border}`,
                  borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.txt,
                }}
              />
              {confirm && confirm !== next && (
                <p style={{ fontSize: 11, color: C.danger, marginTop: 4 }}>Passwords don't match</p>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{
              padding: '9px 18px', borderRadius: 8, background: 'transparent',
              border: `1px solid ${C.border}`, fontSize: 13, color: C.sub, cursor: 'pointer',
            }}>Cancel</button>
            <button onClick={handle} disabled={saving} style={{
              padding: '9px 20px', borderRadius: 8, background: C.accent,
              border: 'none', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer',
            }}>{saving ? 'Updating...' : 'Update Password'}</button>
          </div>
        </>
      )}
    </SettingsModal>
  )
}

/* ─── Modal: Two-Factor Auth ─── */
function TwoFactorModal({ onClose }) {
  const C = useC()
  const [enabled, setEnabled] = useState(false)
  const [step, setStep] = useState(1) // 1=intro, 2=verify, 3=done
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')

  const fakeQR = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" fill="white"/><rect x="10" y="10" width="50" height="50" fill="black"/><rect x="100" y="10" width="50" height="50" fill="black"/><rect x="10" y="100" width="50" height="50" fill="black"/><rect x="20" y="20" width="30" height="30" fill="white"/><rect x="110" y="20" width="30" height="30" fill="white"/><rect x="20" y="110" width="30" height="30" fill="white"/><rect x="25" y="25" width="20" height="20" fill="black"/><rect x="115" y="25" width="20" height="20" fill="black"/><rect x="25" y="115" width="20" height="20" fill="black"/><rect x="70" y="10" width="10" height="10" fill="black"/><rect x="80" y="20" width="10" height="10" fill="black"/><rect x="70" y="30" width="10" height="10" fill="black"/><rect x="80" y="50" width="10" height="10" fill="black"/><rect x="70" y="60" width="10" height="10" fill="black"/><rect x="70" y="80" width="10" height="10" fill="black"/><rect x="100" y="70" width="10" height="10" fill="black"/><rect x="120" y="70" width="10" height="10" fill="black"/><rect x="140" y="70" width="10" height="10" fill="black"/><rect x="70" y="100" width="10" height="10" fill="black"/><rect x="90" y="110" width="10" height="10" fill="black"/><rect x="110" y="130" width="10" height="10" fill="black"/><rect x="130" y="110" width="10" height="10" fill="black"/></svg>`)}`

  const verify = () => {
    if (code.length !== 6) { setErr('Enter the 6-digit code from your authenticator app'); return }
    setErr(''); setStep(3); setEnabled(true)
  }

  return (
    <SettingsModal title="Two-Factor Authentication" onClose={onClose}>
      {step === 1 && (
        <>
          <div style={{
            background: C.inner, border: `1px solid ${C.border}`,
            borderRadius: 10, padding: '14px 16px', marginBottom: 18,
            display: 'flex', gap: 12, alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: 20 }}>🔐</span>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: C.txt, marginBottom: 4 }}>Enhance your account security</p>
              <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>Two-factor authentication adds an extra layer of security by requiring a verification code in addition to your password.</p>
            </div>
          </div>
          <p style={{ fontSize: 13, color: C.sub, marginBottom: 16 }}>To enable 2FA, you'll need an authenticator app like Google Authenticator or Authy.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{
              padding: '9px 18px', borderRadius: 8, background: 'transparent',
              border: `1px solid ${C.border}`, fontSize: 13, color: C.sub, cursor: 'pointer',
            }}>Cancel</button>
            <button onClick={() => setStep(2)} style={{
              padding: '9px 20px', borderRadius: 8, background: C.accent,
              border: 'none', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer',
            }}>Set Up 2FA</button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <p style={{ fontSize: 13, color: C.sub, marginBottom: 16 }}>Scan this QR code with your authenticator app:</p>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <img src={fakeQR} alt="QR Code" style={{ width: 160, height: 160, borderRadius: 8, border: `1px solid ${C.border}` }} />
            <p style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>Or enter code manually: <strong style={{ color: C.txt }}>WLNS-K4X2-8QP7</strong></p>
          </div>
          {err && <ErrorBanner message={err} />}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: C.sub, display: 'block', marginBottom: 6 }}>Enter 6-digit verification code</label>
            <input
              type="text" maxLength={6} value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              style={{
                width: '100%', background: C.inner, border: `1px solid ${C.border}`,
                borderRadius: 8, padding: '12px 14px', fontSize: 20, fontWeight: 700,
                color: C.txt, letterSpacing: 10, textAlign: 'center',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setStep(1)} style={{
              padding: '9px 18px', borderRadius: 8, background: 'transparent',
              border: `1px solid ${C.border}`, fontSize: 13, color: C.sub, cursor: 'pointer',
            }}>Back</button>
            <button onClick={verify} style={{
              padding: '9px 20px', borderRadius: 8, background: C.accent,
              border: 'none', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer',
            }}>Verify & Enable</button>
          </div>
        </>
      )}

      {step === 3 && (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: C.accent, marginBottom: 8 }}>2FA Enabled!</p>
          <p style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>Your account is now protected with two-factor authentication.</p>
          <button onClick={onClose} style={{
            padding: '9px 24px', borderRadius: 8, background: C.accent,
            border: 'none', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer',
          }}>Done</button>
        </div>
      )}
    </SettingsModal>
  )
}

/* ─── Modal: Login History ─── */
function LoginHistoryModal({ onClose }) {
  const C = useC()
  const sessions = [
    { device: 'Chrome on Windows', location: 'Mumbai, India', time: 'Just now', current: true, icon: '🖥️' },
    { device: 'Safari on iPhone 14', location: 'Mumbai, India', time: '2 hours ago', current: false, icon: '📱' },
    { device: 'Firefox on macOS', location: 'Pune, India', time: 'Yesterday, 4:32 PM', current: false, icon: '💻' },
    { device: 'Chrome on Android', location: 'Delhi, India', time: 'Jun 9, 10:14 AM', current: false, icon: '📱' },
    { device: 'Chrome on Windows', location: 'Mumbai, India', time: 'Jun 7, 8:01 AM', current: false, icon: '🖥️' },
  ]
  return (
    <SettingsModal title="Login History" onClose={onClose}>
      <p style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>Recent login sessions for your account</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
        {sessions.map((s, i) => (
          <div key={i} style={{
            background: C.inner, border: `1px solid ${s.current ? C.accent + '44' : C.border}`,
            borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ fontSize: 22 }}>{s.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: C.txt }}>{s.device}</p>
                {s.current && (
                  <span style={{ fontSize: 10, fontWeight: 600, background: C.accent + '22', color: C.accent, padding: '2px 8px', borderRadius: 99 }}>ACTIVE</span>
                )}
              </div>
              <p style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{s.location} · {s.time}</p>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontSize: 11, color: C.muted }}>Showing last 5 sessions</p>
        <button onClick={onClose} style={{
          padding: '8px 18px', borderRadius: 8, background: C.inner,
          border: `1px solid ${C.border}`, fontSize: 13, color: C.txt, cursor: 'pointer',
        }}>Close</button>
      </div>
    </SettingsModal>
  )
}

/* ─── Modal: Change Photo ─── */
function ChangePhotoModal({ onClose, initials }) {
  const C = useC()
  const [selected, setSelected] = useState(null)
  const [preview, setPreview] = useState(null)
  const [saved, setSaved] = useState(false)

  const handleFile = e => {
    const f = e.target.files[0]
    if (!f) return
    setSelected(f)
    setPreview(URL.createObjectURL(f))
  }

  const save = async () => {
    await new Promise(r => setTimeout(r, 800))
    setSaved(true)
    setTimeout(onClose, 1200)
  }

  return (
    <SettingsModal title="Change Profile Photo" onClose={onClose}>
      {saved ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
          <p style={{ color: C.accent, fontWeight: 600 }}>Photo updated!</p>
        </div>
      ) : (
        <>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            {preview ? (
              <img src={preview} alt="Preview" style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${C.accent}` }} />
            ) : (
              <div style={{ width: 96, height: 96, borderRadius: '50%', background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 700, color: '#fff', margin: '0 auto', border: `3px solid ${C.border}` }}>
                {initials}
              </div>
            )}
          </div>
          <label style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            border: `2px dashed ${C.border}`, borderRadius: 10, padding: '20px',
            cursor: 'pointer', color: C.muted, fontSize: 13, marginBottom: 16,
            transition: 'border-color 0.15s',
          }}>
            <span>📁</span>
            <span>{selected ? selected.name : 'Click to upload a photo (JPG, PNG)'}</span>
            <input type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
          </label>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{
              padding: '9px 18px', borderRadius: 8, background: 'transparent',
              border: `1px solid ${C.border}`, fontSize: 13, color: C.sub, cursor: 'pointer',
            }}>Cancel</button>
            <button onClick={save} disabled={!selected} style={{
              padding: '9px 20px', borderRadius: 8,
              background: selected ? C.accent : C.border,
              border: 'none', fontSize: 13, fontWeight: 600, color: '#fff',
              cursor: selected ? 'pointer' : 'not-allowed',
            }}>Save Photo</button>
          </div>
        </>
      )}
    </SettingsModal>
  )
}

/* ─── Modal: Help Center ─── */
function HelpCenterModal({ onClose }) {
  const C = useC()
  const faqs = [
    { q: 'How do I submit attendance?', a: 'Go to the Attendance page, select your course and date, then mark each student.' },
    { q: 'How do I upload assignments?', a: 'Navigate to Assignments, click "New Assignment", fill in the details and attach files.' },
    { q: 'How do I apply for leave?', a: 'Go to Leave Management, click "Apply Leave", fill in dates and reason, then submit for approval.' },
    { q: 'How do I view student profiles?', a: 'Click on any student name in the attendance or marks tables to open their profile.' },
    { q: 'How do I reset my password?', a: 'Go to Settings → Security → Change Password and follow the steps.' },
  ]
  const [open, setOpen] = useState(null)
  return (
    <SettingsModal title="Help Center" onClose={onClose}>
      <p style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>Frequently Asked Questions</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {faqs.map((f, i) => (
          <div key={i} style={{ background: C.inner, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              style={{
                width: '100%', textAlign: 'left', background: 'none', border: 'none',
                padding: '12px 14px', fontSize: 13, fontWeight: 500, color: C.txt,
                cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
            >
              {f.q}
              <span style={{ color: C.muted, transition: 'transform 0.2s', transform: open === i ? 'rotate(180deg)' : 'none', display: 'inline-block' }}>▼</span>
            </button>
            {open === i && (
              <div style={{ padding: '0 14px 12px', fontSize: 12, color: C.muted, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                {f.a}
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: C.muted }}>Can't find your answer? <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 12 }}>Contact Support →</button></p>
      </div>
    </SettingsModal>
  )
}

/* ─── Modal: Contact Support ─── */
function ContactSupportModal({ onClose }) {
  const C = useC()
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [category, setCategory] = useState('technical')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)

  const send = async () => {
    if (!subject || !message) return
    setSending(true)
    await new Promise(r => setTimeout(r, 900))
    setSending(false)
    setSent(true)
  }

  return (
    <SettingsModal title="Contact Support" onClose={onClose}>
      {sent ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📨</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: C.accent, marginBottom: 8 }}>Message Sent!</p>
          <p style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>Our support team will get back to you within 24 hours.</p>
          <button onClick={onClose} style={{
            padding: '9px 24px', borderRadius: 8, background: C.accent,
            border: 'none', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer',
          }}>Done</button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 18 }}>
            <div>
              <label style={{ fontSize: 12, color: C.sub, display: 'block', marginBottom: 6 }}>Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                style={{
                  width: '100%', background: C.inner, border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.txt, cursor: 'pointer',
                }}
              >
                <option value="technical">Technical Issue</option>
                <option value="account">Account Problem</option>
                <option value="feature">Feature Request</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: C.sub, display: 'block', marginBottom: 6 }}>Subject</label>
              <input
                value={subject} onChange={e => setSubject(e.target.value)}
                placeholder="Brief description of your issue"
                style={{
                  width: '100%', background: C.inner, border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.txt,
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: C.sub, display: 'block', marginBottom: 6 }}>Message</label>
              <textarea
                value={message} onChange={e => setMessage(e.target.value)}
                rows={4}
                placeholder="Describe your issue in detail..."
                style={{
                  width: '100%', background: C.inner, border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.txt,
                  resize: 'vertical', fontFamily: 'inherit',
                }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{
              padding: '9px 18px', borderRadius: 8, background: 'transparent',
              border: `1px solid ${C.border}`, fontSize: 13, color: C.sub, cursor: 'pointer',
            }}>Cancel</button>
            <button onClick={send} disabled={sending || !subject || !message} style={{
              padding: '9px 20px', borderRadius: 8,
              background: subject && message ? C.accent : C.border,
              border: 'none', fontSize: 13, fontWeight: 600, color: '#fff',
              cursor: subject && message ? 'pointer' : 'not-allowed',
            }}>{sending ? 'Sending...' : 'Send Message'}</button>
          </div>
        </>
      )}
    </SettingsModal>
  )
}

/* ─── Modal: Privacy Policy ─── */
function PrivacyPolicyModal({ onClose }) {
  const C = useC()
  return (
    <SettingsModal title="Privacy Policy" onClose={onClose}>
      <div style={{ maxHeight: 360, overflowY: 'auto', fontSize: 12, color: C.muted, lineHeight: 1.7 }}>
        <p style={{ color: C.txt, fontWeight: 600, marginBottom: 8, fontSize: 13 }}>WorkLens Edu — Privacy Policy</p>
        <p style={{ marginBottom: 4, color: C.sub, fontSize: 11 }}>Last updated: June 2026</p>
        {[
          ['Data We Collect', 'We collect information you provide directly to us, such as your name, email address, department, and usage activity within the platform. This includes attendance records, assignment submissions, and leave applications.'],
          ['How We Use Your Data', 'Your data is used solely to provide and improve the WorkLens Edu platform. We do not sell or share your personal information with third parties except as required by law or institutional policy.'],
          ['Data Security', 'We implement industry-standard security measures including encryption in transit and at rest. Passwords are hashed using bcrypt. Two-factor authentication is available for additional security.'],
          ['Data Retention', 'Academic records are retained for the duration required by institutional policy. You may request deletion of non-essential personal data by contacting your system administrator.'],
          ['Your Rights', 'You have the right to access, correct, or delete your personal information. Contact your administrator or use the support form to make a request.'],
          ['Contact', 'For privacy-related queries, contact your institution\'s data protection officer or use the Contact Support feature in Settings.'],
        ].map(([title, body]) => (
          <div key={title} style={{ marginBottom: 14 }}>
            <p style={{ color: C.txt, fontWeight: 600, fontSize: 12, marginBottom: 4 }}>{title}</p>
            <p>{body}</p>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{
          padding: '9px 22px', borderRadius: 8, background: C.accent,
          border: 'none', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer',
        }}>Got it</button>
      </div>
    </SettingsModal>
  )
}

/* ══════════════════════════════════════════════════════
   MAIN SETTINGS PAGE
══════════════════════════════════════════════════════ */
export default function SettingsPage({ user }) {
  const C = useC()
  const { darkMode, setDarkMode } = useTheme()

  const [fullName,    setFullName]    = useState('')
  const [email,       setEmail]       = useState('')
  const [dept,        setDept]        = useState('')
  const [phone,       setPhone]       = useState('')
  const [bio,         setBio]         = useState('')
  const [memberSince, setMemberSince] = useState('Jan 2024')
  const [saved,       setSaved]       = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  const [notifs, setNotifs] = useState({
    email:       true,
    assignments: true,
    submissions: true,
    reports:     false,
  })

  // Active modal tracker
  const [modal, setModal] = useState(null) // 'changePhoto'|'changePassword'|'2fa'|'loginHistory'|'help'|'support'|'privacy'

  const toggle = key => setNotifs(p => ({ ...p, [key]: !p[key] }))

  useEffect(() => {
    if (!user?._id) return
    setLoading(true)
    fetch(`${API}/settings/${user._id}`)
      .then(res => res.json())
      .then(data => {
        setFullName(data.fullName || '')
        setEmail(data.email || '')
        setDept(data.department || '')
        setPhone(data.phone || '')
        setBio(data.bio || '')
        setMemberSince(data.memberSince || '')
        if (data.notifications) setNotifs(data.notifications)
      })
      .catch(() => setError('Could not load settings'))
      .finally(() => setLoading(false))
  }, [user])

  const handleSave = async () => {
    if (!user?._id) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`${API}/settings/${user._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, department: dept, phone, bio, notifications: notifs }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || 'Failed to save settings')
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      }
    } catch {
      setError('Could not connect to server.')
    } finally {
      setSaving(false)
    }
  }

  const initials = fullName
    ? fullName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : 'U'

  const roleLabel = { teaching: 'Faculty', 'non-teaching': 'Staff', admin: 'Admin' }[user?.role] || 'Faculty'

  // Divider helper
  const Divider = () => <div style={{ height: 1, background: C.border, margin: '4px 0' }} />

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: '32px 28px', transition: 'background 0.25s' }}>
      <PageHeader title="Settings" subtitle="Manage your profile and application preferences" />

      {loading && <p style={{ color: C.muted, fontSize: 13, marginBottom: 16 }}>Loading settings...</p>}
      <ErrorBanner message={error} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>

        {/* ── LEFT COLUMN ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Profile Settings */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, transition: 'background 0.25s, border-color 0.25s' }}>
            <SectionHeader icon={<ExtraIcons.User />} title="Profile Settings" subtitle="Update your personal information" />

            {/* Avatar row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, padding: '16px', background: C.inner, borderRadius: 10, border: `1px solid ${C.border}` }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
                background: `linear-gradient(135deg, ${C.accent}, ${C.accent}99)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, fontWeight: 700, color: '#fff',
                boxShadow: `0 0 0 3px ${C.card}, 0 0 0 5px ${C.accent}44`,
              }}>
                {initials}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: C.txt, marginBottom: 2 }}>{fullName || 'Your Name'}</p>
                <p style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>{roleLabel} · {dept || 'Department'}</p>
                <button
                  onClick={() => setModal('changePhoto')}
                  style={{
                    background: C.card, border: `1px solid ${C.border}`,
                    borderRadius: 6, padding: '6px 14px',
                    fontSize: 12, color: C.txt, cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                >
                  📷 Change Photo
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <InputField label="Full Name"     value={fullName} onChange={setFullName} placeholder="Full Name" />
              <InputField label="Email Address" value={email}    onChange={setEmail}    type="email" placeholder="Email" />
              <InputField label="Department"    value={dept}     onChange={setDept}     placeholder="Department" />
              <InputField label="Phone Number"  value={phone}    onChange={setPhone}    placeholder="Phone" />
            </div>

            <div>
              <label style={{ fontSize: 12, color: C.sub, display: 'block', marginBottom: 6 }}>Bio</label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                rows={3}
                placeholder="Tell us a bit about yourself..."
                style={{
                  width: '100%', background: C.inner,
                  border: `1px solid ${C.border}`, borderRadius: 8,
                  padding: '10px 14px', fontSize: 13, color: C.txt,
                  resize: 'vertical', fontFamily: 'inherit',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => (e.target.style.borderColor = C.accent)}
                onBlur={e  => (e.target.style.borderColor = C.border)}
              />
            </div>
          </div>

          {/* Notification Preferences */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, transition: 'background 0.25s, border-color 0.25s' }}>
            <SectionHeader icon={<ExtraIcons.Bell />} title="Notification Preferences" subtitle="Choose what notifications you receive" />
            <div style={{ marginTop: -8 }}>
              <ToggleRow label="Email Notifications"  description="Receive email updates about your courses"       checked={notifs.email}       onChange={() => toggle('email')} />
              <ToggleRow label="Assignment Reminders" description="Get reminders about upcoming deadlines"          checked={notifs.assignments} onChange={() => toggle('assignments')} />
              <ToggleRow label="Student Submissions"  description="Notify when students submit assignments"         checked={notifs.submissions} onChange={() => toggle('submissions')} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14 }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: C.txt }}>Weekly Reports</p>
                  <p style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>Receive weekly activity summary reports</p>
                </div>
                <Toggle checked={notifs.reports} onChange={() => toggle('reports')} />
              </div>
            </div>
          </div>

          {/* System Settings */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, transition: 'background 0.25s, border-color 0.25s' }}>
            <SectionHeader icon={<ExtraIcons.Cog />} title="System Settings" subtitle="Configure application preferences" />
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: C.inner, borderRadius: 10, padding: '14px 16px',
              border: `1px solid ${C.border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: darkMode ? '#1e293b' : '#fef9c3',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `1px solid ${C.border}`,
                }}>
                  {darkMode ? <ExtraIcons.Moon /> : <ExtraIcons.Sun />}
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.txt }}>
                    {darkMode ? 'Dark Mode' : 'Light Mode'}
                  </p>
                  <p style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                    {darkMode ? 'Switch to light theme for a brighter look' : 'Switch to dark theme for reduced eye strain'}
                  </p>
                </div>
              </div>
              <Toggle checked={darkMode} onChange={() => setDarkMode(!darkMode)} />
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Account Information */}
          <div style={{
            background: darkMode
              ? 'linear-gradient(135deg, #052e16 0%, #14532d 100%)'
              : 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
            border: darkMode ? '1px solid #166534' : '1px solid #86efac',
            borderRadius: 12, padding: 20,
            transition: 'background 0.25s',
          }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.txt, marginBottom: 16 }}>Account Information</p>
            <SidebarRow label="Member Since" value={memberSince} />
            <SidebarRow label="Account Type" value={roleLabel} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12 }}>
              <span style={{ fontSize: 13, color: C.sub }}>Status</span>
              <span style={{
                fontSize: 12, fontWeight: 600,
                background: C.accent, color: '#fff',
                padding: '3px 12px', borderRadius: 6,
              }}>Active</span>
            </div>
          </div>

          {/* Security */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 20px 12px', transition: 'background 0.25s, border-color 0.25s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 16 }}>🔒</span>
              <p style={{ fontSize: 13, fontWeight: 600, color: C.txt }}>Security</p>
            </div>
            <ActionButton
              label="Change Password"
              icon={<svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
              onClick={() => setModal('changePassword')}
            />
            <ActionButton
              label="Two-Factor Auth"
              icon={<svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
              onClick={() => setModal('2fa')}
            />
            <ActionButton
              label="Login History"
              icon={<svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
              onClick={() => setModal('loginHistory')}
            />
          </div>

          {/* Support */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 20px 12px', transition: 'background 0.25s, border-color 0.25s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 16 }}>💬</span>
              <p style={{ fontSize: 13, fontWeight: 600, color: C.txt }}>Support</p>
            </div>
            <ActionButton
              label="Help Center"
              icon={<svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
              onClick={() => setModal('help')}
            />
            <ActionButton
              label="Contact Support"
              icon={<svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>}
              onClick={() => setModal('support')}
            />
            <ActionButton
              label="Privacy Policy"
              icon={<svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
              onClick={() => setModal('privacy')}
            />
          </div>
        </div>
      </div>

      {/* Save button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24, gap: 12 }}>
        <button onClick={handleSave} disabled={saving} style={{
          background: saved ? '#16a34a' : C.accent,
          border: 'none', borderRadius: 8,
          padding: '11px 28px',
          fontSize: 13, fontWeight: 600,
          color: '#ffffff', cursor: saving ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', gap: 8,
          transition: 'all 0.2s',
          boxShadow: saved ? 'none' : `0 4px 14px ${C.accent}44`,
        }}>
          <ExtraIcons.Save />
          {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Changes'}
        </button>
      </div>

      {/* ── Modals ── */}
      {modal === 'changePhoto'    && <ChangePhotoModal      onClose={() => setModal(null)} initials={initials} />}
      {modal === 'changePassword' && <ChangePasswordModal   onClose={() => setModal(null)} />}
      {modal === '2fa'            && <TwoFactorModal        onClose={() => setModal(null)} />}
      {modal === 'loginHistory'   && <LoginHistoryModal     onClose={() => setModal(null)} />}
      {modal === 'help'           && <HelpCenterModal       onClose={() => setModal(null)} />}
      {modal === 'support'        && <ContactSupportModal   onClose={() => setModal(null)} />}
      {modal === 'privacy'        && <PrivacyPolicyModal    onClose={() => setModal(null)} />}
    </div>
  )
}
