"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useState, useMemo, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { io } from "socket.io-client"
import styles from "./doctor.module.css"
import homeStyles from "../home/home.module.css"
import LoadingCanvas from "../components/LoadingCanvas"
import { getBackendBaseUrl } from "../../../lib/backend-url"

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

function getAppointmentTrackingLabel(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'accepted') return 'Accepted'
  if (normalized === 'completed') return 'Attended'
  if (normalized === 'no-show') return 'Missed'
  if (normalized === 'cancelled') return 'Cancelled'
  if (normalized === 'in-progress') return 'In progress'
  return 'Scheduled'
}

function getAppointmentStatusClass(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'no-show') return 'status-cancelled'
  return `status-${normalized || 'scheduled'}`
}

function isTodayLocal(dateValue) {
  if (!dateValue) return false
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return false
  const now = new Date()
  return date.toDateString() === now.toDateString()
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

function getEffectiveAppointmentStatus(appointment, now = new Date()) {
  const baseStatus = String(appointment?.status || "").toLowerCase()
  if (["completed", "no-show", "cancelled"].includes(baseStatus)) return baseStatus

  const appointmentDateTime = buildAppointmentDateTime(appointment?.appointmentDate, appointment?.appointmentTime)
  if (!appointmentDateTime) return baseStatus || "scheduled"

  const sameDay = appointmentDateTime.toDateString() === now.toDateString()
  const minutesLate = (now.getTime() - appointmentDateTime.getTime()) / (60 * 1000)
  const withinGrace = sameDay && minutesLate >= 0 && minutesLate <= 10

  if (appointmentDateTime < now && !withinGrace) return "no-show"
  return baseStatus || "scheduled"
}

export default function DoctorDashboard() {
  const [doctorId, setDoctorId] = useState("doctor")
  const [doctorName, setDoctorName] = useState("Doctor")
  const [profileImage, setProfileImage] = useState(null)
  const [specialization, setSpecialization] = useState("")
  const [yearsOfExperience, setYearsOfExperience] = useState(0)
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
  const [consentRequestObj, setConsentRequestObj] = useState(null)
  const [appointmentActionBusy, setAppointmentActionBusy] = useState(false)
  const [rebookedMap, setRebookedMap] = useState({})
  const socketRef = useRef(null)
  const [doctorPendingRebookMap, setDoctorPendingRebookMap] = useState({})
  const [availabilityBusy, setAvailabilityBusy] = useState(false)
  const [doctorAvailability, setDoctorAvailability] = useState(true)
  const [appointmentConsentStatus, setAppointmentConsentStatus] = useState({}) // { appointmentId: { status, requestId } }
  const [appointmentHistoryFilter, setAppointmentHistoryFilter] = useState("all") // all, past, pending
  const [appointmentHistory, setAppointmentHistory] = useState([])
  const [appointmentHistoryLoading, setAppointmentHistoryLoading] = useState(false)
  const selectedAppointmentRef = useRef(null)
  const fileInputRef = useRef(null)
  const labFileInputRef = useRef(null)
  const router = useRouter()

  // Lab interpretation state (moved from home)
  const [labFile, setLabFile] = useState(null)
  const [labPatientName, setLabPatientName] = useState("")
  const [labPatientPhone, setLabPatientPhone] = useState("")
  const [labTestType, setLabTestType] = useState("")
  const [labLoading, setLabLoading] = useState(false)
  const [labError, setLabError] = useState("")
  const [labSuccess, setLabSuccess] = useState("")

  useEffect(() => {
    selectedAppointmentRef.current = selectedAppointment
  }, [selectedAppointment])

  useEffect(() => {
    const identity = getDoctorIdentity()
    setDoctorId(identity.doctorId)
    setDoctorName(identity.doctorName)
    setProfileImage(identity.profileImage || null)
  }, [])

  // Load appointment history when tab is selected or filter changes
  useEffect(() => {
    if (selectedTab !== 'history' || !doctorId || doctorId === 'doctor') return

    const loadAppointmentHistory = async () => {
      setAppointmentHistoryLoading(true)
      setError("")

      try {
        const headers = {}
        const token = getStoredToken()
        if (token) headers.authorization = `Bearer ${token}`

        const response = await fetch(
          `/api/doctors/${encodeURIComponent(doctorId)}/appointments-history?status=${appointmentHistoryFilter}&limit=100`,
          { cache: "no-store", headers }
        )

        const data = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(data?.message || "Could not load appointment history.")
        }

        setAppointmentHistory(Array.isArray(data?.appointments) ? data.appointments : [])
      } catch (err) {
        setError(err?.message || "Could not load appointment history.")
      } finally {
        setAppointmentHistoryLoading(false)
      }
    }

    loadAppointmentHistory()
  }, [selectedTab, doctorId, appointmentHistoryFilter])

  // Accept appointment from history
  const handleAcceptAppointment = useCallback(async (appointmentId) => {
    if (!appointmentId || !doctorId) return
    
    setAppointmentActionBusy(true)
    try {
      const headers = { 'Content-Type': 'application/json' }
      const token = getStoredToken()
      if (token) headers.authorization = `Bearer ${token}`

      const response = await fetch(
        `/api/doctors/${encodeURIComponent(doctorId)}/appointments/${encodeURIComponent(appointmentId)}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ status: 'accepted' }),
          cache: 'no-store',
        }
      )

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data?.message || 'Failed to accept appointment')
      }

      // Refresh appointment history
      setAppointmentHistory((prev) =>
        prev.map((apt) =>
          apt.appointmentId === appointmentId ? { ...apt, status: 'accepted' } : apt
        )
      )

      // Show success feedback (optional: could add toast notification)
      console.log('Appointment accepted successfully')
    } catch (err) {
      console.error('Error accepting appointment:', err?.message)
      setError(err?.message || 'Could not accept appointment')
    } finally {
      setAppointmentActionBusy(false)
    }
  }, [doctorId])

    // Doctor workflow: Upload lab file -> Extract text/data -> Analyze values -> Generate explanation -> Display insights
    async function handleInterpretLabResult(event) {
      event.preventDefault()
      if (!labFile || labLoading) return

      setLabLoading(true)
      setLabError("")
      setLabSuccess("")

      try {
        const formData = new FormData()
        formData.append("labFile", labFile)
        formData.append("patientName", labPatientName)
        formData.append("patientPhone", labPatientPhone)
        formData.append("testType", labTestType)

        const headers = {}
        const token = getStoredToken()
        if (token) headers.authorization = `Bearer ${token}`

        const response = await fetch("/api/ai/lab-results/interpret", {
          method: "POST",
          headers,
          body: formData,
        })

        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(data?.error || data?.details || "Failed to interpret lab result")
        }

        const resultId = data?.result?._id
        if (!resultId) {
          throw new Error("Lab result was saved, but no result page id was returned.")
        }

        setLabSuccess("Lab result interpreted successfully. Opening results page...")
        router.push(`/secure/doctor/lab-results/${resultId}`)
      } catch (err) {
        setLabError(err?.message || "Could not interpret lab result.")
      } finally {
        setLabLoading(false)
      }
    }

  const handleProfileImageUpload = useCallback((uploaded) => {
    const nextProfileImage = uploaded?.profileImage || (uploaded?.url ? { url: uploaded.url, publicId: uploaded.publicId, mimeType: uploaded.mimeType } : uploaded)
    setProfileImage(nextProfileImage)
    try {
      const stored = window.localStorage.getItem('doctorAuth') || '{}'
      const auth = JSON.parse(stored)
      if (uploaded?.doctorId) {
        // merge to preserve tokens
        window.localStorage.setItem('doctorAuth', JSON.stringify({ ...(auth || {}), ...(uploaded || {}) }))
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
      const [attachmentsResponse, recordResponse, consentResponse] = await Promise.all([
        fetch(`/api/uploads/owner/${encodeURIComponent(appointment.patientId)}`, { cache: "no-store", headers }),
        fetch(`/api/patients/${encodeURIComponent(appointment.patientId)}/health-records`, { cache: "no-store", headers }),
        fetch(`/api/patients/${encodeURIComponent(appointment.patientId)}/consent-requests`, { cache: "no-store", headers }),
      ])

      const attachmentsData = await attachmentsResponse.json().catch(() => ({}))
      const recordData = await recordResponse.json().catch(() => ({}))
      const consentData = await consentResponse.json().catch(() => ({}))

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

      // Check if there's already an accepted consent for this appointment
      const existingAcceptedConsent = Array.isArray(consentData?.requests)
        ? consentData.requests.find(
            (req) =>
              String(req?.appointmentId || "") === String(appointment.appointmentId || "") &&
              String(req?.status || "") === "accepted",
          )
        : null

      if (existingAcceptedConsent) {
        // Use existing accepted consent
        setConsentRequestObj(existingAcceptedConsent)
        setRecordConsentState("accepted")
      } else {
        // No existing consent, show request button
        setConsentRequestObj(null)
      }

      setConsentModalOpen(true)
    } catch (err) {
      setError(err?.message || "Could not load patient records.")
    } finally {
      setAppointmentActionBusy(false)
    }
  }, [])

  const rejectSharing = useCallback(async () => {
    if (!selectedAppointment) return

    setAppointmentActionBusy(true)
    setError("")

    try {
      const headers = { "Content-Type": "application/json" }
      const token = getStoredToken()
      if (token) headers.authorization = `Bearer ${token}`
      const consentResponse = await fetch(`/api/patients/${encodeURIComponent(selectedAppointment.patientId)}/consent-requests/${encodeURIComponent(consentRequestObj.requestId)}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: "rejected", sharedRecords: [], sharedAttachments: [] }),
      })

      const consentData = await consentResponse.json().catch(() => ({}))
      if (!consentResponse.ok) {
        throw new Error(consentData?.message || "Could not revoke consent.")
      }

      setConsentRequestObj(consentData)
      setRecordConsentState("rejected")
      
      setTimeout(() => {
        setConsentModalOpen(false)
        setSelectedAppointment(null)
        setSelectedPatientAttachments([])
        setSelectedPatientRecord(null)
      }, 500)
    } catch (err) {
      setError(err?.message || "Could not revoke consent.")
    } finally {
      setAppointmentActionBusy(false)
    }
  }, [consentRequestObj, selectedAppointment])

  const acceptAppointment = useCallback(async (appointment) => {
    if (!appointment) return
    if (!doctorId || doctorId === "doctor") return

    const appointmentId = appointment.appointmentId || appointment._id
    if (!appointmentId) return

    setAppointmentActionBusy(true)
    setError("")

    try {
      const headers = { "Content-Type": "application/json" }
      const token = getStoredToken()
      if (token) headers.authorization = `Bearer ${token}`

      const response = await fetch(`/api/doctors/${encodeURIComponent(doctorId)}/appointments/${encodeURIComponent(appointmentId)}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: "accepted", notes: "Accepted by doctor from dashboard." }),
      })

      const updatedAppointment = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(updatedAppointment?.message || "Could not accept appointment.")
      }

      setDashboardData((current) => {
        if (!current) return current
        const nextAppointments = (current.todaysAppointments || []).map((item) =>
          String(item?.appointmentId || item?._id || "") === String(updatedAppointment?.appointmentId || updatedAppointment?._id || "")
            ? updatedAppointment
            : item,
        )
        return { ...current, todaysAppointments: nextAppointments }
      })

      setSelectedAppointment((current) => {
        if (!current) return current
        return String(current?.appointmentId || current?._id || "") === String(updatedAppointment?.appointmentId || updatedAppointment?._id || "")
          ? updatedAppointment
          : current
      })
    } catch (err) {
      setError(err?.message || "Could not accept appointment.")
    } finally {
      setAppointmentActionBusy(false)
    }
  }, [doctorId])

  const cancelAppointment = useCallback(async (appointment) => {
    if (!appointment) return
    if (!doctorId || doctorId === "doctor") return

    const appointmentId = appointment.appointmentId || appointment._id
    if (!appointmentId) return

    setAppointmentActionBusy(true)
    setError("")

    try {
      const headers = { "Content-Type": "application/json" }
      const token = getStoredToken()
      if (token) headers.authorization = `Bearer ${token}`

      const response = await fetch(`/api/doctors/${encodeURIComponent(doctorId)}/appointments/${encodeURIComponent(appointmentId)}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: "cancelled", notes: "Cancelled by doctor from dashboard." }),
      })

      const updatedAppointment = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(updatedAppointment?.message || "Could not cancel appointment.")
      }

      setDashboardData((current) => {
        if (!current) return current
        const nextAppointments = (current.todaysAppointments || []).map((item) =>
          String(item?.appointmentId || item?._id || "") === String(updatedAppointment?.appointmentId || updatedAppointment?._id || "")
            ? updatedAppointment
            : item,
        )
        return { ...current, todaysAppointments: nextAppointments }
      })

      setSelectedAppointment((current) => {
        if (!current) return current
        return String(current?.appointmentId || current?._id || "") === String(updatedAppointment?.appointmentId || updatedAppointment?._id || "")
          ? updatedAppointment
          : current
      })
    } catch (err) {
      setError(err?.message || "Could not cancel appointment.")
    } finally {
      setAppointmentActionBusy(false)
    }
  }, [doctorId])

  const rebookMissedAppointment = useCallback(async (appointment) => {
    if (!appointment) return
    if (!doctorId || doctorId === "doctor") return

    const appointmentId = appointment.appointmentId || appointment._id
    if (!appointmentId) return

    const originalId = String(appointment.appointmentId || appointment._id || "")
    // mark pending for this appointment so UI disables only this row
    setDoctorPendingRebookMap((m) => ({ ...m, [originalId]: true }))
    setAppointmentActionBusy(true)
    setError("")

    try {
      const headers = { "Content-Type": "application/json" }
      const token = getStoredToken()
      if (token) headers.authorization = `Bearer ${token}`

      const response = await fetch(`/api/doctors/${encodeURIComponent(doctorId)}/appointments/${encodeURIComponent(appointmentId)}/rebook`, {
        method: "POST",
        headers,
        cache: "no-store",
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.message || "Could not rebook appointment.")
      }

      // Mark original appointment as rebooked in UI and move it to recentActivity (past)
      setRebookedMap((m) => ({ ...m, [originalId]: true }))
      setDashboardData((current) => {
        if (!current) return current
        // remove from todaysAppointments
        const nextAppointments = Array.isArray(current.todaysAppointments) ? [...current.todaysAppointments] : []
        const idx = nextAppointments.findIndex((a) => String(a?.appointmentId || a?._id || "") === originalId)
        let removed = null
        if (idx >= 0) removed = nextAppointments.splice(idx, 1)[0]

        // push removed into recentActivity as a past item with rebooked flag
        const nextRecent = Array.isArray(current.recentActivity) ? [...current.recentActivity] : []
        if (removed) {
          const recentItem = { ...(removed || {}), rebooked: true, updatedAt: new Date().toISOString() }
          nextRecent.unshift(recentItem)
          if (nextRecent.length > 20) nextRecent.length = 20
        }

        return {
          ...current,
          todaysAppointments: nextAppointments,
          recentActivity: nextRecent,
          stats: {
            ...(current.stats || {}),
            todayAppointments: nextAppointments.length,
          },
        }
      })
    } catch (err) {
      setError(err?.message || "Could not rebook appointment.")
    } finally {
      setAppointmentActionBusy(false)
      setDoctorPendingRebookMap((m) => {
        const copy = { ...m }
        delete copy[originalId]
        return copy
      })
    }
  }, [doctorId])

  const toggleDoctorAvailability = useCallback(async () => {
    if (!doctorId || doctorId === "doctor" || availabilityBusy) return

    const nextAvailability = !doctorAvailability
    setAvailabilityBusy(true)
    setError("")

    try {
      const headers = { "Content-Type": "application/json" }
      const token = getStoredToken()
      if (token) headers.authorization = `Bearer ${token}`

      const response = await fetch(`/api/doctors/${encodeURIComponent(doctorId)}/settings`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ isAvailable: nextAvailability }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.message || "Could not update availability.")
      }

      setDoctorAvailability(nextAvailability)
    } catch (err) {
      setError(err?.message || "Could not update availability.")
    } finally {
      setAvailabilityBusy(false)
    }
  }, [availabilityBusy, doctorAvailability, doctorId])

  useEffect(() => {
    if (!doctorId || doctorId === "doctor") return

    let active = true
    setLoading(true)

    const loadDashboard = async () => {
      try {
        const headers = { "Content-Type": "application/json" }
        const token = getStoredToken()
        if (token) headers.authorization = `Bearer ${token}`

        const response = await fetch(`/api/doctors/${encodeURIComponent(doctorId)}/dashboard`, {
          method: "GET",
          headers,
        })

        const data = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(data?.message || "Could not load dashboard data.")
        }

        if (!active) return

        setDashboardData(data)

        const persistedConsentState = Array.isArray(data?.todaysAppointments)
          ? data.todaysAppointments.reduce((acc, appointment) => {
              const appointmentKey = String(appointment?.appointmentId || appointment?._id || "")
              const persistedStatus = String(appointment?.consentStatus || "")
              const persistedRequestId = String(appointment?.consentRequestId || "")
              if (!appointmentKey || !persistedStatus) return acc
              acc[appointmentKey] = {
                status: persistedStatus,
                requestId: persistedRequestId,
              }
              return acc
            }, {})
          : {}

        setAppointmentConsentStatus((current) => ({
          ...persistedConsentState,
          ...current,
        }))

        setDoctorId((currentDoctorId) => data?.doctor?.doctorId || currentDoctorId)
        setDoctorName((currentDoctorName) => {
          const nextDoctorName = [data?.doctor?.doctorFirstName, data?.doctor?.doctorLastName]
            .filter(Boolean)
            .join(" ")
            .trim()
          return nextDoctorName || currentDoctorName
        })
        setProfileImage((currentProfileImage) => data?.doctor?.profileImage || currentProfileImage)
        setSpecialization(data?.doctor?.specialization || "")
        setYearsOfExperience(Number(data?.doctor?.yearsOfExperience || 0))
        setDoctorAvailability(typeof data?.doctor?.isAvailable === "boolean" ? data.doctor.isAvailable : true)
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

  useEffect(() => {
    if (!doctorId || doctorId === "doctor") return

    const socketUrl = getBackendBaseUrl()
    const socket = io(socketUrl, {
      transports: ["websocket"],
      withCredentials: true,
    })
    // expose socket for other handlers
    socketRef.current = socket

    socket.on('appointment-rebooking', (payload) => {
      const appointmentId = String(payload?.appointmentId || '')
      if (!appointmentId) return
      setDoctorPendingRebookMap((m) => ({ ...m, [appointmentId]: true }))
    })

    socket.on('rebook-cancelled', (payload) => {
      const originalAppointmentId = String(payload?.originalAppointmentId || '')
      if (!originalAppointmentId) return
      setRebookedMap((m) => {
        const copy = { ...m }
        delete copy[originalAppointmentId]
        return copy
      })
      setDoctorPendingRebookMap((m) => {
        const copy = { ...m }
        delete copy[originalAppointmentId]
        return copy
      })
    })

    socket.emit("join-appointments-doctor", doctorId)

    const upsertAppointment = (incomingAppointment) => {
      if (!incomingAppointment) return

      setDashboardData((current) => {
        if (!current) return current

        const incomingId = String(incomingAppointment?.appointmentId || incomingAppointment?._id || "")
        if (!incomingId) return current

        const nextAppointments = [...(current.todaysAppointments || [])]
        const existingIndex = nextAppointments.findIndex(
          (item) => String(item?.appointmentId || item?._id || "") === incomingId,
        )

        const incomingStatus = getEffectiveAppointmentStatus(incomingAppointment)

        // Remove cancelled/completed from today's list; keep missed (no-show) visible but disabled in UI.
        const isTerminal = incomingStatus === 'cancelled' || incomingStatus === 'completed'

        if (isTodayLocal(incomingAppointment?.appointmentDate) && !isTerminal) {
          const normalizedIncomingAppointment = { ...incomingAppointment, status: incomingStatus }
          if (existingIndex >= 0) {
            nextAppointments[existingIndex] = { ...nextAppointments[existingIndex], ...normalizedIncomingAppointment }
          } else {
            nextAppointments.push(normalizedIncomingAppointment)
          }
        } else {
          // remove from todaysAppointments if present
          if (existingIndex >= 0) nextAppointments.splice(existingIndex, 1)
        }

        nextAppointments.sort((a, b) => {
          // Sort to show accepted appointments first
          const statusA = String(a?.status || "").toLowerCase()
          const statusB = String(b?.status || "").toLowerCase()
          
          if (statusA === 'accepted' && statusB !== 'accepted') return -1
          if (statusA !== 'accepted' && statusB === 'accepted') return 1
          
          // Then sort by date and time
          const dateA = new Date(a?.appointmentDate || 0)
          const dateB = new Date(b?.appointmentDate || 0)
          if (dateA.getTime() !== dateB.getTime()) return dateA - dateB
          const timeA = String(a?.appointmentTime || "")
          const timeB = String(b?.appointmentTime || "")
          return timeA.localeCompare(timeB)
        })

        // Build updated recentActivity when a terminal status arrives
        let nextRecent = Array.isArray(current.recentActivity) ? [...current.recentActivity] : []
        if (isTerminal) {
          // Avoid duplicates
          const already = nextRecent.find((r) => String(r?.appointmentId || r?._id || "") === incomingId)
          if (!already) {
            const recentItem = { ...(incomingAppointment || {}), updatedAt: new Date().toISOString() }
            nextRecent.unshift(recentItem)
            // cap recent list to 20
            if (nextRecent.length > 20) nextRecent.length = 20
          }
        }

        return {
          ...current,
          todaysAppointments: nextAppointments,
          recentActivity: nextRecent,
          stats: {
            ...(current.stats || {}),
            todayAppointments: nextAppointments.length,
          },
        }
      })
    }

    socket.on("appointment-created", (payload) => {
      upsertAppointment(payload?.appointment)
    })

    socket.on("appointment-updated", (payload) => {
      upsertAppointment(payload?.appointment)
    })

    // clear pending flags when the server indicates rebook finished via created/updated flows
    socket.on('appointment-reassigned', () => {
      // noop here; appointment-created handler will handle moving items
    })

    return () => {
      socket.off("appointment-created")
      socket.off("appointment-updated")
      socket.off('appointment-reassigned')
      socket.disconnect()
    }
  }, [doctorId])

  useEffect(() => {
    if (!doctorId || doctorId === "doctor") return

    const socketUrl = getBackendBaseUrl()
    const socket = io(socketUrl, {
      transports: ["websocket"],
      withCredentials: true,
    })

    // Join doctor consent room to receive real-time patient responses
    socket.emit("join-consent-doctor", doctorId)

    // Listen for patient consent responses
    socket.on("consent-responded", (payload) => {
      const respondedRequest = payload?.request
      if (!respondedRequest?.appointmentId) return
      const respondedAppointmentId = String(respondedRequest.appointmentId || "")

      setAppointmentConsentStatus((current) => ({
        ...current,
        [respondedAppointmentId]: {
          status: String(respondedRequest.status || ""),
          requestId: String(respondedRequest.requestId || ""),
        },
      }))

      if (String(selectedAppointmentRef.current?.appointmentId || selectedAppointmentRef.current?._id || "") === respondedAppointmentId) {
        setConsentRequestObj(respondedRequest)
        setRecordConsentState(String(respondedRequest.status || "idle"))
      }

      setNotificationCount((currentCount) => currentCount + 1)
    })

    return () => {
      socket.off("consent-responded")
      socket.disconnect()
    }
  }, [doctorId])

  const timeGreeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good morning"
    if (hour < 18) return "Good afternoon"
    return "Good evening"
  }, [])

  if (loading) {
    return <LoadingCanvas />
  }

  const consentAccepted = String(consentRequestObj?.status || "") === "accepted"
  const allowedRecordFields = Array.isArray(consentRequestObj?.sharedRecords) ? consentRequestObj.sharedRecords : []
  const allowedAttachmentIds = Array.isArray(consentRequestObj?.sharedAttachments) ? consentRequestObj.sharedAttachments.map((item) => String(item)) : []
  const visibleAttachments = consentAccepted
    ? selectedPatientAttachments.filter((attachment) => allowedAttachmentIds.includes(String(attachment?._id || attachment?.id || "")))
    : []

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
                <strong>Doctor ID:</strong> {doctorId} | <strong>Specialty:</strong> {specialization || "Not specified"} | <strong>
                  Experience:
                </strong> {yearsOfExperience} year{yearsOfExperience === 1 ? "" : "s"}
              </p>
              <p className={styles.heroBody} style={{ marginTop: "0.5rem" }}>
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
            className={`${styles.tabButton} ${selectedTab === "history" ? styles.active : ""}`}
            onClick={() => setSelectedTab("history")}
          >
            History
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
                      <span className={`${styles.badge} ${styles[getAppointmentStatusClass(apt.status)]}`}>
                        {getAppointmentTrackingLabel(apt.status)}
                      </span>
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

            {/* AI Lab Result Interpretation (doctor) */}
            <section className={homeStyles.composerSection}>
              <article className={homeStyles.labCard}>
                <div className={homeStyles.sideHeader}>
                  <h3>AI Lab Result Interpretation</h3>
                </div>
                <p className={homeStyles.labSubtitle}>
                  Upload a lab result file and get AI-powered interpretation insights for clinical decision support.
                </p>

                <form className={homeStyles.labForm} onSubmit={handleInterpretLabResult}>
                  <div className={homeStyles.labGrid}>
                    <input
                      className={homeStyles.labInput}
                      type="text"
                      placeholder="Patient name (optional)"
                      value={labPatientName}
                      onChange={(event) => setLabPatientName(event.target.value)}
                    />
                    <input
                      className={homeStyles.labInput}
                      type="text"
                      placeholder="Patient phone (optional)"
                      value={labPatientPhone}
                      onChange={(event) => setLabPatientPhone(event.target.value)}
                    />
                  </div>

                  <input
                    className={homeStyles.labInput}
                    type="text"
                    placeholder="Test type (e.g., CBC, Lipid Profile)"
                    value={labTestType}
                    onChange={(event) => setLabTestType(event.target.value)}
                  />

                  <div className={homeStyles.labFileRow}>
                    <input
                      ref={labFileInputRef}
                      id="labFileInput"
                      className={homeStyles.labHiddenFileInput}
                      type="file"
                      accept=".pdf,.txt,.csv,image/*"
                      onChange={(event) => setLabFile(event.target.files?.[0] || null)}
                      required
                    />
                    <label htmlFor="labFileInput" className={homeStyles.labAttachmentButton}>
                      <span className={homeStyles.labAttachmentIcon} aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M8.5 11.5l5.7-5.7a3 3 0 114.2 4.2l-7.7 7.7a5 5 0 11-7.1-7.1l7.9-7.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <span>{labFile ? labFile.name : "Attach lab file"}</span>
                    </label>
                  </div>

                  <div className={homeStyles.labActions}>
                    <button type="submit" disabled={labLoading || !labFile}>
                      {labLoading ? "Interpreting..." : "Interpret lab result"}
                    </button>
                  </div>
                </form>

                {labError ? <p className={homeStyles.labError}>{labError}</p> : null}
                {labSuccess ? <p className={homeStyles.labSuccess}>{labSuccess}</p> : null}
              </article>
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

                {(dashboardData?.notifications || []).slice(0, 2).map((notif) => (
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
                <button
                  type="button"
                  className={`${styles.actionButton} ${doctorAvailability ? styles.actionPrimary : styles.actionSecondary}`}
                  onClick={toggleDoctorAvailability}
                  disabled={availabilityBusy}
                >
                  {availabilityBusy
                    ? "Updating..."
                    : doctorAvailability
                      ? "Set Unavailable"
                      : "Set Available"}
                </button>
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
                dashboardData.todaysAppointments.map((apt) => {
                  const isAccepted = String(apt.status || "").toLowerCase() === "accepted"
                  const isMissed = String(apt.status || "").toLowerCase() === "no-show"
                  const consentStatus = appointmentConsentStatus[String(apt.appointmentId || apt._id || "")]
                  const consentStatusDisplay = consentStatus?.status || String(apt?.consentStatus || "")

                  return (
                    <div key={apt._id} className={styles.appointmentDetailItem}>
                      <div className={styles.appointmentDetail}>
                        <strong>{apt.appointmentTime} - {apt.patientName}</strong>
                        <span>{apt.reason || "General checkup"}</span>
                        <small>Type: {apt.consultationType} | Duration: {apt.duration} min</small>
                      </div>
                      <div className={styles.appointmentActions}>
                        <span className={`${styles.badge} ${styles[getAppointmentStatusClass(apt.status)]}`}>
                          {getAppointmentTrackingLabel(apt.status)}
                        </span>
                        {consentStatusDisplay && (
                          <span
                            className={`${styles.badge} ${consentStatusDisplay === "pending" ? styles.consentPending : consentStatusDisplay === "accepted" ? styles.consentAccepted : styles.consentRejected}`}
                          >
                            {consentStatusDisplay === "pending" ? "📋 Pending" : consentStatusDisplay === "accepted" ? "✅ Approved sharing" : "❌ Sharing halted"}
                          </span>
                        )}
                        <div className={styles.appointmentActionButtons}>
                          <button
                            type="button"
                            className={`${styles.secondaryButton} ${String(apt.status || "").toLowerCase() !== "accepted" ? styles.actionFaded : ""}`}
                            onClick={() => loadPatientRecordAndAttachments(apt)}
                            disabled={appointmentActionBusy || String(apt.status || "").toLowerCase() !== "accepted" || isMissed}
                            title={String(apt.status || "").toLowerCase() !== "accepted" ? "Review is available only after appointment acceptance." : "Review patient records"}
                          >
                            Review records
                          </button>
                          {isMissed ? (
                            doctorPendingRebookMap[String(apt.appointmentId || apt._id || '')] ? (
                              <button type="button" className={styles.primaryButton} disabled>
                                Rebooking...
                              </button>
                            ) : rebookedMap[String(apt.appointmentId || apt._id || '')] ? (
                              <button type="button" className={styles.primaryButton} disabled>
                                Rebooked
                              </button>
                            ) : (
                              <button
                                type="button"
                                className={styles.primaryButton}
                                onClick={() => rebookMissedAppointment(apt)}
                                disabled={appointmentActionBusy}
                              >
                                {appointmentActionBusy ? "Rebooking..." : "Rebook"}
                              </button>
                            )
                          ) : (
                            <button
                              type="button"
                              className={`${isAccepted ? styles.secondaryButton : styles.primaryButton} ${String(apt.status || "").toLowerCase() === 'cancelled' ? styles.actionFaded : ''}`}
                              onClick={() => (isAccepted ? cancelAppointment(apt) : acceptAppointment(apt))}
                              disabled={appointmentActionBusy || String(apt.status || "").toLowerCase() === "cancelled"}
                            >
                              {isAccepted ? "Cancel appointment" : "Accept appointment"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
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

        {selectedTab === "history" && (
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2>Appointment History</h2>
                <p>View all appointments - past and pending</p>
              </div>
            </div>

            <div style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className={`${styles.tabButton} ${appointmentHistoryFilter === "all" ? styles.active : ""}`}
                onClick={() => setAppointmentHistoryFilter("all")}
                style={{ flex: "0 1 auto", padding: "0.5rem 1rem", border: "1px solid #ccc", borderRadius: "0.375rem", backgroundColor: appointmentHistoryFilter === "all" ? "#0a3a66" : "transparent", color: appointmentHistoryFilter === "all" ? "white" : "inherit", cursor: "pointer" }}
              >
                All
              </button>
              <button
                type="button"
                className={`${styles.tabButton} ${appointmentHistoryFilter === "pending" ? styles.active : ""}`}
                onClick={() => setAppointmentHistoryFilter("pending")}
                style={{ flex: "0 1 auto", padding: "0.5rem 1rem", border: "1px solid #ccc", borderRadius: "0.375rem", backgroundColor: appointmentHistoryFilter === "pending" ? "#0a3a66" : "transparent", color: appointmentHistoryFilter === "pending" ? "white" : "inherit", cursor: "pointer" }}
              >
                Pending
              </button>
              <button
                type="button"
                className={`${styles.tabButton} ${appointmentHistoryFilter === "past" ? styles.active : ""}`}
                onClick={() => setAppointmentHistoryFilter("past")}
                style={{ flex: "0 1 auto", padding: "0.5rem 1rem", border: "1px solid #ccc", borderRadius: "0.375rem", backgroundColor: appointmentHistoryFilter === "past" ? "#0a3a66" : "transparent", color: appointmentHistoryFilter === "past" ? "white" : "inherit", cursor: "pointer" }}
              >
                Past
              </button>
            </div>

            {appointmentHistoryLoading ? (
              <p className={styles.emptyState}>Loading appointments...</p>
            ) : (
              <div className={styles.appointmentsList}>
                {(appointmentHistory || []).length === 0 ? (
                  <p className={styles.emptyState}>
                    {appointmentHistoryFilter === "all" && "No appointments found."}
                    {appointmentHistoryFilter === "pending" && "No pending appointments."}
                    {appointmentHistoryFilter === "past" && "No past appointments."}
                  </p>
                ) : (
                  appointmentHistory.map((apt) => (
                    <div key={apt._id || apt.appointmentId} className={styles.appointmentDetailItem}>
                      <div className={styles.appointmentDetail}>
                        <strong>{apt.appointmentTime} - {apt.patientName}</strong>
                        <span>{apt.reason || "General checkup"}</span>
                        <small>
                          Type: {apt.consultationType} | Duration: {apt.duration} min | Date: {new Date(apt.appointmentDate).toLocaleDateString()}
                        </small>
                      </div>
                      <div className={styles.appointmentActions}>
                        {String(apt.status || '').toLowerCase() === 'scheduled' && (
                          <button
                            type="button"
                            onClick={() => handleAcceptAppointment(apt.appointmentId)}
                            disabled={appointmentActionBusy}
                            style={{
                              padding: '0.5rem 1rem',
                              marginRight: '0.5rem',
                              border: 'none',
                              borderRadius: '0.375rem',
                              backgroundColor: '#0a66c2',
                              color: 'white',
                              cursor: appointmentActionBusy ? 'not-allowed' : 'pointer',
                              opacity: appointmentActionBusy ? 0.6 : 1,
                              fontWeight: '600',
                              fontSize: '0.875rem',
                            }}
                          >
                            {appointmentActionBusy ? 'Accepting...' : 'Accept'}
                          </button>
                        )}
                        <span className={`${styles.badge} ${styles[getAppointmentStatusClass(apt.status)]}`}>
                          {getAppointmentTrackingLabel(apt.status)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
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
                      <p style={{ color: '#334155', margin: '0.5rem 0', fontSize: '0.95rem' }}>{notif.message}</p>
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
                    Request consent first. Patient attachments and health records remain hidden until the patient approves sharing.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                {!consentRequestObj ? (
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={async () => {
                      try {
                        setRecordConsentState('requesting')
                        const token = getStoredToken()
                        const headers = { 'Content-Type': 'application/json' }
                        if (token) headers.authorization = `Bearer ${token}`
                        const patientId = selectedAppointment.patientId
                        const doctorIdLocal = doctorId
                        const body = { doctorId: doctorIdLocal, appointmentId: selectedAppointment.appointmentId, message: 'Doctor requests consent to review and share health records for this appointment.' }
                        const res = await fetch(`/api/patients/${encodeURIComponent(patientId)}/consent-requests`, { method: 'POST', headers, body: JSON.stringify(body) })
                        const data = await res.json().catch(() => ({}))
                        if (!res.ok) throw new Error(data?.message || 'Could not send consent request')
                        
                        setConsentRequestObj(data)
                        
                        // Check if consent was already accepted previously
                        if (data?.alreadyAccepted) {
                          setRecordConsentState('accepted')
                        } else {
                          setRecordConsentState('pending')
                        }
                      } catch (err) {
                        setError(err?.message || 'Could not request consent')
                        setRecordConsentState('idle')
                      }
                    }}
                  >
                    Request patient consent
                  </button>
                ) : String(consentRequestObj?.status) === 'accepted' ? (
                  <div style={{ color: '#166534', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>✅</span> Consent granted on {new Date(consentRequestObj?.respondedAt || Date.now()).toLocaleDateString()}
                  </div>
                ) : String(consentRequestObj?.status) === 'rejected' ? (
                  <div style={{ color: '#991b1b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>❌</span> Consent rejected on {new Date(consentRequestObj?.respondedAt || Date.now()).toLocaleDateString()}
                  </div>
                ) : (
                  <div style={{ color: '#b45309', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>⏳</span> Awaiting patient response...
                  </div>
                )}
              </div>

              <div className={styles.modalGrid}>
                <section className={styles.modalSection}>
                  <h3>Patient attachments</h3>
                  {!consentAccepted ? (
                    <p className={styles.emptyState}>Hidden until patient approves sharing.</p>
                  ) : (
                    <div className={styles.modalList}>
                      {visibleAttachments.length === 0 ? (
                        <p className={styles.emptyState}>No approved attachments were shared.</p>
                      ) : (
                        visibleAttachments.map((attachment) => (
                          <article key={attachment._id || attachment.id} className={styles.attachmentItem}>
                            <strong>{attachment.originalName || attachment.purpose || 'Attachment'}</strong>
                            <span>{attachment.mimeType || attachment.resourceType || 'file'}</span>
                            <small>{attachment.uploadedAt ? new Date(attachment.uploadedAt).toLocaleString() : 'Recently uploaded'}</small>
                          </article>
                        ))
                      )}
                    </div>
                  )}
                </section>

                <section className={styles.modalSection}>
                  <h3>Health record preview</h3>
                  {!consentAccepted ? (
                    <p className={styles.emptyState}>Hidden until patient approves sharing.</p>
                  ) : (
                    <div className={styles.modalList}>
                      <article className={styles.previewItem}>
                        <strong>Medical history</strong>
                        <p>{allowedRecordFields.includes("medicalHistory") ? selectedPatientRecord?.medicalHistory || 'No medical history recorded.' : 'Not shared by patient.'}</p>
                      </article>
                      <article className={styles.previewItem}>
                        <strong>Prescriptions</strong>
                        <p>{allowedRecordFields.includes("prescriptions") ? selectedPatientRecord?.prescriptions || 'No prescriptions recorded.' : 'Not shared by patient.'}</p>
                      </article>
                      <article className={styles.previewItem}>
                        <strong>Allergies</strong>
                        <p>{allowedRecordFields.includes("allergies") ? selectedPatientRecord?.allergies || 'No allergies recorded.' : 'Not shared by patient.'}</p>
                      </article>
                      <article className={styles.previewItem}>
                        <strong>Lab results</strong>
                        <p>{allowedRecordFields.includes("labResults") ? (Array.isArray(selectedPatientRecord?.labResults) ? `${selectedPatientRecord.labResults.length} file(s) available` : 'No lab results recorded.') : 'Not shared by patient.'}</p>
                      </article>
                    </div>
                  )}
                </section>
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.secondaryButton} onClick={rejectSharing} disabled={appointmentActionBusy || !consentRequestObj}>
                  Stop sharing
                </button>
                <button type="button" className={styles.primaryButton} onClick={() => setConsentModalOpen(false)} disabled={appointmentActionBusy}>
                  Close
                </button>
              </div>


              {recordConsentState === 'accepted' ? <p className={styles.notice}>Consent granted - records are accessible.</p> : null}
              {recordConsentState === 'rejected' ? <p className={styles.notice}>Sharing stopped - patient records are no longer accessible.</p> : null}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  )
}
