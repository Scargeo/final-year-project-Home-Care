"use client"

import { useEffect, useRef, useState } from "react"
import { io } from "socket.io-client"
import { useRouter } from 'next/navigation'
import Link from "next/link"
import { getBackendBaseUrl } from "../../../lib/backend-url"
import styles from "../home/home.module.css"

const READ_STORAGE_KEY = "patientNotificationReadIds"
const DOCTOR_READ_STORAGE_KEY = "doctorNotificationReadIds"

function loadPatientProfile() {
  if (typeof window === "undefined") return null
  const stored = window.localStorage.getItem("patientAuth")
  if (!stored) return null

  try {
    return JSON.parse(stored)
  } catch {
    return null
  }
}

function loadDoctorProfile() {
  if (typeof window === "undefined") return null
  const stored = window.localStorage.getItem("doctorAuth")
  if (!stored) return null

  try {
    return JSON.parse(stored)
  } catch {
    return null
  }
}

function getUserType() {
  if (typeof window === "undefined") return null
  const patientAuth = window.localStorage.getItem("patientAuth")
  const doctorAuth = window.localStorage.getItem("doctorAuth")
  if (doctorAuth) return "doctor"
  if (patientAuth) return "patient"
  return null
}

function loadReadIds() {
  if (typeof window === "undefined") return new Set()
  const userType = getUserType()
  const storageKey = userType === "doctor" ? DOCTOR_READ_STORAGE_KEY : READ_STORAGE_KEY
  const stored = window.localStorage.getItem(storageKey)
  if (!stored) return new Set()

  try {
    const parsed = JSON.parse(stored)
    return new Set(Array.isArray(parsed) ? parsed.map((value) => String(value)) : [])
  } catch {
    return new Set()
  }
}

function saveReadIds(nextIds) {
  if (typeof window === "undefined") return
  const userType = getUserType()
  const storageKey = userType === "doctor" ? DOCTOR_READ_STORAGE_KEY : READ_STORAGE_KEY

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(Array.from(nextIds)))
  } catch {
    // ignore storage failures
  }
}

function formatNotificationTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Now"

  const diffMs = Date.now() - date.getTime()
  if (diffMs < 30_000) return "Now"

  const diffMinutes = Math.round(diffMs / 60_000)
  if (diffMinutes < 60) return `${diffMinutes}m ago`

  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function buildEntryId(prefix, id, status) {
  return [prefix, id, status].filter(Boolean).join(":")
}

function buildEntryPreview(entry) {
  const em = entry.emergency || {}
  const provider = String(em.respondedBy || "").trim()
  const latestNote = Array.isArray(em.notes) && em.notes.length > 0 ? em.notes[em.notes.length - 1].label : null
  const latestTimeline = Array.isArray(em.timeline) && em.timeline.length > 0 ? em.timeline[em.timeline.length - 1].label : null
  const summaryText = provider ? latestNote || latestTimeline || entry.body : entry.body
  return {
    provider,
    latestNote,
    latestTimeline,
    summaryText,
  }
}

function canJoinChat(entry) {
  const em = entry?.emergency || {}
  const hasRoom = Boolean(String(em.chatRoomId || "").trim())
  if (!hasRoom) return false

  const timeline = Array.isArray(em.timeline) ? em.timeline : []
  const hasChatStarted = timeline.some((item) => {
    const label = String(item?.label || "").toLowerCase()
    return item?.type === "chat-started" || label.includes("started chat")
  })

  return hasChatStarted
}

function buildChatUrl(entry) {
  const em = entry?.emergency || {}
  const roomId = String(em.chatRoomId || "").trim()
  if (!roomId) return ""
  const providerName = String(em.respondedBy || "").trim()
  const patientName = String(em.patientName || "Your name").trim() || "Your name"
  const nameToUse = providerName || patientName
  return `/secure/chat?roomId=${encodeURIComponent(roomId)}&name=${encodeURIComponent(nameToUse)}`
}

