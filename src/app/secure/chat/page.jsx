"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import LoadingCanvas from "../components/LoadingCanvas"

const DEFAULT_SIGNAL_URL = "ws://localhost:3001"
const REACTIONS = ["👍", "❤️", "😂", "🙏", "😮"]

function resolveSignalUrl() {
  const envUrl = globalThis?.process?.env?.NEXT_PUBLIC_SIGNAL_URL
  if (envUrl) return envUrl

  if (typeof window === "undefined") return DEFAULT_SIGNAL_URL

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
  return `${protocol}//${window.location.hostname}:3001`
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

function safeParse(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function pad2(n) {
  return String(n).padStart(2, "0")
}

function formatTime(ts) {
  try {
    const d = new Date(ts)
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  } catch {
    return ""
  }
}

function Icon({ name }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
  }

  switch (name) {
    case "dots":
      return (
        <svg {...common} aria-hidden="true" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 5h.01" />
          <path d="M12 12h.01" />
          <path d="M12 19h.01" />
        </svg>
      )
    case "lock":
      return (
        <svg {...common} aria-hidden="true" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
          <path d="M7 11V8a5 5 0 0 1 10 0v3" />
          <path d="M5 11h14v10H5V11Z" />
        </svg>
      )
    case "phone":
      return (
        <svg {...common} aria-hidden="true" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.11 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.86.3 1.7.54 2.5a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.58-1.58a2 2 0 0 1 2.11-.45c.8.24 1.64.42 2.5.54A2 2 0 0 1 22 16.92Z" />
        </svg>
      )
    case "video":
      return (
        <svg {...common} aria-hidden="true" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
          <path d="M15 10l4-2v8l-4-2v-4Z" />
          <rect x="3" y="6" width="12" height="12" rx="2" ry="2" />
        </svg>
      )
    case "send":
      return (
        <svg {...common} aria-hidden="true" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
          <path d="M22 2 11 13" />
          <path d="M22 2 15 22 11 13 2 9 22 2Z" />
        </svg>
      )
    default:
      return null
  }
}

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf)
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function base64ToArrayBuffer(b64) {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

async function sha256Bytes(text) {
  const enc = new TextEncoder()
  const data = enc.encode(text)
  return await crypto.subtle.digest("SHA-256", data)
}

async function getOrCreateChatKeyPair(roomId) {
  const storageKey = `chat-e2ee-ecdh:${roomId}`
  const existing = localStorage.getItem(storageKey)
  if (existing) {
    const parsed = safeParse(existing)
    if (parsed?.privateKeyPkcs8B64 && parsed?.publicKeySpkiB64) {
      const privateKey = await crypto.subtle.importKey(
        "pkcs8",
        base64ToArrayBuffer(parsed.privateKeyPkcs8B64),
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveBits", "deriveKey"],
      )
      const publicKey = await crypto.subtle.importKey("spki", base64ToArrayBuffer(parsed.publicKeySpkiB64), { name: "ECDH", namedCurve: "P-256" }, true, [])
      return { privateKey, publicKey }
    }
  }

  const keyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits", "deriveKey"])
  const privateKeyPkcs8 = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey)
  const publicKeySpki = await crypto.subtle.exportKey("spki", keyPair.publicKey)

  localStorage.setItem(storageKey, JSON.stringify({ privateKeyPkcs8B64: arrayBufferToBase64(privateKeyPkcs8), publicKeySpkiB64: arrayBufferToBase64(publicKeySpki) }))
  return { privateKey: keyPair.privateKey, publicKey: keyPair.publicKey }
}

async function deriveAesKey({ roomId, privateKey, remotePublicKey }) {
  const salt = await sha256Bytes(roomId)
  const info = new TextEncoder().encode("chat-e2ee-v1")
  const sharedSecret = await crypto.subtle.deriveBits({ name: "ECDH", public: remotePublicKey }, privateKey, 256)
  const hkdfBaseKey = await crypto.subtle.importKey("raw", sharedSecret, "HKDF", false, ["deriveKey"])

  return await crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info },
    hkdfBaseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )
}

async function encryptText({ aesKey, plaintext }) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const enc = new TextEncoder()
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, enc.encode(plaintext))
  return { ivB64: arrayBufferToBase64(iv.buffer), ciphertextB64: arrayBufferToBase64(ciphertext) }
}

async function decryptText({ aesKey, ivB64, ciphertextB64 }) {
  const iv = new Uint8Array(base64ToArrayBuffer(ivB64))
  const ciphertext = base64ToArrayBuffer(ciphertextB64)
  const plaintextBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aesKey, ciphertext)
  return new TextDecoder().decode(plaintextBuf)
}

function receiptLabel(status) {
  if (status === "read") return "Read"
  if (status === "delivered") return "Delivered"
  if (status === "sent") return "Sent"
  return ""
}

