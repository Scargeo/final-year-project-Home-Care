import { WebSocketServer } from 'ws'

const PORT = Number(process.env.PORT || 3002)

// roomId -> { peers: Map(peerId -> ws), messages: Array<EncryptedMessage> }
const rooms = new Map()

function getOrCreateRoom(roomId) {
  let room = rooms.get(roomId)
  if (!room) {
    room = { peers: new Map(), messages: [] }
    rooms.set(roomId, room)
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

wss.on('error', (error) => {
  if (error?.code === 'EADDRINUSE') {
    console.log(`[signaling] port ${PORT} is already in use. An existing signaling server may already be running.`)
    process.exit(0)
  }

  console.error('[signaling] failed to start:', error)
  process.exit(1)
})

wss.on('connection', (ws) => {
  ws._roomId = null
  ws._peerId = null

  ws.on('message', (raw) => {
    const msg = safeJsonParse(raw)
    if (!msg || typeof msg.type !== 'string') return

    if (msg.type === 'join') {
      const { roomId, peerId } = msg
      if (!roomId || !peerId) return

      ws._roomId = String(roomId)
      ws._peerId = String(peerId)

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
      // The server never decrypts; it only stores/routs ciphertext.
      sendJson(ws, { type: 'history', messages: room.messages })

      return
    }

    const { roomId, to } = msg
    if (!roomId || !to) return
    const room = rooms.get(String(roomId))
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

    const room = rooms.get(roomId)
    if (!room) return
    room.peers.delete(peerId)

    // Notify remaining peers.
    for (const [, otherWs] of room.peers.entries()) {
      sendJson(otherWs, { type: 'peer-left', peerId })
    }

    if (room.peers.size === 0) rooms.delete(roomId)
  })
})

