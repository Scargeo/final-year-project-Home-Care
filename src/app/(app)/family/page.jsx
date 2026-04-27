"use client"

import { useMemo, useState } from "react"
import AppShell from "../../components/AppShell.jsx"

const PATIENTS_KEY = "hc:patients:v1"

function loadPatients() {
  try {
    const raw = localStorage.getItem(PATIENTS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export default function FamilyPortalPage() {
  const [email, setEmail] = useState("")
  const [patients, setPatients] = useState(() => loadPatients())

  function lookup() {
    setPatients(loadPatients())
  }

  const match = useMemo(() => {
    const q = email.trim().toLowerCase()
    if (!q) return null
    return patients.find((p) => (p.familyEmail || "").toLowerCase() === q) || null
  }, [email, patients])

  return (
    <AppShell title="Family portal">
      <div className="hcCard" style={{ maxWidth: 720 }}>
        <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>View shared care updates (demo)</div>
        <p style={{ margin: "10px 0 0", color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
          Enter the family contact email saved on the patient record. Data is read from this browser only.
        </p>
        <div className="hcFieldRow" style={{ marginTop: 12 }}>
          <div className="hcField" style={{ flex: 1 }}>
            <div className="hcLabel">Family email</div>
            <input className="hcInput" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="family@email.com" />
          </div>
          <div className="hcField" style={{ display: "flex", alignItems: "flex-end" }}>
            <button className="hcBtn hcBtn--primary" type="button" onClick={lookup} style={{ width: "100%" }}>
              Load
            </button>
          </div>
        </div>

        {!match ? (
          <div style={{ marginTop: 14, color: "var(--muted)", fontSize: 13 }}>{email.trim() ? "No patient linked to this email in local storage." : "Enter an email and click Load."}</div>
        ) : (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 950, fontSize: 18 }}>{match.name}</div>
            <div style={{ marginTop: 8, fontSize: 13, color: "var(--muted)" }}>Care plan</div>
            <div style={{ marginTop: 6, whiteSpace: "pre-wrap", padding: 12, borderRadius: 14, border: "1px solid var(--border)", background: "color-mix(in srgb, var(--surface) 84%, transparent)" }}>
              {match.carePlan || "No care plan text yet."}
            </div>
            <div style={{ marginTop: 12, fontSize: 13, color: "var(--muted)" }}>Medications</div>
            <div style={{ marginTop: 6, whiteSpace: "pre-wrap", fontSize: 13 }}>{match.medicationsText || "—"}</div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
