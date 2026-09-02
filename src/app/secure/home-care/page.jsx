"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { io } from "socket.io-client"
import { getBackendBaseUrl } from "../../../lib/backend-url"
import styles from "./home-care.module.css"

const SERVICE_LABELS = {
  "nursing care": { label: "Nursing Care", icon: "🩺" },
  "elderly care": { label: "Elderly Care", icon: "👵" },
  "post-hospitalization care": { label: "Post-Hospitalization Care", icon: "🏥" },
  physiotherapy: { label: "Physiotherapy", icon: "🤸" },
}

const STATUS_STEPS = ["pending", "under review", "assigned", "accepted", "in progress", "completed"]

function getStoredPatientAuth() {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem("patientAuth")
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function getStoredToken() {
  if (typeof window === "undefined") return null
  try {
    const auth = getStoredPatientAuth()
    return auth?.token || auth?.accessToken || null
  } catch {
    return null
  }
}

function resolvePatientId(auth) {
  return String(auth?.patientId || auth?.uid || auth?.id || auth?._id || "").trim()
}

function formatDate(value) {
  if (!value) return "Not set"
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value))
  } catch {
    return String(value)
  }
}

function canCancel(status) {
  return ["pending", "under review", "assigned", "accepted", "in progress"].includes(String(status || "").toLowerCase())
}

