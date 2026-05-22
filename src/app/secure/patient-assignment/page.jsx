"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"

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

export default function PatientAssignmentPage() {
  const searchParams = useSearchParams()
  const assignmentId = searchParams.get("assignmentId") || ""
  const [auth, setAuth] = useState(null)
  const [assignment, setAssignment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const patientId = useMemo(() => resolvePatientId(auth), [auth])

  useEffect(() => {
    const storedAuth = getStoredPatientAuth()
    if (storedAuth) setAuth(storedAuth)
  }, [])

  useEffect(() => {
    if (!assignmentId) {
      setLoading(false)
      setError("Missing assignment ID.")
      return
    }

    const storedAuth = getStoredPatientAuth()
    const nextPatientId = resolvePatientId(storedAuth)
    if (!nextPatientId) {
      setLoading(false)
      setError("Please sign in as a patient to view this assignment.")
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

        const response = await fetch(`/api/patients/${encodeURIComponent(nextPatientId)}/assignments/${encodeURIComponent(assignmentId)}`, {
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

  const status = String(assignment?.status || "active").toLowerCase()

  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg, #f4f8fc 0%, #eef4fb 100%)", padding: "2rem" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center", marginBottom: "1.5rem" }}>
          <div>
            <p style={{ margin: 0, color: "#0a3a66", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Patient Assignment</p>
            <h1 style={{ margin: "0.25rem 0 0", fontSize: "2rem", color: "#102a43" }}>Care Details</h1>
          </div>
          <Link href="/secure/notifications" style={{ textDecoration: "none", color: "#0a3a66", fontWeight: 600 }}>Back to notifications</Link>
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
                  {status}
                </span>
              </div>

              <div style={{ display: "grid", gap: "0.9rem" }}>
                <div>
                  <p style={{ margin: 0, color: "#5a6b82" }}>Assigned nurse</p>
                  <strong style={{ color: "#102a43" }}>{assignment.nurseName || assignment.nurse?.nurseName || "Nurse"}</strong>
                  <div style={{ color: "#5a6b82" }}>{assignment.specialization || assignment.carePlan?.aiSpecialty || "General care"}</div>
                </div>
                <div>
                  <p style={{ margin: 0, color: "#5a6b82" }}>Condition</p>
                  <strong style={{ color: "#102a43" }}>{assignment.condition || assignment.carePlan?.condition || "Not specified"}</strong>
                </div>
                <div>
                  <p style={{ margin: 0, color: "#5a6b82" }}>Drug / medication</p>
                  <strong style={{ color: "#102a43" }}>{assignment.drug || assignment.carePlan?.drug || "Not specified"}</strong>
                </div>
                <div>
                  <p style={{ margin: 0, color: "#5a6b82" }}>Why this nurse was chosen</p>
                  <div style={{ color: "#102a43" }}>{assignment.selectionReason || assignment.carePlan?.selectionReason || assignment.aiSummary || "The system matched an available verified nurse."}</div>
                </div>
              </div>
            </section>

            <aside style={{ display: "grid", gap: "1rem" }}>
              <section style={{ background: "#fff", borderRadius: 20, padding: "1.25rem", boxShadow: "0 20px 40px rgba(16,42,67,0.08)" }}>
                <h3 style={{ marginTop: 0, color: "#102a43" }}>Care Window</h3>
                <div style={{ color: "#5a6b82" }}>Start: {formatDate(assignment.careWeekStart)}</div>
                <div style={{ color: "#5a6b82" }}>End: {formatDate(assignment.careWeekEnd)}</div>
              </section>

              <section style={{ background: "#fff", borderRadius: 20, padding: "1.25rem", boxShadow: "0 20px 40px rgba(16,42,67,0.08)" }}>
                <h3 style={{ marginTop: 0, color: "#102a43" }}>Patient details</h3>
                <div style={{ color: "#5a6b82", marginBottom: "0.4rem" }}>Patient: {assignment.patientName || patientId}</div>
                <div style={{ color: "#5a6b82", marginBottom: "0.4rem" }}>Phone: {assignment.patientPhone || "Not provided"}</div>
                <div style={{ color: "#5a6b82" }}>Linked appointment: {assignment.sourceAppointmentId || "Not provided"}</div>
              </section>
            </aside>
          </div>
        ) : null}
      </div>
    </main>
  )
}
