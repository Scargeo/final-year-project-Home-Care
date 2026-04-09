"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { io } from "socket.io-client"
import "../../../App.css"

function formatTime(value) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      month: "short",
      day: "numeric",
    }).format(new Date(value))
  } catch {
    return String(value || "")
  }
}

function statusCopy(request) {
  if (!request) return { title: "No active request", body: "Press the emergency button to send help immediately." }
  if (request.status === "accepted") {
    return {
      title: "Help is on the way",
      body: `${request.respondedBy || "A provider"} is responding now. Keep your phone nearby for contact or chat.`,
    }
  }
  if (request.status === "pending") {
    return { title: "Emergency sent", body: "Your request has reached available doctors and nurses." }
  }
  return { title: "Request updated", body: "We have recorded the latest emergency status." }
}

export default function EmergencyDashboardPage() {
  const searchParams = useSearchParams()
  const role = (searchParams.get("role") || "patient").toLowerCase()

  const isProvider = role === "provider"
  const [providers, setProviders] = useState([])
  const [queue, setQueue] = useState([])
  const [activeRequest, setActiveRequest] = useState(null)
  const [patientName, setPatientName] = useState("")
  const [patientPhone, setPatientPhone] = useState("")
  const [location, setLocation] = useState("")
  const [address, setAddress] = useState("")
  const [symptoms, setSymptoms] = useState("")
  const [deviceLocationMessage, setDeviceLocationMessage] = useState("")
  const [statusMessage, setStatusMessage] = useState("Ready to send an emergency alert.")
  const [loading, setLoading] = useState(false)
  const [isResolvingLocation, setIsResolvingLocation] = useState(false)
  const [providerPopup, setProviderPopup] = useState(null)
  const [refreshTick, setRefreshTick] = useState(0)
  const seenProviderRequestIds = useRef(new Set())
  const socketRef = useRef(null)

  const title = isProvider ? "Provider Emergency Panel" : "Emergency Help Dashboard"
  const subtitle = isProvider
    ? "See new emergency requests, accept them immediately, and jump into chat or contact."
    : "Send an immediate alert to available doctors and nurses and track the response live."

  const quickNote = useMemo(() => statusCopy(activeRequest), [activeRequest])

  const publicEnv = globalThis.process?.env || {}

  const loadEmergencyData = useCallback(async () => {
    const response = await fetch("/api/emergency", { cache: "no-store" })
    const data = await response.json()
    const nextProviders = Array.isArray(data.providers) ? data.providers : []
    const nextQueue = Array.isArray(data.requests) ? data.requests : []

    setProviders(nextProviders)
    setQueue(nextQueue)

    // Provider gets immediate in-app and browser notification for newly received SOS alerts.
    if (isProvider) {
      const previouslySeen = seenProviderRequestIds.current
      const latestIds = new Set(nextQueue.map((item) => String(item.id || "")))

      if (previouslySeen.size > 0) {
        const newIncomingRequest = nextQueue.find((item) => {
          const id = String(item.id || "")
          return id && !previouslySeen.has(id) && item.status === "pending"
        })

        if (newIncomingRequest) {
          setProviderPopup({
            id: String(newIncomingRequest.id),
            patientName: newIncomingRequest.patientName || "Unknown patient",
            location: newIncomingRequest.location || "Unknown location",
            createdAt: newIncomingRequest.createdAt,
          })

          if (typeof window !== "undefined" && "Notification" in window && window.Notification.permission === "granted") {
            // Browser-level notification helps providers who switched tabs.
            new window.Notification("New SOS alert", {
              body: `${newIncomingRequest.patientName || "A patient"} needs help at ${newIncomingRequest.location || "an unknown location"}.`,
            })
          }
        }
      }

      seenProviderRequestIds.current = latestIds
    }
  }, [isProvider])

  useEffect(() => {
    // Poll lightly so the patient and provider views stay in sync without extra infrastructure.
    loadEmergencyData().catch(() => undefined)
    const interval = setInterval(() => loadEmergencyData().catch(() => undefined), 2500)
    return () => clearInterval(interval)
  }, [refreshTick, isProvider, loadEmergencyData])

  useEffect(() => {
    if (!isProvider) return
    if (typeof window === "undefined") return
    if (!("Notification" in window)) return
    if (window.Notification.permission !== "default") return

    // Ask once so providers can receive popup notifications for new SOS alerts.
    window.Notification.requestPermission().catch(() => undefined)
  }, [isProvider])

  useEffect(() => {
    if (!activeRequest?.id) return

    const timer = setInterval(async () => {
      const response = await fetch(`/api/emergency/${activeRequest.id}`, { cache: "no-store" })
      if (!response.ok) return
      const data = await response.json()
      setActiveRequest(data.emergency || null)
    }, 2500)

    return () => clearInterval(timer)
  }, [activeRequest?.id])

  useEffect(() => {
    if (isProvider) return
    if (!activeRequest) return
    if (activeRequest.status === "accepted") {
      setStatusMessage("Help is on the way / A doctor is responding")
    } else if (activeRequest.status === "pending") {
      setStatusMessage("Emergency sent. Waiting for provider acceptance.")
    }
  }, [activeRequest, isProvider])

  useEffect(() => {
    if (!isProvider) return undefined

    const socketUrl =
      publicEnv.NEXT_PUBLIC_SOS_SOCKET_URL ||
      publicEnv.NEXT_PUBLIC_API_BASE_URL ||
      "http://localhost:8000"

    // Sockets are used here so providers receive SOS alerts instantly instead of waiting for the poll loop.
    const socket = io(socketUrl, {
      transports: ["websocket"],
      withCredentials: true,
    })

    socketRef.current = socket
    socket.emit("join-provider")

    socket.on("sos-created", (payload) => {
      const emergency = payload?.emergency
      if (!emergency?.id) return

      setQueue((current) => {
        const next = [emergency, ...current.filter((item) => item.id !== emergency.id)]
        return next
      })
      setProviderPopup({
        id: emergency.id,
        patientName: emergency.patientName || "Unknown patient",
        location: emergency.location || "Unknown location",
        createdAt: emergency.createdAt,
      })
      setRefreshTick((value) => value + 1)
    })

    socket.on("sos-updated", (payload) => {
      const emergency = payload?.emergency
      if (!emergency?.id) return

      setQueue((current) => current.map((item) => (item.id === emergency.id ? emergency : item)))
      setActiveRequest((current) => (current?.id === emergency.id ? emergency : current))
      setRefreshTick((value) => value + 1)
    })

    return () => {
      socket.off("sos-created")
      socket.off("sos-updated")
      socket.disconnect()
      socketRef.current = null
    }
  }, [isProvider, publicEnv.NEXT_PUBLIC_SOS_SOCKET_URL, publicEnv.NEXT_PUBLIC_API_BASE_URL])

  function resolveDeviceLocation() {
    if (typeof window === "undefined" || !window.navigator?.geolocation) {
      const message = "Location access is not available in this browser."
      setDeviceLocationMessage(message)
      return Promise.resolve({ ok: false, address: "", location: "", message })
    }

    setIsResolvingLocation(true)
    setDeviceLocationMessage("Requesting device location permission...")

    return new Promise((resolve) => {
      window.navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords
          const coordinates = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
          const fallbackLocation = `Device location: ${coordinates}`
          let resolvedAddress = ""

          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`,
              { headers: { Accept: "application/json" } },
            )

            if (response.ok) {
              const data = await response.json()
              resolvedAddress = String(data?.display_name || "").trim()
            }
          } catch {
            resolvedAddress = ""
          }

          const finalAddress = resolvedAddress || fallbackLocation
          const message = resolvedAddress
            ? "Location permission granted. Address filled automatically."
            : "Location permission granted, but address lookup returned coordinates only."

          setLocation(fallbackLocation)
          setAddress(finalAddress)
          setDeviceLocationMessage(message)
          setIsResolvingLocation(false)
          resolve({ ok: true, address: finalAddress, location: fallbackLocation, message })
        },
        () => {
          const message = "Location access was denied. Please type your address if you want to share it."
          setDeviceLocationMessage(message)
          setIsResolvingLocation(false)
          resolve({ ok: false, address: "", location: "", message })
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      )
    })
  }

  async function sendEmergencyAlert() {
    setLoading(true)
    try {
      let nextLocation = String(location || "").trim()
      let nextAddress = String(address || "").trim()

      if (!nextLocation || !nextAddress) {
        const deviceLocation = await resolveDeviceLocation()
        if (deviceLocation.ok) {
          nextLocation = nextLocation || deviceLocation.location
          nextAddress = nextAddress || deviceLocation.address
        }
      }

      if (!nextLocation) {
        setDeviceLocationMessage("Location is required. Please allow location access or enter it manually.")
        setStatusMessage("Cannot send emergency alert without location.")
        return
      }

      const response = await fetch("/api/emergency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName,
          patientPhone,
          location: nextLocation,
          address: nextAddress,
          symptoms,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.message || "Could not send emergency alert")
      }

      // Keep the confirmation explicit so the patient knows the request is active.
      setActiveRequest(data.emergency)
      setStatusMessage("Emergency alert sent to available doctors and nurses.")
      setRefreshTick((value) => value + 1)
    } catch (error) {
      setStatusMessage(error.message || "Failed to send emergency alert.")
    } finally {
      setLoading(false)
    }
  }

  async function acceptRequest(request) {
    const response = await fetch(`/api/emergency/${request.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept", providerName: "Provider Desk" }),
    })

    const data = await response.json()
    if (!response.ok) return

    setStatusMessage(`Accepted request from ${request.patientName}.`)
    setActiveRequest(data.emergency)
    setRefreshTick((value) => value + 1)
  }

  async function startChat(request) {
    // The chat route already exists, so we reuse it as the immediate communication channel.
    const chatUrl = `/secure/chat?roomId=${encodeURIComponent(`emergency-${request.id}`)}&name=${encodeURIComponent(request.patientName)}`
    window.location.href = chatUrl
  }

  async function contactPatient(request) {
    const phone = String(request.patientPhone || "").trim()
    if (!phone) return
    window.location.href = `tel:${phone.replace(/\D/g, "")}`
  }

  const requestTimeline = activeRequest?.timeline || []
  const pendingRequestCount = queue.filter((request) => request.status === "pending").length

  return (
    <div className="hc-page emergency-page">
      <header className="hc-header">
        <div className="hc-container hc-header__inner">
          <Link href="/" className="hc-logo">
            <span className="hc-logo__mark" aria-hidden="true">
              <span style={{ fontSize: 14 }}>+</span>
            </span>
            <span className="hc-logo__text">
              Home Care<span className="hc-logo__plus">+</span>
            </span>
          </Link>

          <nav className="hc-nav" aria-label="Emergency navigation">
            <Link href="/">Home</Link>
            <Link href="/secure/chat">Chat</Link>
            <Link href="/secure/call">Call</Link>
            <Link href={isProvider ? "/secure/emergency?role=patient" : "/secure/emergency?role=provider"} className="hc-btn hc-btn--outline hc-btn--sm">
              {isProvider ? "Patient view" : "Provider view"}
            </Link>
          </nav>
        </div>
      </header>

      {!isProvider ? (
        <Link href="/secure/emergency" className="hc-sos-fab" aria-label="Emergency help dashboard">
          <span className="hc-sos-fab__pulse" aria-hidden="true" />
          <span className="hc-sos-fab__label">SOS</span>
          <span className="hc-sos-fab__sub">Emergency Help</span>
        </Link>
      ) : null}

      {isProvider && providerPopup ? (
        <div className="provider-sos-popup" role="status" aria-live="polite">
          <div className="provider-sos-popup__card">
            <h3>New SOS Alert</h3>
            <p>
              <strong>{providerPopup.patientName}</strong> has sent an SOS request.
            </p>
            <p>{providerPopup.location}</p>
            <div className="provider-sos-popup__actions">
              <button className="hc-btn hc-btn--primary" type="button" onClick={() => setProviderPopup(null)}>
                View queue
              </button>
              <button className="hc-btn hc-btn--outline" type="button" onClick={() => setProviderPopup(null)}>
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <main className="emergency-shell">
        <section className="emergency-hero">
          <div className="hc-container emergency-hero__inner">
            <div>
              <p className="hc-pill">Emergency Response</p>
              <h1>{title}</h1>
              <p className="emergency-hero__copy">{subtitle}</p>
            </div>
            <div className="emergency-hero__status">
              <strong>{quickNote.title}</strong>
              <span>{quickNote.body}</span>
            </div>
          </div>
        </section>

        <section className="hc-container emergency-grid">
          {!isProvider ? (
            <article className="emergency-card emergency-card--urgent">
              <div className="emergency-card__header">
                <div>
                  <p className="hc-section__eyebrow">Patient SOS</p>
                  <h2>🚨 Emergency Help</h2>
                </div>
                <span className="emergency-pill">Instant alert</span>
              </div>

              <div className="emergency-form">
                <label>
                  <span>Patient name</span>
                  <input value={patientName} onChange={(event) => setPatientName(event.target.value)} placeholder="Enter your name" />
                </label>
                <label>
                  <span>Phone number</span>
                  <input value={patientPhone} onChange={(event) => setPatientPhone(event.target.value)} placeholder="(+233) 123-456789" />
                </label>
                <label>
                  <span>Location (required)</span>
                  <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Nearby landmark or GPS pin" required />
                </label>
                <label className="emergency-form__wide">
                  <span>Address / details</span>
                  <textarea value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Where should help reach you?" rows={3} />
                </label>
                <div className="emergency-location-block emergency-form__wide">
                  <button className="emergency-location-btn" type="button" onClick={() => resolveDeviceLocation()} disabled={isResolvingLocation}>
                    {isResolvingLocation ? "Checking device location..." : "Use my device location"}
                  </button>
                  <p>{deviceLocationMessage || "Allow location access and we will fill your address automatically."}</p>
                </div>
                <label className="emergency-form__wide">
                  <span>What is happening?</span>
                  <textarea value={symptoms} onChange={(event) => setSymptoms(event.target.value)} placeholder="Describe the emergency briefly" rows={4} />
                </label>
              </div>

              <button className="emergency-help-btn" type="button" onClick={sendEmergencyAlert} disabled={loading}>
                🚨 Emergency Help
              </button>

              <p className="emergency-note">This sends an immediate alert to available doctors and nurses and starts live status tracking.</p>
            </article>
          ) : null}

          <article className="emergency-card">
            <div className="emergency-card__header">
              <div>
                <p className="hc-section__eyebrow">Status</p>
                <h2>{isProvider ? "Live emergency queue" : "Your request"}</h2>
              </div>
              <span className={`emergency-status ${activeRequest?.status === "accepted" ? "emergency-status--live" : ""}`}>
                {activeRequest?.status || "idle"}
              </span>
            </div>

            {!isProvider ? (
              <>
                <div className="emergency-status-panel">
                  <strong>{statusMessage}</strong>
                  <p>{activeRequest?.patientName ? `Request from ${activeRequest.patientName}` : "No active request yet."}</p>
                </div>

                <div className="emergency-response">
                  <div>
                    <p className="label">Accepted by</p>
                    <strong>{activeRequest?.respondedBy || "Waiting for provider"}</strong>
                  </div>
                  <div>
                    <p className="label">Time</p>
                    <strong>{activeRequest?.createdAt ? formatTime(activeRequest.createdAt) : "--:--"}</strong>
                  </div>
                  <div>
                    <p className="label">Chat room</p>
                    <strong>{activeRequest?.chatRoomId || "Not assigned"}</strong>
                  </div>
                </div>

                {activeRequest?.status === "accepted" ? (
                  <div className="emergency-actions">
                    <Link href={`/secure/chat?roomId=${encodeURIComponent(activeRequest.chatRoomId)}&name=${encodeURIComponent(activeRequest.patientName)}`} className="hc-btn hc-btn--primary">
                      Start chat immediately
                    </Link>
                    {activeRequest.patientPhone ? (
                      <a className="hc-btn hc-btn--outline" href={`tel:${String(activeRequest.patientPhone).replace(/\D/g, "")}`}>
                        Contact patient
                      </a>
                    ) : null}
                  </div>
                ) : null}

                <div className="emergency-timeline">
                  <h3>Alert timeline</h3>
                  {requestTimeline.length > 0 ? (
                    requestTimeline.map((item) => (
                      <div key={`${item.type}-${item.at}`} className="emergency-timeline__item">
                        <span>{item.label}</span>
                        <time>{formatTime(item.at)}</time>
                      </div>
                    ))
                  ) : (
                    <p className="muted">No request timeline yet.</p>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="emergency-status-panel">
                  <strong>Available doctors and nurses receive alerts immediately.</strong>
                  <p>Accept a request to change the patient’s status to “Help is on the way”.</p>
                </div>

                <div className="provider-roster">
                  {providers.map((provider) => (
                    <div key={provider.id} className="provider-chip">
                      <span>{provider.name}</span>
                      <small>{provider.role} · {provider.specialty}</small>
                    </div>
                  ))}
                </div>
              </>
            )}
          </article>

          {isProvider ? (
            <article className="emergency-card emergency-card--queue">
              <div className="emergency-card__header">
                <div>
                  <p className="hc-section__eyebrow">Provider response panel</p>
                  <h2>Emergency requests</h2>
                </div>
                <span className="emergency-pill">{pendingRequestCount} waiting</span>
              </div>

              <div className="queue-list">
                {queue.length > 0 ? (
                  queue.map((request) => (
                    <article key={request.id} className="queue-item">
                      <div className="queue-item__head">
                        <div>
                          <strong>🚨 Emergency Request from {request.patientName}</strong>
                          <p>{request.symptoms}</p>
                        </div>
                        <span className={`emergency-status ${request.status === "accepted" ? "emergency-status--live" : ""}`}>
                          {request.status}
                        </span>
                      </div>

                      <div className="queue-item__meta">
                        <span>Requested: {formatTime(request.createdAt)}</span>
                        {request.location ? <span>Location: {request.location}</span> : null}
                        {request.address ? <span>Address: {request.address}</span> : null}
                      </div>

                      <div className="emergency-actions">
                        <button className="hc-btn hc-btn--primary" type="button" onClick={() => acceptRequest(request)}>
                          Accept request
                        </button>
                        <button className="hc-btn hc-btn--outline" type="button" onClick={() => contactPatient(request)}>
                          Contact patient
                        </button>
                        <button className="hc-btn hc-btn--outline" type="button" onClick={() => startChat(request)}>
                          Start chat immediately
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="muted">No active emergency requests right now.</p>
                )}
              </div>
            </article>
          ) : null}
        </section>
      </main>
    </div>
  )
}
