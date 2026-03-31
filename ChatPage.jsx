import { useEffect, useMemo, useRef, useState } from 'react'
import './ChatPage.css'

const DEFAULT_SIGNAL_URL = 'ws://localhost:3001'

function safeParse(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function formatTime(ts) {
  try {
    const d = new Date(ts)
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  } catch {
    return ''
  }
}

function Icon({ name }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
  }

  switch (name) {
    case 'dots':
      return (
        <svg {...common} aria-hidden="true" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 5h.01" />
          <path d="M12 12h.01" />
          <path d="M12 19h.01" />
        </svg>
      )
    case 'lock':
      return (
        <svg {...common} aria-hidden="true" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
          <path d="M7 11V8a5 5 0 0 1 10 0v3" />
          <path d="M5 11h14v10H5V11Z" />
        </svg>
      )
    case 'phone':
      return (
        <svg {...common} aria-hidden="true" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.11 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.86.3 1.7.54 2.5a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.58-1.58a2 2 0 0 1 2.11-.45c.8.24 1.64.42 2.5.54A2 2 0 0 1 22 16.92Z" />
        </svg>
      )
    case 'video':
      return (
        <svg {...common} aria-hidden="true" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
          <path d="M15 10l4-2v8l-4-2v-4Z" />
          <rect x="3" y="6" width="12" height="12" rx="2" ry="2" />
        </svg>
      )
    case 'send':
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
  let binary = ''
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
  return await crypto.subtle.digest('SHA-256', data)
}

async function getOrCreateChatKeyPair(roomId) {
  // POC-only: we persist the ECDH private key per room so encrypted history can be decrypted after refresh.
  // A production design should use a proper identity + ratcheting protocol (Signal-style).
  const storageKey = `chat-e2ee-ecdh:${roomId}`
  const existing = localStorage.getItem(storageKey)
  if (existing) {
    const parsed = safeParse(existing)
    if (parsed?.privateKeyPkcs8B64 && parsed?.publicKeySpkiB64) {
      const privateKey = await crypto.subtle.importKey(
        'pkcs8',
        base64ToArrayBuffer(parsed.privateKeyPkcs8B64),
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveKey'],
      )
      const publicKey = await crypto.subtle.importKey(
        'spki',
        base64ToArrayBuffer(parsed.publicKeySpkiB64),
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        [],
      )
      return { privateKey, publicKey }
    }
  }

  const keyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey'])

  const privateKeyPkcs8 = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey)
  const publicKeySpki = await crypto.subtle.exportKey('spki', keyPair.publicKey)

  localStorage.setItem(
    storageKey,
    JSON.stringify({
      privateKeyPkcs8B64: arrayBufferToBase64(privateKeyPkcs8),
      publicKeySpkiB64: arrayBufferToBase64(publicKeySpki),
    }),
  )

  return { privateKey: keyPair.privateKey, publicKey: keyPair.publicKey }
}

async function deriveAesKey({ roomId, privateKey, remotePublicKey }) {
  const salt = await sha256Bytes(roomId)
  const info = new TextEncoder().encode('chat-e2ee-v1')

  return await crypto.subtle.deriveKey(
    { name: 'ECDH', public: remotePublicKey },
    privateKey,
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  )
}

async function encryptText({ aesKey, plaintext }) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const enc = new TextEncoder()
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, enc.encode(plaintext))
  return {
    ivB64: arrayBufferToBase64(iv.buffer),
    ciphertextB64: arrayBufferToBase64(ciphertext),
  }
}

async function decryptText({ aesKey, ivB64, ciphertextB64 }) {
  const iv = new Uint8Array(base64ToArrayBuffer(ivB64))
  const ciphertext = base64ToArrayBuffer(ciphertextB64)
  const plaintextBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertext)
  const dec = new TextDecoder()
  return dec.decode(plaintextBuf)
}

