"use client"

import { useEffect, useState, useCallback } from "react"
import styles from "../../doctor/doctor.module.css"
import { getStoredToken } from "../../../../lib/patient-auth"

export default function ConsentsPage() {
  const [consentRequests, setConsentRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [selectedSharedRecords, setSelectedSharedRecords] = useState([])
  const [selectedAttachments, setSelectedAttachments] = useState([])
  const [allAttachments, setAllAttachments] = useState([])
  const [shareAll, setShareAll] = useState(true)
  const [responding, setResponding] = useState(false)

  const patientId = typeof window !== "undefined" ? localStorage.getItem("patientAuth")?.split(",")[0] : ""

  useEffect(() => {
    loadConsentRequests()
  }, [patientId])

  const loadConsentRequests = useCallback(async () => {
    if (!patientId) {
      setError("Not authenticated")
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError("")
      const token = getStoredToken()
      const headers = { "Content-Type": "application/json" }
      if (token) headers.authorization = `Bearer ${token}`

      const res = await fetch(`/api/patients/${encodeURIComponent(patientId)}/consent-requests`, {
        cache: "no-store",
        headers,
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Failed to load consent requests")

      const pending = Array.isArray(data.requests)
        ? data.requests.filter((r) => r.status === "pending")
        : []
      setConsentRequests(pending)
    } catch (err) {
      setError(err?.message || "Error loading consent requests")
    } finally {
      setLoading(false)
    }
  }, [patientId])

  const handleSelectRequest = useCallback(async (request) => {
    try {
      setSelectedRequest(request)
      setShareAll(true)
      setSelectedSharedRecords([])
      setSelectedAttachments([])

      // Load attachments for selection
      const token = getStoredToken()
      const headers = {}
      if (token) headers.authorization = `Bearer ${token}`

      const res = await fetch(`/api/uploads/owner/${encodeURIComponent(patientId)}`, {
        cache: "no-store",
        headers,
      })

      const data = await res.json().catch(() => ({}))
      if (res.ok && Array.isArray(data.files)) {
        setAllAttachments(data.files)
      }
    } catch (err) {
      console.error("Error loading attachments:", err)
    }
  }, [patientId])

  const handleRespond = useCallback(
    async (accept) => {
      if (!selectedRequest) return

      try {
        setResponding(true)
        setError("")

        const token = getStoredToken()
        const headers = { "Content-Type": "application/json" }
        if (token) headers.authorization = `Bearer ${token}`

        const body = accept
          ? {
              status: "accepted",
              sharedRecords: shareAll
                ? ["medicalHistory", "prescriptions", "allergies", "labResults"]
                : selectedSharedRecords,
              sharedAttachments: shareAll ? allAttachments.map((a) => a._id || a.id) : selectedAttachments,
            }
          : { status: "rejected" }

        const res = await fetch(
          `/api/patients/${encodeURIComponent(patientId)}/consent-requests/${encodeURIComponent(selectedRequest.requestId)}`,
          {
            method: "PATCH",
            headers,
            body: JSON.stringify(body),
          }
        )

        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.message || "Failed to respond to consent request")

        // Reload list
        setSelectedRequest(null)
        loadConsentRequests()
      } catch (err) {
        setError(err?.message || "Error responding to consent request")
      } finally {
        setResponding(false)
      }
    },
    [selectedRequest, patientId, shareAll, selectedSharedRecords, selectedAttachments, allAttachments, loadConsentRequests]
  )

  if (loading) return <div className={styles.container}>Loading...</div>

  if (!selectedRequest) {
    return (
      <div className={styles.container}>
        <h2>Consent Requests</h2>
        {error && <div className={styles.error}>{error}</div>}
        {consentRequests.length === 0 ? (
          <p>No pending consent requests.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {consentRequests.map((req) => (
              <div
                key={req.requestId}
                style={{
                  border: "1px solid #ddd",
                  padding: 16,
                  borderRadius: 8,
                  cursor: "pointer",
                  background: "#fafafa",
                }}
                onClick={() => handleSelectRequest(req)}
              >
                <p style={{ margin: 0, fontWeight: 600 }}>Doctor Request</p>
                <p style={{ margin: "4px 0", fontSize: 14 }}>{req.message}</p>
                <p style={{ margin: "4px 0", fontSize: 12, color: "#666" }}>
                  Requested: {new Date(req.requestedAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <button
        type="button"
        onClick={() => setSelectedRequest(null)}
        style={{ marginBottom: 16, padding: "8px 12px", fontSize: 14, cursor: "pointer" }}
      >
        ← Back
      </button>

      <h2>Respond to Consent Request</h2>
      {error && <div className={styles.error}>{error}</div>}

      <div style={{ marginBottom: 20, padding: 16, background: "#f0f9ff", borderRadius: 8 }}>
        <p style={{ margin: "0 0 8px 0", fontWeight: 600 }}>Request Details</p>
        <p style={{ margin: "4px 0" }}>{selectedRequest.message}</p>
        <p style={{ margin: "4px 0", fontSize: 12, color: "#666" }}>
          Requested: {new Date(selectedRequest.requestedAt).toLocaleString()}
        </p>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={shareAll}
            onChange={(e) => setShareAll(e.target.checked)}
            disabled={responding}
          />
          <span>Share all records and attachments</span>
        </label>

        {!shareAll && (
          <div style={{ marginLeft: 24 }}>
            <p style={{ marginBottom: 12, fontWeight: 600 }}>Select health records to share:</p>
            {["medicalHistory", "prescriptions", "allergies", "labResults"].map((field) => (
              <label
                key={field}
                style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer" }}
              >
                <input
                  type="checkbox"
                  checked={selectedSharedRecords.includes(field)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedSharedRecords((prev) => [...prev, field])
                    } else {
                      setSelectedSharedRecords((prev) => prev.filter((f) => f !== field))
                    }
                  }}
                  disabled={responding}
                />
                <span style={{ textTransform: "capitalize" }}>{field.replace(/([A-Z])/g, " $1")}</span>
              </label>
            ))}

            {allAttachments.length > 0 && (
              <>
                <p style={{ marginTop: 16, marginBottom: 12, fontWeight: 600 }}>Select attachments to share:</p>
                {allAttachments.map((att) => (
                  <label
                    key={att._id || att.id}
                    style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer" }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedAttachments.includes(att._id || att.id)}
                      onChange={(e) => {
                        const attId = att._id || att.id
                        if (e.target.checked) {
                          setSelectedAttachments((prev) => [...prev, attId])
                        } else {
                          setSelectedAttachments((prev) => prev.filter((id) => id !== attId))
                        }
                      }}
                      disabled={responding}
                    />
                    <span style={{ fontSize: 14 }}>{att.originalFilename || att.filename || "Unnamed"}</span>
                  </label>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button
          type="button"
          onClick={() => handleRespond(true)}
          disabled={responding}
          style={{
            padding: "10px 20px",
            background: "#10b981",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: responding ? "not-allowed" : "pointer",
            opacity: responding ? 0.6 : 1,
          }}
        >
          {responding ? "Processing..." : "Accept & Share"}
        </button>
        <button
          type="button"
          onClick={() => handleRespond(false)}
          disabled={responding}
          style={{
            padding: "10px 20px",
            background: "#ef4444",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: responding ? "not-allowed" : "pointer",
            opacity: responding ? 0.6 : 1,
          }}
        >
          {responding ? "Processing..." : "Reject"}
        </button>
      </div>
    </div>
  )
}
