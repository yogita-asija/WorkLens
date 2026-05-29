import React, { createContext, useContext, useState } from 'react'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [darkMode, setDarkMode] = useState(true)
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
      card:   '#262626',
      inner:  '#2f2f2f',
      border: '#333333',
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
