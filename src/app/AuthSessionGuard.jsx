"use client"

import { useEffect } from "react"

const AUTH_KEYS = ["patientAuth", "doctorAuth", "nurseAuth", "adminAuth"]

function getStoredSessions() {
  return AUTH_KEYS.flatMap((key) => {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []

    try {
      const session = JSON.parse(raw)
      return [{ key, session, token: session?.token || session?.accessToken || null }]
    } catch {
      return []
    }
  })
}

function saveRefreshedSession(key, session, data) {
  const nextSession = { ...session, token: data.token, refreshToken: data.refreshToken || session.refreshToken }
  window.localStorage.setItem(key, JSON.stringify(nextSession))
  return nextSession.token
}

function getTokenExpiry(token) {
  try {
    const payload = token.split(".")[1]
    if (!payload) return null
    const decoded = JSON.parse(window.atob(payload.replace(/-/g, "+").replace(/_/g, "/")))
    return typeof decoded.exp === "number" ? decoded.exp * 1000 : null
  } catch {
    return null
  }
}

function clearSessionsAndRedirect() {
  AUTH_KEYS.forEach((key) => window.localStorage.removeItem(key))
  if (!window.location.pathname.startsWith("/login")) {
    window.location.assign("/login")
  }
}

export default function AuthSessionGuard() {
  useEffect(() => {
    let redirecting = false
    let refreshing = false

    async function refreshSession(session) {
      if (!session?.session?.refreshToken) return false

      const response = await window.fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: session.session.refreshToken }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data?.token) return false

      saveRefreshedSession(session.key, session.session, data)
      return true
    }

    async function checkSession() {
      if (redirecting) return

      const expiredSessions = getStoredSessions().filter(({ token }) => {
        const expiry = token && getTokenExpiry(token)
        return expiry !== null && expiry <= Date.now()
      })

      if (expiredSessions.length > 0 && !refreshing) {
        refreshing = true
        const refreshed = await Promise.all(expiredSessions.map(refreshSession))
        refreshing = false
        if (refreshed.every(Boolean)) return
        redirecting = true
        clearSessionsAndRedirect()
      }
    }

    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      const response = await originalFetch(...args)
      if (response.status !== 401 && response.status !== 403) return response

      const requestUrl = args[0] instanceof Request ? args[0].url : String(args[0])
      // Don't clear sessions or redirect during login/signup API calls
      if (requestUrl.includes('/api/auth/login') || requestUrl.includes('/api/auth/verify-email') || requestUrl.includes('/api/patients/register') || requestUrl.includes('/api/doctors/register') || requestUrl.includes('/api/patients/login') || requestUrl.includes('/api/doctors/login')) {
        return response
      }

      const requestHeaders = new Headers(args[1]?.headers || (args[0] instanceof Request ? args[0].headers : undefined))
      const requestToken = requestHeaders.get("authorization")?.replace(/^Bearer\s+/i, "")
      const session = getStoredSessions().find(({ token }) => token && token === requestToken)

      if (response.status === 401 && session?.session?.refreshToken) {
        const refreshResponse = await originalFetch("/api/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: session.session.refreshToken }),
        })
        const refreshData = await refreshResponse.json().catch(() => ({}))
        if (refreshResponse.ok && refreshData?.token) {
          const retryHeaders = new Headers(requestHeaders)
          retryHeaders.set("authorization", `Bearer ${saveRefreshedSession(session.key, session.session, refreshData)}`)
          return originalFetch(args[0], { ...(args[1] || {}), headers: retryHeaders })
        }
      }

      if (getStoredSessions().some(({ token }) => token)) {
        redirecting = true
        clearSessionsAndRedirect()
      }
      return response
    }

    checkSession()
    const intervalId = window.setInterval(checkSession, 1000)
    window.addEventListener("focus", checkSession)
    document.addEventListener("visibilitychange", checkSession)

    return () => {
      window.fetch = originalFetch
      window.clearInterval(intervalId)
      window.removeEventListener("focus", checkSession)
      document.removeEventListener("visibilitychange", checkSession)
    }
  }, [])

  return null
}