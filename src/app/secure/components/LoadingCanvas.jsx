"use client"

import styles from "./LoadingCanvas.module.css"

export default function LoadingCanvas({ title = "Loading", subtitle = "Please wait.", fullScreen = true }) {
  return (
    <div className={`${styles.canvas} ${fullScreen ? styles.fullScreen : styles.inline}`} role="status" aria-live="polite" aria-busy="true">
      <div className={styles.card}>
        <div className={styles.spinner} aria-hidden="true" />
        <div className={styles.copy}>
          <p className={styles.kicker}>{title}</p>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
      </div>
    </div>
  )
}
