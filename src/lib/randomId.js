/**
 * UUID v4. Uses Web Crypto when available; falls back for environments where
 * `crypto.randomUUID` is missing (some HTTP contexts, older browsers, or Webpack client bundles).
 */
export function randomId() {
  const c = typeof globalThis !== "undefined" ? globalThis.crypto : undefined
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID()
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0
    const v = ch === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
