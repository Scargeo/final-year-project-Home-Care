"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { io } from "socket.io-client"
import { getBackendBaseUrl } from "../../../lib/backend-url"
import MapView from "./MapView"
import styles from "./nurse.module.css"

const SERVICE_LABELS = {
  "nursing care": { label: "Nursing Care", icon: "🩺" },
  "elderly care": { label: "Elderly Care", icon: "👵" },
  "post-hospitalization care": { label: "Post-Hospitalization Care", icon: "🏥" },
  physiotherapy: { label: "Physiotherapy", icon: "🤸" },
}

function getStoredToken() {
  if (typeof window === "undefined") return null
  try {
    const nurseAuth = window.localStorage.getItem("nurseAuth")
    const parsed = nurseAuth ? JSON.parse(nurseAuth) : null
    return parsed?.token || parsed?.accessToken || null
  } catch {
    return null
  }
}

function formatDate(value) {
  if (!value) return "Not set"
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value))
  } catch {
    return String(value)
  }
}

function formatDateTime(value) {
  if (!value) return "—"
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value))
  } catch {
    return String(value)
  }
}

export default function HomeCarePanel({ nurseId, nurseName, initialRequestId = "" }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selectedId, setSelectedId] = useState(initialRequestId || "")
  const [busy, setBusy] = useState(false)
  const [liveNotice, setLiveNotice] = useState(null)
  const [declineOpen, setDeclineOpen] = useState(false)
  const [declineReason, setDeclineReason] = useState("")
  const [careOpen, setCareOpen] = useState(false)
  const [careNote, setCareNote] = useState("")
  const [obsOpen, setObsOpen] = useState(false)
  const [obsNote, setObsNote] = useState("")
  const socketRef = useRef(null)

  const selected = useMemo(
    () => requests.find((r) => String(r.homeCareRequestId || r.id) === String(selectedId)) || null,
    [requests, selectedId],
  )

  async function loadRequests() {
    if (!nurseId) return
    setLoading(true)
    setError("")
    try {
      const headers = {}
      const token = getStoredToken()
      if (token) headers.authorization = `Bearer ${token}`
      const res = await fetch(`/api/nurses/${encodeURIComponent(nurseId)}/home-care`, { cache: "no-store", headers })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Could not load home care requests")
      setRequests(Array.isArray(data.requests) ? data.requests : [])
    } catch (err) {
      setError(err?.message || "Could not load home care requests")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (nurseId) loadRequests()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nurseId])

  // Real-time: join the nurse notification room and listen for new assignments/updates
  useEffect(() => {
    if (!nurseId) return
    const socket = io(getBackendBaseUrl(), { transports: ["websocket"], withCredentials: true })
    socketRef.current = socket
    socket.emit("join-notifications-nurse", nurseId)

    socket.on("nurse-notification-created", (payload) => {
      const notification = payload?.notification
      if (!notification) return
      setLiveNotice(notification)
      // Refresh the list so the new assignment appears instantly
      loadRequests()

      // Browser notification (instant)
      try {
        if (typeof window !== "undefined" && "Notification" in window && window.Notification.permission === "granted") {
          new window.Notification(notification.title || "Home Care", {
            body: notification.message || "You have a new home care request.",
          })
        }
      } catch {
        // ignore
      }

      // Auto-dismiss the in-app notice
      setTimeout(() => setLiveNotice(null), 10000)
    })

    return () => {
      socket.off("nurse-notification-created")
      socket.disconnect()
      socketRef.current = null
    }
  }, [nurseId])

  async function runAction(action, body = {}) {
    if (!selected) return
    setBusy(true)
    setError("")
    try {
      const headers = { "Content-Type": "application/json" }
      const token = getStoredToken()
      if (token) headers.authorization = `Bearer ${token}`
      const res = await fetch(
        `/api/nurses/${encodeURIComponent(nurseId)}/home-care/${encodeURIComponent(selected.homeCareRequestId || selected.id)}`,
        { method: "PATCH", headers, body: JSON.stringify({ action, ...body }) },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Action failed")
      // Update the selected request in place
      if (data.request) {
        setRequests((cur) =>
          cur.map((r) => (String(r.homeCareRequestId || r.id) === String(data.request.homeCareRequestId || data.request.id) ? data.request : r)),
        )
      } else {
        await loadRequests()
      }
      setDeclineOpen(false)
      setDeclineReason("")
      setCareOpen(false)
      setCareNote("")
      setObsOpen(false)
      setObsNote("")
    } catch (err) {
      setError(err?.message || "Action failed")
    } finally {
      setBusy(false)
    }
  }

  const status = String(selected?.status || "").toLowerCase()

  return (
    <section className={styles.container} id="home-care-requests">
      <div className={styles.hcHeader}>
        <div>
          <h2>Home Care Requests</h2>
          <p className={styles.hcSubtitle}>View assigned requests, accept or decline, and manage care visits.</p>
        </div>
        <button type="button" className={styles.secondaryButton} onClick={loadRequests} disabled={busy || loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {liveNotice ? (
        <div className={styles.liveNotice}>
          <div className={styles.liveNoticeContent}>
            <strong>{liveNotice.title}</strong>
            <span>{liveNotice.message}</span>
          </div>
          <div className={styles.liveNoticeActions}>
            <button type="button" className={styles.liveNoticeClose} onClick={() => setLiveNotice(null)} aria-label="Dismiss">✕</button>
          </div>
        </div>
      ) : null}

      {error ? <div className={styles.error}>{error}</div> : null}

      {loading ? (
        <div className={styles.emptyState}>Loading your home care requests...</div>
      ) : requests.length === 0 ? (
        <div className={styles.emptyState}>
          <div style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>🏠</div>
          <p>No home care requests assigned to you yet.</p>
          <p style={{ fontSize: "0.85rem", color: "#94a3b8" }}>You'll be notified in real time when you're assigned a request.</p>
        </div>
      ) : (
        <div className={styles.hcLayout}>
          {/* Request list */}
          <div className={styles.hcList}>
            {requests.map((request) => {
              const service = SERVICE_LABELS[String(request.serviceType || "").toLowerCase()] || { label: request.serviceType, icon: "🏠" }
              const active = String(selectedId) === String(request.homeCareRequestId || request.id)
              return (
                <button
                  key={request.homeCareRequestId || request.id}
                  type="button"
                  className={`${styles.hcCard} ${active ? styles.hcCardActive : ""}`}
                  onClick={() => setSelectedId(String(request.homeCareRequestId || request.id))}
                >
                  <span className={styles.hcCardIcon}>{service.icon}</span>
                  <span className={styles.hcCardInfo}>
                    <strong>{service.label}</strong>
                    <span>{request.patientName || "Patient"}</span>
                    <span className={styles.hcCardMeta}>{formatDate(request.createdAt)}</span>
                  </span>
                  <span className={`${styles.statusPill} ${styles[`status_${String(request.status || "").toLowerCase().replace(/\s+/g, "_")}`] || ""}`}>
                    {request.statusLabel || request.status}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Detail panel */}
          <div className={styles.hcDetail}>
            {selected ? (
              <>
<div className={styles.hcDetailHeader}>
                  <div>
                    <p className={styles.hcDetailId}>{selected.homeCareRequestId || selected.id}</p>
                    <h3>{SERVICE_LABELS[String(selected.serviceType || "").toLowerCase()]?.label || selected.serviceType}</h3>
                  </div>
                  <div className={styles.hcDetailHeaderRight}>
                    <span className={`${styles.statusPill} ${styles[`status_${status.replace(/\s+/g, "_")}`] || ""}`}>
                      {selected.statusLabel || selected.status}
                    </span>
                    <button
                      type="button"
                      className={styles.hcCloseButton}
                      onClick={() => setSelectedId("")}
                      aria-label="Close request details"
                      title="Close"
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div className={styles.hcSection}>
                  <h4>Contact patient</h4>
                  <div className={styles.hcActions}>
                    {selected.patientPhone ? (
                      <a className={styles.secondaryButton} href={`tel:${selected.patientPhone}`}>Call patient</a>
                    ) : null}
                    <a className={styles.secondaryButton} href={`/secure/chat?roomId=${encodeURIComponent(`home-care-${selected.homeCareRequestId || selected.id}`)}&patientId=${encodeURIComponent(selected.patientId || '')}&patientName=${encodeURIComponent(selected.patientName || 'Patient')}`}>
                      Message patient
                    </a>
                  </div>
                </div>

                {/* Patient details */}
                <div className={styles.hcSection}>
                  <h4>Patient & appointment details</h4>
                  <div className={styles.hcGrid}>
                    <div><span>Patient</span><strong>{selected.patientName || "—"}</strong></div>
                    <div><span>Phone</span><strong>{selected.patientPhone || "—"}</strong></div>
                    <div><span>Preferred date</span><strong>{formatDate(selected.preferredDate)}</strong></div>
                    <div><span>Preferred time</span><strong>{selected.preferredTime || "Not set"}</strong></div>
                    <div><span>Emergency contact</span><strong>{[selected.emergencyContactName, selected.emergencyContactPhone].filter(Boolean).join(" · ") || "—"}</strong></div>
                  </div>
                </div>

                {/* Care needed */}
                <div className={styles.hcSection}>
                  <h4>Care needed</h4>
                  <p className={styles.hcDescription}>{selected.description}</p>
                </div>

                {/* Location + map */}
                <div className={styles.hcSection}>
                  <h4>Patient location</h4>
                  <div className={styles.hcGrid}>
                    <div><span>Area / landmark</span><strong>{selected.location || "—"}</strong></div>
                    <div><span>Address</span><strong>{selected.address || "—"}</strong></div>
                  </div>
                  <div style={{ marginTop: "0.75rem" }}>
                    <MapView
                      locationCoords={selected.locationCoords}
                      address={selected.address}
                      locationLabel={selected.location}
                    />
                  </div>
                </div>

                {/* Care records & observations */}
                {(Array.isArray(selected.careRecords) && selected.careRecords.length > 0) || (Array.isArray(selected.observations) && selected.observations.length > 0) ? (
                  <div className={styles.hcSection}>
                    <h4>Care records & observations</h4>
                    {Array.isArray(selected.careRecords) && selected.careRecords.length > 0 ? (
                      <div>
                        <strong style={{ fontSize: "0.85rem", color: "#0f766e" }}>Care provided</strong>
                        {selected.careRecords.map((rec, idx) => (
                          <div key={`care-${idx}`} className={styles.hcNote}>
                            <p>{rec.note}</p>
                            <small>{rec.recordedBy || "Nurse"} · {formatDateTime(rec.at)}</small>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {Array.isArray(selected.observations) && selected.observations.length > 0 ? (
                      <div style={{ marginTop: "0.75rem" }}>
                        <strong style={{ fontSize: "0.85rem", color: "#0369a1" }}>Observations / notes</strong>
                        {selected.observations.map((obs, idx) => (
                          <div key={`obs-${idx}`} className={styles.hcNote}>
                            <p>{obs.note}</p>
                            <small>{obs.recordedBy || "Nurse"} · {formatDateTime(obs.at)}</small>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {/* Timeline */}
                {Array.isArray(selected.timeline) && selected.timeline.length > 0 ? (
                  <div className={styles.hcSection}>
                    <h4>Timeline</h4>
                    <div className={styles.hcTimeline}>
                      {selected.timeline.map((item, idx) => (
                        <div key={idx} className={styles.hcTimelineItem}>
                          <span className={styles.hcTimelineDot} />
                          <span style={{ flex: 1 }}>{item.label}</span>
                          <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{formatDateTime(item.at)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Actions */}
                <div className={styles.hcActions}>
                  {status === "assigned" && (
                    <>
                      <button type="button" className={`${styles.primaryButton}`} onClick={() => runAction("accept")} disabled={busy}>
                        {busy ? "Processing…" : "Accept assignment"}
                      </button>
                      <button type="button" className={styles.dangerButton} onClick={() => setDeclineOpen(true)} disabled={busy}>
                        Decline
                      </button>
                    </>
                  )}

                  {status === "accepted" && (
                    <button type="button" className={styles.primaryButton} onClick={() => runAction("start")} disabled={busy}>
                      {busy ? "Starting…" : "Start visit"}
                    </button>
                  )}

                  {status === "in progress" && (
                    <>
                      <button type="button" className={styles.secondaryButton} onClick={() => setCareOpen(true)} disabled={busy}>
                        Record care
                      </button>
                      <button type="button" className={styles.secondaryButton} onClick={() => setObsOpen(true)} disabled={busy}>
                        Add observation
                      </button>
                      <button type="button" className={styles.primaryButton} onClick={() => runAction("complete")} disabled={busy}>
                        {busy ? "Completing…" : "Mark completed"}
                      </button>
                    </>
                  )}

                  {status === "completed" && (
                    <span className={styles.hcCompleted}>✓ This visit has been marked as completed.</span>
                  )}
                  {status === "under review" && (
                    <span className={styles.hcCompleted}>This request was declined and returned for reassignment.</span>
                  )}
                  {status === "cancelled" && (
                    <span className={styles.hcCompleted}>This request was cancelled.</span>
                  )}
                </div>

                {/* Decline reason input */}
                {declineOpen && (
                  <div className={styles.hcForm}>
                    <label>
                      <span>Reason for declining (optional)</span>
                      <textarea
                        value={declineReason}
                        onChange={(e) => setDeclineReason(e.target.value)}
                        rows={2}
                        placeholder="e.g. Out of my service area, schedule conflict, etc."
                      />
                    </label>
                    <div className={styles.hcFormActions}>
                      <button type="button" className={styles.secondaryButton} onClick={() => setDeclineOpen(false)} disabled={busy}>Cancel</button>
                      <button type="button" className={styles.dangerButton} onClick={() => runAction("decline", { reason: declineReason, nurseName })} disabled={busy}>
                        {busy ? "Declining…" : "Confirm decline"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Record care form */}
                {careOpen && (
                  <div className={styles.hcForm}>
                    <label>
                      <span>Care provided</span>
                      <textarea
                        value={careNote}
                        onChange={(e) => setCareNote(e.target.value)}
                        rows={3}
                        placeholder="Describe the care you provided to the patient."
                      />
                    </label>
                    <div className={styles.hcFormActions}>
                      <button type="button" className={styles.secondaryButton} onClick={() => setCareOpen(false)} disabled={busy}>Cancel</button>
                      <button type="button" className={styles.primaryButton} onClick={() => runAction("record-care", { note: careNote, recordedBy: nurseName })} disabled={busy || !careNote.trim()}>
                        {busy ? "Saving…" : "Save care record"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Add observation form */}
                {obsOpen && (
                  <div className={styles.hcForm}>
                    <label>
                      <span>Observation / note</span>
                      <textarea
                        value={obsNote}
                        onChange={(e) => setObsNote(e.target.value)}
                        rows={3}
                        placeholder="Add an observation or note about the patient."
                      />
                    </label>
                    <div className={styles.hcFormActions}>
                      <button type="button" className={styles.secondaryButton} onClick={() => setObsOpen(false)} disabled={busy}>Cancel</button>
                      <button type="button" className={styles.primaryButton} onClick={() => runAction("add-observation", { note: obsNote, recordedBy: nurseName })} disabled={busy || !obsNote.trim()}>
                        {busy ? "Saving…" : "Save observation"}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className={styles.emptyState}>Select a home care request to view its details.</div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
