"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useState, useCallback, useRef } from "react"
import { io } from "socket.io-client"
import styles from "./nurse.module.css"
import LoadingCanvas from "../components/LoadingCanvas"
import VerifiedDoctorBadge from "../components/VerifiedDoctorBadge"
import { getBackendBaseUrl } from "../../../lib/backend-url"

const MISSED_GRACE_MINUTES = 10
const REBOOK_VISIBLE_WINDOW_MINUTES = 20

function formatDateRange(startValue, endValue) {
  try {
    const formatter = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    const start = startValue ? formatter.format(new Date(startValue)) : ""
    const end = endValue ? formatter.format(new Date(endValue)) : ""
    if (start && end) return `${start} - ${end}`
    return start || end || ""
  } catch {
    return ""
  }
}

function getNurseIdentity() {
  if (typeof window === "undefined") return { nurseId: "nurse", nurseName: "Nurse", profileImage: null }

  const stored = window.localStorage.getItem("nurseAuth")
  if (!stored) return { nurseId: "nurse", nurseName: "Nurse", profileImage: null }

  try {
    const auth = JSON.parse(stored)
    const nurseId = auth?.nurseId || auth?.uid || auth?.id || auth?._id
    const nurseName = [auth?.firstName || auth?.nurseFirstName, auth?.lastName || auth?.nurseLastName]
      .filter(Boolean)
      .join(" ")
      .trim() || auth?.firstName || auth?.nurseFirstName || "Nurse"
    const profileImage = auth?.profileImage || null
    return { nurseId, nurseName, profileImage }
  } catch {
    return { nurseId: "nurse", nurseName: "Nurse", profileImage: null }
  }
}

function getStoredToken() {
  if (typeof window === 'undefined') return null
  try {
    const patientAuth = window.localStorage.getItem('patientAuth')
    const nurseAuth = window.localStorage.getItem('nurseAuth')
    const doctorAuth = window.localStorage.getItem('doctorAuth')
    const parsed = patientAuth ? JSON.parse(patientAuth) : nurseAuth ? JSON.parse(nurseAuth) : doctorAuth ? JSON.parse(doctorAuth) : null
    return parsed?.token || parsed?.accessToken || null
  } catch {
    return null
  }
}

