"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, useRef, useCallback } from "react"
import { io } from "socket.io-client"
import styles from "../dashboard/dashboard.module.css"
import VerifiedDoctorBadge from "../components/VerifiedDoctorBadge"
import { getBackendBaseUrl } from "../../../lib/backend-url"

const MISSED_GRACE_MINUTES = 10
const REBOOK_VISIBLE_WINDOW_MINUTES = 20

const APPOINTMENT_TYPES = [
  { value: "messaging", label: "Messaging" },
  { value: "video", label: "Video call" },
  { value: "phone", label: "Phone call" },
]

function getPatientNameFromAuth(auth) {
  return [auth?.patientFirstName, auth?.patientLastName].filter(Boolean).join(" ").trim() || auth?.patientFirstName || "Patient"
}

function getDoctorName(doctor) {
  const title = doctor?.title || doctor?.prefix || 'Dr.'
  const name = doctor?.doctorName || [doctor?.doctorFirstName, doctor?.doctorLastName].filter(Boolean).join(" ").trim() || "Doctor"
  return `${title} ${name}`
}

function formatAppointmentDate(dateValue, timeValue) {
  if (!dateValue) return "Date pending"
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return "Date pending"
  const readableDate = date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" })
  return timeValue ? `${readableDate} at ${timeValue}` : readableDate
}

