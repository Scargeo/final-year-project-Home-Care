import { ROLE_LABELS } from "./roles"

const USERS_KEY = "hc_users_v1"
const SESSION_KEY = "hc_session_v1"
const ACTIVITIES_KEY = "hc_activities_v1"
const RBAC_KEY = "hc_rbac_v1"
const STORE_SIGNAL_KEY = "hc_store_signal_v1"
const STORE_EVENT_NAME = "hc_store_change"

function nowIso() {
  return new Date().toISOString()
}

function randomId(prefix = "id") {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`
  }
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`
}

function safeRead(key, fallback) {
  if (typeof window === "undefined") return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function safeWrite(key, value) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(key, JSON.stringify(value))
}

function notifyStoreChange(scope = "all") {
  if (typeof window === "undefined") return
  const payload = {
    id: randomId("sig"),
    scope,
    at: nowIso(),
  }
  window.dispatchEvent(new CustomEvent(STORE_EVENT_NAME, { detail: payload }))
  window.localStorage.setItem(STORE_SIGNAL_KEY, JSON.stringify(payload))
}

export function subscribeStoreChanges(callback) {
  if (typeof window === "undefined") return () => {}
  const onLocalEvent = (event) => callback(event.detail || null)
  const onStorage = (event) => {
    if (event.key !== STORE_SIGNAL_KEY) return
    callback(safeRead(STORE_SIGNAL_KEY, null))
  }
  window.addEventListener(STORE_EVENT_NAME, onLocalEvent)
  window.addEventListener("storage", onStorage)
  return () => {
    window.removeEventListener(STORE_EVENT_NAME, onLocalEvent)
    window.removeEventListener("storage", onStorage)
  }
}

function createDefaultRbacMatrix() {
  const sectionPerms = [
    "dashboard.view",
    "appointments.view",
    "telehealth.view",
    "patients.view",
    "family_portal.view",
    "care_team.view",
    "marketplace.view",
    "medical_imaging.view",
    "notifications.view",
    "sos.view",
    "billing.view",
    "reports.view",
    "pharmacies.view",
  ]
  const allTrue = sectionPerms.reduce((acc, p) => {
    acc[p] = true
    return acc
  }, {})
  allTrue["users.manage"] = true
  allTrue["rbac.manage"] = true
  allTrue["audit.view"] = true

  return {
    admin: { ...allTrue },
    patient: {
      ...sectionPerms.reduce((acc, p) => ({ ...acc, [p]: false }), {}),
      "dashboard.view": true,
      "appointments.view": true,
      "telehealth.view": true,
      "patients.view": true,
      "family_portal.view": true,
      "marketplace.view": true,
      "notifications.view": true,
      "sos.view": true,
      "billing.view": true,
      "pharmacies.view": true,
      "users.manage": false,
      "rbac.manage": false,
      "audit.view": false,
    },
    doctor: {
      ...sectionPerms.reduce((acc, p) => ({ ...acc, [p]: false }), {}),
      "dashboard.view": true,
      "appointments.view": true,
      "telehealth.view": true,
      "patients.view": true,
      "family_portal.view": true,
      "care_team.view": true,
      "marketplace.view": true,
      "medical_imaging.view": true,
      "notifications.view": true,
      "sos.view": true,
      "reports.view": true,
      "pharmacies.view": true,
      "users.manage": false,
      "rbac.manage": false,
      "audit.view": false,
    },
    nurse: {
      ...sectionPerms.reduce((acc, p) => ({ ...acc, [p]: false }), {}),
      "dashboard.view": true,
      "appointments.view": true,
      "telehealth.view": true,
      "patients.view": true,
      "family_portal.view": true,
      "care_team.view": true,
      "medical_imaging.view": true,
      "notifications.view": true,
      "sos.view": true,
      "reports.view": true,
      "pharmacies.view": true,
      "users.manage": false,
      "rbac.manage": false,
      "audit.view": false,
    },
    pharmacy: {
      ...sectionPerms.reduce((acc, p) => ({ ...acc, [p]: false }), {}),
      "dashboard.view": true,
      "care_team.view": true,
      "marketplace.view": true,
      "notifications.view": true,
      "sos.view": true,
      "billing.view": true,
      "reports.view": true,
      "pharmacies.view": true,
      "users.manage": false,
      "rbac.manage": false,
      "audit.view": false,
    },
    rider: {
      ...sectionPerms.reduce((acc, p) => ({ ...acc, [p]: false }), {}),
      "dashboard.view": true,
      "care_team.view": true,
      "marketplace.view": true,
      "notifications.view": true,
      "sos.view": true,
      "pharmacies.view": true,
      "users.manage": false,
      "rbac.manage": false,
      "audit.view": false,
    },
    ambulance: {
      ...sectionPerms.reduce((acc, p) => ({ ...acc, [p]: false }), {}),
      "dashboard.view": true,
      "patients.view": true,
      "care_team.view": true,
      "notifications.view": true,
      "sos.view": true,
      "reports.view": true,
      "users.manage": false,
      "rbac.manage": false,
      "audit.view": false,
    },
  }
}

