/**
 * Shared in-memory cache/lock store for the Home Care+ backend.
 *
 * Redis has been removed from this project entirely. This module provides the
 * same exported API that consumers previously used (server.js background locks,
 * signaling room persistence, and generic JSON cache helpers) but now backed by
 * plain in-memory Maps. There is no network dependency and no connection logic,
 * so the app can never crash or hang due to Redis being unavailable.
 *
 * NOTE: In-memory storage is single-instance only. Data is not shared across
 * server processes and is cleared on restart. This is acceptable for this app.
 */
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000 // default 7-day TTL

// In-memory stores
const store = new Map() // key -> { value, expiresAt }
const locks = new Map() // lockName -> { token, acquiredAt, ttlMs }

/**
 * Write a value into the in-memory store with a TTL.
 * @param {string} key
 * @param {any} value
 * @param {number} ttlMs
 */
function writeStore(key, value, ttlMs = DEFAULT_TTL_MS) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs })
}

/**
 * Read a value from the in-memory store, honouring TTL expiry.
 * @param {string} key
 * @returns {any|null}
 */
function readStore(key) {
  const entry = store.get(key)
  if (!entry) return null
  if (entry.expiresAt && entry.expiresAt <= Date.now()) {
    store.delete(key)
    return null
  }
  return entry.value
}

/**
 * Convert a Redis-style glob pattern to a RegExp for matching in-memory keys.
 * Supports `*` (any sequence) and `?` (single char).
 * @param {string} pattern
 * @returns {RegExp}
 */
function globToRegex(pattern) {
  let source = '^'
  for (const char of pattern) {
    if (char === '*') source += '.*'
    else if (char === '?') source += '.'
    else source += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  source += '$'
  return new RegExp(source)
}

/* No-op Redis lifecycle functions (kept for API compatibility). */

async function initRedis() {
  // Redis removed — nothing to initialise.
}

function getClient() {
  return null
}

function isFallbackMode() {
  // With Redis removed, the in-memory store is always the active mode.
  return true
}

async function closeRedis() {
  // Nothing to close.
}

/* -------------------------------------------------------------------------- *
 * Distributed locking (used by server.js background jobs)
 * -------------------------------------------------------------------------- */

/**
 * Tries to acquire a lock (in-memory, single-instance only).
 * @param {string} lockName - Logical lock name
 * @param {number} [ttlSeconds=30] - Lock TTL in seconds
 * @returns {Promise<string|null>} Lock token if acquired, else null
 */
async function acquireLock(lockName, ttlSeconds = 30) {
  const ttlMs = ttlSeconds * 1000
  const existing = locks.get(lockName)
  if (existing) {
    const elapsed = Date.now() - existing.acquiredAt
    if (elapsed < existing.ttlMs) return null
    locks.delete(lockName)
  }
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  locks.set(lockName, { token, acquiredAt: Date.now(), ttlMs })
  return token
}

/**
 * Releases a previously acquired lock (safe: only deletes if token matches).
 * @param {string} lockName - Logical lock name
 * @param {string} token - Token returned by acquireLock
 */
async function releaseLock(lockName, token) {
  const existing = locks.get(lockName)
  if (existing && existing.token === token) {
    locks.delete(lockName)
  }
}

/* -------------------------------------------------------------------------- *
 * Signaling room persistence (used by index.js)
 * -------------------------------------------------------------------------- */

function readMemoryRoom(roomId) {
  const room = readStore(`signaling:room:${roomId}`)
  return room ? JSON.parse(JSON.stringify(room)) : { messages: [] }
}

async function getSignalingRoom(roomId) {
  return readMemoryRoom(roomId)
}

async function appendSignalingMessage(roomId, message) {
  const key = `signaling:room:${roomId}`
  const memRoom = readMemoryRoom(roomId)
  if (!Array.isArray(memRoom.messages)) memRoom.messages = []
  memRoom.messages.push(message)
  if (memRoom.messages.length > 500) memRoom.messages.splice(0, memRoom.messages.length - 500)
  writeStore(key, memRoom)
}

async function deleteSignalingRoom(roomId) {
  store.delete(`signaling:room:${roomId}`)
}

/**
 * Legacy alias matching the original API. Stores a full room object.
 * @param {string} roomId
 * @param {object} roomData
 */
async function setSignalingRoom(roomId, roomData) {
  const key = `signaling:room:${roomId}`
  const serialized = JSON.parse(JSON.stringify(roomData))
  writeStore(key, serialized, 3600 * 1000)
}

/* -------------------------------------------------------------------------- *
 * Generic JSON cache helpers (used by API routes)
 * -------------------------------------------------------------------------- */

async function getJson(key) {
  return readStore(key)
}

async function setJson(key, value, ttlSeconds) {
  const ttlMs = ttlSeconds ? ttlSeconds * 1000 : DEFAULT_TTL_MS
  writeStore(key, value, ttlMs)
}

async function delKey(key) {
  store.delete(key)
}

async function delMatching(pattern) {
  const deleted = []
  const regex = globToRegex(pattern)
  for (const key of Array.from(store.keys())) {
    if (regex.test(key)) {
      store.delete(key)
      deleted.push(key)
    }
  }
  return deleted
}

module.exports = {
  initRedis,
  getClient,
  isFallbackMode,
  acquireLock,
  releaseLock,
  setSignalingRoom,
  getSignalingRoom,
  deleteSignalingRoom,
  appendSignalingMessage,
  getJson,
  setJson,
  delKey,
  delMatching,
  closeRedis,
}