function ChatPageContent() {
  const searchParams = useSearchParams()

  const signalUrl = resolveSignalUrl()
  const contactName = searchParams.get("name") || "GCTU"
  const roomId = searchParams.get("roomId") || "demo-room"
  const urlPatientId = searchParams.get("patientId") || ""
  const urlDoctorId = searchParams.get("doctorId") || ""
  const urlDoctorName = searchParams.get("doctorName") || ""

  const [status, setStatus] = useState("idle")
  const [error, setError] = useState("")
  const [messages, setMessages] = useState([]) // { id, from, ivB64, ciphertextB64, ts, text?, status?, reactions? }
  const [draft, setDraft] = useState("")
  const [aesReady, setAesReady] = useState(false)
  const [typingPeer, setTypingPeer] = useState(false)
  const [openReactionDropdown, setOpenReactionDropdown] = useState(null) // messageId or null

  const [sessionInfo, setSessionInfo] = useState(null)
  const [roomData, setRoomData] = useState(null)
  const [roomLoading, setRoomLoading] = useState(false)
  const [roomError, setRoomError] = useState("")
  const [savingClinical, setSavingClinical] = useState(false)
  const [roomActionBusy, setRoomActionBusy] = useState(false)
  const [callRequestBusy, setCallRequestBusy] = useState("")
  const [uploadingRoomFiles, setUploadingRoomFiles] = useState(false)
  const [doctorNotesDraft, setDoctorNotesDraft] = useState("")
  const [doctorPrescriptionDraft, setDoctorPrescriptionDraft] = useState("")
  const [doctorAllergiesDraft, setDoctorAllergiesDraft] = useState("")
  const [clinicalNotice, setClinicalNotice] = useState("")
  const [isMobile, setIsMobile] = useState(false)
  const [showRoomOnMobile, setShowRoomOnMobile] = useState(false)
  const [selectedLabFile, setSelectedLabFile] = useState(null)

  const [myPeerId, setMyPeerId] = useState("")
  const [remotePeerId, setRemotePeerId] = useState("")

  const wsRef = useRef(null)
  const myPeerIdRef = useRef("")
  const remotePeerIdRef = useRef("")
  const aesKeyRef = useRef(null)
  const remotePubKeyRef = useRef(null)
  const pendingDecryptRef = useRef([]) // ciphertext messages received before aesKey ready
  const chatKeyPairRef = useRef(null)

  const typingTimerRef = useRef(null)
  const isTypingRef = useRef(false)
  const listRef = useRef(null)

  useEffect(() => {
    myPeerIdRef.current = myPeerId
  }, [myPeerId])

  useEffect(() => {
    remotePeerIdRef.current = remotePeerId
  }, [remotePeerId])

  function sendJson(payload) {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify(payload))
  }

  useEffect(() => {
    setSessionInfo(getStoredSession())
  }, [])

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 1024)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    let active = true

    async function loadRoom() {
      if (!roomId) return

      setRoomLoading(true)
      setRoomError("")

      try {
        const auth = getStoredSession()
        const headers = {}
        if (auth?.token) headers.authorization = `Bearer ${auth.token}`

        const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}`, {
          method: "GET",
          cache: "no-store",
          headers,
        })

        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data?.message || "Failed to load room data")
        if (!active) return

        setRoomData(data)
        setDoctorNotesDraft(String(data?.room?.notes || ""))
        setDoctorPrescriptionDraft(String(data?.room?.prescription || ""))
        setDoctorAllergiesDraft(String(data?.room?.allergies || ""))
      } catch (err) {
        if (active) setRoomError(err?.message || "Failed to load room data")
      } finally {
        if (active) setRoomLoading(false)
      }
    }

    loadRoom()
    return () => {
      active = false
    }
  }, [roomId])

  const buildCallUrl = useCallback((callType) => {
    const params = new URLSearchParams({
      roomId,
      mode: callType,
      role: sessionInfo?.role || "doctor",
      autoJoin: "1",
      name: contactName,
      patientId: urlPatientId,
      doctorId: urlDoctorId,
      doctorName: urlDoctorName,
    })

    return `/secure/call?${params.toString()}`
  }, [contactName, roomId, sessionInfo?.role, urlDoctorId, urlDoctorName, urlPatientId])

  useEffect(() => {
    let active = true

    async function refreshRoomStatus() {
      if (!roomId) return

      try {
        const auth = getStoredSession()
        const headers = {}
        if (auth?.token) headers.authorization = `Bearer ${auth.token}`

        const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}`, {
          method: "GET",
          cache: "no-store",
          headers,
        })

        const data = await response.json().catch(() => ({}))
        if (!response.ok || !active) return

        setRoomData(data)

        const roomStatus = String(data?.room?.status || "").toLowerCase()
        const callRequestStatus = String(data?.room?.callRequestStatus || "").toLowerCase()
        const callRequestType = String(data?.room?.callRequestType || "audio") || "audio"

        if (callRequestStatus === "approved") {
          window.location.href = buildCallUrl(callRequestType)
          return
        }

        if (roomStatus === "completed" || roomStatus === "cancelled") {
          const target = sessionInfo?.role === "doctor" ? "/secure/doctor" : "/secure/appointments"
          window.location.href = target
        }
      } catch {
        // best-effort polling only
      }
    }

    refreshRoomStatus()
    const timer = setInterval(refreshRoomStatus, 5000)

    return () => {
      active = false
      clearInterval(timer)
    }
  }, [roomId, sessionInfo?.role, buildCallUrl])

  async function saveClinicalSection() {
    setClinicalNotice("")
    setRoomError("")
    setSavingClinical(true)

    try {
      const auth = getStoredSession()
      const headers = { "Content-Type": "application/json" }
      if (auth?.token) headers.authorization = `Bearer ${auth.token}`

      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          notes: doctorNotesDraft,
          prescription: doctorPrescriptionDraft,
          allergies: doctorAllergiesDraft,
          status: "active",
          syncToHealthRecord: true,
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.message || "Failed to save clinical notes")

      setRoomData((current) => ({ ...current, room: data?.room || current?.room }))
      if (data?.healthRecordUpdated) {
        setClinicalNotice("Saved. Prescription, consultation notes, and allergies synced to patient health records.")
      } else {
        setClinicalNotice(data?.healthRecordSkippedReason || "Saved to room. Health-record sync is waiting for accepted consent.")
      }
    } catch (err) {
      setRoomError(err?.message || "Failed to save clinical notes")
    } finally {
      setSavingClinical(false)
    }
  }

  async function uploadRoomFiles(event) {
    const selectedFiles = Array.from(event?.target?.files || [])
    if (selectedFiles.length === 0) return

    setRoomError("")
    setClinicalNotice("")
    setUploadingRoomFiles(true)

    try {
      const auth = getStoredSession()
      const patientId = String(roomData?.room?.patientId || urlPatientId || "").trim()
      if (!patientId) throw new Error("Missing patient id for room file uploads")

      const formData = new FormData()
      selectedFiles.forEach((file) => formData.append("files", file))
      formData.append("ownerRef", patientId)
      formData.append("purpose", "document")

      const headers = {}
      if (auth?.token) headers.authorization = `Bearer ${auth.token}`

      const uploadRes = await fetch("/api/uploads", {
        method: "POST",
        headers,
        body: formData,
      })

      const uploadData = await uploadRes.json().catch(() => ({}))
      if (!uploadRes.ok) throw new Error(uploadData?.message || "Failed to upload room files")

      const uploadedFiles = Array.isArray(uploadData?.files)
        ? uploadData.files.map((item) => ({
            name: String(item?.originalName || item?.name || "File"),
            url: String(item?.url || ""),
            mimeType: String(item?.mimeType || ""),
            uploadedAt: item?.uploadedAt || new Date().toISOString(),
          }))
        : []

      if (uploadedFiles.length === 0) throw new Error("Upload succeeded but no files were returned")

      const mergedFiles = [...(Array.isArray(roomData?.room?.files) ? roomData.room.files : []), ...uploadedFiles]

      const roomRes = await fetch(`/api/rooms/${encodeURIComponent(roomId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(auth?.token ? { authorization: `Bearer ${auth.token}` } : {}),
        },
        body: JSON.stringify({ files: mergedFiles, syncToHealthRecord: false }),
      })

      const roomPatchData = await roomRes.json().catch(() => ({}))
      if (!roomRes.ok) throw new Error(roomPatchData?.message || "Failed to save files to room")

      setRoomData((current) => ({ ...current, room: roomPatchData?.room || current?.room }))
      setClinicalNotice(`Uploaded ${uploadedFiles.length} file(s) to the room.`)
    } catch (err) {
      setRoomError(err?.message || "Failed to upload room files")
    } finally {
      setUploadingRoomFiles(false)
      if (event?.target) event.target.value = ""
    }
  }

  function leaveRoom() {
    try {
      window.location.href = sessionInfo?.role === "doctor" ? "/secure/doctor" : "/secure/appointments"
    } catch {
      window.history.back()
    }
  }

  async function endRoom() {
    setRoomError("")
    setRoomActionBusy(true)

    try {
      const auth = getStoredSession()
      const headers = { "Content-Type": "application/json" }
      if (auth?.token) headers.authorization = `Bearer ${auth.token}`

      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ participantAction: "end", role: "doctor" }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.message || "Failed to end room")

      setRoomData((current) => ({ ...current, room: data?.room || current?.room }))
      leaveRoom()
    } catch (err) {
      setRoomError(err?.message || "Failed to end room")
    } finally {
      setRoomActionBusy(false)
    }
  }

  const initCryptoAndKeys = useCallback(async () => {
    const keyPair = await getOrCreateChatKeyPair(roomId)
    chatKeyPairRef.current = keyPair
    return keyPair
  }, [roomId])

  const attemptDeriveAesKey = useCallback(async () => {
    const keyPair = chatKeyPairRef.current
    if (!keyPair || !remotePubKeyRef.current || aesKeyRef.current) return

    const aesKey = await deriveAesKey({ roomId, privateKey: keyPair.privateKey, remotePublicKey: remotePubKeyRef.current })
    aesKeyRef.current = aesKey
    setAesReady(true)
    setStatus("secure")

    if (pendingDecryptRef.current.length > 0) {
      const queue = pendingDecryptRef.current
      pendingDecryptRef.current = []
      for (const m of queue) {
        try {
          const text = await decryptText({ aesKey, ivB64: m.ivB64, ciphertextB64: m.ciphertextB64 })
          setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, text } : x)))
        } catch {
          setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, text: "[Unable to decrypt]" } : x)))
        }
      }
    }
  }, [roomId])

  function scrollToBottom() {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages.length, typingPeer])

  useEffect(() => {
    let cancelled = false

    async function run() {
      setStatus("connecting")
      setError("")
      setMessages([])
      setTypingPeer(false)

      try {
        const keyPair = await initCryptoAndKeys()
        if (cancelled) return

        const id = crypto.randomUUID()
        myPeerIdRef.current = id
        setMyPeerId(id)

        const ws = new WebSocket(signalUrl)
        wsRef.current = ws

        ws.onopen = () => {
          sendJson({ type: "join", roomId, peerId: id })
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
            setRemotePeerId(other)

            const myPublicKeySpki = await crypto.subtle.exportKey("spki", keyPair.publicKey)
            sendJson({ type: "key-exchange", roomId, from: id, to: other, publicKeyB64: arrayBufferToBase64(myPublicKeySpki) })
            return
          }

          if (msg.type === "peer-left") {
            setStatus("ended")
            setRemotePeerId("")
            remotePubKeyRef.current = null
            aesKeyRef.current = null
            setAesReady(false)
            setTypingPeer(false)
            return
          }

          if (msg.type === "history") {
            if (!Array.isArray(msg.messages)) return
            const loaded = msg.messages
            const items = loaded.map((m) => ({
              id: String(m.messageId || crypto.randomUUID()),
              from: String(m.from || ""),
              ts: Number(m.ts || Date.now()),
              ivB64: m.ivB64,
              ciphertextB64: m.ciphertextB64,
              text: undefined,
              status: undefined,
              reactions: {},
            }))

            if (!aesKeyRef.current) {
              pendingDecryptRef.current.push(
                ...items.map((x) => ({
                  id: x.id,
                  ivB64: x.ivB64,
                  ciphertextB64: x.ciphertextB64,
                })),
              )
              setMessages(items)
              return
            }

            const aesKey = aesKeyRef.current
            const decrypted = []
            for (const it of items) {
              try {
                const text = await decryptText({ aesKey, ivB64: it.ivB64, ciphertextB64: it.ciphertextB64 })
                decrypted.push({ ...it, text })
              } catch {
                decrypted.push({ ...it, text: "[Unable to decrypt]" })
              }
            }
            setMessages(decrypted)
            return
          }

          if (msg.type === "key-exchange") {
            const from = String(msg.from || "")
            if (!from) return
            setRemotePeerId((prev) => prev || from)

            const remotePublicKey = await crypto.subtle.importKey("spki", base64ToArrayBuffer(msg.publicKeyB64), { name: "ECDH", namedCurve: "P-256" }, true, [])
            remotePubKeyRef.current = remotePublicKey
            try {
              await attemptDeriveAesKey()
            } catch {
              setError("Could not derive shared encryption key.")
            }
            return
          }

          if (msg.type === "typing") {
            if (String(msg.from || "") === remotePeerIdRef.current) {
              setTypingPeer(Boolean(msg.isTyping))
            }
            return
          }

          if (msg.type === "receipt") {
            const messageId = String(msg.messageId || "")
            const receipt = String(msg.receipt || "")
            if (!messageId) return
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== messageId) return m
                if (!m.status) return m
                if (receipt === "delivered" && m.status === "sent") return { ...m, status: "delivered" }
                if (receipt === "read" && (m.status === "sent" || m.status === "delivered")) return { ...m, status: "read" }
                return m
              }),
            )
            return
          }

          if (msg.type === "reaction") {
            const messageId = String(msg.messageId || "")
            const emoji = String(msg.emoji || "")
            if (!messageId || !emoji) return
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== messageId) return m
                const next = { ...(m.reactions || {}) }
                next[emoji] = (next[emoji] || 0) + 1
                return { ...m, reactions: next }
              }),
            )
            return
          }

          if (msg.type === "chat-message") {
            const id = String(msg.messageId || crypto.randomUUID())
            const from = String(msg.from || "")
            const ts = Number(msg.ts || Date.now())
            const ivB64 = msg.ivB64
            const ciphertextB64 = msg.ciphertextB64

            const base = { id, from, ts, ivB64, ciphertextB64, reactions: {} }

            if (!aesKeyRef.current) {
              pendingDecryptRef.current.push({ id, ivB64, ciphertextB64 })
              setMessages((prev) => [...prev, base])
              return
            }

            try {
              const text = await decryptText({ aesKey: aesKeyRef.current, ivB64, ciphertextB64 })
              setMessages((prev) => [...prev, { ...base, text }])
            } catch {
              setMessages((prev) => [...prev, { ...base, text: "[Unable to decrypt]" }])
            }

            // Delivery receipt (best-effort).
            if (remotePeerIdRef.current && myPeerIdRef.current) {
              sendJson({ type: "receipt", roomId, from: myPeerIdRef.current, to: from, messageId: id, receipt: "delivered" })
              if (typeof document !== "undefined" && document.visibilityState === "visible") {
                sendJson({ type: "receipt", roomId, from: myPeerIdRef.current, to: from, messageId: id, receipt: "read" })
              }
            }

            return
          }
        }

        ws.onerror = () => setError("WebSocket error. Check the signaling server URL.")
        ws.onclose = () => {
          if (!cancelled) setStatus("ended")
        }
      } catch {
        if (!cancelled) setStatus("error")
      }
    }

    run()
    return () => {
      cancelled = true
      try {
        wsRef.current?.close()
      } catch {
        // ignore
      }
      wsRef.current = null
      aesKeyRef.current = null
      remotePubKeyRef.current = null
      pendingDecryptRef.current = []
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
      typingTimerRef.current = null
      isTypingRef.current = false
    }
  }, [roomId, signalUrl, initCryptoAndKeys, attemptDeriveAesKey])

  async function requestCallSwitch(callType) {
    if (sessionInfo?.role !== "doctor") return
    const nextType = callType === "video" ? "video" : "audio"
    const confirmed = window.confirm(`Request a ${nextType === "video" ? "video" : "voice"} call for this room?`)
    if (!confirmed) return

    setCallRequestBusy(nextType)
    try {
      const auth = getStoredSession()
      const headers = { "Content-Type": "application/json" }
      if (auth?.token) headers.authorization = `Bearer ${auth.token}`

      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ participantAction: "request-call", role: "doctor", callType: nextType }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.message || "Failed to request call switch")

      setRoomData((current) => ({ ...current, room: data?.room || current?.room }))
    } catch (err) {
      setRoomError(err?.message || "Failed to request call switch")
    } finally {
      setCallRequestBusy("")
    }
  }

  async function respondToCallRequest(accept) {
    if (sessionInfo?.role !== "patient") return
    const currentType = String(roomData?.room?.callRequestType || "audio") || "audio"

    setCallRequestBusy(accept ? "approve" : "decline")
    try {
      const auth = getStoredSession()
      const headers = { "Content-Type": "application/json" }
      if (auth?.token) headers.authorization = `Bearer ${auth.token}`

      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ participantAction: accept ? "approve-call" : "decline-call", role: "patient" }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.message || "Failed to respond to call request")

      setRoomData((current) => ({ ...current, room: data?.room || current?.room }))
      if (accept) {
        window.location.href = buildCallUrl(currentType)
      }
    } catch (err) {
      setRoomError(err?.message || "Failed to respond to call request")
    } finally {
      setCallRequestBusy("")
    }
  }

  function sendTyping(isTyping) {
    if (!remotePeerIdRef.current || !myPeerIdRef.current) return
    sendJson({ type: "typing", roomId, from: myPeerIdRef.current, to: remotePeerIdRef.current, isTyping })
  }

  function onDraftChanged(next) {
    setDraft(next)
    if (!aesKeyRef.current || !remotePeerIdRef.current) return

    if (!isTypingRef.current) {
      isTypingRef.current = true
      sendTyping(true)
    }

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false
      sendTyping(false)
    }, 1200)
  }

  async function sendMessage() {
    setError("")
    const text = draft.trim()
    if (!text) return
    if (!remotePeerIdRef.current) return
    if (!aesKeyRef.current) return

    const id = crypto.randomUUID()
    const ts = Date.now()
    const { ivB64, ciphertextB64 } = await encryptText({ aesKey: aesKeyRef.current, plaintext: text })

    const payload = { type: "chat-message", roomId, from: myPeerIdRef.current, to: remotePeerIdRef.current, messageId: id, ts, ivB64, ciphertextB64 }

    setMessages((prev) => [...prev, { id, from: myPeerIdRef.current, ts, ivB64, ciphertextB64, text, status: "sent", reactions: {} }])
    setDraft("")
    isTypingRef.current = false
    sendTyping(false)
    sendJson(payload)
  }

  function sendReaction(messageId, emoji) {
    if (!remotePeerIdRef.current || !myPeerIdRef.current) return
    sendJson({ type: "reaction", roomId, from: myPeerIdRef.current, to: remotePeerIdRef.current, messageId, emoji })
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m
        const next = { ...(m.reactions || {}) }
        next[emoji] = (next[emoji] || 0) + 1
        return { ...m, reactions: next }
      }),
    )
  }

  return (
    <div className="secureChatRoot">
      <div className="secureChatHeader">
        <div className="secureChatHeader__left">
          <div className="secureChatAvatar" aria-hidden="true">
            {contactName.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="secureChatHeader__name">{contactName}</div>
            <div className="secureChatHeader__subtitle">
              {status === "secure" ? "Encrypted" : status === "waiting" ? "Waiting for peer..." : "Secure channel"}
              {typingPeer ? " • typing…" : ""}
            </div>
          </div>
        </div>

        <div className="secureChatHeader__actions">
          {sessionInfo?.role === "doctor" ? (
            <>
              <button
                className="secureChatIconButton"
                type="button"
                onClick={() => requestCallSwitch("audio")}
                title="Request voice call"
                disabled={callRequestBusy === "audio"}
              >
                <Icon name="phone" />
              </button>
              <button
                className="secureChatIconButton"
                type="button"
                onClick={() => requestCallSwitch("video")}
                title="Request video call"
                disabled={callRequestBusy === "video"}
              >
                <Icon name="video" />
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="secureChatBanner">
        <div style={{ color: "#22c55e", marginTop: 1 }}>
          <Icon name="lock" />
        </div>
        <div className="secureChatBanner__text">Messages and calls are end-to-end encrypted. Only people in this chat can read, listen to, or share them.</div>
      </div>

      {sessionInfo?.role === "patient" && String(roomData?.room?.callRequestStatus || "").toLowerCase() === "pending" ? (
        <div className="secureCallRequestBanner">
          <strong>Doctor is requesting a call switch.</strong>
          <p>
            Switch to {String(roomData?.room?.callRequestType || "audio") === "video" ? "video" : "voice"} call now?
          </p>
          <div className="secureCallRequestBanner__actions">
            <button
              type="button"
              className="secureCallRequestBanner__approve"
              onClick={() => respondToCallRequest(true)}
              disabled={callRequestBusy === "approve"}
            >
              {callRequestBusy === "approve" ? "Opening..." : "Agree"}
            </button>
            <button
              type="button"
              className="secureCallRequestBanner__decline"
              onClick={() => respondToCallRequest(false)}
              disabled={callRequestBusy === "decline"}
            >
              {callRequestBusy === "decline" ? "Declining..." : "Decline"}
            </button>
          </div>
        </div>
      ) : null}

      {sessionInfo?.role === "doctor" && String(roomData?.room?.callRequestStatus || "").toLowerCase() === "pending" ? (
        <div className="secureCallRequestBanner">
          <strong>Call switch request sent.</strong>
          <p>Waiting for the patient to approve the switch.</p>
        </div>
      ) : null}

      <div className="secureChatStatusLine">
        Room: <code>{roomId}</code> • {remotePeerId ? `Peer connected` : `Waiting for a second person`}
      </div>

      {/* Mobile-only tab toggle for chat/room */}
      {isMobile ? (
        <div className="secureMobileTabToggle">
          <button
            className={`secureMobileTabToggle__btn ${!showRoomOnMobile ? 'secureMobileTabToggle__btn--active' : ''}`}
            onClick={() => setShowRoomOnMobile(false)}
          >
            Chat
          </button>
          <button
            className={`secureMobileTabToggle__btn ${showRoomOnMobile ? 'secureMobileTabToggle__btn--active' : ''}`}
            onClick={() => setShowRoomOnMobile(true)}
          >
            Room
          </button>
        </div>
      ) : null}

      {/* Split-screen container for desktop, single column for mobile */}
      <div className={`secureChatContainer ${isMobile ? 'secureChatContainer--mobile' : 'secureChatContainer--desktop'}`}>
        {/* Chat section (hidden on mobile unless showRoomOnMobile is false) */}
        <div className={`secureChatSection ${isMobile && showRoomOnMobile ? 'secureChatSection--hidden' : ''}`}>
          <div className="secureChatBody" ref={listRef}>
            {messages.length === 0 ? (
              <div style={{ padding: "12px 0 24px", color: "rgba(229,231,235,0.65)", fontSize: 13 }}>No messages yet. Join the same room on another browser/device to start chatting.</div>
            ) : null}

            {messages.map((m) => {
              const mine = myPeerId && m.from === myPeerId
              const text = m.text
              const reactions = m.reactions || {}
              const hasReactions = Object.keys(reactions).length > 0
              const isDropdownOpen = openReactionDropdown === m.id

              return (
                <div key={m.id} className={`secureChatRow ${mine ? "secureChatRow--mine" : "secureChatRow--theirs"}`}>
                  <div className={`secureChatBubble ${mine ? "secureChatBubble--mine" : "secureChatBubble--theirs"}`}>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {text === undefined ? "Decrypting..." : text}
                        
                      </div>
                      <div style={{ position: "relative" }}>
                        <button
                          type="button"
                          onClick={() => setOpenReactionDropdown(isDropdownOpen ? null : m.id)}
                          title="Add reaction"
                          style={{
                            border: "1px solid rgba(255,255,255,0.14)",
                            background: "rgba(0,0,0,0.14)",
                            color: "inherit",
                            borderRadius: 999,
                            padding: "2px 7px",
                            cursor: remotePeerId ? "pointer" : "not-allowed",
                            fontSize: 14,
                            opacity: remotePeerId ? 1 : 0.5,
                          }}
                          disabled={!remotePeerId}
                        >
                          +
                        </button>
                        {isDropdownOpen ? (
                          <div
                            style={{
                              position: "absolute",
                              bottom: "100%",
                              right: 0,
                              marginBottom: 4,
                              background: "rgba(0,0,0,0.8)",
                              border: "1px solid rgba(255,255,255,0.14)",
                              borderRadius: 8,
                              padding: "4px",
                              display: "flex",
                              gap: 4,
                              zIndex: 1000,
                            }}
                          >
                            {REACTIONS.map((e) => (
                              <button
                                key={e}
                                type="button"
                                onClick={() => {
                                  sendReaction(m.id, e)
                                  setOpenReactionDropdown(null)
                                }}
                                title={`React with ${e}`}
                                style={{
                                  border: "none",
                                  background: "transparent",
                                  color: "inherit",
                                  cursor: "pointer",
                                  fontSize: 18,
                                  padding: "2px 4px",
                                  opacity: 0.8,
                                  transition: "opacity 0.2s",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                                onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.8")}
                              >
                                {e}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {hasReactions ? (
                      <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {Object.entries(reactions).map(([emoji, count]) => (
                          <span
                            key={emoji}
                            style={{
                              fontSize: 12,
                              padding: "2px 8px",
                              borderRadius: 999,
                              border: "1px solid rgba(255,255,255,0.12)",
                              background: "rgba(255,255,255,0.04)",
                            }}
                          >
                            {emoji} {count}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    <div className="secureChatMeta">
                      {formatTime(m.ts)}
                      {mine && m.status ? ` • ${receiptLabel(m.status)}` : ""}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="secureChatInputBar">
            <div className="secureChatInputInner">
              <textarea
                className="secureChatTextInput"
                value={draft}
                onChange={(e) => onDraftChanged(e.target.value)}
                placeholder="Message"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage().catch(() => setError("Message encryption/send failed."))
                  }
                }}
              />
              <button
                className="secureChatSendButton"
                type="button"
                onClick={() => sendMessage().catch(() => setError("Message encryption/send failed."))}
                disabled={!draft.trim() || !remotePeerId || !aesReady}
                title={!remotePeerId ? "Waiting for peer..." : !aesReady ? "Securing..." : "Send"}
              >
                <Icon name="send" />
              </button>
            </div>
            {error ? <div style={{ marginTop: 8, color: "#f87171", fontSize: 12 }}>{error}</div> : null}
          </div>
        </div>

        {/* Room section (hidden on mobile unless showRoomOnMobile is true) */}
        <div className={`secureRoomSection ${isMobile && !showRoomOnMobile ? 'secureRoomSection--hidden' : ''}`}>
          <div className="secureRoomPanel">
            <div className="secureRoomPanel__header">
              <strong>Consultation Room</strong>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span>
                  Patient: {roomData?.room?.patientId || urlPatientId || "N/A"} • Doctor: {roomData?.room?.doctorId || urlDoctorId || "N/A"}
                </span>
                {sessionInfo?.role === "doctor" ? (
                  <button
                    type="button"
                    className="secureRoomPanel__end"
                    onClick={() => endRoom()}
                    disabled={roomActionBusy}
                    title="End session"
                  >
                    {roomActionBusy ? "Ending..." : "End session"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="secureRoomPanel__close"
                    onClick={() => leaveRoom()}
                    title="Close room"
                  >
                    Close
                  </button>
                )}
              </span>
            </div>

            {roomLoading ? <p className="secureRoomPanel__hint">Loading room details...</p> : null}

            {!roomLoading && roomData?.consentAccepted ? (
              <div className="secureRoomPreview">
                <h4>Consented record preview</h4>
                <p><strong>Medical history:</strong> {roomData?.recordPreview?.medicalHistory || "No shared medical history."}</p>
                <p><strong>Prescriptions:</strong> {roomData?.recordPreview?.prescriptions || "No shared prescriptions."}</p>
                <p><strong>Allergies:</strong> {roomData?.recordPreview?.allergies || "No shared allergies."}</p>
              </div>
            ) : null}

            {!roomLoading && !roomData?.consentAccepted ? (
              <p className="secureRoomPanel__hint">Patient records remain hidden until consent is accepted for this appointment.</p>
            ) : null}

            {sessionInfo?.role === "doctor" ? (
              <div className="secureDoctorClinical">
                <h4>Doctor clinical section</h4>
                <label className="secureDoctorClinical__label">
                  Consultation notes (used for patient medical history)
                  <textarea
                    className="secureDoctorClinical__input"
                    value={doctorNotesDraft}
                    onChange={(e) => setDoctorNotesDraft(e.target.value)}
                    rows={3}
                    placeholder="Write consultation notes..."
                  />
                </label>

                <label className="secureDoctorClinical__label">
                  Prescription
                  <textarea
                    className="secureDoctorClinical__input"
                    value={doctorPrescriptionDraft}
                    onChange={(e) => setDoctorPrescriptionDraft(e.target.value)}
                    rows={3}
                    placeholder="Write prescription instructions..."
                  />
                </label>

                <label className="secureDoctorClinical__label">
                  Allergies
                  <textarea
                    className="secureDoctorClinical__input"
                    value={doctorAllergiesDraft}
                    onChange={(e) => setDoctorAllergiesDraft(e.target.value)}
                    rows={2}
                    placeholder="Document allergies if any..."
                  />
                </label>

                <button type="button" className="secureDoctorClinical__save" onClick={saveClinicalSection} disabled={savingClinical}>
                  {savingClinical ? "Saving..." : "Save to room and patient record"}
                </button>

                {/* Patient Lab Files Section */}
                {roomData?.consentAccepted && Array.isArray(roomData?.recordPreview?.labResults) && roomData.recordPreview.labResults.length > 0 ? (
                  <div className="secureLabFilesSection">
                    <h4>Patient Lab Files</h4>
                    <div className="secureLabFilesList">
                      {roomData.recordPreview.labResults.map((file, index) => (
                        <button
                          key={`${file.url || "file"}-${index}`}
                          className={`secureLabFileItem ${selectedLabFile?.url === file.url ? 'secureLabFileItem--selected' : ''}`}
                          onClick={() => setSelectedLabFile(selectedLabFile?.url === file.url ? null : file)}
                        >
                          📄 {file.fileName || `Lab Result ${index + 1}`}
                        </button>
                      ))}
                    </div>

                    {/* Lab File Preview */}
                    {selectedLabFile ? (
                      <div className="secureLabFilePreview">
                        <div className="secureLabFilePreview__header">
                          <strong>{selectedLabFile.fileName || "Lab File"}</strong>
                          <button
                            type="button"
                            className="secureLabFilePreview__close"
                            onClick={() => setSelectedLabFile(null)}
                          >
                            ✕
                          </button>
                        </div>
                        <div className="secureLabFilePreview__container">
                          {selectedLabFile.mimeType?.includes('pdf') ? (
                            <iframe
                              src={`https://docs.google.com/gview?url=${encodeURIComponent(selectedLabFile.url)}&embedded=true`}
                              className="secureLabFilePreview__iframe"
                              title="Lab file preview"
                              frameBorder="0"
                            />
                          ) : selectedLabFile.mimeType?.includes('image') ? (
                            <Image
                              src={selectedLabFile.url}
                              alt={selectedLabFile.fileName || 'Lab file'}
                              className="secureLabFilePreview__image"
                              width={400}
                              height={400}
                            />
                          ) : (
                            <div className="secureLabFilePreview__fallback">
                              <a href={selectedLabFile.url} target="_blank" rel="noreferrer" className="secureLabFilePreview__link">
                                Open file in new tab →
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <label className="secureDoctorClinical__label">
                  Room files
                  <input type="file" multiple onChange={uploadRoomFiles} disabled={uploadingRoomFiles} />
                </label>
                {Array.isArray(roomData?.room?.files) && roomData.room.files.length > 0 ? (
                  <div className="secureRoomFilesList">
                    {roomData.room.files.map((item, index) => (
                      <a key={`${item.url || "file"}-${index}`} href={item.url || "#"} target="_blank" rel="noreferrer">
                        {item.name || `File ${index + 1}`}
                      </a>
                    ))}
                  </div>
                ) : null}
                {clinicalNotice ? <p className="secureRoomPanel__notice">{clinicalNotice}</p> : null}
              </div>
            ) : null}

            {urlDoctorName ? <p className="secureRoomPanel__hint">Assigned doctor: {urlDoctorName}</p> : null}
            {roomError ? <p className="secureRoomPanel__error">{roomError}</p> : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={<LoadingCanvas />}>
      <ChatPageContent />
    </Suspense>
  )
}


