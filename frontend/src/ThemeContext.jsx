import React, { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [darkMode, setDarkModeState] = useState(() => {
    const stored = localStorage.getItem('worklens-dark-mode')
    return stored !== null ? stored === 'true' : true
  })

  useEffect(() => {
    const html = document.documentElement
    if (darkMode) {
      html.classList.add('dark')
      html.classList.remove('light')
      document.body.style.backgroundColor = '#0A0A0A'
      document.body.style.color = '#FFFFFF'
    } else {
      html.classList.remove('dark')
      html.classList.add('light')
      document.body.style.backgroundColor = '#F3F4F6'
      document.body.style.color = '#111827'
    }
  }, [darkMode])

  const setDarkMode = (val) => {
    const next = typeof val === 'boolean' ? val : !darkMode
    localStorage.setItem('worklens-dark-mode', String(next))
    setDarkModeState(next)
  }

  return (
    <ThemeContext.Provider value={{ darkMode, setDarkMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

export function getColors(darkMode) {
  if (darkMode) {
    return {
      bg:     '#0A0A0A',
      card:   '#171717',
      inner:  '#1f1f1f',
      border: '#2a2a2a',
      accent: '#22C55E',
      warn:   '#CA8A04',
      danger: '#EF4444',
      txt:    '#FFFFFF',
      sub:    '#9CA3AF',
      muted:  '#6B7280',
      track:  '#374151',
    }
  } else {
    return {
      bg:     '#F3F4F6',
      card:   '#FFFFFF',
      inner:  '#F9FAFB',
      border: '#E5E7EB',
      accent: '#16A34A',
      warn:   '#D97706',
      danger: '#EF4444',
      txt:    '#111827',
      sub:    '#6B7280',
      muted:  '#9CA3AF',
      track:  '#E5E7EB',
    }
  }
}
