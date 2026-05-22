"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"

function getStoredNurseAuth() {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem("nurseAuth")
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function getStoredToken() {
  if (typeof window === "undefined") return null
  try {
    const auth = getStoredNurseAuth()
    return auth?.token || auth?.accessToken || null
  } catch {
    return null
  }
}

function resolveNurseId(auth) {
  return String(auth?.nurseId || auth?.uid || auth?.id || auth?._id || "").trim()
}

function formatDate(value) {
  if (!value) return "Not set"
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value))
  } catch {
    return String(value)
  }
}

export default function NurseAssignmentDetailPage() {
  const searchParams = useSearchParams()
  const assignmentId = searchParams.get("assignmentId") || ""
  const [auth, setAuth] = useState(null)
  const [assignment, setAssignment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [savingAction, setSavingAction] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const nurseId = useMemo(() => resolveNurseId(auth), [auth])

  useEffect(() => {
    const storedAuth = getStoredNurseAuth()
    if (storedAuth) setAuth(storedAuth)
  }, [])

  useEffect(() => {
    if (!assignmentId) {
      setLoading(false)
      setError("Missing assignment ID.")
      return
    }

    const storedAuth = getStoredNurseAuth()
    const nextNurseId = resolveNurseId(storedAuth)
    if (!nextNurseId) {
      setLoading(false)
      setError("Please sign in as a nurse to view assignments.")
      return
    }

    let active = true

    async function loadAssignment() {
      setLoading(true)
      setError("")
      try {
        const headers = {}
        const token = getStoredToken()
        if (token) headers.authorization = `Bearer ${token}`

        const response = await fetch(`/api/nurses/${encodeURIComponent(nextNurseId)}/assignments/${encodeURIComponent(assignmentId)}`, {
          cache: "no-store",
          headers,
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data?.message || "Could not load assignment")
        if (!active) return
        setAssignment(data?.assignment || null)
      } catch (err) {
        if (active) setError(err?.message || "Could not load assignment")
      } finally {
        if (active) setLoading(false)
      }
    }

    loadAssignment()

    return () => {
      active = false
    }
  }, [assignmentId])

  async function updateAssignment(action) {
    if (!assignmentId || !nurseId) return

    setSavingAction(action)
    setError("")
    setMessage("")

    try {
      const headers = { "Content-Type": "application/json" }
      const token = getStoredToken()
      if (token) headers.authorization = `Bearer ${token}`

      const response = await fetch(`/api/nurses/${encodeURIComponent(nurseId)}/assignments/${encodeURIComponent(assignmentId)}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ action }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.message || "Could not update assignment")

      setAssignment(data?.assignment || null)
      setMessage(
        action === "acknowledge"
          ? "Assignment acknowledged."
          : action === "contacted"
            ? "Patient contact marked."
            : "Care completed and closed."
      )
    } catch (err) {
      setError(err?.message || "Could not update assignment")
    } finally {
      setSavingAction("")
    }
  }

  const status = String(assignment?.status || "active").toLowerCase()
  const canAcknowledge = status === "active"
  const canContact = status === "active" || status === "acknowledged"
  const canComplete = status === "active" || status === "acknowledged" || status === "contacted"

  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg, #f4f8fc 0%, #eef4fb 100%)", padding: "2rem" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center", marginBottom: "1.5rem" }}>
          <div>
            <p style={{ margin: 0, color: "#0a3a66", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Nurse Assignment</p>
            <h1 style={{ margin: "0.25rem 0 0", fontSize: "2rem", color: "#102a43" }}>Assignment Details</h1>
          </div>
          <Link href="/secure/nurse" style={{ textDecoration: "none", color: "#0a3a66", fontWeight: 600 }}>Back to dashboard</Link>
        </div>

        {loading ? (
          <div style={{ padding: "2rem", background: "#fff", borderRadius: 18, boxShadow: "0 20px 40px rgba(16,42,67,0.08)" }}>Loading assignment...</div>
        ) : error ? (
          <div style={{ padding: "1rem 1.25rem", background: "#fff1f2", color: "#9f1239", borderRadius: 16, marginBottom: "1rem" }}>{error}</div>
        ) : assignment ? (
          <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "minmax(0, 1.2fr) minmax(280px, 0.8fr)" }}>
            <section style={{ background: "#fff", borderRadius: 20, padding: "1.5rem", boxShadow: "0 20px 40px rgba(16,42,67,0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start", marginBottom: "1rem" }}>
                <div>
                  <p style={{ margin: 0, color: "#5a6b82", fontSize: "0.9rem" }}>Assignment ID</p>
                  <h2 style={{ margin: "0.25rem 0 0", color: "#102a43" }}>{assignment.assignmentId}</h2>
                </div>
                <span style={{ padding: "0.45rem 0.8rem", borderRadius: 999, background: "#e6eef6", color: "#0a3a66", fontWeight: 700 }}>
                  {assignment.statusLabel || status}
                </span>
              </div>

              <div style={{ display: "grid", gap: "0.9rem" }}>
                <div>
                  <p style={{ margin: 0, color: "#5a6b82" }}>Patient</p>
                  <strong style={{ color: "#102a43" }}>{assignment.patient?.patientName || assignment.patientName || "Patient"}</strong>
                  <div style={{ color: "#5a6b82" }}>{assignment.patient?.patientPhone || assignment.patientPhone || "No phone provided"}</div>
                </div>
                <div>
                  <p style={{ margin: 0, color: "#5a6b82" }}>Condition</p>
                  <strong style={{ color: "#102a43" }}>{assignment.carePlan?.condition || assignment.condition || "Not specified"}</strong>
                </div>
                <div>
                  <p style={{ margin: 0, color: "#5a6b82" }}>Drug / medication</p>
                  <strong style={{ color: "#102a43" }}>{assignment.carePlan?.drug || assignment.drug || "Not specified"}</strong>
                </div>
                <div>
                  <p style={{ margin: 0, color: "#5a6b82" }}>AI reasoning</p>
                  <strong style={{ color: "#102a43" }}>{assignment.carePlan?.aiSpecialty || assignment.specialization || "General care"}</strong>
                  <div style={{ color: "#5a6b82" }}>{assignment.carePlan?.aiSummary || assignment.aiSummary || "No summary available."}</div>
                </div>
              </div>
            </section>

            <aside style={{ display: "grid", gap: "1rem" }}>
              <section style={{ background: "#fff", borderRadius: 20, padding: "1.25rem", boxShadow: "0 20px 40px rgba(16,42,67,0.08)" }}>
                <h3 style={{ marginTop: 0, color: "#102a43" }}>Care Window</h3>
                <div style={{ color: "#5a6b82" }}>Start: {formatDate(assignment.schedule?.weekStart || assignment.careWeekStart)}</div>
                <div style={{ color: "#5a6b82" }}>End: {formatDate(assignment.schedule?.weekEnd || assignment.careWeekEnd)}</div>
              </section>

              <section style={{ background: "#fff", borderRadius: 20, padding: "1.25rem", boxShadow: "0 20px 40px rgba(16,42,67,0.08)" }}>
                <h3 style={{ marginTop: 0, color: "#102a43" }}>Actions</h3>
                <div style={{ display: "grid", gap: "0.75rem" }}>
                  <button type="button" disabled={!canAcknowledge || savingAction} onClick={() => updateAssignment("acknowledge")} style={actionButtonStyle(!canAcknowledge || savingAction)}>
                    {savingAction === "acknowledge" ? "Saving..." : "Acknowledge"}
                  </button>
                  <button type="button" disabled={!canContact || savingAction} onClick={() => updateAssignment("contacted")} style={actionButtonStyle(!canContact || savingAction)}>
                    {savingAction === "contacted" ? "Saving..." : "Contacted patient"}
                  </button>
                  <button type="button" disabled={!canComplete || savingAction} onClick={() => updateAssignment("completed")} style={actionButtonStyle(!canComplete || savingAction, true)}>
                    {savingAction === "completed" ? "Saving..." : "Completed care"}
                  </button>
                </div>
              </section>

              <section style={{ background: "#fff", borderRadius: 20, padding: "1.25rem", boxShadow: "0 20px 40px rgba(16,42,67,0.08)" }}>
                <h3 style={{ marginTop: 0, color: "#102a43" }}>Status Timestamps</h3>
                <div style={{ color: "#5a6b82", marginBottom: "0.4rem" }}>Acknowledged: {formatDate(assignment.acknowledgedAt)}</div>
                <div style={{ color: "#5a6b82", marginBottom: "0.4rem" }}>Contacted: {formatDate(assignment.contactedAt)}</div>
                <div style={{ color: "#5a6b82" }}>Completed: {formatDate(assignment.completedAt)}</div>
              </section>
            </aside>
          </div>
        ) : null}

        {message ? <div style={{ marginTop: "1rem", background: "#ecfdf3", color: "#166534", padding: "0.9rem 1rem", borderRadius: 14 }}>{message}</div> : null}
      </div>
    </main>
  )
}

function actionButtonStyle(disabled, accent = false) {
  return {
    border: "none",
    borderRadius: 14,
    padding: "0.9rem 1rem",
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    color: "#fff",
    background: disabled ? "#94a3b8" : accent ? "linear-gradient(135deg, #0f766e, #14b8a6)" : "linear-gradient(135deg, #0a3a66, #155e9b)",
    opacity: disabled ? 0.75 : 1,
  }
}