function buildNotificationEntries(notifications, items) {
  const entries = [
    ...notifications.map((notification) => ({
      id: notification.id,
      title: notification.title,
      body: notification.body,
      at: notification.at,
      emergency: notification.emergency,
      source: "live",
      important: true,
    })),
    ...items
      .filter((request) => request)
      .map((request) => ({
        id: buildEntryId("request", request.id, request.status),
        title: String(request.status || "").toLowerCase() === "pending" ? "Pending" : request.status === "accepted" ? "Accepted" : "Updated",
        body:
          String(request.status || "").toLowerCase() === "pending"
            ? `${request.patientName || "Your request"} — ${request.symptoms || "What is happening"}`
            : `${request.patientName || "Your request"} — ${request.location || "Unknown"}`,
        at: request.createdAt || request.updatedAt || new Date().toISOString(),
        emergency: request,
        source: "request",
        important: String(request.status || "").toLowerCase() !== "pending",
      })),
  ]

  entries.sort((left, right) => new Date(right.at || 0) - new Date(left.at || 0))
  return entries
}

function buildAppointmentEntries(appointments) {
  return appointments
    .filter((appointment) => String(appointment?.status || "").toLowerCase() === "cancelled")
    .map((appointment) => ({
      id: buildEntryId("appointment", appointment.appointmentId || appointment._id, appointment.status),
      title: "Appointment cancelled",
      body: `${appointment.doctor?.doctorName || "Your doctor"} cancelled your appointment for ${formatNotificationTime(appointment.appointmentDate)}.`,
      at: appointment.updatedAt || appointment.createdAt || new Date().toISOString(),
      emergency: {
        appointmentId: appointment.appointmentId || appointment._id,
        patientId: appointment.patientId,
        patientName: appointment.patientName,
        patientPhone: appointment.patientPhone,
        appointmentDate: appointment.appointmentDate,
        appointmentTime: appointment.appointmentTime,
        duration: appointment.duration,
        reason: appointment.reason,
        consultationType: appointment.consultationType,
      },
      source: "appointment-cancelled",
      important: true,
    }))
}

function buildPatientNotificationEntries(patientNotifications) {
  return patientNotifications
    .filter(Boolean)
    .map((notification) => ({
      id: notification.notificationId || notification.id || notification._id,
      title: notification.title || "Patient update",
      body: notification.message || notification.body || "You have a new update.",
      at: notification.createdAt || notification.at || new Date().toISOString(),
      emergency: {
        notificationId: notification.notificationId || notification.id || notification._id,
        relatedTo: notification.relatedTo || "",
        actionUrl: notification.actionUrl || "/secure/notifications",
      },
      source: "patient-notification",
      important: ["high", "urgent"].includes(String(notification.priority || "").toLowerCase()),
    }))
}

