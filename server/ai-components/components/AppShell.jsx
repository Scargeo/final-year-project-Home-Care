"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { clearAuth, loadAuth } from "../lib/auth-client.js"
import { getRoleAllowedPaths, getRoleHome } from "../lib/auth-config.js"

function cx(...parts) {
  return parts.filter(Boolean).join(" ")
}

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/appointments", label: "Appointments" },
  { href: "/telehealth", label: "Telehealth" },
  { href: "/patients", label: "Patients" },
  { href: "/family", label: "Family portal" },
  { href: "/doctors", label: "Care team" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/medical-imaging", label: "Medical imaging" },
  { href: "/notifications", label: "Notifications" },
  { href: "/sos", label: "SOS" },
  { href: "/billing", label: "Billing" },
  { href: "/reports", label: "Reports" },
  { href: "/pharmacies", label: "Pharmacies" },
  { href: "/ai-assistant", label: "AI assistant" },
  { href: "/rider", label: "Rider" },
  { href: "/integrations", label: "Integrations" },
  { href: "/community", label: "Community" },
  { href: "/admin", label: "Admin" },
  { href: "/secure/chat", label: "Secure Chat" },
]

export default function AppShell({ title, children }) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(true)
  const auth = loadAuth()
  const role = auth?.user?.role
  const roleAllowed = getRoleAllowedPaths(role)
  const navItems = NAV.filter((item) => roleAllowed.some((prefix) => item.href === prefix || item.href.startsWith(`${prefix}/`)))

  let activeHref = ""
  {
    const exact = navItems.find((n) => n.href === pathname)
    if (exact) activeHref = exact.href
    else {
      const prefix = navItems.find((n) => n.href !== "/" && pathname?.startsWith(n.href + "/"))
      activeHref = prefix?.href || ""
    }
  }

  function logout() {
    clearAuth()
    router.replace("/auth")
  }

  return (
    <div className="hcShell">
      <aside className={cx("hcSidebar", open ? "hcSidebar--open" : "hcSidebar--closed")} aria-label="Primary">
        <div className="hcSidebar__top">
          <div className="hcSidebar__brand">
            <span className="hcSidebar__logo" aria-hidden="true" />
            {open ? <span className="hcSidebar__brandText">Home Care Plus</span> : null}
          </div>
          <button className="hcIconBtn" type="button" onClick={() => setOpen((v) => !v)} aria-label={open ? "Collapse sidebar" : "Expand sidebar"}>
            {open ? "⟨" : "⟩"}
          </button>
        </div>

        <nav className="hcNav" aria-label="Sections">
          {navItems.map((item) => {
            const active = item.href === activeHref
            return (
              <Link key={item.href} href={item.href} className={cx("hcNav__item", active ? "hcNav__item--active" : "")}>
                <span className="hcNav__dot" aria-hidden="true" />
                {open ? <span className="hcNav__label">{item.label}</span> : null}
              </Link>
            )
          })}
        </nav>

        <div className="hcSidebar__bottom">
          {open ? (
            <div className="hcSidebar__hint">
              Tip: you can collapse this sidebar any time.
            </div>
          ) : null}
        </div>
      </aside>

      <div className="hcMain">
        <header className="hcTopbar">
          <div className="hcTopbar__left">
            <button className="hcIconBtn hcIconBtn--mobile" type="button" onClick={() => setOpen((v) => !v)} aria-label={open ? "Close menu" : "Open menu"}>
              ☰
            </button>
            <div className="hcTopbar__title">{title}</div>
          </div>
          <div className="hcTopbar__right">
            <Link className="hcTopbar__link" href={getRoleHome(role)}>
              Home
            </Link>
            <Link className="hcTopbar__link" href="/">
              Landing
            </Link>
            <button className="hcTopbar__link" type="button" onClick={logout}>
              Logout
            </button>
          </div>
        </header>

        <main className="hcContent">{children}</main>
      </div>
    </div>
  )
}

