import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const DEFAULT_SIGNAL_URL = 'ws://localhost:3001'
const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

function createWebSocket(url) {
  return new WebSocket(url)
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

export default function CallPage() {
  const urlParams = useMemo(() => new URLSearchParams(window.location.search), [])
  const signalUrl = useMemo(() => {
    // Vite exposes env vars prefixed with `VITE_`.
    return import.meta.env.VITE_SIGNAL_URL || DEFAULT_SIGNAL_URL
  }, [])

  const [roomId, setRoomId] = useState(urlParams.get('roomId') || 'demo-room')
  const [role, setRole] = useState(urlParams.get('role') || 'doctor')
  const [mode, setMode] = useState(urlParams.get('mode') || 'video') // 'audio' | 'video'
  const autoJoin = urlParams.get('autoJoin') === '1'
  const [myPeerId, setMyPeerId] = useState('')
  const [remotePeerId, setRemotePeerId] = useState('')
  const [status, setStatus] = useState('idle') // idle | waiting | connecting | in_call | ended | error
  const [error, setError] = useState('')
  const [roomActionBusy, setRoomActionBusy] = useState(false)

  const wsRef = useRef(null)
  const pcRef = useRef(null)
  const localStreamRef = useRef(null)
  const remoteStreamRef = useRef(new MediaStream())

  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)

  const myPeerIdRef = useRef('')
  const remotePeerIdRef = useRef('')
  const roomIdRef = useRef(roomId)
  const pendingIceCandidatesRef = useRef([])

  useEffect(() => {
    roomIdRef.current = roomId
  }, [roomId])

  useEffect(() => {
    let active = true

    async function refreshRoomStatus() {
      if (!roomIdRef.current) return

      try {
        const headers = {}
        const token = getStoredToken()
        if (token) headers.authorization = `Bearer ${token}`

        const response = await fetch(`/api/rooms/${encodeURIComponent(roomIdRef.current)}`, {
          method: 'GET',
          cache: 'no-store',
          headers,
        })

        const data = await response.json().catch(() => ({}))
        if (!response.ok || !active) return

        const roomStatus = String(data?.room?.status || '').toLowerCase()
        if (roomStatus === 'completed' || roomStatus === 'cancelled') {
          await cleanup()
          setError('This room has ended.')
          const target = role === 'doctor' ? '/secure/doctor' : '/secure/appointments'
          window.location.href = target
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
  }, [cleanup, role])

  useEffect(() => {
    // Attach remote stream to the remote video element.
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current
    }
  }, [])

  const cleanup = useCallback(async () => {
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

    setStatus('ended')
  }, [])

  const sendJson = useCallback((payload) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify(payload))
  }, [])

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: DEFAULT_ICE_SERVERS })
    pcRef.current = pc

    pc.onicecandidate = async (event) => {
      if (!event.candidate) return
      const to = remotePeerIdRef.current
      if (!to) return
      sendJson({
        type: 'ice',
        roomId: roomIdRef.current,
        from: myPeerIdRef.current,
        to,
        candidate: event.candidate.toJSON(),
      })
    }

    pc.ontrack = (event) => {
      // WebRTC will deliver multiple tracks; add them to the shared MediaStream.
      const [stream] = event.streams
      if (stream) {
        // Replace remote stream tracks.
        remoteStreamRef.current = stream
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStreamRef.current
      } else {
        remoteStreamRef.current.addTrack(event.track)
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStreamRef.current
      }
      setStatus('in_call')
    }

    return pc
  }, [sendJson])

  const flushPendingIce = useCallback(async () => {
    const pc = pcRef.current
    if (!pc) return
    if (!pc.remoteDescription) return

    const queue = pendingIceCandidatesRef.current
    pendingIceCandidatesRef.current = []
    for (const cand of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand))
      } catch {
        // Best-effort for POC
      }
    }
  }, [])

  const makeOffer = useCallback(async () => {
    const pc = pcRef.current
    if (!pc) return
    setStatus('connecting')

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    sendJson({
      type: 'offer',
      roomId: roomIdRef.current,
      from: myPeerIdRef.current,
      to: remotePeerIdRef.current,
      sdp: pc.localDescription,
    })
  }, [sendJson])

  const handleOffer = useCallback(async (msg) => {
    const pc = pcRef.current
    if (!pc) return
    setStatus('connecting')

    if (!remotePeerIdRef.current && msg.from) {
      remotePeerIdRef.current = String(msg.from)
      setRemotePeerId(remotePeerIdRef.current)
    }

    await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    sendJson({
      type: 'answer',
      roomId: roomIdRef.current,
      from: myPeerIdRef.current,
      to: msg.from,
      sdp: pc.localDescription,
    })

    await flushPendingIce()
  }, [flushPendingIce, sendJson])

  const handleAnswer = useCallback(async (msg) => {
    const pc = pcRef.current
    if (!pc) return
    if (!remotePeerIdRef.current && msg.from) {
      remotePeerIdRef.current = String(msg.from)
      setRemotePeerId(remotePeerIdRef.current)
    }
    await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))

    await flushPendingIce()
  }, [flushPendingIce])

  const handleIce = useCallback(async (msg) => {
    const pc = pcRef.current
    if (!pc) return
    const cand = msg.candidate
    if (!cand) return

    if (!pc.remoteDescription) {
      pendingIceCandidatesRef.current.push(cand)
      return
    }

    await pc.addIceCandidate(new RTCIceCandidate(cand))
  }, [])

  const startCall = useCallback(async () => {
    setError('')
    setStatus('idle')

    // Reset any previous call state.
    await cleanup()

    const id = crypto.randomUUID()
    myPeerIdRef.current = id
    remotePeerIdRef.current = ''
    setMyPeerId(id)
    setRemotePeerId('')
    setStatus('connecting')

    const pc = createPeerConnection()
    pendingIceCandidatesRef.current = []

    // Get local media.
    const localStream = await navigator.mediaDevices.getUserMedia({
      video: mode === 'video',
      audio: true,
    })
    localStreamRef.current = localStream
    localStream.getTracks().forEach((t) => pc.addTrack(t, localStream))

    try {
      const headers = {}
      const token = getStoredToken()
      if (token) headers.authorization = `Bearer ${token}`
      await fetch(`/api/rooms/${encodeURIComponent(roomIdRef.current)}`, {
        method: 'GET',
        cache: 'no-store',
        headers,
      })
    } catch {
      // Best-effort participation tracking.
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream
    }

    const ws = createWebSocket(signalUrl)
    wsRef.current = ws

    ws.onopen = () => {
      sendJson({
        type: 'join',
        roomId: roomIdRef.current,
        peerId: myPeerIdRef.current,
        role,
      })
    }

    ws.onmessage = async (evt) => {
      const msg = safeParse(evt.data)
      if (!msg?.type) return

      if (msg.type === 'waiting') {
        setStatus('waiting')
        return
      }

      if (msg.type === 'match') {
        const other = String(msg.peerId || '')
        if (!other) return
        remotePeerIdRef.current = other
        setRemotePeerId(other)

        // P2P 1:1: use lexicographic comparison as initiator for simplicity.
        if (myPeerIdRef.current < other) {
          await makeOffer()
        }
        return
      }

      if (msg.type === 'offer') {
        await handleOffer(msg)
        return
      }

      if (msg.type === 'answer') {
        await handleAnswer(msg)
        return
      }

      if (msg.type === 'ice') {
        await handleIce(msg)
        return
      }
    }

    ws.onerror = () => setError('WebSocket error. Check the signaling server URL.')
  }, [cleanup, createPeerConnection, handleAnswer, handleIce, handleOffer, makeOffer, mode, role, sendJson, signalUrl])

  useEffect(() => {
    if (!autoJoin || status !== 'idle') return

    let active = true
    Promise.resolve()
      .then(() => startCall())
      .catch((err) => {
        if (!active) return
        setError(err?.message || 'Could not join the call automatically.')
      })

    return () => {
      active = false
    }
  }, [autoJoin, startCall, status])

  function safeParse(raw) {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  async function endCall() {
    setRoomActionBusy(true)

    try {
      if (role === 'doctor') {
        const headers = { 'Content-Type': 'application/json' }
        const token = getStoredToken()
        if (token) headers.authorization = `Bearer ${token}`

        await fetch(`/api/rooms/${encodeURIComponent(roomIdRef.current)}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ participantAction: 'end', role: 'doctor' }),
        })
      }
    } catch {
      // best-effort; the local cleanup still runs below.
    } finally {
      await cleanup()
      setMyPeerId('')
      setRemotePeerId('')
      setRoomActionBusy(false)

      if (role === 'doctor') {
        window.location.href = '/secure/doctor'
      } else {
        window.location.href = '/secure/appointments'
      }
    }
  }

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
      <h2 style={{ marginTop: 0 }}>Secure Video Call</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 900 }}>
        <div style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 12 }}>
          <div style={{ marginBottom: 8 }}>
            <label>
              Room ID
              <div>
                <input
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  style={{ width: '100%', padding: 8, marginTop: 4 }}
                />
              </div>
            </label>
          </div>

          <div style={{ marginBottom: 8 }}>
            <label>
              I am
              <div>
                <select value={role} onChange={(e) => setRole(e.target.value)} style={{ width: '100%', padding: 8, marginTop: 4 }}>
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
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  style={{ width: '100%', padding: 8, marginTop: 4 }}
                >
                  <option value="audio">Voice call</option>
                  <option value="video">Video call</option>
                </select>
              </div>
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={startCall}
              style={{
                padding: '10px 14px',
                background: '#0ea5e9',
                color: 'white',
                border: 0,
                borderRadius: 10,
                cursor: 'pointer',
                flex: 1,
              }}
              disabled={status === 'connecting'}
            >
              Start / Join
            </button>
            <button
              onClick={endCall}
              style={{ padding: '10px 14px', borderRadius: 10, cursor: 'pointer', border: '1px solid #e5e7eb', flex: 1 }}
              disabled={status === 'idle' || status === 'ended' || roomActionBusy}
            >
              {role === 'doctor' ? (roomActionBusy ? 'Ending...' : 'End room') : 'Leave'}
            </button>
          </div>

          <div style={{ marginTop: 12 }}>
            <div>Status: <b>{status}</b></div>
            {myPeerId ? <div style={{ marginTop: 6 }}>Your ID: <code>{myPeerId}</code></div> : null}
            {remotePeerId ? <div style={{ marginTop: 6 }}>Peer ID: <code>{remotePeerId}</code></div> : null}
            {error ? <div style={{ marginTop: 6, color: '#b91c1c' }}>{error}</div> : null}
          </div>

          <p style={{ marginTop: 10, color: '#6b7280', fontSize: 13 }}>
            P2P audio/video in this POC uses WebRTC media encryption (so the signaling server only routes setup messages).
            For group calls at scale + “relay/SFU cannot decrypt”, we’ll need additional end-to-end media encryption beyond basic WebRTC.
          </p>
        </div>

        <div style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Local</div>
              <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '100%', borderRadius: 10, background: '#111827' }} />
            </div>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Remote</div>
              <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', borderRadius: 10, background: '#111827' }} />
            </div>
          </div>
          <div style={{ marginTop: 10, color: '#6b7280', fontSize: 13 }}>
            Tip: open this page on two devices/browsers, use the same Room ID, and click “Start / Join” on both.
          </div>
        </div>
      </div>
    </div>
  )
}