function NotificationCard({ entry, isRead, isExpanded, onToggle, onMarkRead, userType, onRebooked }) {
  const preview = buildEntryPreview(entry)
  const timeLabel = formatNotificationTime(entry.at)
  const badgeLabel = isRead ? "Read" : "New"
  const joinChatUrl = buildChatUrl(entry)
  const showJoinChat = canJoinChat(entry)
  const router = useRouter()

  async function handleRebookClick() {
    const appointment = entry?.emergency
    if (!appointment?.patientId) return

    try {
      const headers = { "Content-Type": "application/json" }
      const token = typeof window !== "undefined" ? window.localStorage.getItem("patientAuth") : null
      if (token) {
        try {
          const parsed = JSON.parse(token)
          if (parsed?.token || parsed?.accessToken) headers.authorization = `Bearer ${parsed.token || parsed.accessToken}`
        } catch {
          // ignore malformed auth cache
        }
      }

      const response = await fetch(`/api/doctors/auto-assign`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          appointmentId: appointment.appointmentId,
          patientId: appointment.patientId,
          patientName: appointment.patientName,
          patientPhone: appointment.patientPhone || "",
          appointmentDate: appointment.appointmentDate,
          appointmentTime: appointment.appointmentTime,
          duration: appointment.duration || 30,
          reason: appointment.reason || "Rebooked after doctor cancellation.",
          consultationType: appointment.consultationType || "messaging",
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.message || "Could not rebook appointment")
      }

      if (data?.appointmentId || data?._id) {
        onRebooked?.(data)
      }

      onMarkRead(entry.id)
      onToggle(entry.id)
    } catch {
      // keep the notification open if rebook fails
    }
  }

  return (
    <article
      data-notification-item="true"
      className={`${styles.notificationItem} ${isRead ? styles.notificationItemRead : styles.notificationItemUnread} ${entry.important ? styles["notificationItem--important"] : ""}`}
      aria-expanded={isExpanded}
    >
      <button
        type="button"
        className={styles.notificationButton}
        onClick={() => {
          // If doctor clicked and this entry references an appointment, open doctor dashboard and load it
          try {
            if (userType === 'doctor' && entry?.emergency) {
              const apptId = String(entry.emergency.appointmentId || entry.emergency.id || '')
              if (apptId) {
                try { router.push(`/secure/doctor/appointments/${encodeURIComponent(apptId)}`) } catch { router.push('/secure/doctor') }
                return
              }
            }
          } catch {
            // ignore navigation fallback errors
          }

          onMarkRead(entry.id)
          onToggle(entry.id)
        }}
        aria-controls={`notif-${entry.id}`}
      >
        <div className={styles.notificationTopRow}>
          <div className={styles.notificationHeaderCopy}>
            <div className={styles.notificationTitleRow}>
              {!isRead && <span className={styles.notificationUnreadDot} aria-hidden="true" />}
              <div className={styles.notificationTitle}>{preview.provider ? `${preview.provider} — ${entry.title}` : entry.title}</div>
            </div>
            <div className={styles.notificationSubtitle}>{preview.summaryText}</div>
          </div>

          <div className={styles.notificationMetaStack}>
            <div className={styles.notificationTime}>{timeLabel}</div>
            <div className={`${styles.notificationBadge} ${isRead ? styles.notificationBadgeRead : styles.notificationBadgeUnread}`}>{badgeLabel}</div>
          </div>
        </div>

      </button>

      {/* join button moved into the message body below */}

      {isExpanded && (
        <div id={`notif-${entry.id}`} className={styles.notificationDetails}>
          <div className={styles.notificationDetailsTitle}>{preview.provider || "Provider"}</div>
          <div className={styles.notificationDetailsTime}>{timeLabel}</div>
          <div className={styles.notificationDetailsBody}>
            {preview.latestNote ? <p style={{ margin: 0 }}>{preview.latestNote}</p> : preview.latestTimeline ? <p style={{ margin: 0 }}>{preview.latestTimeline}</p> : <p style={{ margin: 0 }}>{entry.body}</p>}
            {entry.source === "appointment-cancelled" ? (
              <div style={{ marginTop: 10 }}>
                <button type="button" className={styles.notificationSmallAction} onClick={handleRebookClick}>
                  Rebook
                </button>
              </div>
            ) : null}
            {showJoinChat ? (
              <div style={{ marginTop: 8 }}>
                <Link href={joinChatUrl} className={styles.notificationSmallAction}>
                  Join chat room
                </Link>
              </div>
            ) : null}
              {entry.source === "patient-notification" && entry.emergency?.actionUrl ? (
                <div style={{ marginTop: 8 }}>
                  <Link href={entry.emergency.actionUrl} className={styles.notificationSmallAction}>
                    View assignment
                  </Link>
                </div>
              ) : null}
          </div>
        </div>
      )}
    </article>
  )
}

