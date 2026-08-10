"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Suspense } from "react"
import { io } from "socket.io-client"
import { getBackendBaseUrl } from "../../../lib/backend-url"
import LoadingCanvas from "../components/LoadingCanvas"
import MapView from "../nurse/MapView"

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

// SOS alerts expire after 24 hours. Once expired, all request actions are disabled.
const SOS_EXPIRY_MS = 24 * 60 * 60 * 1000

function isRequestExpired(request) {
  if (!request?.createdAt) return false
  const created = new Date(request.createdAt).getTime()
  if (Number.isNaN(created)) return false
  return Date.now() - created > SOS_EXPIRY_MS
}

function EmergencyDashboardContent() {
  const [userRole, setUserRole] = useState(null)
  const isProvider = userRole === "doctor" || userRole === "nurse"
  const [providers, setProviders] = useState([])
  const [queue, setQueue] = useState([])
  const [activeRequest, setActiveRequest] = useState(null)
  const [patientName, setPatientName] = useState("")
  const [patientPhone, setPatientPhone] = useState("")
  const [location, setLocation] = useState("")
  const [address, setAddress] = useState("")
  const [locationCoords, setLocationCoords] = useState(null)
  const [symptoms, setSymptoms] = useState("")
  const [deviceLocationMessage, setDeviceLocationMessage] = useState("")
  const [statusMessage, setStatusMessage] = useState("Ready to send an emergency alert.")
  const [loading, setLoading] = useState(false)
  const [isResolvingLocation, setIsResolvingLocation] = useState(false)
  const [providerPopup, setProviderPopup] = useState(null)
  const [refreshTick, setRefreshTick] = useState(0)
const [providerJoinedChat, setProviderJoinedChat] = useState(false)
  const [providerJoinInfo, setProviderJoinInfo] = useState(null)
  const [incomingCall, setIncomingCall] = useState(null)
  const ringAudioRef = useRef(null)
  const seenProviderRequestIds = useRef(new Set())
  const socketRef = useRef(null)

useEffect(() => {
    if (typeof window === "undefined") return

    const doctorAuthStr = window.localStorage.getItem("doctorAuth")
    if (doctorAuthStr) {
      setUserRole("doctor")
      return
    }

    const nurseAuthStr = window.localStorage.getItem("nurseAuth")
    if (nurseAuthStr) {
      setUserRole("nurse")
      return
    }

    const patientAuthStr = window.localStorage.getItem("patientAuth")
    if (patientAuthStr) {
      setUserRole("patient")
      return
    }

    setUserRole("patient")
  }, [])

  function loadPatientProfile() {
    if (typeof window === "undefined") return null

    const storedAuth = window.localStorage.getItem("patientAuth")
    if (!storedAuth) return null

    try {
      return JSON.parse(storedAuth)
    } catch {
      return null
    }
  }

  useEffect(() => {
    if (userRole !== "patient") return
    const auth = loadPatientProfile()
    if (!auth) return

    const nextPatientName = [auth.patientFirstName, auth.patientLastName].filter(Boolean).join(" ").trim()
    setPatientName((current) => current || nextPatientName || auth.patientFirstName || "")
    setPatientPhone((current) => current || auth.patientPhone || "")
    setAddress((current) => current || auth.patientAddress || "")
  }, [userRole])

  const title = isProvider ? "Provider Emergency Panel" : "Emergency Help Dashboard"
  const subtitle = isProvider
    ? "See new emergency requests, accept them immediately, and jump into chat or contact."
    : "Send an immediate alert to available doctors and nurses and track the response live."

  const quickNote = useMemo(() => statusCopy(activeRequest), [activeRequest])

  const publicEnv = globalThis.process?.env || {}
  const backendBaseUrl = getBackendBaseUrl()

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
    const interval = setInterval(() => loadEmergencyData().catch(() => undefined), 10000)
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
    }, 10000)

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
    const socketUrl =
      publicEnv.NEXT_PUBLIC_SOS_SOCKET_URL ||
      publicEnv.NEXT_PUBLIC_API_BASE_URL ||
      backendBaseUrl

    // Sockets are used so providers and patients receive real-time updates
    const socket = io(socketUrl, {
      transports: ["websocket"],
      withCredentials: true,
    })

    socketRef.current = socket

    if (isProvider) {
      socket.emit("join-provider")
    } else if (activeRequest?.chatRoomId) {
      // Patient joins their emergency chat room
      socket.emit("join-sos-room", activeRequest.chatRoomId)
    }

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

