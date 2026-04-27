import crypto from "crypto"
import fs from "fs/promises"
import path from "path"
import process from "process"
import { isRole } from "./auth-config.js"
import { assessProfileTrust } from "./profileTrust.js"
import { randomId } from "./randomId.js"

const DATA_DIR = path.join(process.cwd(), ".data")
const USERS_FILE = path.join(DATA_DIR, "users.json")
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 14

function base64url(value) {
  return Buffer.from(value).toString("base64url")
}

function parseJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true })
  try {
    await fs.access(USERS_FILE)
  } catch {
    await fs.writeFile(USERS_FILE, "[]", "utf8")
  }
}

async function readUsers() {
  await ensureStore()
  const raw = await fs.readFile(USERS_FILE, "utf8")
  const parsed = parseJson(raw)
  return Array.isArray(parsed) ? parsed : []
}

export async function listUsersSanitized() {
  const users = await readUsers()
  return users.map((u) => {
    const copy = { ...u }
    delete copy.passwordHash
    return copy
  })
}

async function writeUsers(users) {
  await ensureStore()
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), "utf8")
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex")
  const derived = await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, key) => {
      if (err) return reject(err)
      resolve(key.toString("hex"))
    })
  })
  return `${salt}:${derived}`
}

export async function verifyPassword(password, hash) {
  const [salt, expected] = String(hash || "").split(":")
  if (!salt || !expected) return false
  const actual = await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, key) => {
      if (err) return reject(err)
      resolve(key.toString("hex"))
    })
  })
  const expectedBuf = Buffer.from(expected, "hex")
  const actualBuf = Buffer.from(actual, "hex")
  if (expectedBuf.length !== actualBuf.length) return false
  return crypto.timingSafeEqual(expectedBuf, actualBuf)
}

function getSecret() {
  return process.env.AUTH_SECRET || "hc-demo-secret-change-me"
}

function signToken(payload) {
  const header = { alg: "HS256", typ: "JWT" }
  const now = Date.now()
  const body = { ...payload, iat: now, exp: now + TOKEN_TTL_MS }
  const h = base64url(JSON.stringify(header))
  const b = base64url(JSON.stringify(body))
  const sig = crypto.createHmac("sha256", getSecret()).update(`${h}.${b}`).digest("base64url")
  return `${h}.${b}.${sig}`
}

export function verifyToken(token) {
  if (!token || typeof token !== "string") return null
  const parts = token.split(".")
  if (parts.length !== 3) return null
  const [h, b, sig] = parts
  const expectedSig = crypto.createHmac("sha256", getSecret()).update(`${h}.${b}`).digest("base64url")
  const sigBuf = Buffer.from(sig)
  const expBuf = Buffer.from(expectedSig)
  if (sigBuf.length !== expBuf.length) return null
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null
  const payload = parseJson(Buffer.from(b, "base64url").toString("utf8"))
  if (!payload || payload.exp < Date.now()) return null
  return payload
}

export async function registerUser({ fullName, email, password, role }) {
  const safeRole = String(role || "").toLowerCase()
  const safeEmail = String(email || "").trim().toLowerCase()
  const safeName = String(fullName || "").trim()
  if (!safeName || !safeEmail || !password || !isRole(safeRole)) {
    throw new Error("Please provide valid full name, email, password, and role.")
  }
  const users = await readUsers()
  const existing = users.find((x) => x.email === safeEmail)
  if (existing) throw new Error("Email already exists.")
  const passwordHash = await hashPassword(password)
  const trust = assessProfileTrust({ email: safeEmail, fullName: safeName, role: safeRole })
  const user = {
    id: randomId(),
    fullName: safeName,
    email: safeEmail,
    role: safeRole,
    passwordHash,
    createdAt: Date.now(),
    trust,
  }
  users.push(user)
  await writeUsers(users)
  const token = signToken({ sub: user.id, email: user.email, role: user.role, fullName: user.fullName })
  return {
    token,
    user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role },
    trust,
  }
}

export async function loginUser({ email, password }) {
  const safeEmail = String(email || "").trim().toLowerCase()
  if (!safeEmail || !password) throw new Error("Email and password are required.")
  const users = await readUsers()
  const user = users.find((x) => x.email === safeEmail)
  if (!user) throw new Error("Invalid credentials.")
  const ok = await verifyPassword(password, user.passwordHash)
  if (!ok) throw new Error("Invalid credentials.")
  const token = signToken({ sub: user.id, email: user.email, role: user.role, fullName: user.fullName })
  return { token, user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role } }
}
