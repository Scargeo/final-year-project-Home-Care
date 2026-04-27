/**
 * Heuristic trust / fake-profile signals for demo purposes.
 * Production: document verification, licensing APIs, device reputation, and ML classifiers.
 */
export function assessProfileTrust({ email, fullName, role }) {
  const flags = []
  let score = 0
  const e = String(email || "").trim().toLowerCase()
  const local = e.split("@")[0] || ""
  const domain = e.split("@")[1] || ""

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
    flags.push("invalid_email")
    score += 30
  }

  if (/mailinator|tempmail|guerrillamail|10minutemail|trashmail|yopmail|discard\.email/i.test(e)) {
    flags.push("disposable_email")
    score += 45
  }

  if (local.length <= 2 || /^[0-9]+$/.test(local)) {
    flags.push("weak_local_part")
    score += 12
  }

  const name = String(fullName || "").trim()
  if (name.length > 0 && name.length < 3) {
    flags.push("very_short_name")
    score += 18
  }

  if (/^(dr\.?|doctor|nurse)\s*$/i.test(name)) {
    flags.push("generic_display_name")
    score += 22
  }

  const r = String(role || "").toLowerCase()
  if ((r === "doctor" || r === "nurse") && domain && !/(gov|edu|org|hospital|clinic|health|med)/i.test(domain)) {
    flags.push("unverified_clinical_domain")
    score += 8
  }

  const level = score >= 45 ? "high" : score >= 22 ? "medium" : "low"
  return { score: Math.min(100, score), flags, level }
}