function createAppointmentId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `APT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
  }
  return `APT-${Date.now().toString(36).toUpperCase()}`
}

function loadStoredAuth() {
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
    const patientAuth = window.localStorage.getItem("patientAuth")
    const doctorAuth = window.localStorage.getItem("doctorAuth")
    const parsed = patientAuth ? JSON.parse(patientAuth) : doctorAuth ? JSON.parse(doctorAuth) : null
    return parsed?.token || parsed?.accessToken || null
  } catch {
    return null
  }
}

function buildAppointmentDateTime(appointmentDate, appointmentTime) {
  const parsedDate = new Date(appointmentDate)
  if (Number.isNaN(parsedDate.getTime())) return null

  const [hours = 0, minutes = 0] = String(appointmentTime || "")
    .split(":")
    .map((value) => Number.parseInt(value, 10))

  const dateTime = new Date(parsedDate)
  dateTime.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0)
  return dateTime
}

function getMinimumBookableDateTime(now = new Date()) {
  const minimum = new Date(now)
  minimum.setMinutes(minimum.getMinutes() + 5)
  minimum.setSeconds(0, 0)
  return minimum
}

function getEffectiveAppointmentStatus(appointment, now = new Date()) {
  const baseStatus = String(appointment?.status || "").toLowerCase()
  if (["completed", "no-show", "cancelled"].includes(baseStatus)) return baseStatus

  const appointmentDateTime = buildAppointmentDateTime(appointment?.appointmentDate, appointment?.appointmentTime)
  if (!appointmentDateTime) return baseStatus || "scheduled"

  const sameDay = appointmentDateTime.toDateString() === now.toDateString()
  const minutesLate = (now.getTime() - appointmentDateTime.getTime()) / (60 * 1000)
  const withinGrace = sameDay && minutesLate >= 0 && minutesLate <= MISSED_GRACE_MINUTES

  if (appointmentDateTime < now && !withinGrace) return "no-show"
  return baseStatus || "scheduled"
}

function getRebookExpiryDateTime(appointment) {
  const appointmentDateTime = buildAppointmentDateTime(appointment?.appointmentDate, appointment?.appointmentTime)
  if (!appointmentDateTime) return null

  return new Date(
    appointmentDateTime.getTime() + (MISSED_GRACE_MINUTES + REBOOK_VISIBLE_WINDOW_MINUTES) * 60 * 1000,
  )
}

function isRebookWindowExpired(appointment, now = new Date()) {
  const expiry = getRebookExpiryDateTime(appointment)
  if (!expiry) return false
  return now.getTime() >= expiry.getTime()
}

function compareAppointmentsAsc(a, b) {
  const dateA = buildAppointmentDateTime(a?.appointmentDate, a?.appointmentTime)?.getTime() || 0
  const dateB = buildAppointmentDateTime(b?.appointmentDate, b?.appointmentTime)?.getTime() || 0
  return dateA - dateB
}

function compareAppointmentsDesc(a, b) {
  return compareAppointmentsAsc(b, a)
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState([])
  const [loadingAppointments, setLoadingAppointments] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [assignmentInsight, setAssignmentInsight] = useState(null)
  const [liveNotice, setLiveNotice] = useState("")
  const [appointmentFilter, setAppointmentFilter] = useState('incoming') // all, incoming, pending, past
  const [consentRequests, setConsentRequests] = useState([])
  const appointmentListRef = useRef(null)
  const [respondingRequestId, setRespondingRequestId] = useState("")
  const [rebookingMap, setRebookingMap] = useState({})
  const [rebookedByDoctorMap, setRebookedByDoctorMap] = useState({})
  const [form, setForm] = useState({ date: "", time: "09:00", consultationType: "messaging", duration: "30", reason: "" })
  const [nowTick, setNowTick] = useState(new Date())
  const [submitting, setSubmitting] = useState(false)
  const [autoSubmitReady, setAutoSubmitReady] = useState(false)
  const [autoSubmitDone, setAutoSubmitDone] = useState(false)
  const [appointmentsSyncTick, setAppointmentsSyncTick] = useState(0)

  const upsertAppointment = useMemo(() => {
    return (incomingAppointment) => {
      if (!incomingAppointment) return

      setAppointments((current) => {
        const incomingId = String(incomingAppointment?.appointmentId || incomingAppointment?._id || "")
        if (!incomingId) return current

        const existingIndex = current.findIndex(
          (item) => String(item?.appointmentId || item?._id || "") === incomingId,
        )

        if (existingIndex >= 0) {
          const next = [...current]
          next[existingIndex] = { ...next[existingIndex], ...incomingAppointment }
          return next
        }

        return [incomingAppointment, ...current]
      })
    }
  }, [])

  useEffect(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    setForm((c) => ({ ...c, date: tomorrow.toISOString().slice(0, 10) }))
  }, [appointmentsSyncTick])

  const submit = useCallback(async (e) => {
    e?.preventDefault?.()
    setError("")
    setSuccess("")
    setAssignmentInsight(null)
    const auth = loadStoredAuth()
    if (!auth?.patientId) return setError("Please sign in to book an appointment")
    if (!form.reason.trim()) return setError("Describe your symptoms so the system can assign a suitable doctor")

    setSubmitting(true)
    try {
      const selectedDateTime = buildAppointmentDateTime(form.date, form.time)
      const minimumDateTime = getMinimumBookableDateTime()

      if (!selectedDateTime || Number.isNaN(selectedDateTime.getTime())) {
        setError("Please choose a valid appointment date and time")
        return
      }

      if (selectedDateTime < minimumDateTime) {
        setError("Please choose a time at least 5 minutes from now")
        return
      }

      const headers = { "Content-Type": "application/json" }
      const token = getStoredToken()
      if (token) headers.authorization = `Bearer ${token}`
      const res = await fetch("/api/doctors/auto-assign", {
        method: "POST",
        headers,
        body: JSON.stringify({
          appointmentId: createAppointmentId(),
          patientId: auth.patientId,
          patientName: getPatientNameFromAuth(auth),
          patientPhone: auth?.patientPhone || auth?.phone || "",
          appointmentDate: form.date,
          appointmentTime: form.time,
          consultationType: form.consultationType,
          duration: Number(form.duration) || 30,
          reason: form.reason.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Could not create appointment")
      upsertAppointment(data)
      setAssignmentInsight(data?.assignment || null)
      const assignedDoctorName = getDoctorName(data?.doctor)
      setAppointmentsSyncTick((value) => value + 1)
      const sourceSuffix = typeof window !== 'undefined' && window.sessionStorage.getItem('homecare:appointmentDraftSource') === 'ai'
        ? ' The AI filled and submitted the booking form for you.'
        : ''
      setSuccess(`Appointment booked. ${assignedDoctorName} has been assigned to your case.${sourceSuffix}`)
      setAppointmentsSyncTick((value) => value + 1)
      setForm((c) => ({ ...c, reason: "" }))

      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem('homecare:appointmentDraft')
        window.sessionStorage.removeItem('homecare:appointmentAutoSubmit')
        window.sessionStorage.removeItem('homecare:appointmentDraftSource')
      }

      try {
        const auth = loadStoredAuth()
        if (auth?.patientId) {
          const consentHeaders = {}
          const consentToken = getStoredToken()
          if (consentToken) consentHeaders.authorization = `Bearer ${consentToken}`
          const consentRes = await fetch(`/api/patients/${encodeURIComponent(auth.patientId)}/consent-requests`, {
            cache: "no-store",
            headers: consentHeaders,
          })
          const consentData = await consentRes.json().catch(() => ({}))
          if (consentRes.ok) {
            setConsentRequests(Array.isArray(consentData?.requests) ? consentData.requests : [])
          }
        }
      } catch {
        // ignore consent refresh errors
      }
    } catch (err) {
      setError(err?.message || "Could not create appointment")
    } finally {
      setSubmitting(false)
    }
  }, [form.date, form.time, form.consultationType, form.duration, form.reason, upsertAppointment])

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const draftRaw = window.sessionStorage.getItem('homecare:appointmentDraft')
      const shouldAutoSubmit = window.sessionStorage.getItem('homecare:appointmentAutoSubmit') === '1'
      if (!draftRaw) return

      const draft = JSON.parse(draftRaw)
      if (draft && typeof draft === 'object') {
        setForm((current) => ({
          ...current,
          date: draft.date || current.date,
          time: draft.time || current.time,
          consultationType: draft.consultationType || current.consultationType,
          duration: draft.duration || current.duration,
          reason: draft.reason || current.reason,
        }))
        if (shouldAutoSubmit) {
          setAutoSubmitReady(true)
        }
      }
    } catch (error) {
      console.error('Could not load appointment draft', error)
    }
  }, [appointmentsSyncTick])

  useEffect(() => {
    if (!autoSubmitReady || autoSubmitDone) return
    if (!form.reason.trim() || !form.date || !form.time) return

    setAutoSubmitDone(true)
    const timer = window.setTimeout(() => {
      submit(new Event('submit')).catch(() => {
        setError('Could not auto-submit appointment draft')
      })
    }, 150)

    return () => window.clearTimeout(timer)
  }, [autoSubmitReady, autoSubmitDone, form.date, form.reason, form.time, submit])

  useEffect(() => {
    const auth = loadStoredAuth()
    if (!auth?.patientId) {
      setAppointments([])
      setLoadingAppointments(false)
      return
    }

    let active = true
    async function loadAppointments() {
      setLoadingAppointments(true)
      try {
        const headers = {}
        const token = getStoredToken()
        if (token) headers.authorization = `Bearer ${token}`
        const res = await fetch(`/api/patients/${encodeURIComponent(auth.patientId)}/appointments`, { cache: "no-store", headers })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.message || "Could not load appointments")
        if (!active) return
        setAppointments(Array.isArray(data?.appointments) ? data.appointments : [])
      } catch (err) {
        if (active) setError(err?.message || "Could not load appointments")
      } finally {
        if (active) setLoadingAppointments(false)
      }
    }

    loadAppointments()
    return () => {
      active = false
    }
  }, [])

  // Keep a ticking "now" so Join becomes active when appointment time arrives
  useEffect(() => {
    const id = setInterval(() => setNowTick(new Date()), 15_000)
    return () => clearInterval(id)
  }, [])

  const displayedAppointments = useMemo(() => {
    try {
      const now = new Date()
      const withEffectiveStatus = appointments.map((appointment) => ({
        ...appointment,
        status: getEffectiveAppointmentStatus(appointment, now),
      }))

      if (appointmentFilter === 'all') {
        const pending = withEffectiveStatus.filter((a) => String(a.status || '').toLowerCase() === 'scheduled')
        const past = withEffectiveStatus.filter((a) => ['completed', 'no-show', 'cancelled'].includes(String(a.status || '').toLowerCase()))
        pending.sort(compareAppointmentsAsc)
        past.sort(compareAppointmentsDesc)
        return [...pending, ...past]
      }

      if (appointmentFilter === 'incoming') {
        return withEffectiveStatus
          .filter((a) => {
            const status = String(a.status || '').toLowerCase()
            return !['completed', 'no-show', 'cancelled'].includes(status)
          })
          .sort(compareAppointmentsAsc)
      }

      if (appointmentFilter === 'pending') {
        return withEffectiveStatus
          .filter((a) => String(a.status || '').toLowerCase() === 'scheduled')
          .sort(compareAppointmentsAsc)
      }

      // past
      return withEffectiveStatus
        .filter((a) => ['completed', 'no-show', 'cancelled'].includes(String(a.status || '').toLowerCase()))
        .sort(compareAppointmentsDesc)
    } catch {
      return appointments
    }
  }, [appointments, appointmentFilter])

  // Reset scroll position when filter or displayed list changes
  useEffect(() => {
    try {
      if (appointmentListRef?.current) appointmentListRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      // ignore
    }
  }, [appointmentFilter, displayedAppointments])

  // Auto-dismiss transient messages (success, assignmentInsight, liveNotice)
  useEffect(() => {
    const timeouts = []
    if (success) {
      const t = setTimeout(() => setSuccess(''), 6000)
      timeouts.push(t)
    }
    if (assignmentInsight) {
      const t = setTimeout(() => setAssignmentInsight(null), 8000)
      timeouts.push(t)
    }
    if (liveNotice) {
      const t = setTimeout(() => setLiveNotice(''), 6000)
      timeouts.push(t)
    }

    return () => timeouts.forEach((t) => clearTimeout(t))
  }, [success, assignmentInsight, liveNotice])

  async function rebookAppointment(appointment) {
    if (!appointment) return
    if (isRebookWindowExpired(appointment)) {
      setError('Rebook window has expired for this missed appointment')
      return
    }

    const appointmentId = appointment.appointmentId || appointment._id
    const doctorId = appointment?.doctor?.doctorId || appointment?.doctorId
    if (!appointmentId || !doctorId) {
      setError('Missing appointment identifiers for rebooking')
      return
    }

    setRebookingMap((m) => ({ ...m, [appointmentId]: true }))
    try {
      const headers = { 'Content-Type': 'application/json' }
      const token = getStoredToken()
      if (token) headers.authorization = `Bearer ${token}`

      const res = await fetch(`/api/doctors/${encodeURIComponent(doctorId)}/appointments/${encodeURIComponent(appointmentId)}/rebook`, { method: 'POST', headers, cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || 'Could not rebook appointment')

      const newApt = data?.appointment || data
      if (newApt) {
        setAppointments((prev) => [newApt, ...prev.filter((p) => String(p?.appointmentId || p?._id || '') !== String(appointmentId))])
      }

      setSuccess('Appointment rebooked successfully')
    } catch (err) {
      setError(err?.message || 'Failed to rebook appointment')
    } finally {
      setRebookingMap((m) => {
        const copy = { ...m }
        delete copy[appointmentId]
        return copy
      })
    }
  }

  async function cancelAppointment(appointment) {
    if (!appointment) return
    const appointmentId = appointment.appointmentId || appointment._id
    const doctorId = appointment?.doctor?.doctorId || appointment?.doctorId
    if (!appointmentId || !doctorId) {
      setError('Missing appointment identifiers for cancellation')
      return
    }

    setError('')
    try {
      const headers = { 'Content-Type': 'application/json' }
      const token = getStoredToken()
      if (token) headers.authorization = `Bearer ${token}`

      const res = await fetch(`/api/doctors/${encodeURIComponent(doctorId)}/appointments/${encodeURIComponent(appointmentId)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'cancelled', notes: 'Cancelled by patient.' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || 'Could not cancel appointment')

      // update local list
      setAppointments((current) => current.map((a) => (String(a?.appointmentId || a?._id || '') === String(appointmentId) ? { ...a, status: 'cancelled' } : a)))
      setSuccess('Appointment cancelled')
    } catch (err) {
      setError(err?.message || 'Failed to cancel appointment')
    }
  }

  useEffect(() => {
    const auth = loadStoredAuth()
    if (!auth?.patientId) {
      setConsentRequests([])
      return
    }

    // Initial load of consent requests
    async function loadConsentRequests() {
      try {
        const headers = {}
        const token = getStoredToken()
        if (token) headers.authorization = `Bearer ${token}`

        const res = await fetch(`/api/patients/${encodeURIComponent(auth.patientId)}/consent-requests`, {
          cache: "no-store",
          headers,
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok) {
          setConsentRequests(Array.isArray(data?.requests) ? data.requests : [])
        }
      } catch {
        setConsentRequests([])
      }
    }

    loadConsentRequests()

    // Set up real-time socket connection for instant consent request updates
    const socketUrl = getBackendBaseUrl()
    const socket = io(socketUrl, {
      transports: ["websocket"],
      withCredentials: true,
    })

    // Join patient consent room to receive real-time doctor requests
    socket.emit("join-consent-patient", auth.patientId)

    // Listen for new consent requests from doctors
    socket.on("consent-requested", (payload) => {
      const newRequest = payload?.request
      if (!newRequest) return

      setConsentRequests((current) => {
        // Check if request already exists
        const exists = current.some((r) => String(r?.requestId || "") === String(newRequest.requestId || ""))
        if (exists) return current
        // Add new request to the beginning of the list
        return [newRequest, ...current]
      })
    })

    // Listen for consent status updates (in case another patient-authorized user responds)
    socket.on("consent-responded", (payload) => {
      const updatedRequest = payload?.request
      if (!updatedRequest?.requestId) return

      setConsentRequests((current) =>
        current.map((r) => (String(r?.requestId || "") === String(updatedRequest.requestId || "") ? updatedRequest : r)),
      )
    })

    return () => {
      socket.off("consent-requested")
      socket.off("consent-responded")
      socket.disconnect()
    }
  }, [])

  useEffect(() => {
    const auth = loadStoredAuth()
    if (!auth?.patientId) return undefined

    const socket = io(getBackendBaseUrl(), {
      transports: ["websocket"],
      withCredentials: true,
    })

    socket.emit("join-appointments-patient", auth.patientId)

    socket.on("appointment-created", (payload) => {
      const newApt = payload?.appointment
      upsertAppointment(newApt)

      // If created as a rebook, mark the previous appointment as rebooked so UI disables old Rebook button
      try {
        const notes = String(newApt?.notes || newApt?.reason || '')
        const m = notes.match(/Rebooked after missed appointment\s+(APT-[A-Z0-9-_]+)/i)
        if (m && m[1]) {
          const oldId = String(m[1])
          setRebookedByDoctorMap((s) => ({ ...s, [oldId]: String(newApt?.appointmentId || newApt?._id || '') }))
          // clear pending flag for the old appointment
          setRebookingMap((s) => {
            const copy = { ...s }
            delete copy[oldId]
            return copy
          })
        }
      } catch {
        // ignore
      }
    })

    socket.on('appointment-rebooking', (payload) => {
      const appointmentId = String(payload?.appointmentId || '')
      if (!appointmentId) return
      // mark pending rebook for this appointment so UI disables the Rebook button
      setRebookingMap((s) => ({ ...s, [appointmentId]: true }))
    })

    socket.on('rebook-cancelled', (payload) => {
      const originalAppointmentId = String(payload?.originalAppointmentId || '')
      if (!originalAppointmentId) return
      // clear any marked rebooked/pending flags so the Rebook button is re-enabled
      setRebookedByDoctorMap((s) => {
        const copy = { ...s }
        delete copy[originalAppointmentId]
        return copy
      })
      setRebookingMap((s) => {
        const copy = { ...s }
        delete copy[originalAppointmentId]
        return copy
      })
    })

    socket.on("appointment-updated", (payload) => {
      upsertAppointment(payload?.appointment)
    })

    socket.on('appointment-room-assigned', (payload) => {
      const aId = String(payload?.appointmentId || '')
      const rId = String(payload?.roomId || '')
      if (!aId || !rId) return
      upsertAppointment({ appointmentId: aId, roomId: rId })
    })

    socket.on("appointment-reassigned", (payload) => {
      const reassignedAppointment = payload?.appointment
      if (!reassignedAppointment) return

      upsertAppointment(reassignedAppointment)

      const assignedDoctor = getDoctorName(reassignedAppointment?.doctor || {})
      setLiveNotice(`Your appointment was reassigned to ${assignedDoctor}.`)
    })

    return () => {
      socket.off("appointment-created")
      socket.off("appointment-updated")
      socket.off("appointment-reassigned")
      socket.disconnect()
    }
  }, [upsertAppointment])

  async function respondToConsentRequest(request, status) {
    if (!request?.requestId) return

    const auth = loadStoredAuth()
    if (!auth?.patientId) {
      setError("Please sign in to respond to sharing requests")
      return
    }

    setRespondingRequestId(String(request.requestId))
    setError("")
    setSuccess("")

    try {
      const headers = { "Content-Type": "application/json" }
      const token = getStoredToken()
      if (token) headers.authorization = `Bearer ${token}`

      let sharedAttachments = []
      if (status === "accepted") {
        const attachmentsRes = await fetch(`/api/uploads/owner/${encodeURIComponent(auth.patientId)}`, {
          cache: "no-store",
          headers: token ? { authorization: `Bearer ${token}` } : {},
        })
        const attachmentsData = await attachmentsRes.json().catch(() => ({}))
        if (attachmentsRes.ok && Array.isArray(attachmentsData?.files)) {
          sharedAttachments = attachmentsData.files.map((file) => String(file?._id || file?.id || "")).filter(Boolean)
        }
      }

      const payload = status === "accepted"
        ? {
            status: "accepted",
            sharedRecords: ["medicalHistory", "prescriptions", "allergies", "labResults"],
            sharedAttachments,
          }
        : { status: "rejected", sharedRecords: [], sharedAttachments: [] }

      const res = await fetch(`/api/patients/${encodeURIComponent(auth.patientId)}/consent-requests/${encodeURIComponent(request.requestId)}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Could not update sharing request")

      setConsentRequests((current) => current.map((item) => (item.requestId === request.requestId ? data : item)))
      setSuccess(status === "accepted" ? "Record sharing approved for this appointment." : "Record sharing request rejected.")
    } catch (err) {
      setError(err?.message || "Could not respond to sharing request")
    } finally {
      setRespondingRequestId("")
    }
  }


  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <div>
            <p className={styles.heroKicker}>Appointments</p>
            <h1 className={styles.heroTitle}>Book an Appointment</h1>
            <p className={styles.heroBody}>Describe your symptoms and choose a time. The system reasons about your condition, picks a suitable specialty, and assigns an available doctor automatically.</p>
            <div className={styles.heroActions}>
              <Link href="/secure/home" className={`${styles.actionButton} ${styles.actionSecondary}`}>Home</Link>
              <Link href="/secure/notifications" className={`${styles.actionButton} ${styles.actionSecondary}`}>Notifications</Link>
            </div>
          </div>
        </section>

        <section className={styles.grid} style={{ marginTop: '1rem' }}>
          <div className={styles.column}>
            <article className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2>Book appointment</h2>
                  <p>Confirm date, time, and visit type.</p>
                </div>
              </div>

              {error ? <div className={styles.appointmentMessageError}>{error}</div> : null}
              {success ? <div className={styles.appointmentMessageSuccess}>{success}</div> : null}
              {liveNotice ? <div className={styles.appointmentMessageSuccess}>{liveNotice}</div> : null}
              {assignmentInsight ? (
                <div className={styles.appointmentMessageSuccess}>
                  <strong>Assignment insight:</strong> {assignmentInsight.summary} Specialty: {assignmentInsight.specialty}.
                </div>
              ) : null}

              <form className={styles.appointmentForm} onSubmit={submit}>
                <div className={styles.appointmentFormGrid}>
                  <label className={styles.appointmentField}>
                    <span>Date</span>
                    <input type="date" value={form.date} min={new Date().toISOString().slice(0,10)} onChange={(e) => setForm((c) => ({ ...c, date: e.target.value }))} required />
                  </label>

                  <label className={styles.appointmentField}>
                    <span>Time</span>
                    <input
                      type="time"
                      value={form.time}
                      min={form.date === new Date().toISOString().slice(0, 10) ? getMinimumBookableDateTime().toTimeString().slice(0, 5) : undefined}
                      onChange={(e) => setForm((c) => ({ ...c, time: e.target.value }))}
                      required
                    />
                  </label>

                  <label className={styles.appointmentField}>
                    <span>Consultation type</span>
                    <select value={form.consultationType} onChange={(e) => setForm((c) => ({ ...c, consultationType: e.target.value }))}>
                      {APPOINTMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </label>

                  <label className={styles.appointmentField}>
                    <span>Duration</span>
                    <select value={form.duration} onChange={(e) => setForm((c) => ({ ...c, duration: e.target.value }))}>
                      <option value="15">15 minutes</option>
                      <option value="30">30 minutes</option>
                      <option value="45">45 minutes</option>
                      <option value="60">60 minutes</option>
                    </select>
                  </label>

                  <label className={`${styles.appointmentField} ${styles.appointmentFieldFull}`}>
                    <span>Reason for visit</span>
                    <textarea rows={4} value={form.reason} onChange={(e) => setForm((c) => ({ ...c, reason: e.target.value }))} placeholder="Describe symptoms in detail so AI can route you to the right specialty" required />
                  </label>
                </div>

                <button type="submit" className={styles.appointmentButton} disabled={submitting}>{submitting ? 'Booking...' : 'Find doctor and confirm booking'}</button>
              </form>
            </article>
          </div>

          <aside className={styles.sideStack}>
            <section className={styles.card}>
              <div className={styles.cardHeader}><div><h3>Your appointments</h3><p>Upcoming and recent visits</p></div></div>

              <div style={{ display: 'flex', gap: 8, margin: '0.75rem 0', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setAppointmentFilter('all')}
                  className={`${styles.actionButton} ${appointmentFilter === 'all' ? styles.actionPrimary : styles.actionSecondary}`}
                >All</button>
                <button
                  type="button"
                  onClick={() => setAppointmentFilter('incoming')}
                  className={`${styles.actionButton} ${appointmentFilter === 'incoming' ? styles.actionPrimary : styles.actionSecondary}`}
                >Incoming</button>
                <button
                  type="button"
                  onClick={() => setAppointmentFilter('pending')}
                  className={`${styles.actionButton} ${appointmentFilter === 'pending' ? styles.actionPrimary : styles.actionSecondary}`}
                >Pending</button>
                <button
                  type="button"
                  onClick={() => setAppointmentFilter('past')}
                  className={`${styles.actionButton} ${appointmentFilter === 'past' ? styles.actionPrimary : styles.actionSecondary}`}
                >Past</button>
              </div>

              {loadingAppointments ? <div className={styles.appointmentEmpty}>Loading appointments...</div> : null}
              {!loadingAppointments && displayedAppointments.length === 0 ? <div className={styles.appointmentEmpty}>You have no appointments for this view.</div> : null}
              <div ref={appointmentListRef} className={`${styles.appointmentList} ${styles.appointmentListScroll}`}>
                {displayedAppointments.map((a, index) => {
                  const appointmentKey = String(a.appointmentId || a._id || "")
                  const appointmentConsent = consentRequests.find(
                    (request) => String(request?.appointmentId || "") === appointmentKey,
                  )
                  const pendingConsent = appointmentConsent && String(appointmentConsent?.status || "") === "pending" ? appointmentConsent : null
                  const sharingApproved = appointmentConsent && String(appointmentConsent?.status || "") === "accepted"
                  const sharingRejected = appointmentConsent && String(appointmentConsent?.status || "") === "rejected"

                  return (
                    <article key={`${appointmentKey || 'appointment'}-${index}`} className={styles.appointmentItem}>
                      <div className={styles.appointmentItemHeader}>
                        <div className={styles.doctorHeader}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                            <strong className={styles.doctorName}>{a.doctor ? getDoctorName(a.doctor) : 'Doctor'}</strong>
                            <VerifiedDoctorBadge doctor={a.doctor} style={{ fontSize: '0.7rem' }} />
                          </div>
                          <div className={styles.doctorSpecialty}>Speciality: {a.doctor?.specialization || 'General care'}</div>
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                          {sharingApproved && (
                            <span className={styles.sharingBadgeApproved}>✓ Sharing approved</span>
                          )}
                          {sharingRejected && (
                            <span className={styles.sharingBadgeRejected}>✕ Sharing rejected</span>
                          )}
                          <span className={`${styles.statusBadge} ${styles[`status-${String(a.status || 'scheduled').replace(/[^a-z]/g, '')}`]}`}>{a.status || 'scheduled'}</span>
                        </div>
                      </div>
                      <small>{formatAppointmentDate(a.appointmentDate, a.appointmentTime)}</small>
                      {a.reason ? <span>{a.reason}</span> : null}

                      {/* Patient-side rebook action for missed appointments */}
                      {String(a.status || '').toLowerCase() === 'no-show' ? (
                        <div style={{ marginTop: 8 }}>
                          {rebookedByDoctorMap[String(a.appointmentId || a._id || '')] ? (
                            <button type="button" className={styles.actionButton} disabled>Rebooked</button>
                          ) : isRebookWindowExpired(a) ? (
                            <button type="button" className={styles.actionButton} disabled>Rebook expired</button>
                          ) : (
                            <button
                              type="button"
                              className={styles.actionButton}
                              onClick={() => rebookAppointment(a)}
                              disabled={Boolean(rebookingMap[String(a.appointmentId || a._id || '')])}
                            >
                              {rebookingMap[String(a.appointmentId || a._id || '')] ? 'Rebooking...' : 'Rebook'}
                            </button>
                          )}
                        </div>
                      ) : null}

                      {/* Allow patient to cancel a scheduled (possibly rebooked) appointment */}
                      {String(a.status || '').toLowerCase() === 'scheduled' ? (
                        <div style={{ marginTop: 8 }}>
                          <button type="button" className={styles.actionButton} onClick={() => cancelAppointment(a)}>Cancel</button>
                        </div>
                      ) : null}

                      {/* Join room button for accepted appointments (patient) */}
                      {String(a.status || '').toLowerCase() === 'accepted' && String(a.status || '').toLowerCase() !== 'no-show' ? (() => {
                        const appointmentId = String(a.appointmentId || a._id || '')
                        const roomId = String(a.roomId || `appointment-${appointmentId}`)
                        const dateTime = buildAppointmentDateTime(a.appointmentDate, a.appointmentTime)
                        const now = nowTick || new Date()
                        const canJoin = dateTime && now.getTime() >= dateTime.getTime()
                        const type = String(a.consultationType || '').toLowerCase()
                        let href = '#'
                        const auth = loadStoredAuth()
                        const patientName = encodeURIComponent(getPatientNameFromAuth(auth))
                        const patientId = encodeURIComponent(auth?.patientId || '')
                        const doctorName = encodeURIComponent(a.doctor?.doctorName || a.doctorName || '')
                        const doctorId = encodeURIComponent(a.doctor?.doctorId || a.doctorId || '')
                        if (type === 'messaging' || type === 'message') {
                          href = `/secure/chat?roomId=${encodeURIComponent(roomId)}&name=${patientName}&patientId=${patientId}&doctorId=${doctorId}&doctorName=${doctorName}`
                        } else if (type === 'video') {
                          href = `/secure/call?roomId=${encodeURIComponent(roomId)}&mode=video&patientId=${patientId}&doctorId=${doctorId}`
                        } else if (type === 'phone' || type === 'call') {
                          href = `/secure/call?roomId=${encodeURIComponent(roomId)}&mode=phone&patientId=${patientId}&doctorId=${doctorId}`
                        }

                        return (
                          <div style={{ marginTop: 8 }}>
                            <Link
                              href={href}
                              className={`${styles.appointmentJoinLink} ${!canJoin ? styles.appointmentJoinLinkDisabled : ''}`}
                              onClick={(e) => { if (!canJoin) { e.preventDefault(); } }}
                              aria-disabled={!canJoin}
                            >
                              {canJoin ? 'Join room' : 'Join (when live)'}
                            </Link>
                          </div>
                        )
                      })() : null}

                      {pendingConsent ? (
                        <div className={styles.appointmentConsentMessage}>
                          <p>{pendingConsent.message || "Your doctor requested access to your records for this appointment."}</p>
                          <div className={styles.appointmentConsentActions}>
                            <button
                              type="button"
                              className={styles.appointmentConsentAccept}
                              onClick={() => respondToConsentRequest(pendingConsent, "accepted")}
                              disabled={respondingRequestId === String(pendingConsent.requestId)}
                            >
                              {respondingRequestId === String(pendingConsent.requestId) ? "Updating..." : "Accept"}
                            </button>
                            <button
                              type="button"
                              className={styles.appointmentConsentReject}
                              onClick={() => respondToConsentRequest(pendingConsent, "rejected")}
                              disabled={respondingRequestId === String(pendingConsent.requestId)}
                            >
                              Reject
                            </button>
                            <Link href="/secure/patient/consents" className={styles.appointmentConsentChoose}>
                              Choose what to share
                            </Link>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  )
                })}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  )
}