export default function ChatPage() {
  const urlParams = useMemo(() => new URLSearchParams(window.location.search), [])
  const signalUrl = import.meta.env.VITE_SIGNAL_URL || DEFAULT_SIGNAL_URL

  const contactName = urlParams.get('name') || 'GCTU'
  const roomId = urlParams.get('roomId') || 'demo-room'

  const [menuOpen, setMenuOpen] = useState(false)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [messages, setMessages] = useState([]) // { id, from, ivB64, ciphertextB64, ts, text? }
  const [draft, setDraft] = useState('')
  const [aesReady, setAesReady] = useState(false)

  const [myPeerId, setMyPeerId] = useState('')
  const [remotePeerId, setRemotePeerId] = useState('')

  const wsRef = useRef(null)
  const myPeerIdRef = useRef('')
  const remotePeerIdRef = useRef('')
  const aesKeyRef = useRef(null)
  const remotePubKeyRef = useRef(null)
  const pendingDecryptRef = useRef([]) // ciphertext messages received before aesKey ready

  const chatKeyPairRef = useRef(null)

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

  async function initCryptoAndKeys() {
    try {
      const keyPair = await getOrCreateChatKeyPair(roomId)
      chatKeyPairRef.current = keyPair
      return keyPair
    } catch (e) {
      setError('Encryption key init failed in this browser.')
      throw e
    }
  }

  async function attemptDeriveAesKey() {
    const keyPair = chatKeyPairRef.current
    if (!keyPair) return
    if (!remotePubKeyRef.current) return
    if (aesKeyRef.current) return

    try {
      const aesKey = await deriveAesKey({
        roomId,
        privateKey: keyPair.privateKey,
        remotePublicKey: remotePubKeyRef.current,
      })
      aesKeyRef.current = aesKey
      setAesReady(true)
      setStatus('secure')

      // Decrypt any previously-received ciphertext.
      if (pendingDecryptRef.current.length > 0) {
        const queue = pendingDecryptRef.current
        pendingDecryptRef.current = []
        for (const m of queue) {
          try {
            const text = await decryptText({ aesKey, ivB64: m.ivB64, ciphertextB64: m.ciphertextB64 })
            setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, text } : x)))
          } catch {
            setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, text: '[Unable to decrypt]' } : x)))
          }
        }
      }
    } catch {
      setError('Could not derive shared encryption key.')
    }
  }

  useEffect(() => {
    let cancelled = false

    async function run() {
      setStatus('connecting')
      setError('')
      setMenuOpen(false)
      setMessages([])

      try {
        const keyPair = await initCryptoAndKeys()
        if (cancelled) return
        const id = crypto.randomUUID()
        myPeerIdRef.current = id
        setMyPeerId(id)

        const ws = new WebSocket(signalUrl)
        wsRef.current = ws

        ws.onopen = () => {
          sendJson({ type: 'join', roomId, peerId: id })
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
            setRemotePeerId(other)

            // Exchange public keys over the same signaling server route.
            const myPublicKeySpki = await crypto.subtle.exportKey('spki', keyPair.publicKey)
            const publicKeyB64 = arrayBufferToBase64(myPublicKeySpki)
            sendJson({
              type: 'key-exchange',
              roomId,
              from: id,
              to: other,
              publicKeyB64,
            })

            return
          }

          if (msg.type === 'peer-left') {
            setStatus('ended')
            setRemotePeerId('')
            remotePubKeyRef.current = null
            aesKeyRef.current = null
            setAesReady(false)
            return
          }

          if (msg.type === 'history') {
            if (!Array.isArray(msg.messages)) return
            const loaded = msg.messages
            const items = loaded.map((m) => ({
              id: String(m.messageId || crypto.randomUUID()),
              from: String(m.from || ''),
              ts: Number(m.ts || Date.now()),
              ivB64: m.ivB64,
              ciphertextB64: m.ciphertextB64,
              text: undefined,
            }))

            // If we don't yet have the shared AES key, queue ciphertext for later decrypt.
            if (!aesKeyRef.current) {
              pendingDecryptRef.current.push(
                items.map((x) => ({
                  id: x.id,
                  ivB64: x.ivB64,
                  ciphertextB64: x.ciphertextB64,
                })),
              )
              setMessages(items)
              return
            }

            // Best-effort: decrypt immediately if the key is already available.
            try {
              const aesKey = aesKeyRef.current
              const decrypted = []
              for (const it of items) {
                try {
                  const text = await decryptText({ aesKey, ivB64: it.ivB64, ciphertextB64: it.ciphertextB64 })
                  decrypted.push({ ...it, text })
                } catch {
                  decrypted.push({ ...it, text: '[Unable to decrypt]' })
                }
              }
              setMessages(decrypted)
            } catch {
              setMessages(items.map((x) => ({ ...x, text: '[Unable to decrypt]' })))
            }
            return
          }

          if (msg.type === 'key-exchange') {
            const from = String(msg.from || '')
            if (!from) return
            setRemotePeerId((prev) => prev || from)

            const remotePublicKey = await crypto.subtle.importKey(
              'spki',
              base64ToArrayBuffer(msg.publicKeyB64),
              { name: 'ECDH', namedCurve: 'P-256' },
              true,
              [],
            )
            remotePubKeyRef.current = remotePublicKey
            await attemptDeriveAesKey()
            return
          }

          if (msg.type === 'chat-message') {
            const id = String(msg.messageId || crypto.randomUUID())
            const from = String(msg.from || '')
            const ts = Number(msg.ts || Date.now())
            const ivB64 = msg.ivB64
            const ciphertextB64 = msg.ciphertextB64

            if (!aesKeyRef.current) {
              pendingDecryptRef.current.push({ id, ivB64, ciphertextB64 })
              setMessages((prev) => [
                ...prev,
                {
                  id,
                  from,
                  ts,
                  ivB64,
                  ciphertextB64,
                },
              ])
              return
            }

            try {
              const text = await decryptText({ aesKey: aesKeyRef.current, ivB64, ciphertextB64 })
              setMessages((prev) => [...prev, { id, from, ts, ivB64, ciphertextB64, text }])
            } catch {
              setMessages((prev) => [...prev, { id, from, ts, ivB64, ciphertextB64, text: '[Unable to decrypt]' }])
            }

            return
          }
        }

        ws.onerror = () => setError('WebSocket error. Check the signaling server URL.')
        ws.onclose = () => {
          if (!cancelled) setStatus('ended')
        }
      } catch {
        if (!cancelled) setStatus('error')
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
    }
  }, [roomId, signalUrl])

  async function sendMessage() {
    setError('')
    const text = draft.trim()
    if (!text) return
    if (!remotePeerIdRef.current) return
    if (!aesKeyRef.current) return

    const id = crypto.randomUUID()
    const ts = Date.now()
    const { ivB64, ciphertextB64 } = await encryptText({ aesKey: aesKeyRef.current, plaintext: text })

    const message = {
      type: 'chat-message',
      roomId,
      from: myPeerIdRef.current,
      to: remotePeerIdRef.current,
      messageId: id,
      ts,
      ivB64,
      ciphertextB64,
    }

    // Optimistically render locally as decrypted.                                                                                                                                                                                                                                                                            
    setMessages((prev) => [...prev, { id, from: myPeerIdRef.current, ts, ivB64, ciphertextB64, text }])
    setDraft('')
    sendJson(message)
  }

  function openCallLink(mode) {
    const link = `${window.location.origin}/secure/call?roomId=${encodeURIComponent(roomId)}&mode=${encodeURIComponent(mode)}`
    navigator.clipboard
      .writeText(link)
      .then(() => alert('Call link copied. Paste it to the other person.'))
      .catch(() => {
        // Fallback: just open with the route.
        window.location.href = link
      })
  }

  function goToCall(mode) {
    window.location.href = `/secure/call?roomId=${encodeURIComponent(roomId)}&mode=${encodeURIComponent(mode)}`
  }

  function scheduleCall() {
    alert('Schedule call UI placeholder (backend scheduling not implemented in this MVP).')
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
              {status === 'secure' ? 'Encrypted' : status === 'waiting' ? 'Waiting for peer...' : 'Secure channel'}
            </div>
          </div>
        </div>

        <div className="secureChatHeader__actions">
          <button className="secureChatIconButton" type="button" onClick={() => goToCall('audio')} title="Voice call">
            <Icon name="phone" />
          </button>
          <button className="secureChatIconButton" type="button" onClick={() => goToCall('video')} title="Video call">
            <Icon name="video" />
          </button>
          <button
            className="secureChatIconButton"
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            title="More"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <Icon name="dots" />
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div className="secureChatMenu" role="menu" aria-label="Chat actions">
          <button
            className="secureChatMenu__item"
            type="button"
            onClick={() => {
              setMenuOpen(false)
              goToCall('audio')
            }}
          >
            Voice Call <span className="secureChatMenu__kbd">Audio</span>
          </button>
          <button
            className="secureChatMenu__item"
            type="button"
            onClick={() => {
              setMenuOpen(false)
              goToCall('video')
            }}
          >
            Video Call <span className="secureChatMenu__kbd">Video</span>
          </button>
          <button
            className="secureChatMenu__item"
            type="button"
            onClick={() => {
              setMenuOpen(false)
              openCallLink('video')
            }}
          >
            Send call link <span className="secureChatMenu__kbd">Copy URL</span>
          </button>
          <button
            className="secureChatMenu__item"
            type="button"
            onClick={() => {
              setMenuOpen(false)
              scheduleCall()
            }}
          >
            Schedule call <span className="secureChatMenu__kbd">Demo</span>
          </button>
        </div>
      ) : null}

      <div className="secureChatBanner">
        <div style={{ color: '#22c55e', marginTop: 1 }}>
          <Icon name="lock" />
        </div>
        <div className="secureChatBanner__text">
          Messages and calls are end-to-end encrypted. Only people in this chat can read, listen to, or share them.
        </div>
      </div>

      <div className="secureChatBody">
        <div className="secureChatStatusLine">
          Room: <code>{roomId}</code> • {remotePeerId ? `Peer connected` : `Waiting for a second person`}
        </div>

        {messages.length === 0 ? (
          <div style={{ padding: '12px 0 24px', color: 'rgba(229,231,235,0.65)', fontSize: 13 }}>
            No messages yet. Join the same room on another browser/device to start chatting.
          </div>
        ) : null}

        {messages.map((m) => {
          const mine = myPeerId && m.from === myPeerId
          const text = m.text
          return (
            <div key={m.id} className={`secureChatRow ${mine ? 'secureChatRow--mine' : 'secureChatRow--theirs'}`}>
              <div className={`secureChatBubble ${mine ? 'secureChatBubble--mine' : 'secureChatBubble--theirs'}`}>
                {text === undefined ? 'Decrypting...' : text}
                <div className="secureChatMeta">{formatTime(m.ts)}</div>
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
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage().catch(() => setError('Message encryption/send failed.'))
              }
            }}
          />
          <button
            className="secureChatSendButton"
            type="button"
            onClick={() => sendMessage().catch(() => setError('Message encryption/send failed.'))}
            disabled={!draft.trim() || !remotePeerId || !aesReady}
            title={!remotePeerId ? 'Waiting for peer...' : !aesReady ? 'Securing...' : 'Send'}
          >
            <Icon name="send" />
          </button>
        </div>
        {error ? <div style={{ marginTop: 8, color: '#f87171', fontSize: 12 }}>{error}</div> : null}
      </div>
    </div>
  )
}

