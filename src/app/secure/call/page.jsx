"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"

const DEFAULT_SIGNAL_URL = "ws://localhost:3002"
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

export default function CallPage() {
  const searchParams = useSearchParams()

  const signalUrl = useMemo(() => globalThis?.process?.env?.NEXT_PUBLIC_SIGNAL_URL || DEFAULT_SIGNAL_URL, [])

  const [roomId, setRoomId] = useState(searchParams.get("roomId") || "demo-room")
  const [role, setRole] = useState(searchParams.get("role") || "doctor")
  const [mode, setMode] = useState(searchParams.get("mode") || "video") // 'audio' | 'video'
  const [myPeerId, setMyPeerId] = useState("")
  const [remotePeerId, setRemotePeerId] = useState("")
  const [status, setStatus] = useState("idle") // idle | waiting | connecting | in_call | ended | error
  const [error, setError] = useState("")

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

  useEffect(() => {
    roomIdRef.current = roomId
  }, [roomId])

  useEffect(() => {
    // MediaStream exists only in the browser runtime.
    if (!remoteStreamRef.current && typeof window !== "undefined" && typeof window.MediaStream !== "undefined") {
      remoteStreamRef.current = new window.MediaStream()
    }
    if (remoteVideoRef.current && remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current
    }
  }, [])

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

  async function endCall() {
    await cleanup()
    setMyPeerId("")
    setRemotePeerId("")
  }

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      <h2 style={{ marginTop: 0 }}>Secure Video Call</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 900 }}>
        <div style={{ padding: 12, border: "1px solid #e5e7eb", borderRadius: 12 }}>
          <div style={{ marginBottom: 8 }}>
            <label>
              Room ID
              <div>
                <input value={roomId} onChange={(e) => setRoomId(e.target.value)} style={{ width: "100%", padding: 8, marginTop: 4 }} />
              </div>
            </label>
          </div>

          <div style={{ marginBottom: 8 }}>
            <label>
              I am
              <div>
                <select value={role} onChange={(e) => setRole(e.target.value)} style={{ width: "100%", padding: 8, marginTop: 4 }}>
                  <option value="doctor">Doctor</option>
                  <option value="nurse">Nurse</option>
                  <option value="Patience">Patience</option>
                  <option value="Rider">Rider</option>
                  <option value="Phamarcy">Phamarcy</option>
                </select>
              </div>
            </label>
          </div>

          <div style={{ marginBottom: 8 }}>
            <label>
              Call type
              <div>
                <select value={mode} onChange={(e) => setMode(e.target.value)} style={{ width: "100%", padding: 8, marginTop: 4 }}>
                  <option value="audio">Voice call</option>
                  <option value="video">Video call</option>
                </select>
              </div>
            </label>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={startCall}
              style={{ padding: "10px 14px", background: "#0ea5e9", color: "white", border: 0, borderRadius: 10, cursor: "pointer", flex: 1 }}
              disabled={status === "connecting"}
            >
              Start / Join
            </button>
            <button
              onClick={endCall}
              style={{ padding: "10px 14px", borderRadius: 10, cursor: "pointer", border: "1px solid #e5e7eb", flex: 1 }}
              disabled={status === "idle" || status === "ended"}
            >
              End
            </button>
          </div>

          <div style={{ marginTop: 12 }}>
            <div>
              Status: <b>{status}</b>
            </div>
            {myPeerId ? (
              <div style={{ marginTop: 6 }}>
                Your ID: <code>{myPeerId}</code>
              </div>
            ) : null}
            {remotePeerId ? (
              <div style={{ marginTop: 6 }}>
                Peer ID: <code>{remotePeerId}</code>
              </div>
            ) : null}
            {error ? <div style={{ marginTop: 6, color: "#b91c1c" }}>{error}</div> : null}
          </div>

          <p style={{ marginTop: 10, color: "#6b7280", fontSize: 13 }}>
            P2P audio/video in this POC uses WebRTC media encryption (so the signaling server only routes setup messages). For group calls at scale + “relay/SFU
            cannot decrypt”, we’ll need additional end-to-end media encryption beyond basic WebRTC.
          </p>
        </div>

        <div style={{ padding: 12, border: "1px solid #e5e7eb", borderRadius: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Local</div>
              <video ref={localVideoRef} autoPlay playsInline muted style={{ width: "100%", borderRadius: 10, background: "#111827" }} />
            </div>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Remote</div>
              <video ref={remoteVideoRef} autoPlay playsInline style={{ width: "100%", borderRadius: 10, background: "#111827" }} />
            </div>
          </div>
          <div style={{ marginTop: 10, color: "#6b7280", fontSize: 13 }}>Tip: open this page on two devices/browsers, use the same Room ID, and click “Start / Join” on both.</div>
        </div>
      </div>
    </div>
  )
}

