"use client"

import { useEffect, useMemo, useState } from "react"
import AppShell from "../../components/AppShell.jsx"
import { randomId } from "../../lib/randomId.js"

const STORAGE_KEY = "hc:patients:v1"

function loadPatients() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function savePatients(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

function emptyForm() {
  return {
    name: "",
    phone: "",
    email: "",
    age: "",
    gender: "unknown",
    address: "",
    allergies: "",
    notes: "",
    carePlan: "",
    medicationsText: "",
    familyEmail: "",
    lastBp: "",
    lastGlucose: "",
    lastWeight: "",
  }
}

function buildRecommendations({ age, allergies, medicationsText, carePlan }) {
  const out = []
  const a = String(allergies || "").toLowerCase()
  if (/penicillin|pcn/.test(a)) out.push("Highlight penicillin-class allergy on every prescription and pharmacy handoff.")
  const n = Number(age)
  if (Number.isFinite(n) && n > 65) out.push("Geriatric focus: schedule fall-risk home scan, night lighting review, and medication reconciliation.")
  if (/metformin/i.test(medicationsText || "")) out.push("Metformin on board: monitor GI tolerance and renal function cadence with the primary clinician.")
  if (/warfarin|apixaban|rivaroxaban/i.test(medicationsText || "")) out.push("Anticoagulant safety: ensure INR or renal monitoring plans are explicit in the care plan.")
  if (!String(carePlan || "").trim()) out.push("Add a structured care plan to align home visits, vitals capture, and telehealth touchpoints.")
  if (out.length === 0) out.push("Keep weekly vitals logging and update emergency contacts inside the family portal.")
  return out
}

export default function PatientsPage() {
  const [items, setItems] = useState(() => loadPatients())
  const [query, setQuery] = useState("")
  const [editingId, setEditingId] = useState("")
  const [form, setForm] = useState(emptyForm())

  useEffect(() => {
    savePatients(items)
  }, [items])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((p) => (p.name || "").toLowerCase().includes(q) || (p.phone || "").toLowerCase().includes(q) || (p.email || "").toLowerCase().includes(q))
  }, [items, query])

  const recommendations = useMemo(() => buildRecommendations(form), [form])

  function startAdd() {
    setEditingId("")
    setForm(emptyForm())
  }

  function startEdit(p) {
    setEditingId(p.id)
    setForm({
      name: p.name || "",
      phone: p.phone || "",
      email: p.email || "",
      age: p.age || "",
      gender: p.gender || "unknown",
      address: p.address || "",
      allergies: p.allergies || "",
      notes: p.notes || "",
      carePlan: p.carePlan || "",
      medicationsText: p.medicationsText || "",
      familyEmail: p.familyEmail || "",
      lastBp: p.lastBp || "",
      lastGlucose: p.lastGlucose || "",
      lastWeight: p.lastWeight || "",
    })
  }

  function remove(id) {
    setItems((prev) => prev.filter((x) => x.id !== id))
    if (editingId === id) startAdd()
  }

  function submit() {
    const name = form.name.trim()
    const phone = form.phone.trim()
    if (!name || !phone) return

    if (editingId) {
      setItems((prev) => prev.map((x) => (x.id === editingId ? { ...x, ...form, name, phone } : x)))
      return
    }

    setItems((prev) => [{ id: randomId(), createdAt: Date.now(), ...form, name, phone }, ...prev])
    setForm(emptyForm())
  }

  return (
    <AppShell title="Patients">
      <div className="hcGrid hcGrid--2">
        <div className="hcCard">
          <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>{editingId ? "Edit patient" : "Add new patient"}</div>

          <div className="hcFieldRow hcFieldRow--2" style={{ marginTop: 12 }}>
            <div className="hcField">
              <div className="hcLabel">Full name *</div>
              <input className="hcInput" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Patient name" />
            </div>
            <div className="hcField">
              <div className="hcLabel">Phone *</div>
              <input className="hcInput" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+233..." />
            </div>
            <div className="hcField">
              <div className="hcLabel">Email</div>
              <input className="hcInput" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="name@email.com" />
            </div>
            <div className="hcField">
              <div className="hcLabel">Age</div>
              <input className="hcInput" value={form.age} onChange={(e) => setForm((p) => ({ ...p, age: e.target.value }))} placeholder="e.g. 34" />
            </div>
            <div className="hcField">
              <div className="hcLabel">Gender</div>
              <select className="hcSelect" value={form.gender} onChange={(e) => setForm((p) => ({ ...p, gender: e.target.value }))}>
                <option value="unknown">Unknown</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="hcField">
              <div className="hcLabel">Address</div>
              <input className="hcInput" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} placeholder="City / location" />
            </div>
          </div>

          <div className="hcFieldRow" style={{ marginTop: 10 }}>
            <div className="hcField">
              <div className="hcLabel">Allergies</div>
              <input className="hcInput" value={form.allergies} onChange={(e) => setForm((p) => ({ ...p, allergies: e.target.value }))} placeholder="e.g. Penicillin" />
            </div>
            <div className="hcField">
              <div className="hcLabel">Notes</div>
              <textarea className="hcTextarea" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Medical notes..." />
            </div>
          </div>

          <div style={{ marginTop: 14, fontWeight: 950, letterSpacing: "-0.02em" }}>Remote monitoring (last documented)</div>
          <div className="hcFieldRow hcFieldRow--2" style={{ marginTop: 10 }}>
            <div className="hcField">
              <div className="hcLabel">Blood pressure</div>
              <input className="hcInput" value={form.lastBp} onChange={(e) => setForm((p) => ({ ...p, lastBp: e.target.value }))} placeholder="e.g. 128/78 mmHg" />
            </div>
            <div className="hcField">
              <div className="hcLabel">Glucose</div>
              <input className="hcInput" value={form.lastGlucose} onChange={(e) => setForm((p) => ({ ...p, lastGlucose: e.target.value }))} placeholder="e.g. 6.1 mmol/L" />
            </div>
            <div className="hcField">
              <div className="hcLabel">Weight</div>
              <input className="hcInput" value={form.lastWeight} onChange={(e) => setForm((p) => ({ ...p, lastWeight: e.target.value }))} placeholder="e.g. 72 kg" />
            </div>
          </div>

          <div style={{ marginTop: 14, fontWeight: 950, letterSpacing: "-0.02em" }}>Personalized care & medication</div>
          <div className="hcField" style={{ marginTop: 10 }}>
            <div className="hcLabel">Care plan (goals & tasks)</div>
            <textarea className="hcTextarea" value={form.carePlan} onChange={(e) => setForm((p) => ({ ...p, carePlan: e.target.value }))} placeholder="Weekly wound check; physiotherapy 2×/week; mobility goals…" />
          </div>
          <div className="hcField" style={{ marginTop: 10 }}>
            <div className="hcLabel">Medications (one per line: name | dose | schedule)</div>
            <textarea className="hcTextarea" value={form.medicationsText} onChange={(e) => setForm((p) => ({ ...p, medicationsText: e.target.value }))} placeholder={"Metformin | 500mg | twice daily\nAmlodipine | 5mg | once daily"} />
          </div>
          <div className="hcField" style={{ marginTop: 10 }}>
            <div className="hcLabel">Family portal email (read-only shared view)</div>
            <input className="hcInput" type="email" value={form.familyEmail} onChange={(e) => setForm((p) => ({ ...p, familyEmail: e.target.value }))} placeholder="family@email.com" />
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
            Pill reminders & interaction checks: connect to a clinical decision support API in production.{" "}
            <a href="/family" style={{ fontWeight: 800, color: "inherit" }}>
              Open family portal
            </a>
          </div>

          <div style={{ marginTop: 14, padding: 12, borderRadius: 16, border: "1px dashed var(--border)", background: "color-mix(in srgb, var(--surface) 88%, transparent)" }}>
            <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>Personalized recommendations (rules demo)</div>
            <ul style={{ margin: "10px 0 0", paddingLeft: 18, color: "var(--muted)", lineHeight: 1.65, fontSize: 13 }}>
              {recommendations.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="hcBtn hcBtn--primary" type="button" onClick={submit}>
              {editingId ? "Save changes" : "Add patient"}
            </button>
            <button className="hcBtn hcBtn--ghost" type="button" onClick={startAdd}>
              New
            </button>
            <a className="hcBtn hcBtn--ghost" href="/appointments">
              Create appointment
            </a>
          </div>
          <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 12, lineHeight: 1.35 }}>
            Advanced: persistence is local in this build. Next step is connecting to a DB with role-based access, audit logs, and encrypted at-rest records.
          </div>
        </div>

        <div className="hcCard">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>Patient list</div>
            <input className="hcInput" style={{ maxWidth: 280 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name/phone/email" />
          </div>

          <div style={{ marginTop: 10, overflow: "auto" }}>
            <table className="hcTable">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ color: "var(--muted)" }}>
                      No patients found.
                    </td>
                  </tr>
                ) : null}
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.phone}</td>
                    <td>{p.email || "-"}</td>
                    <td style={{ textAlign: "right", display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                      <button className="hcBtn hcBtn--sm hcBtn--ghost" type="button" onClick={() => startEdit(p)}>
                        Edit
                      </button>
                      <button className="hcBtn hcBtn--sm hcBtn--danger" type="button" onClick={() => remove(p.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

