"use client"

import { useEffect, useMemo, useState } from "react"
import AppShell from "../../components/AppShell.jsx"
import { randomId } from "../../lib/randomId.js"
import { loadAuth } from "../../lib/auth-client.js"

const STORAGE_KEY = "hc:marketplace:v1"

function loadListings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const p = raw ? JSON.parse(raw) : []
    return Array.isArray(p) ? p : []
  } catch {
    return []
  }
}

function saveListings(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

function emptyForm() {
  return { title: "", role: "doctor", specialty: "", rate: "", city: "", bio: "" }
}

export default function MarketplacePage() {
  const auth = typeof window !== "undefined" ? loadAuth() : null
  const selfRole = auth?.user?.role || "patient"
  const canOffer = selfRole === "doctor" || selfRole === "nurse" || selfRole === "admin"

  const [items, setItems] = useState(() => loadListings())
  const [query, setQuery] = useState("")
  const [form, setForm] = useState(emptyForm())

  useEffect(() => {
    saveListings(items)
  }, [items])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((x) => [x.title, x.specialty, x.city, x.bio].some((f) => String(f || "").toLowerCase().includes(q)))
  }, [items, query])

  function publish() {
    const title = form.title.trim()
    const specialty = form.specialty.trim()
    const rate = form.rate.trim()
    if (!title || !specialty || !rate) return
    setItems((prev) => [
      {
        id: randomId(),
        createdAt: Date.now(),
        ownerRole: form.role,
        title,
        specialty,
        rate,
        city: form.city.trim(),
        bio: form.bio.trim(),
        ownerEmail: auth?.user?.email || "anonymous",
      },
      ...prev,
    ])
    setForm(emptyForm())
  }

  return (
    <AppShell title="Freelance marketplace">
      <div className="hcGrid hcGrid--2">
        {canOffer ? (
          <div className="hcCard">
            <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>Offer a home-care service</div>
            <p style={{ margin: "10px 0 0", color: "var(--muted)", fontSize: 13, lineHeight: 1.55 }}>
              Qualified clinicians can publish visit types, hourly bundles, and telehealth slots. Verification, payouts, and insurance checks belong in a production
              workflow.
            </p>
            <div className="hcFieldRow hcFieldRow--2" style={{ marginTop: 12 }}>
              <div className="hcField">
                <div className="hcLabel">Listing title *</div>
                <input className="hcInput" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. Post-op wound review" />
              </div>
              <div className="hcField">
                <div className="hcLabel">You are *</div>
                <select className="hcSelect" value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}>
                  <option value="doctor">Doctor</option>
                  <option value="nurse">Nurse</option>
                </select>
              </div>
              <div className="hcField">
                <div className="hcLabel">Specialty / skill *</div>
                <input className="hcInput" value={form.specialty} onChange={(e) => setForm((p) => ({ ...p, specialty: e.target.value }))} placeholder="e.g. Geriatrics" />
              </div>
              <div className="hcField">
                <div className="hcLabel">Rate *</div>
                <input className="hcInput" value={form.rate} onChange={(e) => setForm((p) => ({ ...p, rate: e.target.value }))} placeholder="e.g. GHS 250 / visit" />
              </div>
              <div className="hcField">
                <div className="hcLabel">City / region</div>
                <input className="hcInput" value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} placeholder="Accra" />
              </div>
            </div>
            <div className="hcField" style={{ marginTop: 10 }}>
              <div className="hcLabel">Bio</div>
              <textarea className="hcTextarea" value={form.bio} onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))} placeholder="Languages, certifications, equipment you bring…" />
            </div>
            <div style={{ marginTop: 12 }}>
              <button className="hcBtn hcBtn--primary" type="button" onClick={publish}>
                Publish listing
              </button>
            </div>
          </div>
        ) : (
          <div className="hcCard">
            <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>Browse trusted clinicians</div>
            <p style={{ margin: "10px 0 0", color: "var(--muted)", fontSize: 13, lineHeight: 1.55 }}>
              Patients and families can compare offerings, then book through <a href="/appointments">Appointments</a> or message via <a href="/secure/chat">Secure Chat</a>.
            </p>
            <div style={{ marginTop: 12 }}>
              <a className="hcBtn hcBtn--primary" href="/appointments">
                Book a visit
              </a>
            </div>
          </div>
        )}

        <div className="hcCard">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>Open listings</div>
            <input className="hcInput" style={{ maxWidth: 280 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title, city, skill" />
          </div>
          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {filtered.length === 0 ? <div style={{ color: "var(--muted)", fontSize: 13 }}>No listings yet—clinicians can publish from the left panel.</div> : null}
            {filtered.map((x) => (
              <div key={x.id} style={{ padding: 12, borderRadius: 16, border: "1px solid var(--border)", background: "color-mix(in srgb, var(--surface) 86%, transparent)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 950 }}>{x.title}</div>
                  <div style={{ fontWeight: 900, color: "var(--muted)" }}>{x.rate}</div>
                </div>
                <div style={{ marginTop: 6, fontSize: 13, color: "var(--muted)" }}>
                  {x.ownerRole === "nurse" ? "Nurse" : "Doctor"} · {x.specialty}
                  {x.city ? ` · ${x.city}` : ""}
                </div>
                {x.bio ? <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.55 }}>{x.bio}</div> : null}
                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <a className="hcBtn hcBtn--sm hcBtn--ghost" href="/appointments">
                    Request booking
                  </a>
                  <a className="hcBtn hcBtn--sm hcBtn--ghost" href="/telehealth">
                    Video consult
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
