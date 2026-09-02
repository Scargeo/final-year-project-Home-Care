"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

function getAdminToken() {
  if (typeof window === "undefined") return ""
  try {
    const value = JSON.parse(window.localStorage.getItem("adminAuth") || "{}")
    return value?.token || ""
  } catch {
    return ""
  }
}

function formatDate(value) {
  if (!value) return "Not set"
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value))
  } catch {
    return String(value)
  }
}

export default function NurseAssignmentsPage() {
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  async function loadAssignments() {
    setLoading(true)
    setError("")
    try {
      const token = getAdminToken()
      const response = await fetch("/api/admin/nurse-assignments", {
        cache: "no-store",
        headers: token ? { authorization: `Bearer ${token}` } : {},
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.message || "Could not load nurse assignments")
      setAssignments(Array.isArray(data.assignments) ? data.assignments : [])
    } catch (err) {
      setError(err?.message || "Could not load nurse assignments")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAssignments()
  }, [])

  return (
    <main style={{ minHeight: "100vh", background: "#f4f7fb", padding: "2rem" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: 0, color: "#0a3a66", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Admin console</p>
            <h1 style={{ margin: "0.25rem 0", color: "#102a43" }}>Nurse Assignments</h1>
            <p style={{ margin: 0, color: "#5a6b82" }}>Track appointment-based nurse assignments, completion, and patient ratings.</p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button type="button" onClick={loadAssignments} disabled={loading} style={buttonStyle}>{loading ? "Loading..." : "Refresh"}</button>
            <Link href="/admin" style={{ ...buttonStyle, textDecoration: "none", background: "#e6eef6", color: "#0a3a66" }}>Admin home</Link>
          </div>
        </header>

        {error ? <div style={{ background: "#fff1f2", color: "#9f1239", padding: "1rem", borderRadius: 12, marginBottom: "1rem" }}>{error}</div> : null}
        {loading ? <div style={panelStyle}>Loading nurse assignments...</div> : assignments.length === 0 ? <div style={panelStyle}>No nurse assignments have been created yet.</div> : (
          <div style={{ display: "grid", gap: "1rem" }}>
            {assignments.map((assignment) => {
              const review = assignment.patientRating
              return (
                <article key={assignment.assignmentId || assignment._id} style={panelStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                    <div>
                      <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem" }}>{assignment.assignmentId}</p>
                      <h2 style={{ margin: "0.25rem 0", color: "#102a43", fontSize: "1.2rem" }}>{assignment.patientName || "Patient"} → {assignment.nurseName || "Nurse"}</h2>
                      <p style={{ margin: 0, color: "#64748b" }}>{assignment.specialization || "General care"} · {assignment.status || "active"}</p>
                    </div>
                    <strong style={{ color: review ? "#b45309" : "#64748b" }}>{review ? `${review.rating}/5 patient rating` : "No patient rating"}</strong>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem", marginTop: "1rem", color: "#475569" }}>
                    <div><strong>Patient contact</strong><br />{assignment.patientPhone || "Not provided"}</div>
                    <div><strong>Status dates</strong><br />Completed: {formatDate(assignment.completedAt)}</div>
                    <div><strong>Care window</strong><br />{formatDate(assignment.careWeekStart)} to {formatDate(assignment.careWeekEnd)}</div>
                  </div>
                  <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #e2e8f0", color: "#334155" }}>
                    <strong>Assignment reason</strong>
                    <p style={{ margin: "0.35rem 0 0" }}>{assignment.assignmentReason}</p>
                    {review?.comment ? <p style={{ margin: "0.75rem 0 0", color: "#475569" }}><strong>Patient feedback:</strong> {review.comment}</p> : null}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}

const panelStyle = {
  background: "#fff",
  borderRadius: 16,
  padding: "1.25rem",
  boxShadow: "0 10px 30px rgba(16,42,67,0.08)",
}

const buttonStyle = {
  border: 0,
  borderRadius: 10,
  padding: "0.7rem 1rem",
  background: "#0a3a66",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
}
