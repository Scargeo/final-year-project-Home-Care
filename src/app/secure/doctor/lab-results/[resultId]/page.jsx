"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import styles from "./lab-result.module.css"

function getStoredToken() {
  if (typeof window === "undefined") return null
  try {
    const patientAuth = window.localStorage.getItem("patientAuth")
    const doctorAuth = window.localStorage.getItem("doctorAuth")
    const parsed = patientAuth ? JSON.parse(patientAuth) : doctorAuth ? JSON.parse(doctorAuth) : null
    return parsed?.token || parsed?.accessToken || null
  } catch {
    return null
  }
}

function formatDateTime(value) {
  if (!value) return "Unknown"
  try {
    return new Date(value).toLocaleString()
  } catch {
    return String(value)
  }
}

export default function LabResultPage() {
  const params = useParams()
  const resultId = Array.isArray(params?.resultId) ? params.resultId[0] : params?.resultId
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [result, setResult] = useState(null)

  useEffect(() => {
    let active = true

    async function loadResult() {
      if (!resultId) {
        setError("Missing lab result id.")
        setLoading(false)
        return
      }

      setLoading(true)
      setError("")

      try {
        const headers = {}
        const token = getStoredToken()
        if (token) headers.authorization = `Bearer ${token}`

        const response = await fetch(`/api/ai/lab-results/${encodeURIComponent(resultId)}`, {
          cache: "no-store",
          headers,
        })

        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(data?.error || data?.details || "Could not load the lab interpretation.")
        }

        if (!active) return
        setResult(data?.result || null)
      } catch (err) {
        if (active) {
          setError(err?.message || "Could not load the lab interpretation.")
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    loadResult()

    return () => {
      active = false
    }
  }, [resultId])

  const interpretation = result?.interpretation || null

  const summaryText = useMemo(() => {
    if (!interpretation?.summary) return "No summary available."
    return interpretation.summary
  }, [interpretation])

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <Link href="/secure/doctor" className={styles.backLink}>
          ← Back to dashboard
        </Link>
        <div className={styles.pageTitleWrap}>
          <p className={styles.kicker}>Doctor Lab Result</p>
          <h1 className={styles.pageTitle}>Interpretation Report</h1>
        </div>
      </header>

      <section className={styles.shell}>
        {loading ? (
          <div className={styles.stateCard}>Loading interpretation...</div>
        ) : error ? (
          <div className={styles.stateCardError}>{error}</div>
        ) : result ? (
          <div className={styles.layout}>
            <aside className={styles.sidebar}>
              <div className={styles.sidebarCard}>
                <h2>Quick Navigation</h2>
                <a href="#summary">Summary</a>
                <a href="#findings">Key Findings</a>
                <a href="#normal">Normal Values</a>
                <a href="#abnormal">Abnormal Values</a>
                <a href="#recommendations">Recommendations</a>
                <a href="#raw-text">Raw Text</a>
              </div>
            </aside>

            <section className={styles.content}>
              <article className={styles.heroCard}>
                <div>
                  <p className={styles.heroLabel}>{result.status || "completed"}</p>
                  <h2>{result.testType || "Lab Result"}</h2>
                  <p className={styles.heroMeta}>
                    {result.patientName ? `Patient: ${result.patientName}` : "Patient not provided"}
                    {result.patientPhone ? ` • ${result.patientPhone}` : ""}
                  </p>
                  <p className={styles.heroMeta}>Uploaded {formatDateTime(result.createdAt)}</p>
                </div>

                <div className={styles.heroStats}>
                  <div>
                    <strong>{Array.isArray(interpretation?.keyFindings) ? interpretation.keyFindings.length : 0}</strong>
                    <span>Findings</span>
                  </div>
                  <div>
                    <strong>{Array.isArray(interpretation?.abnormalValues) ? interpretation.abnormalValues.length : 0}</strong>
                    <span>Abnormal</span>
                  </div>
                  <div>
                    <strong>{Array.isArray(interpretation?.recommendations) ? interpretation.recommendations.length : 0}</strong>
                    <span>Actions</span>
                  </div>
                </div>
              </article>

              <article id="summary" className={styles.sectionCard}>
                <h3>Summary</h3>
                <p>{summaryText}</p>
              </article>

              <article id="findings" className={styles.sectionCard}>
                <h3>Key Findings</h3>
                {Array.isArray(interpretation?.keyFindings) && interpretation.keyFindings.length > 0 ? (
                  <ul className={styles.list}>
                    {interpretation.keyFindings.map((item, index) => (
                      <li key={`finding-${index}`}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No key findings recorded.</p>
                )}
              </article>

              <article id="normal" className={styles.sectionCard}>
                <h3>Normal Values</h3>
                {Array.isArray(interpretation?.normalValues) && interpretation.normalValues.length > 0 ? (
                  <div className={styles.valueGrid}>
                    {interpretation.normalValues.map((item, index) => (
                      <div key={`normal-${index}`} className={styles.valueCard}>
                        <div className={styles.valueHeader}>
                          <strong>{item.testName}</strong>
                          <span className={styles.badgeNormal}>Normal</span>
                        </div>
                        <p>{item.value}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>No normal values recorded.</p>
                )}
              </article>

              <article id="abnormal" className={styles.sectionCard}>
                <h3>Abnormal Values</h3>
                {Array.isArray(interpretation?.abnormalValues) && interpretation.abnormalValues.length > 0 ? (
                  <div className={styles.valueGrid}>
                    {interpretation.abnormalValues.map((item, index) => (
                      <div key={`abnormal-${index}`} className={styles.valueCard}>
                        <div className={styles.valueHeader}>
                          <strong>{item.testName}</strong>
                          <span
                            className={
                              item.status === "critical"
                                ? styles.badgeCritical
                                : item.status === "low"
                                  ? styles.badgeLow
                                  : item.status === "high"
                                    ? styles.badgeHigh
                                    : styles.badgeAbnormal
                            }
                          >
                            {String(item.status || "abnormal").toUpperCase()}
                          </span>
                        </div>
                        <p className={styles.valueText}>{item.value}</p>
                        {item.interpretation ? <p className={styles.valueNote}>{item.interpretation}</p> : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>No abnormal values recorded.</p>
                )}
              </article>

              <article id="recommendations" className={styles.sectionCard}>
                <h3>Recommendations</h3>
                {Array.isArray(interpretation?.recommendations) && interpretation.recommendations.length > 0 ? (
                  <ul className={styles.list}>
                    {interpretation.recommendations.map((item, index) => (
                      <li key={`recommendation-${index}`}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No recommendations generated.</p>
                )}
              </article>

              {Array.isArray(interpretation?.alertsOrConcerns) && interpretation.alertsOrConcerns.length > 0 ? (
                <article className={styles.sectionCardAlert}>
                  <h3>Alerts or Critical Concerns</h3>
                  <ul className={styles.list}>
                    {interpretation.alertsOrConcerns.map((item, index) => (
                      <li key={`alert-${index}`}>{item}</li>
                    ))}
                  </ul>
                </article>
              ) : null}

              <article id="raw-text" className={styles.sectionCard}>
                <h3>Extracted Lab Text</h3>
                <pre className={styles.rawText}>{result.rawText || "No raw text available."}</pre>
              </article>
            </section>
          </div>
        ) : null}
      </section>
    </main>
  )
}