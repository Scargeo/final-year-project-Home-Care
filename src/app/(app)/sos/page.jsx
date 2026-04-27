"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import AppShell from "../../components/AppShell.jsx"
import { randomId } from "../../lib/randomId.js"
import { appendAudit } from "../../lib/auditLog.js"

function mapsUrl(lat, lng) {
  const a = encodeURIComponent(`${lat},${lng}`)
  return `https://www.google.com/maps?q=${a}`
}

function osmUrl(lat, lng) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=16`
}

/** Street View / look-around at position, oriented to device/GPS heading when known */
function streetViewUrl(lat, lng, headingDeg) {
  const h = Number(headingDeg)
  if (!Number.isFinite(h)) return ""
  const head = Math.round(((h % 360) + 360) % 360)
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${encodeURIComponent(`${lat},${lng}`)}&heading=${head}&pitch=0&fov=80`
}

function normalizeDeg(d) {
  if (d == null || !Number.isFinite(Number(d))) return null
  const x = Number(d)
  return ((x % 360) + 360) % 360
}

function degToCardinal(deg) {
  const d = normalizeDeg(deg)
  if (d == null) return null
  const labels = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
  const idx = Math.round(d / 45) % 8
  return labels[idx]
}

function formatHeadingLine(label, deg) {
  const d = normalizeDeg(deg)
  if (d == null) return null
  const c = degToCardinal(d)
  return `${label}: ${Math.round(d)}° (${c ?? "—"})`
}

async function getCurrentPositionAsync(options) {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error("Geolocation is not available in this browser.")
  }
  return await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  })
}

function orientationToHeading(e) {
  if (e.webkitCompassHeading != null && Number.isFinite(e.webkitCompassHeading)) {
    return normalizeDeg(e.webkitCompassHeading)
  }
  if (e.absolute && e.alpha != null && Number.isFinite(e.alpha)) {
    return normalizeDeg(360 - e.alpha)
  }
  if (e.alpha != null && Number.isFinite(e.alpha)) {
    return normalizeDeg(360 - e.alpha)
  }
  return null
}

function CompassDial({ degrees, size = 140, label = "Direction" }) {
  const d = normalizeDeg(degrees)
  const known = d != null
  const cx = size / 2
  const cy = size / 2
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)" }}>{label}</span>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          border: "2px solid color-mix(in srgb, var(--border) 80%, #64748b)",
          background: "color-mix(in srgb, var(--surface) 92%, transparent)",
          position: "relative",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
        }}
        aria-label={known ? `Compass ${Math.round(d)} degrees` : "Compass direction unknown"}
      >
        {["N", "E", "S", "W"].map((dir, i) => {
          const ang = i * 90
          return (
            <span
              key={dir}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 24,
                marginLeft: -12,
                marginTop: -10,
                textAlign: "center",
                fontSize: 11,
                fontWeight: 900,
                color: dir === "N" ? "#b91c1c" : "var(--muted)",
                transform: `rotate(${ang}deg) translateY(-${size / 2 - 14}px) rotate(${-ang}deg)`,
                zIndex: 1,
              }}
            >
              {dir}
            </span>
          )
        })}
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: "absolute", inset: 0, zIndex: 2 }}>
          {known ? (
            <g transform={`translate(${cx},${cy}) rotate(${d})`}>
              <polygon points="0,-42 -14,28 14,28" fill="#b91c1c" stroke="rgba(0,0,0,0.2)" strokeWidth="1" />
              <circle r="5" fill="#0f172a" />
            </g>
          ) : (
            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="34" fontWeight="800" fill="rgba(100,116,139,0.85)">
              ?
            </text>
          )}
        </svg>
      </div>
      {known ? (
        <div style={{ fontSize: 13, fontWeight: 800, textAlign: "center" }}>
          {Math.round(d)}° · {degToCardinal(d)}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", maxWidth: size + 48 }}>Tap “Enable compass” or move to get GPS heading</div>
      )}
    </div>
  )
}