export default function HomeCarePage() {
  const searchParams = useSearchParams()
  const requestedId = searchParams.get("requestId") || ""
  const created = searchParams.get("created") === "1"
  const [auth, setAuth] = useState(null)
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selectedId, setSelectedId] = useState(requestedId || "")
  const [actionBusy, setActionBusy] = useState(false)
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewComment, setReviewComment] = useState("")
  const [reviewBusy, setReviewBusy] = useState(false)

  const patientId = useMemo(() => resolvePatientId(auth), [auth])

  useEffect(() => {
    const storedAuth = getStoredPatientAuth()
    if (storedAuth) setAuth(storedAuth)
  }, [])

  async function loadRequests() {
    if (!patientId) return
    setLoading(true)
    setError("")
    try {
      const headers = {}
      const token = getStoredToken()
      if (token) headers.authorization = `Bearer ${token}`
      const response = await fetch(`/api/patients/${encodeURIComponent(patientId)}/home-care`, { cache: "no-store", headers })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.message || "Could not load home care requests")
      setRequests(Array.isArray(data.requests) ? data.requests : [])
    } catch (err) {
      setError(err?.message || "Could not load home care requests")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (patientId) loadRequests()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId])

  useEffect(() => {
    if (!patientId) return
    const socket = io(getBackendBaseUrl(), { transports: ["websocket"], withCredentials: true })
    socket.on("home-care-updated", (payload) => {
      const updated = payload?.request
      if (!updated?.id && !updated?.homeCareRequestId) return
      const key = String(updated.homeCareRequestId || updated.id)
      setRequests((current) => {
        const exists = current.some((item) => String(item.homeCareRequestId || item.id) === key)
        if (exists) return current.map((item) => (String(item.homeCareRequestId || item.id) === key ? { ...item, ...updated } : item))
        return [updated, ...current]
      })
    })
    return () => {
      socket.off("home-care-updated")
      socket.disconnect()
    }
  }, [patientId])

  const selected = requests.find((item) => String(item.homeCareRequestId || item.id) === String(selectedId)) || null

  async function cancelRequest(request) {
    if (!window.confirm("Cancel this home care request?")) return
    setActionBusy(true)
    setError("")
    try {
      const headers = { "Content-Type": "application/json" }
      const token = getStoredToken()
      if (token) headers.authorization = `Bearer ${token}`
      const response = await fetch(`/api/patients/${encodeURIComponent(patientId)}/home-care/${encodeURIComponent(request.homeCareRequestId || request.id)}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ action: "cancel" }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.message || "Could not cancel request")
      await loadRequests()
    } catch (err) {
      setError(err?.message || "Could not cancel request")
    } finally {
      setActionBusy(false)
    }
  }

  async function submitReview() {
    if (!selected || !reviewRating) return
    setReviewBusy(true)
    setError("")
    try {
      const headers = { "Content-Type": "application/json" }
      const token = getStoredToken()
      if (token) headers.authorization = `Bearer ${token}`
      const response = await fetch(`/api/patients/${encodeURIComponent(patientId)}/home-care/${encodeURIComponent(selected.homeCareRequestId || selected.id)}/review`, {
        method: "POST", headers, body: JSON.stringify({ rating: reviewRating, comment: reviewComment }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.message || "Could not save review")
      setRequests((current) => current.map((item) => String(item.homeCareRequestId || item.id) === String(selected.homeCareRequestId || selected.id) ? { ...item, nurseReview: data.review } : item))
    } catch (err) {
      setError(err?.message || "Could not save review")
    } finally {
      setReviewBusy(false)
    }
  }

  const currentStepIndex = STATUS_STEPS.indexOf(String(selected?.status || "").toLowerCase())

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <Link href="/secure/home" className={styles.brand}>
          <span className={styles.brandMark}>+</span>
          <span className={styles.brandText}>Home Care+</span>
        </Link>
        <div className={styles.topActions}>
          <Link href="/secure/home" className={styles.action}>Home</Link>
          <Link href="/secure/home-care/request" className={`${styles.action} ${styles.actionPrimary}`}>New Request</Link>
          <Link href="/secure/emergency" className={`${styles.action} ${styles.actionDanger}`}>Emergency</Link>
        </div>
      </header>

      <div className={styles.shell}>
        <div className={styles.pageHeader}>
          <div>
            <p className={styles.kicker}>Home Care</p>
            <h1 className={styles.title}>My Home Care Requests</h1>
            <p className={styles.subtitle}>Track your requests from submission through to completion.</p>
          </div>
          <Link href="/secure/home-care/request" className={`${styles.btn} ${styles.btnPrimary}`}>+ Request Home Care</Link>
        </div>

        {created ? (
          <div className={styles.successBanner}>Your home care request has been submitted. You can track its status below.</div>
        ) : null}

        {error ? <div className={styles.errorBanner}>{error}</div> : null}

        {loading ? (
          <div className={styles.emptyState}>Loading your requests...</div>
        ) : requests.length === 0 ? (
          <div className={styles.emptyState}>
            <p>You have not requested home care yet.</p>
            <Link href="/secure/home-care/request" className={`${styles.btn} ${styles.btnPrimary}`}>Request Home Care</Link>
          </div>
        ) : (
          <div className={styles.layout}>
            <section className={styles.requestList}>
              {requests.map((request) => {
                const service = SERVICE_LABELS[String(request.serviceType || "").toLowerCase()] || { label: request.serviceType, icon: "🏠" }
                return (
                  <button
                    key={request.homeCareRequestId || request.id}
                    type="button"
                    className={`${styles.requestCard} ${selectedId === String(request.homeCareRequestId || request.id) ? styles.requestCardActive : ""}`}
                    onClick={() => setSelectedId(String(request.homeCareRequestId || request.id))}
                  >
                    <span className={styles.requestIcon}>{service.icon}</span>
                    <span className={styles.requestInfo}>
                      <strong>{service.label}</strong>
                      <span className={styles.requestMeta}>{formatDate(request.createdAt)}</span>
                    </span>
                    <span className={`${styles.statusPill} ${styles[`status_${String(request.status || "").toLowerCase().replace(/\s+/g, "_")}`] || ""}`}>
                      {String(request.status || "").charAt(0).toUpperCase() + String(request.status || "").slice(1)}
                    </span>
                  </button>
                )
              })}
            </section>

            <section className={styles.detailPanel}>
              {selected ? (
                <>
                  <div className={styles.detailHeader}>
                    <div>
                      <p className={styles.detailId}>{selected.homeCareRequestId || selected.id}</p>
                      <h2>{SERVICE_LABELS[String(selected.serviceType || "").toLowerCase()]?.label || selected.serviceType}</h2>
                    </div>
                    <span className={`${styles.statusPill} ${styles[`status_${String(selected.status || "").toLowerCase().replace(/\s+/g, "_")}`] || ""}`}>
                      {selected.statusLabel || selected.status}
                    </span>
                  </div>

                  {selected.status && String(selected.status).toLowerCase() !== "cancelled" ? (
                    <div className={styles.tracker}>
                      {STATUS_STEPS.map((step, index) => {
                        const completed = index < currentStepIndex
                        const active = index === currentStepIndex
                        return (
                          <div key={step} className={`${styles.trackerStep}`}>
                            <span className={`${styles.trackerDot} ${completed ? styles.trackerDotDone : ""} ${active ? styles.trackerDotActive : ""}`}>
                              {completed ? "✓" : index + 1}
                            </span>
                            <span className={`${styles.trackerLabel} ${active ? styles.trackerLabelActive : ""}`}>{step.replace(/^\w/, (c) => c.toUpperCase())}</span>
                          </div>
                        )
                      })}
                    </div>
                  ) : null}

                  <div className={styles.detailBody}>
                    <div className={styles.detailSection}>
                      <h3>Care needed</h3>
                      <p className={styles.description}>{selected.description}</p>
                    </div>

                    <div className={styles.detailGrid}>
                      <div><span>Location</span><strong>{selected.location || "Not provided"}</strong></div>
                      <div><span>Address</span><strong>{selected.address || "Not provided"}</strong></div>
                      <div><span>Preferred date</span><strong>{formatDate(selected.preferredDate)}</strong></div>
                      <div><span>Preferred time</span><strong>{selected.preferredTime || "Not set"}</strong></div>
                    </div>

                    {selected.emergencyContactName || selected.emergencyContactPhone ? (
                      <div className={styles.detailSection}>
                        <h3>Emergency contact</h3>
                        <p>{[selected.emergencyContactName, selected.emergencyContactPhone].filter(Boolean).join(" · ") || "Not provided"}</p>
                      </div>
                    ) : null}
                  </div>

                  <div className={styles.assignedCard}>
                    <h3>Assigned healthcare professional</h3>
                    {selected.assignedNurse ? (
                      <div className={styles.nurseRow}>
                        <span className={styles.nurseAvatar}>
                          {selected.assignedNurse.profileImage?.url ? (
                            <img src={selected.assignedNurse.profileImage.url} alt={selected.assignedNurse.nurseName} />
                          ) : (
                            (selected.assignedNurse.nurseName || "N").slice(0, 1).toUpperCase()
                          )}
                        </span>
                        <div>
                          <strong>{selected.assignedNurse.nurseName}</strong>
                          <span className={styles.nurseMeta}>{selected.assignedNurse.specialization || "Healthcare professional"}</span>
                          {selected.assignedNurse.nursePhone ? <span className={styles.nurseMeta}>📞 {selected.assignedNurse.nursePhone}</span> : null}
                        </div>
                      </div>
                    ) : (
                      <p className={styles.muted}>
                        {String(selected.status || "").toLowerCase() === "under review"
                          ? "Your request is being reviewed and a professional will be assigned shortly."
                          : "A healthcare professional has not been assigned yet."}
                      </p>
                    )}
                  </div>

                  {String(selected.status || "").toLowerCase() === "completed" && selected.assignedNurse ? (
                    <div className={styles.assignedCard}>
                      <h3>Review your nurse</h3>
                      {selected.nurseReview ? (
                        <p className={styles.muted}>You rated this nurse {selected.nurseReview.rating}/5.</p>
                      ) : (
                        <>
                          <div style={{ display: "flex", gap: "0.35rem", marginBottom: "0.75rem" }}>
                            {[1, 2, 3, 4, 5].map((value) => (
                              <button key={value} type="button" onClick={() => setReviewRating(value)} aria-label={`${value} stars`} style={{ border: 0, background: "transparent", fontSize: "1.5rem", color: value <= reviewRating ? "#f59e0b" : "#cbd5e1", cursor: "pointer" }}>★</button>
                            ))}
                          </div>
                          <textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} placeholder="Share feedback about the care (optional)" rows={3} style={{ width: "100%", boxSizing: "border-box", marginBottom: "0.75rem" }} />
                          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={submitReview} disabled={!reviewRating || reviewBusy}>{reviewBusy ? "Saving..." : "Submit review"}</button>
                        </>
                      )}
                    </div>
                  ) : null}

                  {canCancel(selected.status) ? (
                    <div className={styles.detailActions}>
                      <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={() => cancelRequest(selected)} disabled={actionBusy}>
                        {actionBusy ? "Cancelling..." : "Cancel Request"}
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className={styles.emptyState}>Select a request to view its details and status.</div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  )
}
