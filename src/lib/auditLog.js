import { randomId } from "./randomId.js"

const AUDIT_KEY = "hc:audit:v1"
const MAX_ENTRIES = 200

export function appendAudit({ action, resource, detail, userId = "current-user" }) {
  if (typeof window === "undefined") return
  try {
    const raw = localStorage.getItem(AUDIT_KEY)
    const list = raw ? JSON.parse(raw) : []
    const entry = {
      id: randomId(),
      ts: Date.now(),
      userId,
      action,
      resource,
      detail: detail || "",
    }
    const next = [entry, ...(Array.isArray(list) ? list : [])].slice(0, MAX_ENTRIES)
    localStorage.setItem(AUDIT_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
}

export function readAudit() {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(AUDIT_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}
