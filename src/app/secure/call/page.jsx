"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import LoadingCanvas from "../components/LoadingCanvas"
import styles from "./page.module.css"

const DEFAULT_SIGNAL_URL = "ws://localhost:3001"
const DEFAULT_ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }]

function safeParse(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function createWebSocket(url) {
  return new WebSocket(url)
}

function getStoredSession() {
  if (typeof window === "undefined") return null

  try {
    const doctorRaw = window.localStorage.getItem("doctorAuth")
    if (doctorRaw) {
      const doctor = JSON.parse(doctorRaw)
      return {
        role: "doctor",
        id: doctor?.doctorId || doctor?.id || doctor?._id || "",
        firstName: doctor?.doctorFirstName || doctor?.firstName || "",
        lastName: doctor?.doctorLastName || doctor?.lastName || "",
        token: doctor?.token || doctor?.accessToken || "",
      }
    }

    const patientRaw = window.localStorage.getItem("patientAuth")
    if (patientRaw) {
      const patient = JSON.parse(patientRaw)
      return {
        role: "patient",
        id: patient?.patientId || patient?.id || patient?._id || "",
        firstName: patient?.patientFirstName || patient?.firstName || "",
        lastName: patient?.patientLastName || patient?.lastName || "",
        token: patient?.token || patient?.accessToken || "",
      }
    }
  } catch {
    return null
  }

  return null
}

function Icon({ name }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", xmlns: "http://www.w3.org/2000/svg" }

  switch (name) {
    case "mic":
      return (
        <svg {...common} aria-hidden="true" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z" />
          <path d="M19 11a7 7 0 0 1-14 0" />
          <path d="M12 18v3" />
        </svg>
      )
    case "video":
      return (
        <svg {...common} aria-hidden="true" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="6" width="12" height="12" rx="2" />
          <path d="M15 10l6-3v10l-6-3v-4Z" />
        </svg>
      )
    case "screen":
      return (
        <svg {...common} aria-hidden="true" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="12" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      )
    case "phone":
      return (
        <svg {...common} aria-hidden="true" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.11 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.86.3 1.7.54 2.5a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.58-1.58a2 2 0 0 1 2.11-.45c.8.24 1.64.42 2.5.54A2 2 0 0 1 22 16.92Z" />
        </svg>
      )
    case "dots":
      return (
        <svg {...common} aria-hidden="true" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 5h.01" />
          <path d="M12 12h.01" />
          <path d="M12 19h.01" />
        </svg>
      )
    default:
      return null
  }
}

function CallPageContent() {
  const searchParams = useSearchParams()

  const signalUrl = useMemo(() => globalThis?.process?.env?.NEXT_PUBLIC_SIGNAL_URL || DEFAULT_SIGNAL_URL, [])

  const [roomId, setRoomId] = useState(searchParams.get("roomId") || "demo-room")
  const [role, setRole] = useState(searchParams.get("role") || "doctor")
  const [mode, setMode] = useState(searchParams.get("mode") || "video")
  const autoJoin = searchParams.get("autoJoin") === "1"
  const [myPeerId, setMyPeerId] = useState("")
  const [remotePeerId, setRemotePeerId] = useState("")
  const [status, setStatus] = useState("idle")
  const [error, setError] = useState("")
  const [roomActionBusy, setRoomActionBusy] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [videoEnabled, setVideoEnabled] = useState(true)

  const wsRef = useRef(null)
  const pcRef = useRef(null)
  const localStreamRef = useRef(null)
  const remoteStreamRef = useRef(null)

  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)

  const myPeerIdRef = useRef("")
  const remotePeerIdRef = useRef("")
  const roomIdRef = useRef(roomId)
  const pendingIceCandidatesRef = useRef([])
  const sessionRef = useRef(null)

  useEffect(() => {
    roomIdRef.current = roomId
  }, [roomId])

  useEffect(() => {
    sessionRef.current = getStoredSession()
  }, [])

  useEffect(() => {
    if (!remoteStreamRef.current && typeof window !== "undefined" && typeof window.MediaStream !== "undefined") {
      remoteStreamRef.current = new window.MediaStream()
    }
    if (remoteVideoRef.current && remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current
    }
  }, [])

  function getDisplayName() {
    const session = sessionRef.current
    return [session?.firstName, session?.lastName].filter(Boolean).join(" ").trim() || session?.role || "Participant"
  }

  async function cleanup() {
    try {
      if (pcRef.current) {
        pcRef.current.onicecandidate = null
        pcRef.current.ontrack = null
      }
      pcRef.current?.close()
    } catch {
      // ignore
    }
    pcRef.current = null
    pendingIceCandidatesRef.current = []

    try {
      if (localStreamRef.current) {
        for (const track of localStreamRef.current.getTracks()) track.stop()
      }
    } catch {
      // ignore
    }
    localStreamRef.current = null

    try {
      wsRef.current?.close()
    } catch {
      // ignore
    }
    wsRef.current = null

    setStatus("ended")
  }

  function sendJson(payload) {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify(payload))
  }

  function createPeerConnection() {
    const pc = new RTCPeerConnection({ iceServers: DEFAULT_ICE_SERVERS })
    pcRef.current = pc

    pc.onicecandidate = async (event) => {
      if (!event.candidate) return
      const to = remotePeerIdRef.current
      if (!to) return
      sendJson({ type: "ice", roomId: roomIdRef.current, from: myPeerIdRef.current, to, candidate: event.candidate.toJSON() })
    }

    pc.ontrack = (event) => {
      const [stream] = event.streams
      if (stream) {
        remoteStreamRef.current = stream
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStreamRef.current
      } else {
        if (!remoteStreamRef.current && typeof window !== "undefined" && typeof window.MediaStream !== "undefined") {
          remoteStreamRef.current = new window.MediaStream()
        }
        if (!remoteStreamRef.current) return
        remoteStreamRef.current.addTrack(event.track)
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStreamRef.current
      }
      setStatus("in_call")
    }

    return pc
  }

  async function flushPendingIce() {
    const pc = pcRef.current
    if (!pc || !pc.remoteDescription) return

    const queue = pendingIceCandidatesRef.current
    pendingIceCandidatesRef.current = []
    for (const cand of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand))
      } catch {
        // best-effort
      }
    }
  }

  async function makeOffer() {
    const pc = pcRef.current
    if (!pc) return
    setStatus("connecting")

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    sendJson({ type: "offer", roomId: roomIdRef.current, from: myPeerIdRef.current, to: remotePeerIdRef.current, sdp: pc.localDescription })
  }

  async function handleOffer(msg) {
    const pc = pcRef.current
    if (!pc) return
    setStatus("connecting")

    if (!remotePeerIdRef.current && msg.from) {
      remotePeerIdRef.current = String(msg.from)
      setRemotePeerId(remotePeerIdRef.current)
    }

    await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    sendJson({ type: "answer", roomId: roomIdRef.current, from: myPeerIdRef.current, to: msg.from, sdp: pc.localDescription })
    await flushPendingIce()
  }

  async function handleAnswer(msg) {
    const pc = pcRef.current
    if (!pc) return
    if (!remotePeerIdRef.current && msg.from) {
      remotePeerIdRef.current = String(msg.from)
      setRemotePeerId(remotePeerIdRef.current)
    }
    await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
    await flushPendingIce()
  }

  async function handleIce(msg) {
    const pc = pcRef.current
    if (!pc) return
    const cand = msg.candidate
    if (!cand) return

    if (!pc.remoteDescription) {
      pendingIceCandidatesRef.current.push(cand)
      return
    }

    await pc.addIceCandidate(new RTCIceCandidate(cand))
  }

  async function startCall() {
    setError("")
    setStatus("idle")

    await cleanup()

    const id = crypto.randomUUID()
    myPeerIdRef.current = id
    remotePeerIdRef.current = ""
    setMyPeerId(id)
    setRemotePeerId("")
    setStatus("connecting")

    const pc = createPeerConnection()
    pendingIceCandidatesRef.current = []

    const localStream = await navigator.mediaDevices.getUserMedia({ video: mode === "video", audio: true })
    localStreamRef.current = localStream
    localStream.getTracks().forEach((t) => pc.addTrack(t, localStream))
    setAudioEnabled(true)
    setVideoEnabled(mode === "video")

    if (localVideoRef.current) localVideoRef.current.srcObject = localStream

    const ws = createWebSocket(signalUrl)
    wsRef.current = ws

    ws.onopen = () => {
      sendJson({ type: "join", roomId: roomIdRef.current, peerId: myPeerIdRef.current, role })
    }

    ws.onmessage = async (evt) => {
      const msg = safeParse(evt.data)
      if (!msg?.type) return

      if (msg.type === "waiting") {
        setStatus("waiting")
        return
      }

      if (msg.type === "match") {
        const other = String(msg.peerId || "")
        if (!other) return
        remotePeerIdRef.current = other
        setRemotePeerId(other)

        if (myPeerIdRef.current < other) await makeOffer()
        return
      }

      if (msg.type === "offer") return await handleOffer(msg)
      if (msg.type === "answer") return await handleAnswer(msg)
      if (msg.type === "ice") return await handleIce(msg)
    }

    ws.onerror = () => setError("WebSocket error. Check the signaling server URL.")
  }

  useEffect(() => {
    if (!autoJoin || status !== "idle") return
    startCall().catch((err) => setError(err?.message || "Could not join the call automatically."))
  }, [autoJoin, status])

  useEffect(() => {
    let active = true

    async function refreshRoomStatus() {
      if (!roomIdRef.current) return

      try {
        const headers = {}
        const session = getStoredSession()
        if (session?.token) headers.authorization = `Bearer ${session.token}`

        const response = await fetch(`/api/rooms/${encodeURIComponent(roomIdRef.current)}`, {
          method: "GET",
          cache: "no-store",
          headers,
        })

        const data = await response.json().catch(() => ({}))
        if (!response.ok || !active) return

        const roomStatus = String(data?.room?.status || "").toLowerCase()
        if (roomStatus === "completed" || roomStatus === "cancelled") {
          await cleanup()
          setError("This room has ended.")
          window.location.href = role === "doctor" ? "/secure/doctor" : "/secure/appointments"
        }
      } catch {
        // best-effort only
      }
    }

    refreshRoomStatus()
    const timer = setInterval(refreshRoomStatus, 5000)

    return () => {
      active = false
      clearInterval(timer)
    }
  }, [role])

  function toggleTrack(kind) {
    const stream = localStreamRef.current
    if (!stream) return

    const track = kind === "audio" ? stream.getAudioTracks()[0] : stream.getVideoTracks()[0]
    if (!track) return

    track.enabled = !track.enabled
    if (kind === "audio") setAudioEnabled(track.enabled)
    if (kind === "video") setVideoEnabled(track.enabled)
  }

  async function endCall() {
    setRoomActionBusy(true)

    try {
      if (role === "doctor") {
        const headers = { "Content-Type": "application/json" }
        const session = getStoredSession()
        if (session?.token) headers.authorization = `Bearer ${session.token}`

        await fetch(`/api/rooms/${encodeURIComponent(roomIdRef.current)}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ participantAction: "end", role: "doctor" }),
        })
      }
    } catch {
      // best-effort
    }

    await cleanup()
    setMyPeerId("")
    setRemotePeerId("")
    setRoomActionBusy(false)
    window.location.href = role === "doctor" ? "/secure/doctor" : "/secure/appointments"
  }

  function getJoinCopy() {
    if (status === "waiting") return "Waiting for the other person"
    if (status === "connecting") return "Connecting to the meeting"
    if (status === "in_call") return "You are in the meeting"
    if (autoJoin) return "Joining the approved meeting"
    return "Ready to join"
  }

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <div className={styles.topBar__brand}>
          <div className={styles.logoMark}>
            <span />
          </div>
          <div>
            <div className={styles.topBar__title}>Home Care Meet</div>
            <div className={styles.topBar__subtitle}>Room {roomId} · {role}</div>
          </div>
        </div>

        <div className={styles.topBar__badge}>{mode === "video" ? "Video call" : "Voice call"}</div>
      </header>

      <main className={styles.meetingShell}>
        <section className={styles.stage}>
          <div className={styles.videoFrame}>
            <video ref={remoteVideoRef} autoPlay playsInline className={styles.remoteVideo} />

            {status !== "in_call" ? (
              <div className={styles.joinOverlay}>
                <div className={styles.joinOverlay__card}>
                  <p>{getJoinCopy()}</p>
                  <h1>{getDisplayName()}</h1>
                  <span>{roomId}</span>
                  {!autoJoin ? (
                    <button className={styles.joinButton} onClick={() => startCall().catch((err) => setError(err?.message || "Could not join the call."))}>
                      Join meeting
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className={styles.selfViewCard}>
              <video ref={localVideoRef} autoPlay playsInline muted className={styles.selfVideo} />
              <div className={styles.selfViewCard__label}>{getDisplayName()}</div>
            </div>
          </div>

          <div className={styles.controlDock}>
            <button className={styles.controlButton} onClick={() => toggleTrack("audio")} disabled={!localStreamRef.current}>
              <Icon name="mic" />
              <span>{audioEnabled ? "Mute" : "Unmute"}</span>
            </button>
            <button className={styles.controlButton} onClick={() => toggleTrack("video")} disabled={mode !== "video" || !localStreamRef.current}>
              <Icon name="video" />
              <span>{videoEnabled ? "Stop video" : "Start video"}</span>
            </button>
            <button className={styles.controlButton} onClick={() => sendJson({ type: "join", roomId: roomIdRef.current, peerId: myPeerIdRef.current, role })} disabled={!myPeerIdRef.current}>
              <Icon name="dots" />
              <span>Reconnect</span>
            </button>
            <button className={styles.controlButton} onClick={() => navigator.clipboard?.writeText(window.location.href)}>
              <Icon name="screen" />
              <span>Copy link</span>
            </button>
            <button className={`${styles.controlButton} ${styles.controlButtonDanger}`} onClick={endCall} disabled={status === "idle" || status === "ended" || roomActionBusy}>
              <Icon name="phone" />
              <span>{role === "doctor" ? (roomActionBusy ? "Ending..." : "End room") : "Leave"}</span>
            </button>
          </div>
        </section>

        <aside className={styles.sideRail}>
          <div className={styles.sideCard}>
            <h2>Meeting</h2>
            <div className={styles.metaRow}><span>Status</span><strong>{status}</strong></div>
            <div className={styles.metaRow}><span>Room</span><strong>{roomId}</strong></div>
            <div className={styles.metaRow}><span>Mode</span><strong>{mode}</strong></div>
          </div>

          <div className={styles.sideCard}>
            <h2>Participants</h2>
            <div className={styles.participantItem}><span>You</span><strong>{myPeerId ? myPeerId.slice(0, 8) : "Joining"}</strong></div>
            <div className={styles.participantItem}><span>Peer</span><strong>{remotePeerId ? remotePeerId.slice(0, 8) : "Waiting"}</strong></div>
          </div>

          <div className={styles.sideCard}>
            <h2>Notes</h2>
            <p>The approved room link auto-starts this call. Doctor ends the room for both sides; patient can only leave locally.</p>
            {error ? <div className={styles.errorBox}>{error}</div> : null}
          </div>
        </aside>
      </main>
    </div>
  )
}

export default function CallPage() {
  return (
    <Suspense fallback={<LoadingCanvas />}>
      <CallPageContent />
    </Suspense>
  )
}

