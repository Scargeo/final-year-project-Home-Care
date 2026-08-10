"use client"

import Link from "next/link"
import { useState } from "react"
import styles from "../home/home.module.css"
import NotificationsPanel from "../components/NotificationsPanel"

function getDashboardHref() {
  if (typeof window === "undefined") return "/secure/dashboard"
  try {
    const nurseAuth = window.localStorage.getItem("nurseAuth")
    if (nurseAuth) return "/secure/nurse"
    const doctorAuth = window.localStorage.getItem("doctorAuth")
    if (doctorAuth) return "/secure/doctor"
  } catch {
    // ignore storage access errors
  }
  return "/secure/dashboard"
}

export default function NotificationsPage() {
  const [dashboardHref] = useState(() => getDashboardHref())

  return (
    <main className={styles.page} style={{ overflowY: "auto", overflowX: "hidden" }}>
      <header className={styles.topBar}>
        <Link href="/secure/home" className={styles.brand}>
          <span className={styles.brandMark}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M12 2l8 4v6c0 5-3.4 9.6-8 10-4.6-.4-8-5-8-10V6l8-4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              <path d="M9.5 12l1.8 1.8L15.5 9.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <span className={styles.brandText}>Home Care+</span>
        </Link>

        <div className={styles.topActions}>
          <Link href="/secure/home" className={`${styles.action} ${styles.actionGhost}`}>
            Home
          </Link>
          <Link href={dashboardHref} className={`${styles.action} ${styles.actionGhost} ${styles.desktopOnlyAction}`}>
            Dashboard
          </Link>
          <Link href="/secure/emergency" className={`${styles.action} ${styles.actionDanger}`}>
            <span className={styles.emergencyLabel}>Emergency</span>
            <span className={styles.sosLabel}>SOS</span>
          </Link>
        </div>
      </header>

      <section className={styles.layout} style={{ display: "block" }}>
        <NotificationsPanel variant="full" />
      </section>
    </main>
  )
}
