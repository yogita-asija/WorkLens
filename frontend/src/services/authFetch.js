/**
 * Adds `Authorization: Bearer <token>` to every request that goes to the WorkLens API, so none of the
 * existing fetch() calls have to change. If the server answers 401 (token missing/expired) the user is
 * logged out and sent back to the login screen.
 */
export const TOKEN_KEY = "worklens_token"
const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000"

export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } }
export const setToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ } }

export function installAuthFetch() {
  if (window.__worklensAuthFetch) return
  window.__worklensAuthFetch = true
  const original = window.fetch.bind(window)

  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input?.url || ""
    const isApi = url.startsWith(`${BASE}/api`)
    const isLogin = url.startsWith(`${BASE}/api/auth/login`)
    if (!isApi || isLogin) return original(input, init)

    const headers = new Headers(init.headers || (typeof input !== "string" && input.headers) || {})
    const token = getToken()
    if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`)

    const res = await original(input, { ...init, headers })
    if (res.status === 401) {
      setToken(null)
      try { localStorage.removeItem("worklens_user") } catch { /* ignore */ }
      window.location.reload()      // App shows <LoginPage /> when there is no user
    }
    return res
  }
}
