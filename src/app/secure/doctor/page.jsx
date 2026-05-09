"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useState, useMemo, useCallback, useRef } from "react"
import styles from "./doctor.module.css"

function getDoctorIdentity() {
  if (typeof window === "undefined") return { doctorId: "doctor", doctorName: "Doctor", profileImage: null }

  const stored = window.localStorage.getItem("doctorAuth")
  if (!stored) return { doctorId: "doctor", doctorName: "Doctor", profileImage: null }

  try {
    const auth = JSON.parse(stored)
    const doctorId = auth?.doctorId || auth?.id || auth?._id
    const doctorName = [auth?.doctorFirstName || auth?.firstName, auth?.doctorLastName || auth?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() || auth?.doctorFirstName || auth?.firstName || "Doctor"
    const profileImage = auth?.profileImage || null
    return { doctorId, doctorName, profileImage }
  } catch {
    return { doctorId: "doctor", doctorName: "Doctor", profileImage: null }
  }
}

function getStoredToken() {
  if (typeof window === 'undefined') return null
  try {
    const patientAuth = window.localStorage.getItem('patientAuth')
    const doctorAuth = window.localStorage.getItem('doctorAuth')
    const parsed = patientAuth ? JSON.parse(patientAuth) : doctorAuth ? JSON.parse(doctorAuth) : null
    return parsed?.token || parsed?.accessToken || null
  } catch {
    return null
  }
}

export default function DoctorDashboard() {
  const [doctorId, setDoctorId] = useState("doctor")
  const [doctorName, setDoctorName] = useState("Doctor")
  const [profileImage, setProfileImage] = useState(null)
  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selectedTab, setSelectedTab] = useState("overview")
  const [notificationCount, setNotificationCount] = useState(0)
  const [selectedAppointment, setSelectedAppointment] = useState(null)
  const [selectedPatientAttachments, setSelectedPatientAttachments] = useState([])
  const [selectedPatientRecord, setSelectedPatientRecord] = useState(null)
  const [recordConsentState, setRecordConsentState] = useState("idle")
  const [consentModalOpen, setConsentModalOpen] = useState(false)
  const [appointmentActionBusy, setAppointmentActionBusy] = useState(false)
  const [patientNotified, setPatientNotified] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    const identity = getDoctorIdentity()
    setDoctorId(identity.doctorId)
    setDoctorName(identity.doctorName)
    setProfileImage(identity.profileImage || null)
  }, [])

  const handleProfileImageUpload = useCallback((uploaded) => {
    const nextProfileImage = uploaded?.profileImage || (uploaded?.url ? { url: uploaded.url, publicId: uploaded.publicId, mimeType: uploaded.mimeType } : uploaded)
    setProfileImage(nextProfileImage)
    try {
      const stored = window.localStorage.getItem('doctorAuth') || '{}'
      const auth = JSON.parse(stored)
      if (uploaded?.doctorId) {
        window.localStorage.setItem('doctorAuth', JSON.stringify(uploaded))
      } else {
        auth.profileImage = { url: nextProfileImage?.url, publicId: nextProfileImage?.publicId }
        window.localStorage.setItem('doctorAuth', JSON.stringify(auth))
      }
    } catch (e) {
      console.error('Failed to save doctor profile image to localStorage', e)
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

      // Use the upload hook to upload to Cloudinary
      try {
        const formData = new FormData()
        imageFiles.forEach((file) => formData.append('files', file))
        formData.append('reference', doctorId)
        formData.append('type', 'profile')

        const headers = {}
        const token = getStoredToken()
        if (token) headers.authorization = `Bearer ${token}`

        const response = await fetch('/api/uploads', {
          method: 'POST',
          headers,
          body: formData,
        })

        if (!response.ok) {
          throw new Error('Upload failed')
        }

        const data = await response.json()
        const uploaded = data?.attachments?.[0] || data?.attachment || data
        if (uploaded) {
          handleProfileImageUpload(uploaded)
        }
      } catch (err) {
        console.error('Profile image upload error:', err)
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [doctorId, handleProfileImageUpload],
  )

  const loadPatientRecordAndAttachments = useCallback(async (appointment) => {
    if (!appointment?.patientId) return

    setAppointmentActionBusy(true)
    setError("")

    try {
      const headers = {}
      const token = getStoredToken()
      if (token) headers.authorization = `Bearer ${token}`
      const [attachmentsResponse, recordResponse] = await Promise.all([
        fetch(`/api/uploads/owner/${encodeURIComponent(appointment.patientId)}`, { cache: "no-store", headers }),
        fetch(`/api/patients/${encodeURIComponent(appointment.patientId)}/health-records`, { cache: "no-store", headers }),
      ])

      const attachmentsData = await attachmentsResponse.json().catch(() => ({}))
      const recordData = await recordResponse.json().catch(() => ({}))

      if (!attachmentsResponse.ok) {
        throw new Error(attachmentsData?.message || "Could not load patient attachments.")
      }

      if (!recordResponse.ok) {
        throw new Error(recordData?.message || "Could not load patient health records.")
      }

      setSelectedAppointment(appointment)
      setSelectedPatientAttachments(Array.isArray(attachmentsData?.files) ? attachmentsData.files : [])
      setSelectedPatientRecord(recordData)
      setRecordConsentState("idle")
      setPatientNotified(false)
      setConsentModalOpen(true)
    } catch (err) {
      setError(err?.message || "Could not load patient records.")
    } finally {
      setAppointmentActionBusy(false)
    }
  }, [])

  const acceptAppointmentWithRecords = useCallback(async () => {
    if (!selectedAppointment) return

    if (!patientNotified) {
      setError("Notify the patient before sharing health records.")
      return
    }

    setAppointmentActionBusy(true)
    setError("")

    try {
      const consentedRecord = selectedPatientRecord || {}
      const headers = { "Content-Type": "application/json" }
      const token = getStoredToken()
      if (token) headers.authorization = `Bearer ${token}`
      const healthRecordResponse = await fetch(`/api/patients/${encodeURIComponent(selectedAppointment.patientId)}/health-records`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          medicalHistory: String(consentedRecord.medicalHistory || ""),
          prescriptions: String(consentedRecord.prescriptions || ""),
          allergies: String(consentedRecord.allergies || ""),
          labResults: Array.isArray(consentedRecord.labResults) ? consentedRecord.labResults : [],
        }),
      })

      const healthRecordData = await healthRecordResponse.json().catch(() => ({}))
      if (!healthRecordResponse.ok) {
        throw new Error(healthRecordData?.message || "Could not save patient health records.")
      }

      const headers2 = { "Content-Type": "application/json" }
      const token2 = getStoredToken()
      if (token2) headers2.authorization = `Bearer ${token2}`
      const appointmentResponse = await fetch(`/api/doctors/${encodeURIComponent(doctorId)}/appointments/${encodeURIComponent(selectedAppointment.appointmentId)}`, {
        method: "PATCH",
        headers: headers2,
        body: JSON.stringify({ status: "accepted", notes: "Health records reviewed with patient consent." }),
      })

      const appointmentData = await appointmentResponse.json().catch(() => ({}))
      if (!appointmentResponse.ok) {
        throw new Error(appointmentData?.message || "Could not accept appointment.")
      }

      setDashboardData((current) => {
        if (!current) return current
        const nextAppointments = (current.todaysAppointments || []).map((appointment) =>
          appointment.appointmentId === selectedAppointment.appointmentId ? appointmentData : appointment,
        )
        return { ...current, todaysAppointments: nextAppointments }
      })
      setConsentModalOpen(false)
      setSelectedAppointment(null)
      setSelectedPatientAttachments([])
      setSelectedPatientRecord(null)
      setRecordConsentState("accepted")
    } catch (err) {
      setError(err?.message || "Could not accept appointment.")
    } finally {
      setAppointmentActionBusy(false)
    }
  }, [doctorId, patientNotified, selectedAppointment, selectedPatientRecord])

  const rejectSharing = useCallback(async () => {
    if (!selectedAppointment) return

    setAppointmentActionBusy(true)
    setError("")

    try {
      const headers = { "Content-Type": "application/json" }
      const token = getStoredToken()
      if (token) headers.authorization = `Bearer ${token}`
      const appointmentResponse = await fetch(`/api/doctors/${encodeURIComponent(doctorId)}/appointments/${encodeURIComponent(selectedAppointment.appointmentId)}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: "scheduled", notes: "Patient rejected sharing health records." }),
      })

      const appointmentData = await appointmentResponse.json().catch(() => ({}))
      if (!appointmentResponse.ok) {
        throw new Error(appointmentData?.message || "Could not update appointment.")
      }

      setDashboardData((current) => {
        if (!current) return current
        const nextAppointments = (current.todaysAppointments || []).map((appointment) =>
          appointment.appointmentId === selectedAppointment.appointmentId ? appointmentData : appointment,
        )
        return { ...current, todaysAppointments: nextAppointments }
      })
      setConsentModalOpen(false)
      setSelectedAppointment(null)
      setSelectedPatientAttachments([])
      setSelectedPatientRecord(null)
      setRecordConsentState("rejected")
      setPatientNotified(false)
    } catch (err) {
      setError(err?.message || "Could not reject sharing.")
    } finally {
      setAppointmentActionBusy(false)
    }
  }, [doctorId, selectedAppointment])

  useEffect(() => {
    let active = true

    async function loadDashboard() {
      if (!doctorId || doctorId === "doctor") {
        setLoading(false)
        return
      }

      setLoading(true)
      setError("")

      try {
        const headers = {}
        const token = getStoredToken()
        if (token) headers.authorization = `Bearer ${token}`
        const response = await fetch(`/api/doctors/${encodeURIComponent(doctorId)}/dashboard`, {
          cache: "no-store",
          headers,
        })

        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(data?.message || "Could not load dashboard data.")
        }

        if (!active) return

        setDashboardData(data)
        setNotificationCount(data?.stats?.unreadNotifications || 0)
      } catch (err) {
        if (active) {
          setError(err?.message || "Could not load dashboard data.")
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadDashboard()

    return () => {
      active = false
    }
  }, [doctorId])

  const timeGreeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good morning"
    if (hour < 18) return "Good afternoon"
    return "Good evening"
  }, [])

  if (loading) {
    return <main className={styles.page}><p className={styles.status}>Loading dashboard…</p></main>
  }

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
          <Link href="/secure/home" className={`${styles.actionButton} ${styles.actionSecondary}`}>
            Home
          </Link>
          <Link href="/secure/doctor/settings" className={`${styles.actionButton} ${styles.actionSecondary}`}>
            System
          </Link>
        </div>
      </header>

      <div className={styles.shell}>
        <section className={styles.hero}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: 999, overflow: 'hidden', background: '#e6eef6', display: 'grid', placeItems: 'center' }}>
                {profileImage?.url ? (
                  <Image src={profileImage.url} alt={doctorName} width={64} height={64} style={{ objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '1.25rem', color: '#0a3a66', fontWeight: 700 }}>{(doctorName || 'D').slice(0, 1).toUpperCase()}</span>
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

            <div>
              <p className={styles.heroKicker}>Doctor Dashboard</p>
              <h1 className={styles.heroTitle}>
                {timeGreeting}, <strong>{doctorName}</strong>.
              </h1>
              <p className={styles.heroBody}>
                Manage your appointments, patient queue, and stay updated with real-time notifications.
              </p>
            </div>
          </div>
        </section>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.statsGrid}>
          <article className={styles.statCard}>
            <span className={styles.statLabel}>Today's Appointments</span>
            <strong className={styles.statValue}>{dashboardData?.stats?.todayAppointments || 0}</strong>
          </article>
          <article className={styles.statCard}>
            <span className={styles.statLabel}>Patient Queue</span>
            <strong className={styles.statValue}>{dashboardData?.stats?.queueCount || 0}</strong>
          </article>
          <article className={styles.statCard}>
            <span className={styles.statLabel}>Completed Today</span>
            <strong className={styles.statValue}>{dashboardData?.stats?.completedToday || 0}</strong>
          </article>
          <article className={styles.statCard}>
            <span className={styles.statLabel}>Notifications</span>
            <strong className={styles.statValue}>{dashboardData?.stats?.unreadNotifications || 0}</strong>
          </article>
        </div>

        <div className={styles.tabNav}>
          <button
            className={`${styles.tabButton} ${selectedTab === "overview" ? styles.active : ""}`}
            onClick={() => setSelectedTab("overview")}
          >
            Overview
          </button>
          <button
            className={`${styles.tabButton} ${selectedTab === "appointments" ? styles.active : ""}`}
            onClick={() => setSelectedTab("appointments")}
          >
            Appointments
          </button>
          <button
            className={`${styles.tabButton} ${selectedTab === "queue" ? styles.active : ""}`}
            onClick={() => setSelectedTab("queue")}
          >
            Patient Queue
          </button>
          <button
            className={`${styles.tabButton} ${selectedTab === "notifications" ? styles.active : ""}`}
            onClick={() => setSelectedTab("notifications")}
          >
            Notifications ({notificationCount})
          </button>
        </div>

        {selectedTab === "overview" && (
          <div className={styles.grid}>
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2>Today's Appointments</h2>
                  <p>Scheduled consultations for today</p>
                </div>
              </div>

              <div className={styles.appointmentsList}>
                {(dashboardData?.todaysAppointments || []).length === 0 ? (
                  <p className={styles.emptyState}>No appointments scheduled for today.</p>
                ) : null}

                {(dashboardData?.todaysAppointments || []).map((apt) => (
                  <div key={apt._id} className={styles.appointmentItem}>
                    <div className={styles.appointmentTime}>
                      <strong>{apt.appointmentTime}</strong>
                      <small>{apt.duration} min</small>
                    </div>
                    <div className={styles.appointmentInfo}>
                      <strong>{apt.patientName}</strong>
                      <span>{apt.reason || "Regular checkup"}</span>
                      <small>{apt.consultationType}</small>
                    </div>
                    <div className={styles.appointmentStatus}>
                      <span className={`${styles.badge} ${styles[`status-${apt.status}`]}`}>{apt.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2>Patient Queue</h2>
                  <p>Currently waiting patients</p>
                </div>
              </div>

              <div className={styles.queueList}>
                {(dashboardData?.patientQueue || []).length === 0 ? (
                  <p className={styles.emptyState}>No patients in queue.</p>
                ) : null}

                {(dashboardData?.patientQueue || []).map((patient) => (
                  <div key={patient._id} className={styles.queueItem}>
                    <div className={styles.queueNumber}>
                      <span className={styles.number}>{patient.queuePosition}</span>
                    </div>
                    <div className={styles.queueInfo}>
                      <strong>{patient.patientName}</strong>
                      <span>{patient.visitReason || "General visit"}</span>
                      <small>Wait time: ~{patient.estimatedWaitTime} min</small>
                    </div>
                    <div className={styles.queueStatus}>
                      <span className={`${styles.badge} ${styles[`priority-${patient.priority}`]}`}>{patient.priority}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2>Recent Notifications</h2>
                  <p>Latest updates</p>
                </div>
              </div>

              <div className={styles.notificationsList}>
                {(dashboardData?.notifications || []).length === 0 ? (
                  <p className={styles.emptyState}>No new notifications.</p>
                ) : null}

                {(dashboardData?.notifications || []).slice(0, 5).map((notif) => (
                  <div key={notif._id} className={`${styles.notificationItem} ${notif.isRead ? styles.read : styles.unread}`}>
                    <div className={styles.notificationType}>
                      <span className={`${styles.badge} ${styles[`type-${notif.type}`]}`}>{notif.type}</span>
                    </div>
                    <div className={styles.notificationContent}>
                      <strong>{notif.title}</strong>
                      <p>{notif.message}</p>
                      <small>{new Date(notif.createdAt).toLocaleString()}</small>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2>Quick Actions</h2>
                  <p>Access frequently used features</p>
                </div>
              </div>

              <div className={styles.quickActions}>
                <Link href="/secure/doctor/appointments/new" className={`${styles.actionButton} ${styles.actionPrimary}`}>
                  + New Appointment
                </Link>
                <Link href="/secure/doctor/patient-records" className={`${styles.actionButton} ${styles.actionSecondary}`}>
                  View Records
                </Link>
                <Link href="/secure/doctor/prescriptions" className={`${styles.actionButton} ${styles.actionSecondary}`}>
                  Write Prescription
                </Link>
              </div>
            </section>
          </div>
        )}

        {selectedTab === "appointments" && (
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>All Appointments Today</h2>
            </div>
            <div className={styles.appointmentsList}>
              {(dashboardData?.todaysAppointments || []).length === 0 ? (
                <p className={styles.emptyState}>No appointments scheduled.</p>
              ) : (
                dashboardData.todaysAppointments.map((apt) => (
                  <div key={apt._id} className={styles.appointmentDetailItem}>
                    <div className={styles.appointmentDetail}>
                      <strong>{apt.appointmentTime} - {apt.patientName}</strong>
                      <span>{apt.reason || "General checkup"}</span>
                      <small>Type: {apt.consultationType} | Duration: {apt.duration} min</small>
                    </div>
                    <div className={styles.appointmentActions}>
                      <span className={`${styles.badge} ${styles[`status-${apt.status}`]}`}>{apt.status}</span>
                      <div className={styles.appointmentActionButtons}>
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={() => loadPatientRecordAndAttachments(apt)}
                          disabled={appointmentActionBusy}
                        >
                          Review records
                        </button>
                        <button
                          type="button"
                          className={styles.primaryButton}
                          onClick={() => loadPatientRecordAndAttachments(apt)}
                          disabled={appointmentActionBusy}
                        >
                          Accept appointment
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {selectedTab === "queue" && (
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>Patient Queue</h2>
              <p>Active patient queue for today</p>
            </div>
            <div className={styles.queueDetailsList}>
              {(dashboardData?.patientQueue || []).length === 0 ? (
                <p className={styles.emptyState}>No patients in queue.</p>
              ) : (
                dashboardData.patientQueue.map((patient) => (
                  <div key={patient._id} className={styles.queueDetailItem}>
                    <div className={styles.queueDetail}>
                      <div className={styles.queuePosition}>#{patient.queuePosition}</div>
                      <div>
                        <strong>{patient.patientName}</strong>
                        <span>{patient.visitReason || "General visit"}</span>
                        <small>Checked in: {new Date(patient.checkInTime).toLocaleTimeString()}</small>
                      </div>
                    </div>
                    <div className={styles.queueDetailActions}>
                      <span className={`${styles.badge} ${styles[`priority-${patient.priority}`]}`}>{patient.priority}</span>
                      <small>{patient.estimatedWaitTime} min wait</small>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {selectedTab === "notifications" && (
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>All Notifications</h2>
              <p>Manage your notifications</p>
            </div>
            <div className={styles.notificationsDetailList}>
              {(dashboardData?.notifications || []).length === 0 ? (
                <p className={styles.emptyState}>No notifications.</p>
              ) : (
                dashboardData.notifications.map((notif) => (
                  <div key={notif._id} className={`${styles.notificationDetailItem} ${notif.isRead ? styles.read : styles.unread}`}>
                    <div className={styles.notificationDetail}>
                      <span className={`${styles.badge} ${styles[`type-${notif.type}`]}`}>{notif.type}</span>
                      <strong>{notif.title}</strong>
                      <p>{notif.message}</p>
                      <small>{new Date(notif.createdAt).toLocaleString()}</small>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {consentModalOpen && selectedAppointment ? (
          <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="consent-title">
            <div className={styles.modalCard}>
              <div className={styles.modalHeader}>
                <div>
                  <p className={styles.heroKicker}>Consent required</p>
                  <h2 id="consent-title">{selectedAppointment.patientName}</h2>
                  <p className={styles.modalSubtitle}>
                    Notify the patient first. They can share health records or reject sharing before this appointment is accepted.
                  </p>
                </div>
                <button type="button" className={styles.modalCloseButton} onClick={() => setConsentModalOpen(false)}>
                  Close
                </button>
              </div>

              <label className={styles.consentCheckbox}>
                <input
                  type="checkbox"
                  checked={patientNotified}
                  onChange={(event) => setPatientNotified(event.target.checked)}
                />
                <span>I have notified the patient and they agreed to review the records.</span>
              </label>

              <div className={styles.modalGrid}>
                <section className={styles.modalSection}>
                  <h3>Patient attachments</h3>
                  <div className={styles.modalList}>
                    {selectedPatientAttachments.length === 0 ? (
                      <p className={styles.emptyState}>No attachments found for this patient.</p>
                    ) : (
                      selectedPatientAttachments.map((attachment) => (
                        <article key={attachment._id} className={styles.attachmentItem}>
                          <strong>{attachment.originalName || attachment.purpose || 'Attachment'}</strong>
                          <span>{attachment.mimeType || attachment.resourceType || 'file'}</span>
                          <small>{attachment.uploadedAt ? new Date(attachment.uploadedAt).toLocaleString() : 'Recently uploaded'}</small>
                        </article>
                      ))
                    )}
                  </div>
                </section>

                <section className={styles.modalSection}>
                  <h3>Health record preview</h3>
                  <div className={styles.modalList}>
                    <article className={styles.previewItem}>
                      <strong>Medical history</strong>
                      <p>{selectedPatientRecord?.medicalHistory || 'No medical history recorded.'}</p>
                    </article>
                    <article className={styles.previewItem}>
                      <strong>Prescriptions</strong>
                      <p>{selectedPatientRecord?.prescriptions || 'No prescriptions recorded.'}</p>
                    </article>
                    <article className={styles.previewItem}>
                      <strong>Allergies</strong>
                      <p>{selectedPatientRecord?.allergies || 'No allergies recorded.'}</p>
                    </article>
                    <article className={styles.previewItem}>
                      <strong>Lab results</strong>
                      <p>{Array.isArray(selectedPatientRecord?.labResults) ? `${selectedPatientRecord.labResults.length} file(s) available` : 'No lab results recorded.'}</p>
                    </article>
                  </div>
                </section>
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.secondaryButton} onClick={rejectSharing} disabled={appointmentActionBusy}>
                  Reject sharing
                </button>
                <button type="button" className={styles.primaryButton} onClick={acceptAppointmentWithRecords} disabled={appointmentActionBusy || !patientNotified}>
                  Share records and accept
                </button>
              </div>

              {recordConsentState === 'accepted' ? <p className={styles.notice}>Records shared and appointment accepted.</p> : null}
              {recordConsentState === 'rejected' ? <p className={styles.notice}>Sharing rejected for this appointment.</p> : null}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  )
}