socket.on("provider-joined-chat", (payload) => {
      if (!isProvider) {
        // Patient receives notification that provider joined and payload contains room info
        setProviderJoinInfo(payload || null)
        setProviderJoinedChat(true)
        // Auto-dismiss notification after 5 seconds and clear saved join info
        setTimeout(() => {
          setProviderJoinedChat(false)
          setProviderJoinInfo(null)
        }, 5000)
      }
    })

    socket.on("provider-calling", (payload) => {
      if (isProvider) return
      // Patient's app rings when a provider requests a voice call.
      setIncomingCall({
        roomId: payload?.chatRoomId || activeRequest?.chatRoomId || (activeRequest ? `emergency-${activeRequest.id}` : ""),
        providerName: payload?.providerName || activeRequest?.respondedBy || "Your provider",
      })
      playRingTone()
    })

    return () => {
      socket.off("sos-created")
      socket.off("sos-updated")
      socket.off("provider-joined-chat")
      socket.off("provider-calling")
      stopRingTone()
      socket.disconnect()
      socketRef.current = null
    }
  }, [isProvider, publicEnv.NEXT_PUBLIC_SOS_SOCKET_URL, publicEnv.NEXT_PUBLIC_API_BASE_URL, backendBaseUrl, activeRequest?.chatRoomId])

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
          setLocationCoords({ lat: latitude, lng: longitude })
          setDeviceLocationMessage(message)
          setIsResolvingLocation(false)
          resolve({ ok: true, address: finalAddress, location: fallbackLocation, coords: { lat: latitude, lng: longitude }, message })
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
      let nextCoords = locationCoords

      if (!nextLocation || !nextAddress) {
        const deviceLocation = await resolveDeviceLocation()
        if (deviceLocation.ok) {
          nextLocation = nextLocation || deviceLocation.location
          nextAddress = nextAddress || deviceLocation.address
          nextCoords = nextCoords || deviceLocation.coords || null
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
          locationCoords: nextCoords,
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
// Reset the form fields the patient filled (keep name/phone from profile)
      setLocation("")
      setAddress("")
      setLocationCoords(null)
      setSymptoms("")
    } catch (error) {
      setStatusMessage(error.message || "Failed to send emergency alert.")
    } finally {
      setLoading(false)
    }
  }

// Resolve the authenticated provider (doctor or nurse) token + display name.
  function getProviderAuth() {
    const storedName = "Available provider"
    let token = undefined
    let name = storedName

    if (typeof window === "undefined") return { token, name }

    // Prefer doctor auth, then nurse auth (whichever the user is logged in as).
    const authStr = window.localStorage.getItem(userRole === "nurse" ? "nurseAuth" : "doctorAuth")
    if (authStr) {
      try {
        const auth = JSON.parse(authStr)
        token = auth?.token || auth?.accessToken || undefined
        const firstName = String(auth?.nurseFirstName || auth?.doctorFirstName || auth?.firstName || "").trim()
        const lastName = String(auth?.nurseLastName || auth?.doctorLastName || auth?.lastName || "").trim()
        name = [firstName, lastName].filter(Boolean).join(" ").trim() || storedName
      } catch {
        // Ignore parse errors
      }
    }

    return { token, name }
  }

  async function acceptRequest(request) {
    const { token, name } = getProviderAuth()
    const headers = { "Content-Type": "application/json" }
    if (token) headers["Authorization"] = `Bearer ${token}`

    const response = await fetch(`/api/emergency/${request.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ action: "accept", providerName: name }),
    })

    const data = await response.json()
    if (!response.ok) {
      console.error("Accept request failed:", data?.message || "Unknown error")
      return
    }

    setStatusMessage(`Accepted request from ${request.patientName}.`)
    setActiveRequest(data.emergency)
    setRefreshTick((value) => value + 1)
  }

  async function startChat(request) {
    const { token, name } = getProviderAuth()
    const providerName = request.respondedBy || name
    const headers = { "Content-Type": "application/json" }
    if (token) headers["Authorization"] = `Bearer ${token}`

    const response = await fetch(`/api/emergency/${request.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ action: "chat", providerName }),
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      console.error("Start chat failed:", data?.message || "Unknown error")
    }

    const chatUrl = `/secure/chat?roomId=${encodeURIComponent(`emergency-${request.id}`)}&name=${encodeURIComponent(request.patientName)}`
    window.location.href = chatUrl
  }