function initialUsers() {
  return [
    {
      id: randomId("user"),
      role: "admin",
      status: "active",
      email: "admin@homecare.local",
      password: "admin123",
      fullName: "System Admin",
      phone: "+233200000001",
      profile: { organizationName: "Home-Care+" },
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: randomId("user"),
      role: "patient",
      status: "active",
      email: "patient@demo.com",
      password: "patient123",
      fullName: "Ama Patient",
      phone: "+233200000002",
      profile: { emergencyContactName: "Kojo", emergencyContactPhone: "+233200000099" },
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: randomId("user"),
      role: "doctor",
      status: "active",
      email: "doctor@demo.com",
      password: "doctor123",
      fullName: "Dr Kojo Mensah",
      phone: "+233200000003",
      profile: { licenseNumber: "MD-GH-23939", specialty: "Internal medicine" },
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
  ]
}

export function seedStoreIfNeeded() {
  const users = safeRead(USERS_KEY, null)
  if (!users) safeWrite(USERS_KEY, initialUsers())
  const acts = safeRead(ACTIVITIES_KEY, null)
  if (!acts) safeWrite(ACTIVITIES_KEY, [])
  const rbac = safeRead(RBAC_KEY, null)
  if (!rbac) safeWrite(RBAC_KEY, createDefaultRbacMatrix())
}

export function getUsers() {
  seedStoreIfNeeded()
  return safeRead(USERS_KEY, [])
}

export function getActivities() {
  seedStoreIfNeeded()
  return safeRead(ACTIVITIES_KEY, [])
}

export function addActivity(activity) {
  const current = getActivities()
  const item = {
    id: randomId("act"),
    at: nowIso(),
    actor: activity.actor || "system",
    action: activity.action || "updated",
    resource: activity.resource || "system",
    detail: activity.detail || "",
  }
  safeWrite(ACTIVITIES_KEY, [item, ...current].slice(0, 300))
  notifyStoreChange("activities")
  return item
}

export function createUser(payload) {
  const users = getUsers()
  const email = String(payload.email || "").toLowerCase().trim()
  if (users.some((user) => user.email.toLowerCase() === email)) {
    return { ok: false, message: "Email already exists" }
  }

  const next = {
    id: randomId("user"),
    role: payload.role,
    status: "active",
    email,
    password: payload.password,
    fullName: payload.fullName,
    phone: payload.phone,
    profile: payload.profile || {},
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }

  safeWrite(USERS_KEY, [next, ...users])
  notifyStoreChange("users")
  addActivity({
    actor: next.email,
    action: "signup",
    resource: ROLE_LABELS[next.role] || next.role,
    detail: `${next.fullName} created a ${next.role} account`,
  })

  return { ok: true, user: next }
}

export function loginUser({ email, password }) {
  const users = getUsers()
  const match = users.find(
    (user) => user.email.toLowerCase() === String(email).toLowerCase().trim(),
  )
  if (!match || match.password !== password) {
    return { ok: false, message: "Invalid email or password" }
  }

  if (match.status === "blocked" || match.status === "suspended") {
    return { ok: false, message: `Account is ${match.status}. Contact admin.` }
  }

  const session = {
    userId: match.id,
    role: match.role,
    email: match.email,
    fullName: match.fullName,
    loggedInAt: nowIso(),
  }
  safeWrite(SESSION_KEY, session)
  notifyStoreChange("session")
  addActivity({
    actor: match.email,
    action: "login",
    resource: match.role,
    detail: `${match.fullName} logged in`,
  })
  return { ok: true, user: match, session }
}

export function getSession() {
  return safeRead(SESSION_KEY, null)
}

export function logoutUser() {
  const session = getSession()
  if (typeof window !== "undefined") window.localStorage.removeItem(SESSION_KEY)
  if (session) {
    addActivity({
      actor: session.email,
      action: "logout",
      resource: session.role,
      detail: `${session.fullName} signed out`,
    })
  }
  notifyStoreChange("session")
}

export function updateUser(userId, updates, actorEmail = "admin@homecare.local") {
  const users = getUsers()
  const next = users.map((user) => {
    if (user.id !== userId) return user
    return {
      ...user,
      ...updates,
      profile: { ...user.profile, ...(updates.profile || {}) },
      updatedAt: nowIso(),
    }
  })
  safeWrite(USERS_KEY, next)
  notifyStoreChange("users")
  const changed = next.find((user) => user.id === userId)
  if (changed) {
    addActivity({
      actor: actorEmail,
      action: "edit",
      resource: changed.role,
      detail: `${changed.fullName} account updated`,
    })
  }
}

export function setUserStatus(userId, status, actorEmail = "admin@homecare.local") {
  updateUser(userId, { status }, actorEmail)
  const user = getUsers().find((item) => item.id === userId)
  if (!user) return
  addActivity({
    actor: actorEmail,
    action: status,
    resource: user.role,
    detail: `${user.fullName} is now ${status}`,
  })
}

export function deleteUser(userId, actorEmail = "admin@homecare.local") {
  const users = getUsers()
  const user = users.find((item) => item.id === userId)
  safeWrite(
    USERS_KEY,
    users.filter((item) => item.id !== userId),
  )
  notifyStoreChange("users")
  if (user) {
    addActivity({
      actor: actorEmail,
      action: "delete",
      resource: user.role,
      detail: `${user.fullName} account was deleted`,
    })
  }
}

export function getRbacMatrix() {
  seedStoreIfNeeded()
  return safeRead(RBAC_KEY, createDefaultRbacMatrix())
}

export function setRbacPermission(role, permission, enabled, actorEmail = "admin@homecare.local") {
  const matrix = getRbacMatrix()
  const currentRole = matrix[role] || {}
  const next = {
    ...matrix,
    [role]: {
      ...currentRole,
      [permission]: Boolean(enabled),
    },
  }
  safeWrite(RBAC_KEY, next)
  addActivity({
    actor: actorEmail,
    action: "rbac_update",
    resource: role,
    detail: `${permission} => ${enabled ? "allowed" : "denied"}`,
  })
  notifyStoreChange("rbac")
}

export function canRoleAccess(role, permission) {
  const matrix = getRbacMatrix()
  return Boolean(matrix?.[role]?.[permission])
}
