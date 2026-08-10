"use client"

import { useState } from "react"

// Lightweight location viewer used to display the patient's location.
// It renders an embedded OpenStreetMap iframe with a marker, and a "Get
// directions" toggle that reveals an embedded route map inside the system
// (no external tabs, no API key required).

function buildViewUrl(lat, lng) {
  const bbox = `${lng - 0.02}%2C${lat - 0.02}%2C${lng + 0.02}%2C${lat + 0.02}`
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`
}

// Google Maps embed (output=embed) works without an API key and renders the
// destination with a route so the nurse can see directions while staying in-app.
function buildNavUrl(lat, lng, address) {
  const query = address && String(address).trim() ? encodeURIComponent(String(address).trim()) : encodeURIComponent(`${lat},${lng}`)
  return `https://maps.google.com/maps?q=${query}&z=15&output=embed`
}

export default function MapView({ locationCoords, address, locationLabel }) {
  const [showDirections, setShowDirections] = useState(false)

  const coords = locationCoords && Number.isFinite(locationCoords.lat) && Number.isFinite(locationCoords.lng)
    ? { lat: locationCoords.lat, lng: locationCoords.lng }
    : null

  if (!coords) {
    return (
      <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #e5eef6", background: "#f8fafc", padding: "1rem", textAlign: "center", color: "#64748b", fontSize: "0.9rem" }}>
        <div style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>📍</div>
        <strong>Patient location</strong>
        <div style={{ marginTop: "0.25rem" }}>{locationLabel || address || "Exact coordinates not provided."}</div>
        {address ? <div style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "#94a3b8" }}>{address}</div> : null}
      </div>
    )
  }

  return (
    <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #e5eef6" }}>
      <iframe
        title="Patient location map"
        width="100%"
        height={showDirections ? 320 : 260}
        loading="lazy"
        src={showDirections ? buildNavUrl(coords.lat, coords.lng, address) : buildViewUrl(coords.lat, coords.lng)}
        style={{ border: 0, display: "block" }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", padding: "0.6rem 0.85rem", background: "#fff", fontSize: "0.85rem", color: "#475569" }}>
        <span>📍 {locationLabel || address || `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`}</span>
        <button
          type="button"
          onClick={() => setShowDirections((value) => !value)}
          style={{ color: "#0891b2", fontWeight: 600, textDecoration: "none", border: "none", background: "transparent", cursor: "pointer", padding: 0, fontSize: "0.85rem" }}
        >
          {showDirections ? "Show location map" : "Get directions ↓"}
        </button>
      </div>
    </div>
  )
}
