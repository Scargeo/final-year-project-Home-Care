"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import styles from "./home-care.module.css"

const SERVICE_LABELS = {
  "nursing care": { label: "Nursing Care", icon: "🩺" },
  "elderly care": { label: "Elderly Care", icon: "👵" },
  "post-hospitalization care": { label: "Post-Hospitalization Care", icon: "🏥" },
  physiotherapy: { label: "Physiotherapy", icon: "🤸" },
}

const STATUS_OPTIONS = ["pending", "under review", "assigned", "accepted", "in progress", "completed", "cancelled"]

// Map status -> user-selectable next statuses the admin can advance to
const NEXT_STATUS = {
  pending: ["under review"],
  "under review": ["assigned", "completed", "cancelled"],
  assigned: ["accepted", "in progress", "completed", "cancelled"],
  accepted: ["in progress", "completed", "cancelled"],
  "in progress": ["completed", "cancelled"],
  completed: [],
  cancelled: [],
}

function getStoredToken() {
  if (typeof window === "undefined") return null
  try {
    const stored = window.localStorage.getItem("adminAuth")
    return stored ? JSON.parse(stored) : null
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
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value))
  } catch {
    return String(value)
  }
}

export default function AdminHomeCarePage() {
  const [auth, setAuth] = useState(null)
  const [token, setToken] = useState("")
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [selectedId, setSelectedId] = useState("")
  const [filter, setFilter] = useState("")
  const [nurses, setNurses] = useState([])
  const [loadNursesFor, setLoadNursesFor] = useState("")

  const apiFetch = useCallback(async (path, options = {}, activeToken = token) => {
    const headers = { ...(options.headers || {}) }
    const bearer = activeToken || (getStoredToken()?.token) || ""
    if (bearer) headers.authorization = `Bearer ${bearer}`
    if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json"
    return fetch(`/api/admin${path}`, { ...options, headers, cache: "no-store" })
  }, [token])

  useEffect(() => {
    const stored = getStoredToken()
    if (stored?.token) {
      setAuth(stored)
      setToken(stored.token)
    }
  }, [])

  const loadRequests = useCallback(async (activeToken = token, viewFilter = filter) => {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      if (viewFilter === "completed") params.set("view", "completed")
      else if (viewFilter) params.set("status", viewFilter)
      const query = params.toString()
      const response = await apiFetch(`/home-care${query ? `?${query}` : ""}`, { method: "GET" }, activeToken)
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.message || "Could not load home care requests")
      setRequests(Array.isArray(data.requests) ? data.requests : [])
      setSelectedId((current) => (current && data.requests?.some((r) => String(r.homeCareRequestId || r.id) === current) ? current : ""))
    } catch (err) {
      setError(err?.message || "Could not load home care requests")
    } finally {
      setLoading(false)
    }
  }, [apiFetch, token, filter])

  useEffect(() => {
    if (auth?.token) loadRequests(auth.token, "")
  }, [auth]) // eslint-disable-line react-hooks/exhaustive-deps

  const selected = useMemo(
    () => requests.find((r) => String(r.homeCareRequestId || r.id) === String(selectedId)) || null,
    [requests, selectedId],
  )

  async function reload() {
    await loadRequests(token, filter)
  }

  async function loadAvailableNurses(requestId) {
    setLoadNursesFor(requestId)
    setError("")
    try {
      const response = await apiFetch(`/home-care/${encodeURIComponent(requestId)}/nurses`, { method: "GET" })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.message || "Could not load available professionals")
      setNurses(Array.isArray(data.nurses) ? data.nurses : [])
    } catch (err) {
      setError(err?.message || "Could not load available professionals")
      setNurses([])
    } finally {
      setLoadNursesFor("")
    }
  }

  async function assignNurse(requestId, nurseId = "") {
    const label = nurseId ? "Assign the selected healthcare professional?" : "Auto-assign the best available healthcare professional?"
    if (!window.confirm(label)) return
    setBusy(true)
    setError("")
    setMessage("")
    try {
      const body = { action: "assign" }
      if (nurseId) body.nurseId = nurseId
      const response = await apiFetch(`/home-care/${encodeURIComponent(requestId)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.message || "Could not assign professional")
      setMessage(data?.message || "Healthcare professional assigned")
      await reload()
    } catch (err) {
      setError(err?.message || "Failed to assign professional")
    } finally {
      setBusy(false)
    }
  }

  async function reassignNurse(requestId, nurseId = "") {
    if (!window.confirm(nurseId ? "Reassign to the selected healthcare professional?" : "Auto-reassign to another available professional?")) return
    setBusy(true)
    setError("")
    setMessage("")
    try {
      const body = { action: "reassign" }
      if (nurseId) body.nurseId = nurseId
      const response = await apiFetch(`/home-care/${encodeURIComponent(requestId)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.message || "Could not reassign professional")
      setMessage(data?.message || "Healthcare professional reassigned")
      await reload()
    } catch (err) {
      setError(err?.message || "Failed to reassign professional")
    } finally {
      setBusy(false)
    }
  }

  async function changeStatus(requestId, nextStatus) {
    if (!nextStatus) return
    if (!window.confirm(`Change this request status to "${nextStatus}"?`)) return
    setBusy(true)
    setError("")
    setMessage("")
    try {
      const response = await apiFetch(`/home-care/${encodeURIComponent(requestId)}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "status", status: nextStatus }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.message || "Could not update status")
      setMessage(data?.message || "Status updated")
      await reload()
    } catch (err) {
      setError(err?.message || "Failed to update status")
    } finally {
      setBusy(false)
    }
  }

  async function rejectRequest(requestId) {
    if (!window.confirm("Reject this home care request? This will cancel it.")) return
    setBusy(true)
    setError("")
    setMessage("")
    try {
      const response = await apiFetch(`/home-care/${encodeURIComponent(requestId)}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "reject" }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.message || "Could not reject request")
      setMessage(data?.message || "Request rejected")
      await reload()
    } catch (err) {
      setError(err?.message || "Failed to reject request")
    } finally {
      setBusy(false)
    }
  }

  function logout() {
    if (!window.confirm("Log out of the admin console?")) return
    if (typeof window !== "undefined") window.localStorage.removeItem("adminAuth")
    setAuth(null)
    setToken("")
    setRequests([])
  }

  const counts = useMemo(() => {
    const map = {}
    requests.forEach((r) => {
      const key = String(r.status || "pending").toLowerCase()
      map[key] = (map[key] || 0) + 1
    })
    return map
  }, [requests])

  const isAuthed = Boolean(auth?.token || token)

  if (loading && !isAuthed) {
    return <main className={styles.shell}><div className={styles.loading}>Loading admin home care console...</div></main>
  }

  if (!isAuthed) {
    return (
      <main className={styles.shell}>
        <div className={styles.panel} style={{ maxWidth: 560, margin: "0 auto" }}>
          <p className={styles.kicker}>Admin console</p>
          <h1 className={styles.detailTitle}>Home Care Review</h1>
          <p style={{ color: "rgba(15,23,42,0.65)", margin: "0.5rem 0 1rem" }}>
            Please log in using the main admin console to review and manage home care requests.
          </p>
          <Link href="/admin" className={styles.actionButton} style={{ textDecoration: "none", display: "inline-block" }}>
            Go to Admin Login
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1>Home Care Requests</h1>
          <p>Review, assign professionals, manage statuses, and reject requests.</p>
        </div>
        <div className={styles.headerRight}>
          <Link href="/admin" className={styles.linkButton}>← Main Admin Console</Link>
          <button type="button" className={styles.glassButton} onClick={reload} disabled={busy}>Refresh</button>
          <button type="button" className={styles.glassButton} onClick={logout} disabled={busy}>Logout</button>
        </div>
      </header>

      {error ? <div className={styles.error}>{error}</div> : null}
      {message ? <div className={styles.message}>{message}</div> : null}

      <div className={styles.filters}>
        {[
          { value: "", label: `All (${requests.length})` },
          { value: "pending", label: `Pending (${counts.pending || 0})` },
          { value: "under review", label: `Under Review (${counts["under review"] || 0})` },
          { value: "assigned", label: `Assigned (${counts.assigned || 0})` },
          { value: "accepted", label: `Accepted (${counts.accepted || 0})` },
          { value: "in progress", label: `In Progress (${counts["in progress"] || 0})` },
          { value: "completed", label: `Completed (${counts.completed || 0})` },
          { value: "cancelled", label: `Rejected ${counts.cancelled || 0}` },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            className={`${styles.filterButton} ${filter === option.value ? styles.active : ""}`}
            onClick={() => {
              setFilter(option.value)
              loadRequests(token, option.value)
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={styles.panel}><div className={styles.empty}>Loading requests...</div></div>
      ) : (
        <div className={styles.layout}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.kicker}>Requests</p>
                <h2 className={styles.panelTitle}>{filter ? String(filter).replace(/\b\w/g, (c) => c.toUpperCase()) : "All requests"}</h2>
              </div>
            </div>
            <div className={styles.requestList}>
              {requests.length === 0 ? (
                <div className={styles.empty}>No requests in this view.</div>
              ) : (
                requests.map((request) => {
                  const service = SERVICE_LABELS[String(request.serviceType || "").toLowerCase()] || { label: request.serviceType, icon: "🏠" }
                  const statusKey = String(request.status || "pending").toLowerCase().replace(/\s+/g, "_")
                  return (
                    <button
                      key={request.homeCareRequestId || request.id}
                      type="button"
                      className={`${styles.requestCard} ${String(selectedId) === String(request.homeCareRequestId || request.id) ? styles.cardActive : ""}`}
                      onClick={() => setSelectedId(String(request.homeCareRequestId || request.id))}
                    >
                      <div className={styles.cardRow}>
                        <span className={styles.cardName}>{service.icon} {service.label}</span>
                        <span className={`${styles.statusPill} ${styles[`status_${statusKey}`] || ""}`}>{request.status}</span>
                      </div>
                      <div className={styles.cardMeta}>{request.patientName || "Unknown patient"} · {formatDate(request.createdAt)}</div>
                      <div className={styles.cardMeta}>📍 {request.location || request.address || "No location"}</div>
                    </button>
                  )
                })
              )}
            </div>
          </section>

          <section className={styles.panel}>
            {selected ? (
              <>
                <div className={styles.detailTop}>
                  <div>
                    <p className={styles.detailId}>{selected.homeCareRequestId || selected.id}</p>
                    <h2 className={styles.detailTitle}>
                      {SERVICE_LABELS[String(selected.serviceType || "").toLowerCase()]?.label || selected.serviceType}
                    </h2>
                  </div>
                  <span className={`${styles.statusPill} ${styles[`status_${String(selected.status || "").toLowerCase().replace(/\s+/g, "_")}`] || ""}`}>
                    {selected.statusLabel || selected.status}
                  </span>
                </div>

                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Patient information</h3>
                  <div className={styles.grid}>
                    <div className={styles.gridItem}><span>Name</span><strong>{selected.patientName || "—"}</strong></div>
                    <div className={styles.gridItem}><span>Phone</span><strong>{selected.patientPhone || "—"}</strong></div>
                    <div className={styles.gridItem}><span>Patient ID</span><strong>{selected.patientId || "—"}</strong></div>
                    <div className={styles.gridItem}><span>Emergency contact</span><strong>{[selected.emergencyContactName, selected.emergencyContactPhone].filter(Boolean).join(" · ") || "—"}</strong></div>
                  </div>
                </div>

                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Requested service</h3>
                  <p className={styles.description}>{selected.description || "No description provided"}</p>
                </div>

                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Date / time & location</h3>
                  <div className={styles.grid}>
                    <div className={styles.gridItem}><span>Preferred date</span><strong>{formatDate(selected.preferredDate)}</strong></div>
                    <div className={styles.gridItem}><span>Preferred time</span><strong>{selected.preferredTime || "Not set"}</strong></div>
                    <div className={styles.gridItem}><span>Location</span><strong>{selected.location || "—"}</strong></div>
                    <div className={styles.gridItem}><span>Address</span><strong>{selected.address || "—"}</strong></div>
                  </div>
                </div>

                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Assigned healthcare professional</h3>
                  {selected.assignedNurse ? (
                    <div className={styles.nurseBox}>
                      <span className={styles.nurseAvatar}>
                        {selected.assignedNurse.profileImage?.url ? (
                          <img src={selected.assignedNurse.profileImage.url} alt={selected.assignedNurse.nurseName} />
                        ) : (
                          (selected.assignedNurse.nurseName || "N").slice(0, 1).toUpperCase()
                        )}
                      </span>
                      <div className={styles.nurseInfo}>
                        <strong>{selected.assignedNurse.nurseName}</strong>
                        <span>{selected.assignedNurse.specialization || "Healthcare professional"}</span>
                        {selected.assignedNurse.nursePhone ? <span>📞 {selected.assignedNurse.nursePhone}</span> : null}
                      </div>
                    </div>
                  ) : (
                    <div className={styles.nurseUnassigned}>No professional assigned yet.</div>
                  )}
                </div>

                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Timeline</h3>
                  <div className={styles.timeline}>
                    {(Array.isArray(selected.timeline) ? selected.timeline : []).map((item, index) => (
                      <div key={`${item.type || "event"}-${index}`} className={styles.timelineItem}>
                        <span className={styles.timelineDot} />
                        <span style={{ flex: 1 }}>{item.label}</span>
                        <span>{formatDateTime(item.at)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={styles.actions}>
                  {["pending", "under review"].includes(String(selected.status).toLowerCase()) ? (
                    <button type="button" className={`${styles.actionButton} ${styles.actionPrimary}`} onClick={() => assignNurse(String(selected.homeCareRequestId || selected.id))} disabled={busy}>
                      {busy ? "Assigning..." : "Auto-assign best professional"}
                    </button>
                  ) : null}

                  {["assigned", "accepted", "in progress"].includes(String(selected.status).toLowerCase()) ? (
                    <button type="button" className={`${styles.actionButton} ${styles.actionWarn}`} onClick={() => loadAvailableNurses(String(selected.homeCareRequestId || selected.id))} disabled={busy || loadNursesFor === String(selected.homeCareRequestId || selected.id)}>
                      {loadNursesFor === String(selected.homeCareRequestId || selected.id) ? "Loading..." : "Reassign caregiver"}
                    </button>
                  ) : null}

                  {!["completed", "cancelled"].includes(String(selected.status).toLowerCase()) ? (
                    <button type="button" className={`${styles.actionButton} ${styles.actionDanger}`} onClick={() => rejectRequest(String(selected.homeCareRequestId || selected.id))} disabled={busy}>
                      Reject request
                    </button>
                  ) : null}
                </div>

                {loadNursesFor === String(selected.homeCareRequestId || selected.id) ? (
                  <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>Available healthcare professionals</h3>
                    {nurses.length === 0 ? (
                      <div className={styles.empty}>No available verified professionals right now.</div>
                    ) : (
                      nurses.map((nurse) => (
                        <div key={nurse.nurseId} className={styles.gridItem} style={{ marginBottom: "0.5rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                            <div>
                              <strong>{nurse.nurseName}</strong>
                              <span style={{ display: "block", fontSize: "0.8rem", color: "rgba(15,23,42,0.55)" }}>
                                {nurse.specialization || "General care"} · {nurse.yearsOfExperience || 0} yrs
                              </span>
                              {nurse.nursePhone ? <span style={{ fontSize: "0.8rem" }}>📞 {nurse.nursePhone}</span> : null}
                            </div>
                            <button type="button" className={`${styles.actionButton} ${styles.actionPrimary}`} onClick={() => reassignNurse(String(selected.homeCareRequestId || selected.id), nurse.nurseId)} disabled={busy}>
                              Assign
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : null}

                {(NEXT_STATUS[String(selected.status).toLowerCase()] || []).length > 0 ? (
                  <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>Change status</h3>
                    <div className={styles.assignRow}>
                      <select
                        className={styles.statusSelect}
                        value=""
                        onChange={(event) => changeStatus(String(selected.homeCareRequestId || selected.id), event.target.value)}
                        disabled={busy}
                      >
                        <option value="">— Change status to —</option>
                        {(NEXT_STATUS[String(selected.status).toLowerCase()] || []).map((status) => (
                          <option key={status} value={status}>{status.replace(/^\w/, (c) => c.toUpperCase())}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className={styles.empty}>Select a home care request to review its details.</div>
            )}
          </section>
        </div>
      )}
    </main>
  )
}
