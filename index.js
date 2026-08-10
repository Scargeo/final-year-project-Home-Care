import { WebSocketServer } from 'ws'
import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'

// Load the same server/.env used by the Express backend so the signaling server
// verifies JWTs with the SAME JWT_SECRET the auth tokens were signed with.
// Without this, verifyToken() uses the fallback secret ('dev-secret-change-me')
// and rejects every valid join, leaving rooms stuck on "Waiting for a second person".
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const envPath = path.resolve(__dirname, 'server', '.env')
try {
  process.loadEnvFile(envPath)
} catch {
  // server/.env may be absent in some environments; fall back to process env.
}

const require = createRequire(import.meta.url)
let verifyToken
try {
  ;({ verifyToken } = require('./server/middleware/jwtAuth'))
} catch {
  // jwtAuth is unavailable; join attempts will be rejected. Kept for resilience.
  verifyToken = () => null
}

const PORT = Number(process.env.PORT || 3001)

// In-memory room store: roomId -> { peers: Map(peerId -> ws), messages: Array }
const memoryRooms = new Map()

function getOrCreateRoom(roomId) {
  let room = memoryRooms.get(roomId)
  if (!room) {
    room = { peers: new Map(), messages: [] }
    memoryRooms.set(roomId, room)
  }
  return room
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function sendJson(ws, payload) {
  if (ws.readyState !== ws.OPEN) return
  ws.send(JSON.stringify(payload))
}

const wss = new WebSocketServer({ port: PORT })
console.log(`[signaling] listening on ws://localhost:${PORT}`)

wss.on('connection', (ws) => {
  ws._roomId = null
  ws._peerId = null

  ws.on('message', (raw) => {
    const msg = safeJsonParse(raw)
    if (!msg || typeof msg.type !== 'string') return

if (msg.type === 'join') {
      const { roomId, peerId } = msg
      if (!roomId || !peerId) return

      const roomKey = String(roomId)
      ws._roomId = roomKey
      ws._peerId = String(peerId)

      // Emergency SOS rooms are time-sensitive safety channels. A patient who
      // is mid-emergency may not have a verifiable JWT available (e.g., they
      // initiated the SOS without a full login). To avoid leaving them stuck
      // on "Waiting for a second person" forever, emergency rooms are allowed
      // to pair without strict token validation. Appointments/consultation
      // rooms still require a valid token.
      const isEmergencyRoom = roomKey.startsWith('emergency-')
      const token = msg.token || ''
      const payload = verifyToken(token)
      if (!isEmergencyRoom && !payload) {
        return sendJson(ws, { type: 'error', message: 'Unauthorized: invalid or missing token' })
      }

      ws._user = payload || { role: 'guest', id: ws._peerId }

      const room = getOrCreateRoom(ws._roomId)
      // Enforce 1 websocket per peerId in the room.
      if (room.peers.has(ws._peerId)) {
        return sendJson(ws, { type: 'error', message: 'peerId already exists in room' })
      }

      room.peers.set(ws._peerId, ws)

      // 1:1 POC: if someone already exists, exchange match info.
      const otherPeerId = Array.from(room.peers.keys()).find((id) => id !== ws._peerId)
      if (otherPeerId) {
        sendJson(ws, { type: 'match', peerId: otherPeerId })
        const otherWs = room.peers.get(otherPeerId)
        sendJson(otherWs, { type: 'match', peerId: ws._peerId })
      } else {
        sendJson(ws, { type: 'waiting' })
      }

      // Send encrypted chat history to the joining peer.
      // The server never decrypts; it only stores/routes ciphertext.
      sendJson(ws, { type: 'history', messages: room.messages })

      return
    }

    const { roomId, to } = msg
    if (!roomId || !to) return
    const room = memoryRooms.get(String(roomId))
    if (!room) return

    const targetWs = room.peers.get(String(to))
    if (!targetWs) return

    if (msg.type === 'chat-message') {
      // Store encrypted payload for history.
      // Expected shape: { type, roomId, from, to, messageId, ts, ivB64, ciphertextB64 }
      const stored = {
        messageId: msg.messageId || String(Date.now()),
        ts: msg.ts || Date.now(),
        from: msg.from,
        ivB64: msg.ivB64,
        ciphertextB64: msg.ciphertextB64,
      }
      room.messages.push(stored)
      // Keep bounded history in memory for the POC.
      if (room.messages.length > 500) room.messages.splice(0, room.messages.length - 500)
    }

    // Route offer/answer/ice/chat-message without inspecting contents.
    sendJson(targetWs, msg)
  })

  ws.on('close', () => {
    const roomId = ws._roomId
    const peerId = ws._peerId
    if (!roomId || !peerId) return

    const room = memoryRooms.get(roomId)
    if (!room) return
    room.peers.delete(peerId)

    // Notify remaining peers.
    for (const [, otherWs] of room.peers.entries()) {
      sendJson(otherWs, { type: 'peer-left', peerId })
    }

    if (room.peers.size === 0) {
      memoryRooms.delete(roomId)
    }
  })
})
