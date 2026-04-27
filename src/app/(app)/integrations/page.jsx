"use client"

import { useEffect, useState } from "react"
import AppShell from "../../components/AppShell.jsx"

const KEY = "hc:integrations:v1"

const DEFAULT = {
  ehr: { connected: false, vendor: "fhir-generic" },
  pharmacy: { connected: false, vendor: "local-network" },
  wearables: { appleHealth: false, googleFit: false, medicalDevices: false },
}

function loadCfg() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULT, ...JSON.parse(raw) }
  } catch {
    // ignore
  }
  return DEFAULT
}

export default function IntegrationsPage() {
  const [cfg, setCfg] = useState(() => loadCfg())

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(cfg))
    } catch {
      // ignore
    }
  }, [cfg])

  return (
    <AppShell title="Integrations">
      <div className="hcGrid hcGrid--2">
        <div className="hcCard">
          <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>EHR / FHIR</div>
          <p style={{ margin: "10px 0 0", color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
            Connect to FHIR R4 endpoints for Patient, Encounter, Observation. Production: OAuth2 + SMART on FHIR.
          </p>
          <label style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10, fontWeight: 600 }}>
            <input type="checkbox" checked={cfg.ehr.connected} onChange={(e) => setCfg((c) => ({ ...c, ehr: { ...c.ehr, connected: e.target.checked } }))} />
            Enable EHR sync (demo toggle)
          </label>
          <div className="hcField" style={{ marginTop: 10 }}>
            <div className="hcLabel">Adapter</div>
            <select className="hcSelect" value={cfg.ehr.vendor} onChange={(e) => setCfg((c) => ({ ...c, ehr: { ...c.ehr, vendor: e.target.value } }))}>
              <option value="fhir-generic">Generic FHIR R4</option>
              <option value="epic-sandbox">Epic sandbox</option>
              <option value="cerner">Cerner / Oracle Health</option>
            </select>
          </div>
        </div>

        <div className="hcCard">
          <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>Pharmacy network</div>
          <p style={{ margin: "10px 0 0", color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
            Route e-prescriptions to partner pharmacies and delivery. Production: NCPDP SCRIPT, eligibility checks.
          </p>
          <label style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10, fontWeight: 600 }}>
            <input type="checkbox" checked={cfg.pharmacy.connected} onChange={(e) => setCfg((c) => ({ ...c, pharmacy: { ...c.pharmacy, connected: e.target.checked } }))} />
            Enable pharmacy routing (demo)
          </label>
        </div>

        <div className="hcCard">
          <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>Wearables & devices</div>
          <p style={{ margin: "10px 0 0", color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
            Sync health data for remote monitoring. Production: HealthKit / Health Connect / device-specific SDKs.
          </p>
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 600 }}>
              <input type="checkbox" checked={cfg.wearables.appleHealth} onChange={(e) => setCfg((c) => ({ ...c, wearables: { ...c.wearables, appleHealth: e.target.checked } }))} />
              Apple Health (demo)
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 600 }}>
              <input type="checkbox" checked={cfg.wearables.googleFit} onChange={(e) => setCfg((c) => ({ ...c, wearables: { ...c.wearables, googleFit: e.target.checked } }))} />
              Google Fit / Health Connect (demo)
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 600 }}>
              <input type="checkbox" checked={cfg.wearables.medicalDevices} onChange={(e) => setCfg((c) => ({ ...c, wearables: { ...c.wearables, medicalDevices: e.target.checked } }))} />
              Medical-grade devices (BLE) (demo)
            </label>
          </div>
        </div>

        <div className="hcCard">
          <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>Webhooks</div>
          <p style={{ margin: "10px 0 0", color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
            Outbound events: appointment.created, prescription.signed, delivery.completed. Configure URLs in production.
          </p>
          <div className="hcField" style={{ marginTop: 10 }}>
            <div className="hcLabel">Webhook URL (read-only demo)</div>
            <input className="hcInput" readOnly value="https://api.example.com/hooks/home-care" />
          </div>
        </div>
      </div>
    </AppShell>
  )
}
