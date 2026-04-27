"use client"

import Link from "next/link"
import { useParams, usePathname, useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { canRoleAccess, getRbacMatrix, getSession, logoutUser, subscribeStoreChanges } from "../../../../lib/auth-store"
import { ADVANCED_FEATURE_LIBRARY, SIDEBAR_SECTIONS, getSectionBySlug } from "../../../../lib/portal-config"
import { ROLE_LABELS, ROLE_OPTIONS } from "../../../../lib/roles"

export default function PortalSectionPage() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams()
  const role = String(params.role || "").toLowerCase()
  const sectionSlug = String(params.section || "")
  const [session, setSession] = useState(() => getSession())
  const [rbacMatrix, setRbacMatrix] = useState(() => getRbacMatrix())
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarWidth, setSidebarWidth] = useState(240)

  const section = getSectionBySlug(sectionSlug)
  const isSupportedRole = ROLE_OPTIONS.some((item) => item.value === role)

  useEffect(() => {
    const current = getSession()
    if (!current) {
      router.replace("/login")
      return
    }
    if (current.role !== role) {
      router.replace(`/portal/${current.role}`)
    }
  }, [role, router])

  useEffect(() => {
    const unsub = subscribeStoreChanges(() => {
      setSession(getSession())
      setRbacMatrix(getRbacMatrix())
    })
    return () => unsub()
  }, [])

  const allowedSections = useMemo(
    () => SIDEBAR_SECTIONS.filter((item) => Boolean(rbacMatrix?.[role]?.[item.permission])),
    [role, rbacMatrix],
  )

  if (!isSupportedRole || !section) {
    return (
      <main className="rp-shell">
        <section className="rp-auth-card">
          <h1>Page not found</h1>
          <Link href={`/portal/${role}`}>Back to dashboard</Link>
        </section>
      </main>
    )
  }

  const hasAccess = canRoleAccess(role, section.permission)
  const advancedFeatures = ADVANCED_FEATURE_LIBRARY[sectionSlug] || []

  return (
    <main
      className={`rp-app-shell ${sidebarOpen ? "" : "rp-app-shell-collapsed"}`}
      style={{ "--rp-sidebar-width": `${sidebarWidth}px` }}
    >
      <aside className={`rp-sidebar ${sidebarOpen ? "" : "rp-sidebar-collapsed"}`}>
        <div className="rp-brand">
          <span className="rp-brand-dot" />
          {sidebarOpen ? <span>Home Care Plus</span> : null}
          <button type="button" className="rp-sidebar-toggle" onClick={() => setSidebarOpen((value) => !value)}>
            {sidebarOpen ? "‹" : "›"}
          </button>
        </div>
        <nav className="rp-menu">
          <Link href={`/portal/${role}`} className={`rp-menu-item ${pathname === `/portal/${role}` ? "rp-menu-item-active" : ""}`}>
            {sidebarOpen ? "Dashboard" : "D"}
          </Link>
          {allowedSections.map((item) => (
            <Link
              key={item.slug}
              href={`/portal/${role}/${item.slug}`}
              className={`rp-menu-item ${pathname === `/portal/${role}/${item.slug}` ? "rp-menu-item-active" : ""}`}
            >
              {sidebarOpen ? item.label : item.label.slice(0, 1)}
            </Link>
          ))}
          <Link href="/secure/chat" className="rp-menu-item">{sidebarOpen ? "Secure chat" : "C"}</Link>
        </nav>
      </aside>

      <section className="rp-main">
        <header className="rp-main-top">
          <div className="rp-main-top-left">
            <button type="button" className="rp-mobile-menu-btn" onClick={() => setSidebarOpen((value) => !value)}>
              Menu
            </button>
            <h1>{section.label}</h1>
          </div>
          <div className="rp-inline-actions">
            <label className="rp-sidebar-width-control">
              <span>Sidebar</span>
              <input
                type="range"
                min="200"
                max="340"
                value={sidebarWidth}
                onChange={(event) => setSidebarWidth(Number(event.target.value))}
              />
            </label>
            <Link href="/" className="rp-btn">Home</Link>
            <Link href="/" className="rp-btn">Landing</Link>
            <button
              type="button"
              className="rp-btn"
              onClick={() => {
                logoutUser()
                router.push("/login")
              }}
            >
              Logout
            </button>
          </div>
        </header>

        {!hasAccess ? (
          <section className="rp-panel">
            <h2>Access denied by RBAC</h2>
            <p>
              Your role (<strong>{ROLE_LABELS[role]}</strong>) currently does not have permission for
              <code> {section.permission}</code>. Ask admin to update RBAC matrix.
            </p>
          </section>
        ) : (
          <>
            <section className="rp-panel">
              <h2>{section.label} module</h2>
              <p>
                Logged in as <strong>{session?.fullName || "Unknown user"}</strong>. This page is responsive and
                permission-controlled in real time.
              </p>
            </section>

            <section className="rp-two-col">
              <article className="rp-panel">
                <h3>Advanced features</h3>
                <div className="rp-chip-wrap">
                  {advancedFeatures.map((feature) => (
                    <button key={feature} type="button" className="rp-chip">
                      {feature}
                    </button>
                  ))}
                </div>
              </article>
              <article className="rp-panel">
                <h3>Real-time status</h3>
                <ul className="rp-bullets">
                  <li>RBAC matrix sync: active</li>
                  <li>Sidebar permission filter: active</li>
                  <li>Cross-tab updates: active</li>
                  <li>Role guard: active</li>
                </ul>
              </article>
            </section>
          </>
        )}
      </section>
    </main>
  )
}
