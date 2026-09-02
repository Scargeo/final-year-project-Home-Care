"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

const AUTH_KEYS = ["patientAuth", "doctorAuth", "nurseAuth", "adminAuth"]

export default function SecurePageGuard({ children, allowedRoles = null }) {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [userRole, setUserRole] = useState(null)

  useEffect(() => {
    // Check if user is authenticated by looking for valid auth token in localStorage
    function checkAuth() {
      if (typeof window === "undefined") return

      let foundAuth = false
      let foundRole = null

      for (const key of AUTH_KEYS) {
        const raw = window.localStorage.getItem(key)
        if (!raw) continue

        try {
          const auth = JSON.parse(raw)
          const token = auth?.token || auth?.accessToken

          // Check if token exists and is not expired
          if (token) {
            // Decode token to check expiry
            try {
              const payload = token.split(".")[1]
              if (payload) {
                const decoded = JSON.parse(
                  window.atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
                )
                const exp = decoded.exp * 1000
                if (exp > Date.now()) {
                  foundAuth = true
                  foundRole = auth.role || key.replace("Auth", "")
                  break
                }
              }
            } catch {
              // ignore decode errors
            }
          }
        } catch {
          // ignore parse errors
        }
      }

      // Check role restrictions if specified
      if (foundAuth && allowedRoles && !allowedRoles.includes(foundRole)) {
        setIsAuthenticated(false)
        setUserRole(null)
        setIsLoading(false)
        router.replace("/login")
        return
      }

      if (foundAuth) {
        setIsAuthenticated(true)
        setUserRole(foundRole)
        setIsLoading(false)
      } else {
        setIsAuthenticated(false)
        setUserRole(null)
        setIsLoading(false)
        router.replace("/login")
      }
    }

    checkAuth()
  }, [allowedRoles, router])

  if (isLoading) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "#f3f6f8",
      }}>
        <p style={{ color: "#666", fontSize: "1rem" }}>Loading...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return children
}
