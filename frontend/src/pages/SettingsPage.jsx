import React, { useState, useEffect } from 'react'
import {
  useC,
  Card, SectionHeader, InputField, Toggle, ToggleRow,
  SidebarRow, SidebarButton, PageHeader, ErrorBanner, Icons, ExtraIcons,
} from '../components/UI'
import { useTheme } from '../ThemeContext'

const API = 'http://localhost:8000/api'

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

  const toggle = key => setNotifs(p => ({ ...p, [key]: !p[key] }))

  useEffect(() => {
    if (!user?._id) return;
    setLoading(true);
    fetch(`${API}/settings/${user._id}`)
      .then(res => res.json())
      .then(data => {
        console.log("SETTINGS DATA:", data);
        setFullName(data.fullName || '')
        setEmail(data.email || '')
        setDept(data.department || '')
        setPhone(data.phone || '')
        setBio(data.bio || '')
        setMemberSince(data.memberSince || '')
        if (data.notifications) {
          setNotifs(data.notifications)
        }
      })
      .catch(err => {
        console.error(err)
        setError('Could not load settings')
      })
      .finally(() => setLoading(false))
  }, [user]);

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

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: '32px 28px', transition: 'background 0.3s' }}>
      <PageHeader title="Settings" subtitle="Manage your profile and application preferences" />

      {loading && <p style={{ color: C.muted, fontSize: 13, marginBottom: 16 }}>Loading settings...</p>}
      <ErrorBanner message={error} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>

        {/* ── LEFT COLUMN ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Profile Settings */}
          <Card>
            <SectionHeader icon={<ExtraIcons.User />} title="Profile Settings" subtitle="Update your personal information" />

            {/* Avatar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: C.accent, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff',
              }}>
                {initials}
              </div>
              <div>
                <p style={{ fontSize: 13, color: C.sub, marginBottom: 6 }}>Profile Photo</p>
                <button style={{
                  background: C.inner, border: `1px solid ${C.border}`,
                  borderRadius: 6, padding: '6px 14px',
                  fontSize: 12, color: C.txt, cursor: 'pointer',
                }}>Change Photo</button>
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
                style={{
                  width: '100%', background: C.inner,
                  border: `1px solid ${C.border}`, borderRadius: 8,
                  padding: '10px 14px', fontSize: 13, color: C.txt,
                  resize: 'vertical', fontFamily: 'inherit',
                }}
                onFocus={e => (e.target.style.borderColor = C.accent)}
                onBlur={e  => (e.target.style.borderColor = C.border)}
              />
            </div>
          </Card>

          {/* Notification Preferences */}
          <Card>
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
          </Card>

          {/* System Settings */}
          <Card>
            <SectionHeader icon={<ExtraIcons.Cog />} title="System Settings" subtitle="Configure application preferences" />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {darkMode ? <ExtraIcons.Moon /> : <ExtraIcons.Sun />}
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: C.txt }}>Dark Mode</p>
                  <p style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                    {darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
                  </p>
                </div>
              </div>
              <Toggle checked={darkMode} onChange={setDarkMode} />
            </div>
          </Card>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Account Information */}
          <div style={{
            background: darkMode
              ? 'linear-gradient(135deg, #1a3a2a 0%, #14532d 100%)'
              : 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
            border: darkMode ? '1px solid #166534' : '1px solid #86efac',
            borderRadius: 12,
            padding: 20,
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

          <Card style={{ padding: '20px 20px 8px' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.txt, marginBottom: 8 }}>Security</p>
            <SidebarButton label="Change Password" />
            <SidebarButton label="Two-Factor Auth" />
            <SidebarButton label="Login History" />
          </Card>

          <Card style={{ padding: '20px 20px 8px' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.txt, marginBottom: 8 }}>Support</p>
            <SidebarButton label="Help Center" />
            <SidebarButton label="Contact Support" />
            <SidebarButton label="Privacy Policy" />
          </Card>
        </div>
      </div>

      {/* Save button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
        <button onClick={handleSave} disabled={saving} style={{
          background: saved ? '#16a34a' : C.accent,
          border: 'none', borderRadius: 8,
          padding: '10px 24px',
          fontSize: 13, fontWeight: 600,
          color: '#ffffff', cursor: saving ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', gap: 8,
          transition: 'all 0.2s',
        }}>
          <ExtraIcons.Save />
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
