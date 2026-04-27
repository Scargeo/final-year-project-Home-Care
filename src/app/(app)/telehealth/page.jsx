"use client"

import { useState } from "react"
import AppShell from "../../components/AppShell.jsx"
import { appendAudit } from "../../lib/auditLog.js"
import { randomId } from "../../lib/randomId.js"

const CARE_ROOM = "telehealth-room-1"

export default function TelehealthPage() {
  const [rx, setRx] = useState({ patient: "", drug: "", dose: "", sig: "", signed: false })
  const [vitals, setVitals] = useState([
    { id: "1", device: "BP cuff (BLE)", value: "128/82", unit: "mmHg", ts: 1_700_000_000_000, alert: false },
    { id: "2", device: "Glucose meter", value: "6.2", unit: "mmol/L", ts: 1_699_990_000_000, alert: false },
  ])

  function signPrescription() {
    if (!rx.patient.trim() || !rx.drug.trim()) return
    setRx((p) => ({ ...p, signed: true }))
    appendAudit({ action: "prescription.signed", resource: "telehealth", detail: rx.patient })
    alert("Prescription signed and recorded.")
  }

  function simulateReading() {
    setVitals((prev) => [
      {
        id: randomId(),
        device: "Pulse oximeter",
        value: `${97 + Math.floor(Math.random() * 3)}`,
        unit: "SpO₂ %",
        ts: Date.now(),
        alert: false,
      },
      ...prev,
    ])
  }

  return (
    <AppShell title="Telehealth & virtual care">
      <div className="hcGrid hcGrid--2">
        <div className="hcCard">
          <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>Video consultations</div>
          <p style={{ margin: "10px 0 0", color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
            Start a secure WebRTC call with the same signaling server as Secure Chat. Use a shared room ID for patient and clinician.
          </p>
          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a className="hcBtn hcBtn--primary" href={`/secure/call?roomId=${encodeURIComponent(CARE_ROOM)}&mode=video`}>
              Start video visit
            </a>
            <a className="hcBtn hcBtn--ghost" href={`/secure/call?roomId=${encodeURIComponent(CARE_ROOM)}&mode=audio`}>
              Audio only
            </a>
            <a className="hcBtn hcBtn--ghost" href="/secure/chat">
              Secure chat
            </a>
          </div>
        </div>

        <div className="hcCard">
          <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>Remote monitoring (IoT)</div>
          <p style={{ margin: "10px 0 0", color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
            Device readings are recorded in real time within this session. Connect to FHIR Observation/device gateways for full EHR sync.
          </p>
          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="hcBtn hcBtn--ghost" type="button" onClick={simulateReading}>
              Capture new reading
            </button>
          </div>
          <div style={{ marginTop: 10, overflow: "auto" }}>
            <table className="hcTable">
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Value</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {vitals.map((v) => (
                  <tr key={v.id}>
                    <td>{v.device}</td>
                    <td>
                      {v.value} {v.unit}
                    </td>
                    <td>{new Date(v.ts).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="hcCard" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>Digital prescription & e-sign (demo)</div>
        <div className="hcFieldRow hcFieldRow--2" style={{ marginTop: 12 }}>
          <div className="hcField">
            <div className="hcLabel">Patient</div>
            <input className="hcInput" value={rx.patient} onChange={(e) => setRx((p) => ({ ...p, patient: e.target.value }))} placeholder="Patient name" />
          </div>
          <div className="hcField">
            <div className="hcLabel">Medication</div>
            <input className="hcInput" value={rx.drug} onChange={(e) => setRx((p) => ({ ...p, drug: e.target.value }))} placeholder="Drug name" />
          </div>
          <div className="hcField">
            <div className="hcLabel">Dose</div>
            <input className="hcInput" value={rx.dose} onChange={(e) => setRx((p) => ({ ...p, dose: e.target.value }))} placeholder="e.g. 500mg" />
          </div>
          <div className="hcField">
            <div className="hcLabel">Sig / directions</div>
            <input className="hcInput" value={rx.sig} onChange={(e) => setRx((p) => ({ ...p, sig: e.target.value }))} placeholder="e.g. 1 tab twice daily" />
          </div>
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button className="hcBtn hcBtn--primary" type="button" onClick={signPrescription} disabled={rx.signed}>
            {rx.signed ? "Signed" : "Sign & send"}
          </button>
          {rx.signed ? <span style={{ color: "var(--muted)", fontSize: 13 }}>Audit log entry recorded.</span> : null}
        </div>
      </div>
    </AppShell>
  )
}
