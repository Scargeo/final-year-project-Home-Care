import { getRoleHome } from "./auth-config.js"

const AUTH_KEY = "hc:auth:v1"

export function loadAuth() {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    if (!parsed?.token || !parsed?.user) return null
    return parsed
  } catch {
    return null
  }
}

export function saveAuth(payload) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(payload))
}

export function clearAuth() {
  localStorage.removeItem(AUTH_KEY)
}

export async function signUp(data) {
  const res = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error || "Signup failed.")
  saveAuth(json)
  return json
}

export async function signIn(data) {
  const res = await fetch("/api/auth/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error || "Signin failed.")
  saveAuth(json)
  return json
}

export async function refreshSession(token) {
  const res = await fetch("/api/auth/session", {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  return res.json()
}

export function roleHomeFromAuth(auth) {
  return getRoleHome(auth?.user?.role)
}
