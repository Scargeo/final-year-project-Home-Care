"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import "../../styles/hc-shell.css"
import { clearAuth, loadAuth, refreshSession } from "../../lib/auth-client.js"
import { getRoleAllowedPaths, getRoleHome } from "../../lib/auth-config.js"

export default function AppLayout({ children }) {
  const pathname = usePathname()
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [allowed, setAllowed] = useState(false)

  const roleBasedPathAllowed = useMemo(() => {
    const auth = loadAuth()
    const role = auth?.user?.role
    if (!role || !pathname) return false
    const routes = getRoleAllowedPaths(role)
    return routes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  }, [pathname])

  useEffect(() => {
    let cancelled = false
    async function run() {
      const auth = loadAuth()
      if (!auth?.token || !auth?.user) {
        clearAuth()
        router.replace("/auth")
        return
      }
      const session = await refreshSession(auth.token)
      if (!session) {
        clearAuth()
        router.replace("/auth")
        return
      }
      if (cancelled) return
      if (!roleBasedPathAllowed) {
        router.replace(getRoleHome(session.user.role))
        return
      }
      setAllowed(true)
      setReady(true)
    }
    run()
    return () => {
      cancelled = true
    }
  }, [router, roleBasedPathAllowed])

  if (!ready || !allowed) return null
  return children
}
