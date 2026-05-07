"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import styles from "./page.module.css"
import { useUpload } from "../../../lib/useUpload"

function getStoredAuth() {
  if (typeof window === "undefined") return null

  const stored = window.localStorage.getItem("patientAuth")
  if (!stored) return null

  try {
    return JSON.parse(stored)
  } catch {
    return null
  }
}

function getPatientIdentity() {
  const auth = getStoredAuth()
  const patientId = auth?.patientId || auth?.id || auth?._id || auth?.patientEmail || "patient"
  const patientName = [auth?.patientFirstName, auth?.patientLastName].filter(Boolean).join(" ").trim() || auth?.patientFirstName || "Patient"

  return { patientId, patientName }
}

function toPdfViewerUrl(file) {
  // For iframe preview, use Google Docs Viewer for Cloudinary URLs
  // For base64, use data URL directly
  if (file.url) {
    return `https://docs.google.com/gview?url=${encodeURIComponent(file.url)}&embedded=true`
  }
  return `data:${file.mimeType || "application/pdf"};base64,${file.fileData}`
}

export default function HealthRecordsPage() {
  const [patientId, setPatientId] = useState("patient")
  const [patientName, setPatientName] = useState("Patient")
  const [medicalHistory, setMedicalHistory] = useState("")
  const [prescriptions, setPrescriptions] = useState("")
  const [allergies, setAllergies] = useState("")
  const [labResults, setLabResults] = useState([])
  const [savedLabResultCount, setSavedLabResultCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const { upload, uploading } = useUpload()

  useEffect(() => {
    const identity = getPatientIdentity()
    setPatientId(identity.patientId)
    setPatientName(identity.patientName)
  }, [])

  useEffect(() => {
    let active = true

    async function loadHealthRecords() {
      if (!patientId || patientId === "patient") {
        setLoading(false)
        return
      }

      setLoading(true)
      setError("")

      try {
        const response = await fetch(`/api/patients/${encodeURIComponent(patientId)}/health-records`, {
          cache: "no-store",
        })

        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(data?.message || "Could not load health records.")
        }

        if (!active) return

        setMedicalHistory(String(data?.medicalHistory || ""))
        setPrescriptions(String(data?.prescriptions || ""))
        setAllergies(String(data?.allergies || ""))
        const loadedLabResults = Array.isArray(data?.labResults)
          ? data.labResults.map((entry) => ({ ...entry, isSaved: true }))
          : []
        setLabResults(loadedLabResults)
        setSavedLabResultCount(loadedLabResults.length)
      } catch (err) {
        if (active) {
          setError(err?.message || "Could not load health records.")
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadHealthRecords()

    return () => {
      active = false
    }
  }, [patientId])

  const recordSummary = useMemo(
    () => [
      { label: "Medical history", value: medicalHistory.trim() ? "Saved" : "Empty" },
      { label: "Prescriptions", value: prescriptions.trim() ? "Saved" : "Empty" },
      { label: "Lab results", value: `${savedLabResultCount} file${savedLabResultCount === 1 ? "" : "s"}` },
      { label: "Allergies & conditions", value: allergies.trim() ? "Saved" : "Empty" },
    ],
    [allergies, medicalHistory, prescriptions, savedLabResultCount],
  )

  async function handleLabUpload(event) {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    setError("")
    setNotice("")

    const pdfFiles = files.filter((file) => file.type === "application/pdf")
    if (pdfFiles.length !== files.length) {
      setError("Only PDF files are allowed for lab results.")
      return
    }

    // Upload to Cloudinary
    const uploaded = await upload(pdfFiles, patientId, "document")
    if (uploaded.length > 0) {
      const nextFiles = uploaded.map((doc) => ({
        fileName: doc.originalName,
        mimeType: doc.mimeType,
        url: doc.url,
        publicId: doc.publicId,
        attachmentId: doc._id,
        uploadedAt: new Date().toISOString(),
        isSaved: false,
      }))
      setLabResults((current) => [...current, ...nextFiles])
      setNotice(`Uploaded ${nextFiles.length} lab result(s).`)
    }
    event.target.value = ""
  }

  async function removeLabResult(index) {
    const file = labResults[index]
    if (!file) return

    const confirmed = window.confirm("Remove this lab result from the current draft? You will need to save to keep the change.")
    if (!confirmed) return

    if (file.attachmentId) {
      try {
        const response = await fetch(`/api/uploads/${encodeURIComponent(file.attachmentId)}`, {
          method: "DELETE",
        })

        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(data?.message || "Could not remove the uploaded file.")
        }

        if (file.isSaved) {
          setSavedLabResultCount((current) => Math.max(0, current - 1))
        }
      } catch (err) {
        setError(err?.message || "Could not remove the uploaded file.")
        return
      }
    }

    setLabResults((current) => current.filter((_, currentIndex) => currentIndex !== index))
  }

  async function saveHealthRecords() {
    setSaving(true)
    setError("")
    setNotice("")

    try {
      const response = await fetch(`/api/patients/${encodeURIComponent(patientId)}/health-records`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medicalHistory, prescriptions, allergies, labResults }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.message || "Could not save health records.")
      }

      const savedLabResults = Array.isArray(data?.labResults)
        ? data.labResults.map((entry) => ({ ...entry, isSaved: true }))
        : labResults.map((entry) => ({ ...entry, isSaved: true }))

      setLabResults(savedLabResults)
      setSavedLabResultCount(savedLabResults.length)
      setNotice("Health records saved successfully.")
    } catch (err) {
      setError(err?.message || "Could not save health records.")
    } finally {
      setSaving(false)
    }
  }

  async function deleteMedicalHistory() {
    const confirmed = window.confirm("Delete the medical history section? Health professionals will update it later.")
    if (!confirmed) return

    setSaving(true)
    setError("")
    setNotice("")

    try {
      const response = await fetch(`/api/patients/${encodeURIComponent(patientId)}/health-records`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medicalHistory: "", prescriptions, allergies, labResults }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.message || "Could not delete medical history.")
      }

      setMedicalHistory("")
      setLabResults(Array.isArray(data?.labResults) ? data.labResults : labResults)
      setNotice("Medical history cleared for professional review.")
    } catch (err) {
      setError(err?.message || "Could not delete medical history.")
    } finally {
      setSaving(false)
    }
  }

  async function deletePrescriptions() {
    const confirmed = window.confirm("Delete all prescriptions? Health professionals will update them later.")
    if (!confirmed) return

    setSaving(true)
    setError("")
    setNotice("")

    try {
      const response = await fetch(`/api/patients/${encodeURIComponent(patientId)}/health-records`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medicalHistory, prescriptions: "", allergies, labResults }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.message || "Could not delete prescriptions.")
      }

      setPrescriptions("")
      setLabResults(Array.isArray(data?.labResults) ? data.labResults : labResults)
      setNotice("Prescriptions cleared for professional review.")
    } catch (err) {
      setError(err?.message || "Could not delete prescriptions.")
    } finally {
      setSaving(false)
    }
  }

  async function deleteAllergies() {
    const confirmed = window.confirm("Delete all allergies and conditions? Health professionals will update them later.")
    if (!confirmed) return

    setSaving(true)
    setError("")
    setNotice("")

    try {
      const response = await fetch(`/api/patients/${encodeURIComponent(patientId)}/health-records`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medicalHistory, prescriptions, allergies: "", labResults }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.message || "Could not delete allergies.")
      }

      setAllergies("")
      setLabResults(Array.isArray(data?.labResults) ? data.labResults : labResults)
      setNotice("Allergies and conditions cleared for professional review.")
    } catch (err) {
      setError(err?.message || "Could not delete allergies.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <div>
          <p className={styles.kicker}>Patient Portal</p>
          <h1>Health Records</h1>
          <p className={styles.subtitle}>Manage medical history, prescriptions, lab PDFs, and allergy notes in one place.</p>
        </div>

        <div className={styles.topActions}>
          <Link href="/secure/dashboard" className={styles.secondaryButton}>
            Back to dashboard
          </Link>
          <Link href="/secure/home" className={styles.primaryButton}>
            Home
          </Link>
        </div>
      </header>

      <section className={styles.shell}>
        <div className={styles.summaryGrid}>
          {recordSummary.map((item) => (
            <article key={item.label} className={styles.summaryCard}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          ))}
        </div>

        {loading ? <p className={styles.status}>Loading records…</p> : null}
        {error ? <p className={styles.error}>{error}</p> : null}
        {notice ? <p className={styles.notice}>{notice}</p> : null}

        <div className={styles.grid}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2>Medical information</h2>
                <p>Medical history is read-only here. Health professionals will update it later.</p>
              </div>
              <span className={styles.badge}>{patientName}</span>
            </div>

            <label className={styles.field}>
              <span>Medical history</span>
              <textarea
                value={medicalHistory}
                readOnly
                aria-readonly="true"
                rows={6}
                placeholder="Past surgeries, ongoing conditions, important care details..."
              />
            </label>

            <div className={styles.actionsRow}>
              <button type="button" className={styles.secondaryButton} onClick={deleteMedicalHistory} disabled={saving || loading || !medicalHistory.trim()}>
                {saving ? "Working..." : "Delete medical history"}
              </button>
            </div>

            <label className={styles.field}>
              <span>Prescriptions</span>
              <textarea
                value={prescriptions}
                readOnly
                aria-readonly="true"
                className={styles.fieldReadOnly}
                rows={5}
                placeholder="List current medications, dosage, and schedule..."
              />
            </label>

            <div className={styles.actionsRow}>
              <button type="button" className={styles.secondaryButton} onClick={deletePrescriptions} disabled={saving || loading || !prescriptions.trim()}>
                {saving ? "Working..." : "Delete prescriptions"}
              </button>
            </div>

            <label className={styles.field}>
              <span>Allergies & conditions</span>
              <textarea
                value={allergies}
                readOnly
                aria-readonly="true"
                className={styles.fieldReadOnly}
                rows={4}
                placeholder="Allergies, chronic conditions, special precautions..."
              />
            </label>

            <div className={styles.actionsRow}>
              <button type="button" className={styles.secondaryButton} onClick={deleteAllergies} disabled={saving || loading || !allergies.trim()}>
                {saving ? "Working..." : "Delete allergies & conditions"}
              </button>
            </div>

          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2>Lab results</h2>
                <p>Upload PDF files and open them directly from the records page.</p>
              </div>
            </div>

            <label className={styles.uploadBox}>
              <input type="file" accept="application/pdf" multiple onChange={handleLabUpload} disabled={uploading} />
              <span>{uploading ? "Uploading..." : "Upload PDF lab results"}</span>
              <small>PDF only. You can add more than one file.</small>
            </label>

            <div className={styles.fileList}>
              {labResults.length === 0 ? <p className={styles.emptyState}>No lab results uploaded yet.</p> : null}

              {labResults.map((file, index) => {
                const viewerUrl = toPdfViewerUrl(file)
                return (
                  <article key={`${file.fileName}-${index}`} className={styles.fileCard}>
                    <div className={styles.fileMeta}>
                      <div>
                        <strong>{file.fileName}</strong>
                        <span>{new Date(file.uploadedAt || Date.now()).toLocaleString()}</span>
                      </div>
                      <div className={styles.fileActions}>
                        <button type="button" className={styles.ghostButton} onClick={() => removeLabResult(index)}>
                          Remove
                        </button>
                      </div>
                    </div>

                    <details className={styles.previewDetails}>
                      <summary>Preview</summary>
                        <div>
                          <iframe title={file.fileName} src={viewerUrl} className={styles.previewFrame} />
                          <button
                            type="button"
                            className={styles.ghostButton}
                            onClick={(e) => e.currentTarget.closest("details").open = false}
                            style={{ marginTop: "0.75rem" }}
                          >
                            Close preview
                          </button>
                        </div>
                    </details>
                  </article>
                )
              })}
            </div>

              <div className={styles.actionsRow}>
                <button type="button" className={styles.primaryButton} onClick={saveHealthRecords} disabled={saving || loading}>
                  {saving ? "Saving..." : "Save records"}
                </button>
              </div>
          </section>
        </div>
      </section>
    </main>
  )
}
