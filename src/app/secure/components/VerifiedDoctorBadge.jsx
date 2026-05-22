"use client"

export default function VerifiedDoctorBadge({ doctor, verified, role, className = "", style = {}, label }) {
  const isVerified = typeof verified === "boolean" ? verified : Boolean(doctor?.isVerified)
  const normalizedRole = String(role || doctor?.role || "").toLowerCase()
  const badgeRole = normalizedRole === "nurse" ? "nurse" : "doctor"
  const badgeLabel = label ?? (badgeRole === "nurse" ? "Verified nurse" : "Verified doctor")

  if (!isVerified || !["doctor", "nurse"].includes(badgeRole)) return null

  return (
    <span
      className={className}
      title={`Verified ${badgeRole}`}
      aria-label={`Verified ${badgeRole}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        padding: "0.14rem 0.5rem",
        borderRadius: "999px",
        background: "rgba(10, 102, 194, 0.1)",
        color: "#0a66c2",
        fontSize: "0.72rem",
        fontWeight: 700,
        whiteSpace: "nowrap",
        lineHeight: 1,
        flexShrink: 0,
        ...style,
      }}
    >
      ✓ {badgeLabel}
    </span>
  )
}
