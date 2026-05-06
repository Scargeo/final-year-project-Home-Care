import Link from "next/link"
import styles from "../home/home.module.css"

export default function DashboardPage() {
  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <Link href="/secure/home" className={styles.brand}>
          <span className={styles.brandMark}>+</span>
          <span className={styles.brandText}>Home Care+</span>
        </Link>
      </header>

      <div className={styles.layout}>
        <section style={{ padding: "2rem" }}>
          <h1>Patient Dashboard</h1>
          <p>This is your dashboard. Add widgets and summaries here.</p>
          <p>
            Go back to <Link href="/secure/home">Home</Link>
          </p>
        </section>
      </div>
    </main>
  )
}