async function contactPatient(request) {
    const { token, name } = getProviderAuth()
    const providerName = request.respondedBy || name
    const headers = { "Content-Type": "application/json" }
    if (token) headers["Authorization"] = `Bearer ${token}`

    // Notify the patient's app so it rings, then open the voice call link.
    try {
      await fetch(`/api/emergency/${request.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ action: "call", providerName }),
      })
    } catch {
      // Best-effort: still open the call even if the ring notification fails.
    }

const roomId = request.chatRoomId || `emergency-${request.id}`
    const callUrl = `/secure/call?roomId=${encodeURIComponent(roomId)}&role=${encodeURIComponent(userRole)}&mode=voice&autoJoin=1`
    window.location.href = callUrl
  }

  function playRingTone() {
    if (typeof window === "undefined") return
    try {
      if (!ringAudioRef.current) {
        // Generate a simple ring tone using the Web Audio API to avoid asset dependencies.
        const AudioContextCtor = window.AudioContext || window.webkitAudioContext
        if (!AudioContextCtor) return
        const context = ringAudioRef.current?.context || new AudioContextCtor()
        const gain = context.createGain()
        gain.gain.value = 0.12
        gain.connect(context.destination)

        const oscillator = context.createOscillator()
        oscillator.type = "sine"
        oscillator.frequency.value = 900
        oscillator.gain = gain
        oscillator.start()

        ringAudioRef.current = {
          context,
          oscillator,
          gain,
          startedAt: Date.now(),
          timer: setInterval(() => {
            // Pulse the ring tone every ~1.2s to mimic a phone ring.
            const elapsed = Date.now() - (ringAudioRef.current?.startedAt || Date.now())
            const on = Math.floor(elapsed / 1200) % 2 === 0
            try {
              gain.gain.setTargetAtTime(on ? 0.12 : 0, context.currentTime, 0.05)
            } catch {
              // ignore
            }
          }, 200),
        }
      }
    } catch {
      // Ringtones are best-effort; the visual ring UI still works without audio.
    }
  }

  function stopRingTone() {
    if (!ringAudioRef.current) return
    try {
      clearInterval(ringAudioRef.current.timer)
      ringAudioRef.current.oscillator?.stop()
      ringAudioRef.current.oscillator?.disconnect()
      ringAudioRef.current.gain?.disconnect()
      ringAudioRef.current.context?.close?.()
    } catch {
      // ignore
    }
    ringAudioRef.current = null
  }

  function acceptIncomingCall() {
    if (!incomingCall?.roomId) return
    stopRingTone()
    const callUrl = `/secure/call?roomId=${encodeURIComponent(incomingCall.roomId)}&role=patient&mode=voice&autoJoin=1`
    window.location.href = callUrl
  }

  function dismissIncomingCall() {
    stopRingTone()
    setIncomingCall(null)
  }

const requestTimeline = activeRequest?.timeline || []
  const pendingRequestCount = queue.filter((request) => request.status === "pending").length
  // Who is the signed-in provider (used to grant exclusive access to the requester that accepted).
  const currentProviderName = getProviderAuth().name

  if (!userRole) {
    return <LoadingCanvas />
  }

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

          <div className="hc-header__actions">
            <Link href="/secure/home" className="hc-btn hc-btn--outline hc-btn--sm hc-home-header">
              Home
            </Link>
          </div>

<nav className="hc-nav" aria-label="Emergency navigation">
            <Link href="/secure/home">Home</Link>
            <span className="hc-btn hc-btn--outline hc-btn--sm" aria-label="Current emergency view role">
              {isProvider ? "Provider view" : "Patient view"}
            </span>
          </nav>
        </div>
      </header>

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

{!isProvider && providerJoinedChat ? (
        <div className="provider-sos-popup" role="status" aria-live="polite" style={{ backgroundColor: "#10b981" }}>
          <div className="provider-sos-popup__card" style={{ textAlign: "center" }}>
            <h3 style={{ color: "#fff", marginBottom: "0.5rem" }}>✓ {providerJoinInfo?.providerName || activeRequest?.respondedBy || "Doctor"} has joined the chat room!</h3>
            <p style={{ color: "#f0fdf4", marginBottom: "1rem" }}>
              {activeRequest?.respondedBy || providerJoinInfo?.providerName || "Your provider"} is now online and ready to assist.
            </p>
            <div style={{ marginTop: "0.5rem" }}>
              <Link href={`/secure/chat?roomId=${encodeURIComponent(providerJoinInfo?.chatRoomId || activeRequest?.chatRoomId || (activeRequest ? `emergency-${activeRequest.id}` : ""))}&name=${encodeURIComponent(activeRequest?.patientName || patientName)}`} className="hc-btn hc-btn--primary">
                Join chat
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {!isProvider && incomingCall ? (
        <div className="provider-sos-popup" role="dialog" aria-live="assertive" style={{ zIndex: 50 }}>
          <div className="provider-sos-popup__card" style={{ textAlign: "center", borderColor: "rgba(6, 182, 212, 0.4)" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📞</div>
            <h3 style={{ marginBottom: "0.35rem" }}>Incoming call</h3>
            <p style={{ fontWeight: 800, color: "#0e7490" }}>{incomingCall.providerName}</p>
            <p style={{ marginTop: "0.2rem" }}>A provider is calling you about your emergency.</p>
            <div className="provider-sos-popup__actions" style={{ justifyContent: "center" }}>
              <button className="hc-btn hc-btn--primary" type="button" onClick={acceptIncomingCall}>
                Accept call
              </button>
              <button className="hc-btn hc-btn--outline" type="button" onClick={dismissIncomingCall}>
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
                {locationCoords ? (
                  <div className="emergency-map-block emergency-form__wide" style={{ marginTop: "0.75rem" }}>
                    <MapView locationCoords={locationCoords} address={address} locationLabel={location} />
                  </div>
                ) : null}
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
                {activeRequest ? (
                  <>
                    <div className="emergency-status-panel">
                      <strong>{statusMessage}</strong>
                      <p>Your SOS alert status</p>
                    </div>

                    <div className="emergency-response">
                      <div>
                        <p className="label">🚨 Request Status</p>
                        <strong style={{ textTransform: "capitalize", color: activeRequest.status === "accepted" ? "#10b981" : "#f97316" }}>
                          {activeRequest.status}
                        </strong>
                      </div>
                      <div>
                        <p className="label">Accepting Provider</p>
                        <strong>{activeRequest.respondedBy ? `✓ ${activeRequest.respondedBy}` : "⏳ Waiting for provider"}</strong>
                      </div>
                      <div>
                        <p className="label">Request Time</p>
                        <strong>{activeRequest.createdAt ? formatTime(activeRequest.createdAt) : "--:--"}</strong>
                      </div>
                      {activeRequest.acceptedAt ? (
                        <div>
                          <p className="label">Accepted At</p>
                          <strong>{formatTime(activeRequest.acceptedAt)}</strong>
                        </div>
                      ) : null}
                      <div>
                        <p className="label">Chat Room</p>
                        <strong className="emergency-chat-room-id">
                          {activeRequest.chatRoomId ? `#${String(activeRequest.chatRoomId).split('-').pop()}` : "Not assigned"}
                        </strong>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="emergency-status-panel">
                    <strong>No active emergency request</strong>
                    <p>Click the emergency button above to send a help alert to available doctors and nurses.</p>
                  </div>
                )}

{activeRequest?.status === "accepted" ? (
                  <div className="emergency-actions">
                    <Link
                      href={`/secure/chat?roomId=${encodeURIComponent(activeRequest.chatRoomId)}&name=${encodeURIComponent(activeRequest.respondedBy || "Provider")}`}
                      className="hc-btn hc-btn--primary"
                      style={isRequestExpired(activeRequest) ? { opacity: 0.4, pointerEvents: "none" } : undefined}
                    >
                      {isRequestExpired(activeRequest) ? "Expired" : `🗨️ Open chat with ${activeRequest.respondedBy || "provider"}`}
                    </Link>
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

                      {request.locationCoords && Number.isFinite(Number(request.locationCoords.lat)) && Number.isFinite(Number(request.locationCoords.lng)) ? (
                        <div style={{ marginTop: "0.75rem" }}>
                          <MapView
                            locationCoords={{ lat: Number(request.locationCoords.lat), lng: Number(request.locationCoords.lng) }}
                            address={request.address}
                            locationLabel={request.location}
                          />
                        </div>
                      ) : null}

{(() => {
                        const expired = isRequestExpired(request)
                        const isAccepted = request.status === "accepted"
                        // Only the provider who accepted may contact/chat; otherwise all actions are hidden.
                        const isOwner = isAccepted && request.respondedBy && request.respondedBy === currentProviderName
                        const canAccept = !expired && !isAccepted
                        const canCommunicate = !expired && isOwner
                        return (
                          <div className="emergency-actions">
                            <button className="hc-btn hc-btn--primary" type="button" disabled={!canAccept} onClick={() => canAccept && acceptRequest(request)} style={{ opacity: canAccept ? 1 : 0.4, pointerEvents: canAccept ? "auto" : "none" }}>
                              {expired ? "Expired" : isAccepted && !isOwner ? "Claimed" : "Accept request"}
                            </button>
                            <button className="hc-btn hc-btn--outline" type="button" disabled={!canCommunicate} onClick={() => canCommunicate && contactPatient(request)} style={{ opacity: canCommunicate ? 1 : 0.4, pointerEvents: canCommunicate ? "auto" : "none" }}>
                              Contact patient
                            </button>
                            <button className="hc-btn hc-btn--outline" type="button" disabled={!canCommunicate} onClick={() => canCommunicate && startChat(request)} style={{ opacity: canCommunicate ? 1 : 0.4, pointerEvents: canCommunicate ? "auto" : "none" }}>
                              Start chat immediately
                            </button>
                          </div>
                        )
                      })()}
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

export default function EmergencyDashboardPage() {
  return (
    <Suspense fallback={<LoadingCanvas />}>
      <EmergencyDashboardContent />
    </Suspense>
  )
}