export default function NotificationsPanel({ variant = "sidebar" }) {
  const [notifications, setNotifications] = useState([])
  const [items, setItems] = useState([])
  const [appointments, setAppointments] = useState([])
  const [patientNotifications, setPatientNotifications] = useState([])
  const [readIds, setReadIds] = useState(() => new Set())
  const [userType, setUserType] = useState(null)
  const [expanded, setExpanded] = useState(() => new Set())
  const prevStatusRef = useRef(new Map())

  function markAsRead(id) {
    if (!id) return

    setReadIds((current) => {
      if (current.has(id)) return current

      const next = new Set(current)
      next.add(id)
      saveReadIds(next)
      return next
    })
  }

  function markAllAsRead(ids) {
    setReadIds((current) => {
      const next = new Set(current)
      let changed = false

      ids.forEach((id) => {
        if (id && !next.has(id)) {
          next.add(id)
          changed = true
        }
      })

      if (changed) saveReadIds(next)
      return next
    })
  }

  function toggleExpanded(id) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function upsertAppointment(nextAppointment) {
    if (!nextAppointment) return

    setAppointments((current) => {
      const incomingId = String(nextAppointment?.appointmentId || nextAppointment?._id || "")
      if (!incomingId) return current

      const existingIndex = current.findIndex((item) => String(item?.appointmentId || item?._id || "") === incomingId)

      if (existingIndex >= 0) {
        const next = [...current]
        next[existingIndex] = { ...next[existingIndex], ...nextAppointment }
        return next
      }

      return [nextAppointment, ...current]
    })
  }

  useEffect(() => {
    function handleOutsideClick(event) {
      if (event.target.closest('[data-notification-item="true"]')) return
      setExpanded(new Set())
    }

    document.addEventListener("mousedown", handleOutsideClick)
    document.addEventListener("touchstart", handleOutsideClick)

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick)
      document.removeEventListener("touchstart", handleOutsideClick)
    }
  }, [])

  useEffect(() => {
    // Load notification state after hydration so the server and client start from the same HTML.
    const timer = window.setTimeout(() => {
      setReadIds(loadReadIds())
      setUserType(getUserType())
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])

  

  useEffect(() => {
    let mounted = true
    const userType = getUserType()
    const auth = userType === "doctor" ? loadDoctorProfile() : loadPatientProfile() || {}
    const patientPhone = userType === "patient" ? String(auth.patientPhone || "").trim() : ""
    const patientName = userType === "patient" ? [auth.patientFirstName, auth.patientLastName].filter(Boolean).join(" ").trim() : ""
    const patientId = userType === "patient" ? String(auth.patientId || "").trim() : ""
    const socketUrl = getBackendBaseUrl()
    const socket = userType === "patient" && patientId
      ? io(socketUrl, { transports: ["websocket"], withCredentials: true })
      : null

    if (socket && patientId) {
      socket.emit("join-notifications-patient", patientId)
      socket.on("patient-notification-created", (payload) => {
        const notification = payload?.notification
        if (!notification) return
        setPatientNotifications((current) => {
          const next = [notification, ...current].filter(Boolean)
          const seen = new Set()
          return next.filter((item) => {
            const key = String(item.notificationId || item.id || item._id || "")
            if (!key || seen.has(key)) return false
            seen.add(key)
            return true
          }).slice(0, 20)
        })

        try {
          if (typeof window !== "undefined" && "Notification" in window && window.Notification.permission === "granted") {
            new window.Notification(notification.title || "HomeCare update", {
              body: notification.message || "You have a new notification.",
            })
          }
        } catch {
          // ignore browser notification failures
        }
      })
    }

    async function load() {
      try {
          const headers = {}
          try {
            const patientAuth = typeof window !== 'undefined' ? window.localStorage.getItem('patientAuth') : null
            const doctorAuth = typeof window !== 'undefined' ? window.localStorage.getItem('doctorAuth') : null
            const parsed = patientAuth ? JSON.parse(patientAuth) : doctorAuth ? JSON.parse(doctorAuth) : null
            const token = parsed?.token || parsed?.accessToken || null
            if (token) headers.authorization = `Bearer ${token}`
          } catch {
            // ignore
          }
          const res = await fetch("/api/emergency", { cache: "no-store", headers })
        if (!res.ok) return

        const data = await res.json()
        const requests = Array.isArray(data.requests) ? data.requests : []
        
        // Filter requests based on user type
        const matching = requests.filter((request) => {
          if (!request) return false
          
          // For doctors: show all pending requests (not yet accepted by anyone)
          if (userType === "doctor") {
            return String(request.status || "").toLowerCase() === "pending"
          }
          
          // For patients: show requests matching their phone or name
          if (patientPhone && String(request.patientPhone || "").trim() === patientPhone) return true
          if (patientName && String(request.patientName || "").trim() === patientName) return true
          return false
        })

        if (!mounted) return
        setItems(matching)

        const previous = prevStatusRef.current
        const freshNotifications = []

        for (const request of matching) {
          const requestId = String(request.id || "")
          const nextStatus = String(request.status || "pending")
          const previousStatus = previous.get(requestId) || null

          // For doctors: only show new notifications when requests transition from pending to accepted
          // For patients: show notifications when requests transition to accepted or resolved
          if (previousStatus && previousStatus !== nextStatus) {
            if (userType === "doctor" && nextStatus === "accepted") {
              const liveId = buildEntryId("live", requestId, nextStatus)
              freshNotifications.push({
                id: liveId,
                title: "Emergency accepted",
                body: `${request.respondedBy || "A provider"} accepted the request from ${request.patientName || "patient"}.`,
                at: new Date().toISOString(),
                emergency: request,
                source: "live",
                important: true,
              })
            } else if (userType === "patient" && (nextStatus === "accepted" || nextStatus === "resolved")) {
              const liveId = buildEntryId("live", requestId, nextStatus)
              freshNotifications.push({
                id: liveId,
                title: nextStatus === "accepted" ? "Emergency accepted" : "Emergency updated",
                body:
                  nextStatus === "accepted"
                    ? `${request.respondedBy || "A provider"} accepted your request. They'll contact you shortly.`
                    : `Your emergency status is now ${nextStatus}.`,
                at: new Date().toISOString(),
                emergency: request,
                source: "live",
                important: true,
              })
            }

            if (typeof window !== "undefined" && "Notification" in window && window.Notification.permission === "granted") {
              try {
                const notificationTitle = userType === "doctor" ? "HomeCare: New Emergency" : "HomeCare: Emergency update"
                const notificationBody = userType === "doctor" 
                  ? `New emergency request from ${request.patientName || "patient"}`
                  : (nextStatus === "accepted" ? `${request.respondedBy || "A provider"} accepted your request.` : `Status: ${nextStatus}`)
                new window.Notification(notificationTitle, {
                  body: notificationBody,
                })
              } catch {
                // ignore
              }
            }
          }

          previous.set(requestId, nextStatus)
        }

        if (freshNotifications.length > 0) {
          setNotifications((current) => [...freshNotifications, ...current].slice(0, 20))
        }

        if (userType === "patient" && patientId) {
          try {
            const notificationsResponse = await fetch(`/api/patients/${encodeURIComponent(patientId)}/notifications`, {
              cache: "no-store",
              headers,
            })
            const notificationsData = await notificationsResponse.json().catch(() => ({}))
            if (notificationsResponse.ok) {
              const nextPatientNotifications = Array.isArray(notificationsData?.notifications) ? notificationsData.notifications : []
              setPatientNotifications(nextPatientNotifications)
            }

            const appointmentsResponse = await fetch(`/api/patients/${encodeURIComponent(patientId)}/appointments`, {
              cache: "no-store",
              headers,
            })
            const appointmentsData = await appointmentsResponse.json().catch(() => ({}))
            if (appointmentsResponse.ok) {
              const nextAppointments = Array.isArray(appointmentsData?.appointments) ? appointmentsData.appointments : []
              setAppointments(nextAppointments)
            }
          } catch {
            // ignore appointment load failures here
          }
        }
      } catch {
        // ignore
      }
    }

    try {
      if (typeof window !== "undefined" && "Notification" in window && window.Notification.permission === "default") {
        window.Notification.requestPermission().catch(() => undefined)
      }
    } catch {
      // ignore
    }

    load().catch(() => undefined)
    const interval = setInterval(() => load().catch(() => undefined), 12000)

    return () => {
      mounted = false
      clearInterval(interval)
      if (socket) socket.disconnect()
    }
  }, [])

  const entries = buildNotificationEntries(notifications, items)
    .concat(buildPatientNotificationEntries(patientNotifications))
    .concat(buildAppointmentEntries(appointments))
  // Count any unread entry (live updates or request entries, including pending requests)
  const unreadEntries = entries.filter((entry) => !readIds.has(entry.id))
  const unreadCount = unreadEntries.length
  const latestEntry = entries[0] || null

  if (variant === "header") {
    return (
      <Link href="/secure/notifications" className={styles.notificationHeaderButton} aria-label={`Open notifications${unreadCount > 0 ? `, ${unreadCount} new` : ""}`}>
        <span className={styles.notificationHeaderButtonIcon} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 6a4 4 0 0 1 4 4v3l1.5 2H6.5L8 13v-3a4 4 0 0 1 4-4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <path d="M10 17a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
        {unreadCount > 0 ? <span className={styles.notificationHeaderCount}>{unreadCount}</span> : null}
      </Link>
    )
  }

  if (variant === "full") {
    return (
      <section className={styles.notificationPageShell}>
        <div className={styles.notificationPageHeader}>
          <div>
            <h1>Notifications</h1>
            <p>Track new replies, status changes, and emergency updates in one place.</p>
          </div>
          <div className={styles.notificationPageActions}>
            <button type="button" className={styles.notificationPageAction} onClick={() => markAllAsRead(entries.map((entry) => entry.id))}>
              Mark all read
            </button>
          </div>
        </div>

        <div className={styles.notificationsList}>
          {entries.length === 0 ? (
            <article className={styles.notificationItem}>
              <p style={{ margin: 0 }}>No notifications yet.</p>
            </article>
          ) : (
            entries.map((entry) => {
              const isExpanded = expanded.has(entry.id)
              const isRead = readIds.has(entry.id)

              return (
                <NotificationCard
                  key={entry.id}
                  entry={entry}
                  isRead={isRead}
                  isExpanded={isExpanded}
                  onToggle={toggleExpanded}
                  onMarkRead={markAsRead}
                  userType={userType || "patient"}
                  onRebooked={upsertAppointment}
                />
              )
            })
          )}
        </div>
      </section>
    )
  }

  const sidebarSummary = (userType || "patient") === "doctor"
    ? (latestEntry 
      ? `${latestEntry.emergency?.patientName || "Patient"} — ${buildEntryPreview(latestEntry).summaryText}`
      : `${unreadCount} pending emergency request${unreadCount !== 1 ? 's' : ''} waiting for response.`)
    : (latestEntry
    ? buildEntryPreview(latestEntry).summaryText
    : "You'll see live updates here when a provider accepts or updates your request.")

  return (
    <aside className={styles.notificationSidebar}>
      <div className={styles.notificationPanel}>
        <div className={styles.sideHeader}>
          <h3>Notifications</h3>
          <span className={styles.notificationPanelCount}>{unreadCount}</span>
        </div>

        <p className={styles.notificationPanelSummary}>{sidebarSummary}</p>

        <div className={styles.notificationPanelActions}>
          <Link href="/secure/notifications" className={styles.notificationPanelButton}>
            Open notifications
          </Link>
        </div>
      </div>
    </aside>
  )
}
