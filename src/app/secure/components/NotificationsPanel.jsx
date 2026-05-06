"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import styles from "../home/home.module.css"

const READ_STORAGE_KEY = "patientNotificationReadIds"

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

function loadReadIds() {
  if (typeof window === "undefined") return new Set()
  const stored = window.localStorage.getItem(READ_STORAGE_KEY)
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

  try {
    window.localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(Array.from(nextIds)))
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
      .filter((request) => request && String(request.status || "").toLowerCase() !== "pending")
      .map((request) => ({
        id: buildEntryId("request", request.id, request.status),
        title: request.status === "accepted" ? "Accepted" : "Updated",
        body: `${request.patientName || "Your request"} — ${request.location || "Unknown"}`,
        at: request.createdAt || request.updatedAt || new Date().toISOString(),
        emergency: request,
        source: "request",
        important: true,
      })),
  ]

  entries.sort((left, right) => new Date(right.at || 0) - new Date(left.at || 0))
  return entries
}

function NotificationCard({ entry, isRead, isExpanded, onToggle, onMarkRead }) {
  const preview = buildEntryPreview(entry)
  const timeLabel = formatNotificationTime(entry.at)
  const badgeLabel = isRead ? "Read" : "New"

  return (
    <article
      className={`${styles.notificationItem} ${isRead ? styles.notificationItemRead : styles.notificationItemUnread} ${entry.important ? styles["notificationItem--important"] : ""}`}
      aria-expanded={isExpanded}
    >
      <button
        type="button"
        className={styles.notificationButton}
        onClick={() => {
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

        <div className={styles.notificationSummary}>
          <span className={styles.notificationSummaryLabel}>Tap to open</span>
        </div>
      </button>

      {isExpanded && (
        <div id={`notif-${entry.id}`} className={styles.notificationDetails}>
          <div className={styles.notificationDetailsTitle}>{preview.provider || "Provider"}</div>
          <div className={styles.notificationDetailsTime}>{timeLabel}</div>
          <div className={styles.notificationDetailsBody}>
            {preview.latestNote ? <p style={{ margin: 0 }}>{preview.latestNote}</p> : preview.latestTimeline ? <p style={{ margin: 0 }}>{preview.latestTimeline}</p> : <p style={{ margin: 0 }}>{entry.body}</p>}
          </div>
          <div className={styles.notificationDetailsActions}>
            <button type="button" onClick={() => onToggle(entry.id)} className={styles.notificationCloseButton}>
              Close
            </button>
          </div>
        </div>
      )}
    </article>
  )
}

export default function NotificationsPanel({ variant = "sidebar" }) {
  const [notifications, setNotifications] = useState([])
  const [items, setItems] = useState([])
  const [readIds, setReadIds] = useState(() => loadReadIds())
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

  useEffect(() => {
    let mounted = true
    const auth = loadPatientProfile() || {}
    const patientPhone = String(auth.patientPhone || "").trim()
    const patientName = [auth.patientFirstName, auth.patientLastName].filter(Boolean).join(" ").trim()

    async function load() {
      try {
        const res = await fetch("/api/emergency", { cache: "no-store" })
        if (!res.ok) return

        const data = await res.json()
        const requests = Array.isArray(data.requests) ? data.requests : []
        const matching = requests.filter((request) => {
          if (!request) return false
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

          if (previousStatus && previousStatus !== nextStatus && (nextStatus === "accepted" || nextStatus === "resolved")) {
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

            if (typeof window !== "undefined" && "Notification" in window && window.Notification.permission === "granted") {
              try {
                new window.Notification("HomeCare: Emergency update", {
                  body: nextStatus === "accepted" ? `${request.respondedBy || "A provider"} accepted your request.` : `Status: ${nextStatus}`,
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
    const interval = setInterval(() => load().catch(() => undefined), 3000)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  const entries = buildNotificationEntries(notifications, items)
  const unreadEntries = entries.filter((entry) => entry.source === "live" && !readIds.has(entry.id))
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
            <p className={styles.notificationPageEyebrow}>Live updates</p>
            <h1>Notifications</h1>
            <p>Track new replies, status changes, and emergency updates in one place.</p>
          </div>
          <div className={styles.notificationPageActions}>
            <button type="button" className={styles.notificationPageAction} onClick={() => markAllAsRead(entries.map((entry) => entry.id))}>
              Mark all read
            </button>
            <Link href="/secure/home" className={styles.notificationPageActionSecondary}>
              Back to home
            </Link>
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
                />
              )
            })
          )}
        </div>
      </section>
    )
  }

  const sidebarSummary = latestEntry
    ? buildEntryPreview(latestEntry).summaryText
    : "You’ll see live updates here when a provider accepts or updates your request."

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
