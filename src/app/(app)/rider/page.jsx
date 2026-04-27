"use client"

import { useMemo, useState } from "react"
import AppShell from "../../components/AppShell.jsx"
import { appendAudit } from "../../lib/auditLog.js"

export default function RiderPage() {
  const [jobs, setJobs] = useState([
    { id: "JOB-9001", pickup: "Accra Central Pharmacy", dropoff: "East Legon", fee: 25, status: "available", lat: 5.6037, lng: -0.187, etaMin: 28 },
    { id: "JOB-9002", pickup: "Legon Pharmacy", dropoff: "Madina", fee: 18, status: "available", lat: 5.6505, lng: -0.1874, etaMin: 22 },
  ])
  const [activeJob, setActiveJob] = useState(null)
  const [routeNote, setRouteNote] = useState("")
  const [proofPhoto, setProofPhoto] = useState("")
  const [sigOk, setSigOk] = useState(false)

  const income = useMemo(() => jobs.filter((j) => j.status === "completed").reduce((s, j) => s + j.fee, 0), [jobs])

  function accept(id) {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status: "picked" } : j)))
    setActiveJob(id)
    appendAudit({ action: "rider.job.accepted", resource: "rider", detail: id })
  }
  function pickedUp(id) {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status: "in transit" } : j)))
    appendAudit({ action: "rider.pickup", resource: "rider", detail: id })
  }
  function delivered(id) {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status: "completed" } : j)))
    setActiveJob(null)
    setProofPhoto("")
    setSigOk(false)
    appendAudit({ action: "rider.delivered", resource: "rider", detail: id })
  }

  function optimizeRoute() {
    const sorted = [...jobs].filter((j) => j.status !== "completed").sort((a, b) => a.etaMin - b.etaMin)
    const order = sorted.map((j) => j.id).join(" → ")
    setRouteNote(order ? `Suggested order: ${order} (minimize travel time — demo)` : "No open jobs.")
    appendAudit({ action: "rider.route.optimized", resource: "rider", detail: "demo" })
  }

  function onProofFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    const r = new FileReader()
    r.onload = () => setProofPhoto(String(r.result || ""))
    r.readAsDataURL(f)
  }

  const selected = jobs.find((j) => j.id === activeJob)

  return (
    <AppShell title="Rider & logistics">
      <div className="hcGrid hcGrid--3">
        <div className="hcCard hcKpi">
          <div className="hcKpi__k">Available jobs</div>
          <div className="hcKpi__v">{jobs.filter((j) => j.status === "available").length}</div>
        </div>
        <div className="hcCard hcKpi">
          <div className="hcKpi__k">In progress</div>
          <div className="hcKpi__v">{jobs.filter((j) => j.status === "picked" || j.status === "in transit").length}</div>
        </div>
        <div className="hcCard hcKpi">
          <div className="hcKpi__k">Income (demo)</div>
          <div className="hcKpi__v">GHS {income.toFixed(2)}</div>
        </div>
      </div>

      <div className="hcGrid hcGrid--2" style={{ marginTop: 12 }}>
        <div className="hcCard">
          <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>Live map (demo coordinates)</div>
          <p style={{ margin: "10px 0 0", color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
            Mock GPS: integrate Mapbox/Google Maps with rider device stream. Showing static lat/lng per job.
          </p>
          <div style={{ marginTop: 10, padding: 12, borderRadius: 16, border: "1px solid var(--border)", background: "color-mix(in srgb, var(--surface) 88%, transparent)", minHeight: 140 }}>
            {jobs.map((j) => (
              <div key={j.id} style={{ fontSize: 13, marginBottom: 6 }}>
                <b>{j.id}</b> · {j.status} · GPS {j.lat?.toFixed(4)}, {j.lng?.toFixed(4)} · ETA ~{j.etaMin}m
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="hcBtn hcBtn--primary" type="button" onClick={optimizeRoute}>
              Optimize route (AI demo)
            </button>
          </div>
          {routeNote ? <div style={{ marginTop: 10, fontSize: 13, color: "var(--muted)" }}>{routeNote}</div> : null}
        </div>

        <div className="hcCard">
          <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>Proof of delivery</div>
          <p style={{ margin: "10px 0 0", color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
            Capture photo + geotagged check-in + signature before completing delivery.
          </p>
          <div className="hcField" style={{ marginTop: 10 }}>
            <div className="hcLabel">Photo</div>
            <input className="hcInput" type="file" accept="image/*" onChange={onProofFile} />
          </div>
          {proofPhoto ? <img src={proofPhoto} alt="Proof" style={{ marginTop: 10, width: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 12 }} /> : null}
          <label style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, fontWeight: 700 }}>
            <input type="checkbox" checked={sigOk} onChange={(e) => setSigOk(e.target.checked)} />
            Digital signature captured (demo — use DocuSign / native capture in production)
          </label>
        </div>
      </div>

      <div className="hcCard" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>Delivery jobs</div>
        <div style={{ marginTop: 10, overflow: "auto" }}>
          <table className="hcTable">
            <thead>
              <tr>
                <th>Job</th>
                <th>Pickup</th>
                <th>Dropoff</th>
                <th>Fee</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td>{j.id}</td>
                  <td>{j.pickup}</td>
                  <td>{j.dropoff}</td>
                  <td>GHS {j.fee.toFixed(2)}</td>
                  <td>{j.status}</td>
                  <td style={{ textAlign: "right", display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                    {j.status === "available" ? (
                      <button className="hcBtn hcBtn--sm hcBtn--primary" type="button" onClick={() => accept(j.id)}>
                        Accept
                      </button>
                    ) : null}
                    {j.status === "picked" ? (
                      <button className="hcBtn hcBtn--sm hcBtn--ghost" type="button" onClick={() => pickedUp(j.id)}>
                        Picked up
                      </button>
                    ) : null}
                    {j.status === "in transit" ? (
                      <button className="hcBtn hcBtn--sm hcBtn--ghost" type="button" onClick={() => delivered(j.id)} disabled={!proofPhoto || !sigOk}>
                        Delivered
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {selected ? <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)" }}>Active job: {selected.id} — attach proof before marking delivered.</div> : null}
      </div>
    </AppShell>
  )
}