export default function SosPage() {
  const [note, setNote] = useState("")
  const [sent, setSent] = useState([])
  const [busyKind, setBusyKind] = useState("")
  const [preview, setPreview] = useState(null)
  const [previewError, setPreviewError] = useState("")
  const [compassHeading, setCompassHeading] = useState(null)
  const [compassError, setCompassError] = useState("")
  const [compassActive, setCompassActive] = useState(false)

  const compassRef = useRef(null)

  useEffect(() => {
    compassRef.current = compassHeading
  }, [compassHeading])

  useEffect(() => {
    if (!compassActive || typeof window === "undefined") return

    function onOrient(e) {
      const h = orientationToHeading(e)
      if (h != null) setCompassHeading(h)
    }

    window.addEventListener("deviceorientationabsolute", onOrient, true)
    window.addEventListener("deviceorientation", onOrient, true)
    return () => {
      window.removeEventListener("deviceorientationabsolute", onOrient, true)
      window.removeEventListener("deviceorientation", onOrient, true)
    }
  }, [compassActive])

  const refreshPreview = useCallback(async () => {
    setPreviewError("")
    setPreview(null)
    try {
      const pos = await getCurrentPositionAsync({
        enableHighAccuracy: true,
        timeout: 20_000,
        maximumAge: 0,
      })
      const lat = Number(pos.coords.latitude)
      const lng = Number(pos.coords.longitude)
      const accuracy = pos.coords.accuracy != null ? Number(pos.coords.accuracy) : null
      const heading = pos.coords.heading != null && Number.isFinite(pos.coords.heading) ? normalizeDeg(pos.coords.heading) : null
      const speed = pos.coords.speed != null && Number.isFinite(pos.coords.speed) ? Number(pos.coords.speed) : null
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error("Invalid coordinates.")
      setPreview({
        lat,
        lng,
        accuracy,
        heading,
        speed,
        at: Date.now(),
        mapUrl: mapsUrl(lat, lng),
        streetViewUrl: heading != null ? streetViewUrl(lat, lng, heading) : "",
      })
    } catch (e) {
      const msg = e?.code === 1 ? "Location permission denied." : e?.message || "Could not read location."
      setPreviewError(msg)
    }
  }, [])

  async function enableCompass() {
    setCompassError("")
    try {
      const DO = typeof window !== "undefined" ? window.DeviceOrientationEvent : undefined
      if (DO && typeof DO.requestPermission === "function") {
        const res = await DO.requestPermission()
        if (res !== "granted") {
          setCompassError("Compass permission was not granted.")
          return
        }
      }
      setCompassActive(true)
    } catch {
      setCompassError("Could not enable compass on this device.")
    }
  }

  function bestFacingDeg(gpsHeading, deviceHeading) {
    if (deviceHeading != null) return deviceHeading
    if (gpsHeading != null) return gpsHeading
    return null
  }

  async function trigger(kind) {
    setBusyKind(kind)
    let coords = preview
    let locNote = ""
    let headingGps = null
    let speedMps = null

    try {
      if (!coords) {
        const pos = await getCurrentPositionAsync({
          enableHighAccuracy: true,
          timeout: 20_000,
          maximumAge: 0,
        })
        const lat = Number(pos.coords.latitude)
        const lng = Number(pos.coords.longitude)
        const accuracy = pos.coords.accuracy != null ? Number(pos.coords.accuracy) : null
        headingGps = pos.coords.heading != null && Number.isFinite(pos.coords.heading) ? normalizeDeg(pos.coords.heading) : null
        speedMps = pos.coords.speed != null && Number.isFinite(pos.coords.speed) ? Number(pos.coords.speed) : null
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error("Invalid coordinates.")
        coords = {
          lat,
          lng,
          accuracy,
          heading: headingGps,
          speed: speedMps,
          at: Date.now(),
          mapUrl: mapsUrl(lat, lng),
          streetViewUrl: headingGps != null ? streetViewUrl(lat, lng, headingGps) : "",
        }
        setPreview(coords)
      } else {
        headingGps = coords.heading ?? null
        speedMps = coords.speed ?? null
      }

      const headingCompass = compassRef.current
      const facingDeg = bestFacingDeg(coords.heading ?? headingGps, headingCompass)
      const cardinal = degToCardinal(facingDeg)

      locNote = `lat=${coords.lat.toFixed(6)} lng=${coords.lng.toFixed(6)}`
      if (coords.accuracy != null && Number.isFinite(coords.accuracy)) {
        locNote += ` accuracy≈${Math.round(coords.accuracy)}m`
      }
      if (headingGps != null) locNote += ` | gps_heading=${Math.round(headingGps)}°`
      if (headingCompass != null) locNote += ` | compass=${Math.round(headingCompass)}°`
      if (cardinal) locNote += ` | facing≈${cardinal}`
      if (speedMps != null && speedMps >= 0) locNote += ` | speed≈${(speedMps * 3.6).toFixed(1)}km/h`
      locNote += ` | ${coords.mapUrl}`
    } catch (e) {
      const reason = e?.code === 1 ? "permission_denied" : e?.message || "unknown"
      locNote = `location_unavailable (${reason})`
      coords = null
    }

    const headingCompassSnap = compassRef.current
    const facingSnap = coords ? bestFacingDeg(coords.heading ?? null, headingCompassSnap) : null
    const cardinalSnap = degToCardinal(facingSnap)
    const streetSnap =
      coords && facingSnap != null ? streetViewUrl(coords.lat, coords.lng, facingSnap) : coords?.streetViewUrl || ""

    const id = randomId()
    const ts = Date.now()
    const userNote = note.trim()
    const auditDetail = [kind, userNote || null, locNote].filter(Boolean).join(" — ")
    appendAudit({ action: "sos.triggered", resource: "emergency", detail: auditDetail })

    setSent((prev) =>
      [
        {
          id,
          ts,
          kind,
          note: userNote,
          lat: coords?.lat,
          lng: coords?.lng,
          accuracy: coords?.accuracy,
          headingGps: coords?.heading ?? null,
          headingCompass: headingCompassSnap,
          facingDeg: facingSnap,
          facingCardinal: cardinalSnap,
          speedMps: coords?.speed ?? null,
          mapUrl: coords?.mapUrl,
          osmUrl: coords ? osmUrl(coords.lat, coords.lng) : "",
          streetViewUrl: streetSnap || "",
          locationFailed: !coords,
        },
        ...prev,
      ].slice(0, 12),
    )
    setNote("")
    setBusyKind("")
  }

  const previewFacing = preview ? bestFacingDeg(preview.heading, compassHeading) : null

  return (
    <AppShell title="Emergency (SOS)">
      <div className="hcCard" style={{ borderColor: "color-mix(in srgb, #ef4444 35%, var(--border))" }}>
        <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>Rapid assistance request</div>
        <p style={{ margin: "10px 0 0", color: "var(--muted)", fontSize: 13, lineHeight: 1.55 }}>
          SOS sends your <b>GPS position</b> plus <b>direction</b>: device compass when enabled, otherwise GPS heading when you are moving. Dispatch can match the map
          with the compass needle so responders find you faster. For life-threatening emergencies, call your local emergency number.
        </p>

        <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
          <CompassDial degrees={previewFacing} size={148} label="You are facing" />
          <div style={{ flex: "1 1 220px", minWidth: 0 }}>
            <div className="hcLabel">Device compass (best for “which way am I facing?”)</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
              <button className="hcBtn hcBtn--ghost" type="button" onClick={() => void enableCompass()}>
                {compassActive ? "Compass on" : "Enable compass"}
              </button>
              {compassError ? <span style={{ fontSize: 13, color: "#b45309" }}>{compassError}</span> : null}
            </div>
            {compassActive ? (
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted)", lineHeight: 1.45 }}>
                Hold the phone flat and level. If the needle is wrong, move in a small figure‑eight to calibrate (device-dependent).
              </p>
            ) : null}
            {formatHeadingLine("Compass", compassHeading) ? (
              <p style={{ margin: "8px 0 0", fontSize: 13, fontWeight: 700 }}>{formatHeadingLine("Compass", compassHeading)}</p>
            ) : null}
            {formatHeadingLine("GPS movement", preview?.heading) ? (
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted)" }}>{formatHeadingLine("GPS movement", preview?.heading)}</p>
            ) : preview ? (
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--muted)" }}>GPS direction appears when the device is moving (not all phones report it).</p>
            ) : null}
          </div>
        </div>

        <div className="hcField" style={{ marginTop: 18 }}>
          <div className="hcLabel">Your location (shared with the alert)</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button className="hcBtn hcBtn--ghost" type="button" onClick={() => void refreshPreview()}>
              Update location now
            </button>
            {preview ? (
              <span style={{ fontSize: 13, color: "var(--muted)" }}>
                {preview.lat.toFixed(5)}, {preview.lng.toFixed(5)}
                {preview.accuracy != null ? ` · ±${Math.round(preview.accuracy)} m` : ""}
              </span>
            ) : previewError ? (
              <span style={{ fontSize: 13, color: "#b45309" }}>{previewError}</span>
            ) : (
              <span style={{ fontSize: 13, color: "var(--muted)" }}>Not captured yet — we will read GPS when you press SOS.</span>
            )}
          </div>
          {preview ? (
            <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a className="hcBtn hcBtn--sm hcBtn--primary" href={preview.mapUrl} target="_blank" rel="noreferrer">
                Open in Maps
              </a>
              {preview.streetViewUrl ? (
                <a className="hcBtn hcBtn--sm hcBtn--ghost" href={preview.streetViewUrl} target="_blank" rel="noreferrer">
                  Street View (GPS heading)
                </a>
              ) : previewFacing != null ? (
                <a className="hcBtn hcBtn--sm hcBtn--ghost" href={streetViewUrl(preview.lat, preview.lng, previewFacing)} target="_blank" rel="noreferrer">
                  Street View (facing)
                </a>
              ) : null}
              <button
                className="hcBtn hcBtn--sm hcBtn--ghost"
                type="button"
                onClick={() => {
                  const face = previewFacing
                  const parts = [
                    `${preview.lat.toFixed(6)}, ${preview.lng.toFixed(6)}`,
                    preview.mapUrl,
                    face != null ? `Facing ~${Math.round(face)}° (${degToCardinal(face)})` : null,
                  ].filter(Boolean)
                  void navigator.clipboard?.writeText(parts.join(" — ")).catch(() => {})
                }}
              >
                Copy location + direction
              </button>
            </div>
          ) : null}
        </div>

        <div className="hcField" style={{ marginTop: 12 }}>
          <div className="hcLabel">Optional context (symptoms, access notes)</div>
          <textarea className="hcTextarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Fall in bathroom, front door unlocked" />
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            className="hcBtn hcBtn--primary"
            type="button"
            style={{ background: "#b91c1c", borderColor: "#b91c1c" }}
            disabled={Boolean(busyKind)}
            onClick={() => void trigger("Medical SOS")}
          >
            {busyKind === "Medical SOS" ? "Sending…" : "Medical SOS"}
          </button>
          <button className="hcBtn hcBtn--ghost" type="button" disabled={Boolean(busyKind)} onClick={() => void trigger("Caregiver dispatch")}>
            {busyKind === "Caregiver dispatch" ? "Sending…" : "Request caregiver"}
          </button>
          <a className="hcBtn hcBtn--ghost" href="/telehealth">
            Start telehealth
          </a>
          <a className="hcBtn hcBtn--ghost" href="/secure/chat">
            Message care team
          </a>
        </div>
      </div>

      <div className="hcCard" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>Recent alerts (this device)</div>
        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          {sent.length === 0 ? <div style={{ color: "var(--muted)", fontSize: 13 }}>No SOS events yet.</div> : null}
          {sent.map((s) => (
            <div key={s.id} style={{ padding: 12, borderRadius: 14, border: "1px solid var(--border)", fontSize: 13 }}>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{new Date(s.ts).toLocaleString()}</div>
              <div style={{ marginTop: 6, fontWeight: 900 }}>{s.kind}</div>
              {s.note ? <div style={{ marginTop: 4 }}>{s.note}</div> : null}
              {s.locationFailed ? (
                <div style={{ marginTop: 8, fontSize: 12, color: "#b45309" }}>Location not included — enable permission and send again.</div>
              ) : s.lat != null && s.lng != null ? (
                <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
                  <CompassDial degrees={s.facingDeg} size={112} label="Facing at SOS" />
                  <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                    <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
                      {Number(s.lat).toFixed(6)}, {Number(s.lng).toFixed(6)}
                      {s.accuracy != null ? ` · ±${Math.round(s.accuracy)} m` : ""}
                    </div>
                    {s.facingDeg != null ? (
                      <div style={{ marginTop: 6, fontSize: 13, fontWeight: 800 }}>
                        Direction: {Math.round(s.facingDeg)}° {s.facingCardinal ? `(${s.facingCardinal})` : ""}
                        {s.headingCompass != null ? <span style={{ fontWeight: 600, color: "var(--muted)" }}> · compass</span> : null}
                        {s.headingGps != null && s.headingCompass == null ? <span style={{ fontWeight: 600, color: "var(--muted)" }}> · GPS movement</span> : null}
                      </div>
                    ) : (
                      <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>No direction data — enable compass before SOS or move to get GPS heading.</div>
                    )}
                    {s.speedMps != null && s.speedMps > 0.5 ? (
                      <div style={{ marginTop: 4, fontSize: 12, color: "var(--muted)" }}>Speed when sent: ~{(s.speedMps * 3.6).toFixed(1)} km/h</div>
                    ) : null}
                    <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <a className="hcBtn hcBtn--sm hcBtn--ghost" href={s.mapUrl} target="_blank" rel="noreferrer">
                        Google Maps
                      </a>
                      {s.osmUrl ? (
                        <a className="hcBtn hcBtn--sm hcBtn--ghost" href={s.osmUrl} target="_blank" rel="noreferrer">
                          OpenStreetMap
                        </a>
                      ) : null}
                      {s.streetViewUrl ? (
                        <a className="hcBtn hcBtn--sm hcBtn--ghost" href={s.streetViewUrl} target="_blank" rel="noreferrer">
                          Street View (facing)
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