function readStoredNurseAuth() {
  if (typeof window === "undefined") return null
  try {
    const stored = window.localStorage.getItem("nurseAuth")
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

export default function NurseDashboard() {
  const [nurseId, setNurseId] = useState("nurse")
  const [nurseName, setNurseName] = useState("Nurse")
  const [profileImage, setProfileImage] = useState(null)
  const [specialization, setSpecialization] = useState("")
  const [yearsOfExperience, setYearsOfExperience] = useState(0)
  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [, setError] = useState("")
  const [, setNotificationCount] = useState(0)
  const socketRef = useRef(null)
  const fileInputRef = useRef(null)

  const handleProfileImageUpload = useCallback((uploaded) => {
    const nextProfileImage = uploaded?.profileImage || (uploaded?.url ? { url: uploaded.url, publicId: uploaded.publicId, mimeType: uploaded.mimeType } : uploaded)
    setProfileImage(nextProfileImage)
    try {
      const stored = window.localStorage.getItem('nurseAuth') || '{}'
      const auth = JSON.parse(stored)
      if (uploaded?.uid || uploaded?.nurseId) {
        window.localStorage.setItem('nurseAuth', JSON.stringify({ ...(auth || {}), ...(uploaded || {}) }))
      } else {
        auth.profileImage = { url: nextProfileImage?.url, publicId: nextProfileImage?.publicId }
        window.localStorage.setItem('nurseAuth', JSON.stringify(auth))
      }
    } catch (e) {
      console.error('Failed to save nurse profile image to localStorage', e)
    }
  }, [])

  const handleProfileImageSelect = useCallback(
    async (event) => {
      const files = Array.from(event.target.files || [])
      if (files.length === 0) return

      const imageFiles = files.filter((file) => file.type.startsWith('image/'))
      if (imageFiles.length !== files.length) {
        console.error('Only image files are allowed for profile pictures.')
        return
      }

      try {
        const formData = new FormData()
        imageFiles.forEach((file) => formData.append('files', file))
        formData.append('ownerRef', nurseId)
        formData.append('purpose', 'profile')

        const headers = {}
        const token = getStoredToken()
        if (token) headers.authorization = `Bearer ${token}`

        const response = await fetch('/api/uploads', {
          method: 'POST',
          headers,
          body: formData,
        })

        if (!response.ok) throw new Error('Upload failed')

        const data = await response.json()
        const uploadedNurse = data?.nurse || null
        const uploadedFile = data?.files?.[0] || data?.attachments?.[0] || data?.attachment || null

        if (uploadedNurse?.profileImage) {
          handleProfileImageUpload(uploadedNurse)
        } else if (uploadedFile?.url) {
          handleProfileImageUpload(uploadedFile)
        }
      } catch (err) {
        console.error('Profile image upload error:', err)
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [handleProfileImageUpload, nurseId],
  )

  useEffect(() => {
    const identity = getNurseIdentity()
    setNurseId(identity.nurseId)
    setNurseName(identity.nurseName)
    setProfileImage(identity.profileImage || null)
  }, [])

  useEffect(() => {
    function syncFromStoredAuth() {
      const auth = readStoredNurseAuth()
      if (!auth) return

      setNurseName((current) => {
        const nextName = [auth?.firstName || auth?.nurseFirstName, auth?.lastName || auth?.nurseLastName]
          .filter(Boolean)
          .join(" ")
          .trim()
        return nextName || current
      })
      setProfileImage((current) => auth?.profileImage || current)
      setSpecialization(auth?.specialization || "")
      setYearsOfExperience(Number.isFinite(Number(auth?.yearsOfExperience)) ? Number(auth.yearsOfExperience) : 0)
      if (auth?.nurseId || auth?.uid || auth?.id || auth?._id) {
        setNurseId(String(auth.nurseId || auth.uid || auth.id || auth._id))
      }
    }

    window.addEventListener("nurseAuthUpdated", syncFromStoredAuth)
    window.addEventListener("storage", syncFromStoredAuth)

    return () => {
      window.removeEventListener("nurseAuthUpdated", syncFromStoredAuth)
      window.removeEventListener("storage", syncFromStoredAuth)
    }
  }, [])

  useEffect(() => {
    if (!nurseId || nurseId === 'nurse') return

    let active = true
    setLoading(true)

    const loadDashboard = async () => {
      try {
        const headers = { "Content-Type": "application/json" }
        const token = getStoredToken()
        if (token) headers.authorization = `Bearer ${token}`

        const response = await fetch(`/api/nurses/${encodeURIComponent(nurseId)}/dashboard`, { method: 'GET', headers, cache: 'no-store' })
        const data = await response.json().catch(() => ({}))

        if (!response.ok) throw new Error(data?.message || 'Could not load nurse dashboard')

        if (!active) return
        setDashboardData(data)
        setNotificationCount(data?.stats?.unreadNotifications || 0)
        setProfileImage((current) => data?.nurse?.profileImage || current)
        setSpecialization(data?.nurse?.specialization || "")
        setYearsOfExperience(Number.isFinite(Number(data?.nurse?.yearsOfExperience)) ? Number(data.nurse.yearsOfExperience) : 0)
        setNurseName((current) => {
          const name = [data?.nurse?.firstName || data?.nurse?.nurseFirstName, data?.nurse?.lastName || data?.nurse?.nurseLastName]
            .filter(Boolean)
            .join(' ')
            .trim()
          return name || current
        })
      } catch (err) {
        if (active) setError(err?.message || 'Could not load nurse dashboard')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadDashboard()

    const socketUrl = getBackendBaseUrl()
    const socket = io(socketUrl, { transports: ['websocket'], withCredentials: true })
    socketRef.current = socket
    socket.emit('join-assignments-nurse', nurseId)

    socket.on('assignment-created', (payload) => {
      if (!payload?.assignment) return
      setDashboardData((current) => {
        if (!current) return current
        const next = { ...(current || {}) }
        next.assignments = Array.isArray(next.assignments) ? [payload.assignment, ...next.assignments] : [payload.assignment]
        return next
      })
    })

    socket.on('assignment-updated', (payload) => {
      if (!payload?.assignment) return
      setDashboardData((current) => {
        if (!current) return current
        const next = { ...(current || {}) }
        next.assignments = Array.isArray(next.assignments) ? next.assignments.map(a => String(a?.id||a?._id||a?.assignmentId||'') === String(payload.assignment?.id||payload.assignment?._id||payload.assignment?.assignmentId||'') ? payload.assignment : a) : [payload.assignment]
        return next
      })
    })

    return () => {
      socket.disconnect()
      active = false
    }
  }, [nurseId])

  if (loading) return <LoadingCanvas />

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <Link href="/secure/home" className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2l8 4v6c0 5-3.4 9.6-8 10-4.6-.4-8-5-8-10V6l8-4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              <path d="M9.5 12l1.8 1.8L15.5 9.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <span className={styles.brandText}>Home Care+</span>
        </Link>

        <div className={styles.topActions}>
          <Link href="/secure/home" className={`${styles.actionButton} ${styles.actionSecondary}`}>Home</Link>
          <Link href="/secure/nurse/settings" className={`${styles.actionButton} ${styles.actionSecondary}`}>System</Link>
        </div>
      </header>

      <div className={styles.shell}>
        <section className={styles.hero}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: 999, overflow: 'hidden', background: '#e6eef6', display: 'grid', placeItems: 'center' }}>
                {profileImage?.url ? (
                  <Image src={profileImage.url} alt={nurseName} width={64} height={64} style={{ objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '1.25rem', color: '#0a3a66', fontWeight: 700 }}>{(nurseName || 'N').slice(0, 1).toUpperCase()}</span>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{ marginTop: '0.75rem', display: 'inline-block', padding: '0.5rem 1rem', backgroundColor: '#0a3a66', color: 'white', border: 'none', textDecoration: 'none', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: '600', textAlign: 'center', transition: 'background 150ms ease', cursor: 'pointer' }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#082d52'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#0a3a66'}
              >
                Update photo
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleProfileImageSelect}
                style={{ display: 'none' }}
              />
            </div>

            <div style={{ flex: 1 }}>
              <p className={styles.heroKicker}>Nurse Dashboard</p>
              <h1 className={styles.heroTitle} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                Welcome, <strong>{nurseName}</strong>
                {Boolean(dashboardData?.nurse?.isVerified) ? <VerifiedDoctorBadge doctor={dashboardData?.nurse} role="nurse" label="Verified nurse" style={{ fontSize: '0.72rem' }} /> : null}
              </h1>
              <p className={styles.heroBody}>
                <strong>Nurse ID:</strong> {nurseId} | <strong>Specialty:</strong> {specialization || "Not specified"} | <strong>
                  Experience:
                </strong> {yearsOfExperience} year{yearsOfExperience === 1 ? "" : "s"}
              </p>
              <p className={styles.heroBody} style={{ marginTop: "0.5rem" }}>
                <strong>Active assignments:</strong> {Array.isArray(dashboardData?.assignments) ? dashboardData.assignments.length : 0}
              </p>
              <p className={styles.heroBody} style={{ marginTop: "0.5rem" }}>
                Manage your assignments and patient tasks. Assignments appear here when the system allocates work to you.
              </p>
            </div>
          </div>
        </section>

        <section className={styles.container}>
          <h2>Assignments</h2>
          {Array.isArray(dashboardData?.assignments) && dashboardData.assignments.length > 0 ? (
            <div>
              {dashboardData.assignments.map((a) => (
                <div key={a.assignmentId || a._id || a.id} className={styles.appointmentDetailItem}>
                  <div className={styles.appointmentDetail}>
                    <strong>{a.title || 'Weekly patient care assignment'}</strong>
                    <span>
                      {a.patient?.patientName || a.patientName || 'Patient'}
                      {a.patient?.patientPhone || a.patientPhone ? ` • ${a.patient?.patientPhone || a.patientPhone}` : ''}
                    </span>
                    <small>Condition: {a.carePlan?.condition || a.condition || 'Not specified'}</small>
                    <small>Drug: {a.carePlan?.drug || a.drug || 'Not specified'}</small>
                    <small>
                      Care window: {formatDateRange(a.schedule?.weekStart || a.careWeekStart, a.schedule?.weekEnd || a.careWeekEnd) || '7-day follow-up'}
                    </small>
                  </div>
                  <div className={styles.appointmentActions}>
                    <div className={styles.appointmentActionButtons}>
                      <Link href={`/secure/assignment?assignmentId=${encodeURIComponent(a.assignmentId || a._id || a.id)}`} className={styles.primaryButton}>Open details</Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p>No assignments</p>
          )}
        </section>
      </div>
    </main>
  )
}
