import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'

/**
 * Theme system
 *  - preference: 'light' | 'dark' | 'system'   (persisted in localStorage)
 *  - resolvedTheme: 'light' | 'dark'           (what is actually applied)
 *  - 'system' follows the OS live via prefers-color-scheme
 *  - applied as class on <html> (+ data-theme, color-scheme, theme-color meta)
 *  - index.html has a tiny inline script that applies it before first paint (no flash)
 */
export const THEME_KEY = 'worklens-theme'
const LEGACY_KEY = 'worklens-dark-mode'
// Change to 'dark' to keep the old "dark unless told otherwise" behaviour.
const DEFAULT_PREFERENCE = 'system'

const ThemeContext = createContext()

const safeGet = (k) => { try { return localStorage.getItem(k) } catch { return null } }
const safeSet = (k, v) => { try { localStorage.setItem(k, v) } catch { /* private mode */ } }
const safeDel = (k) => { try { localStorage.removeItem(k) } catch { /* noop */ } }

const systemTheme = () =>
  typeof window !== 'undefined' && window.matchMedia &&
  window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'

function readPreference() {
  const s = safeGet(THEME_KEY)
  if (s === 'light' || s === 'dark' || s === 'system') return s
  const legacy = safeGet(LEGACY_KEY)           // migrate the old boolean key
  if (legacy === 'true') return 'dark'
  if (legacy === 'false') return 'light'
  return DEFAULT_PREFERENCE
}

let switchTimer
function applyTheme(resolved, animate) {
  const html = document.documentElement
  if (animate) {
    html.classList.add('theme-switching')
    clearTimeout(switchTimer)
    switchTimer = setTimeout(() => html.classList.remove('theme-switching'), 350)
  }
  html.classList.toggle('dark', resolved === 'dark')
  html.classList.toggle('light', resolved === 'light')
  html.dataset.theme = resolved
  html.style.colorScheme = resolved
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0A0A0A' : '#F3F4F6')
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readPreference)
  const [system, setSystem] = useState(systemTheme)
  const resolvedTheme = theme === 'system' ? system : theme

  // follow the OS
  useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const on = () => setSystem(mq.matches ? 'light' : 'dark')
    mq.addEventListener ? mq.addEventListener('change', on) : mq.addListener(on)
    return () => { mq.removeEventListener ? mq.removeEventListener('change', on) : mq.removeListener(on) }
  }, [])

  // sync other tabs
  useEffect(() => {
    const on = (e) => { if (e.key === THEME_KEY) setThemeState(readPreference()) }
    window.addEventListener('storage', on)
    return () => window.removeEventListener('storage', on)
  }, [])

  // apply; animate only for changes after first render
  const first = React.useRef(true)
  useEffect(() => {
    applyTheme(resolvedTheme, !first.current)
    first.current = false
  }, [resolvedTheme])

  const setTheme = useCallback((next) => {
    if (next !== 'light' && next !== 'dark' && next !== 'system') return
    safeSet(THEME_KEY, next)
    safeDel(LEGACY_KEY)
    setThemeState(next)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }, [resolvedTheme, setTheme])

  // back-compat: setDarkMode(bool) or setDarkMode() to flip
  const setDarkMode = useCallback((val) => {
    setTheme(typeof val === 'boolean' ? (val ? 'dark' : 'light') : (resolvedTheme === 'dark' ? 'light' : 'dark'))
  }, [resolvedTheme, setTheme])

  const value = useMemo(() => ({
    theme, resolvedTheme, darkMode: resolvedTheme === 'dark',
    setTheme, setDarkMode, toggleTheme,
  }), [theme, resolvedTheme, setTheme, setDarkMode, toggleTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}

export function getColors(darkMode) {
  if (darkMode) {
    return {
      bg: '#0A0A0A', card: '#171717', inner: '#1f1f1f', border: '#2a2a2a',
      accent: '#22C55E', warn: '#CA8A04', danger: '#EF4444',
      txt: '#FFFFFF', sub: '#9CA3AF', muted: '#6B7280', track: '#374151',
    }
  }
  return {
    bg: '#F3F4F6', card: '#FFFFFF', inner: '#F9FAFB', border: '#E5E7EB',
    accent: '#16A34A', warn: '#D97706', danger: '#EF4444',
    txt: '#111827', sub: '#6B7280', muted: '#9CA3AF', track: '#E5E7EB',
  }
}
