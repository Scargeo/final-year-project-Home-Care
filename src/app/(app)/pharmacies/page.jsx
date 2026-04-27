"use client"

import { useMemo, useState } from "react"
import AppShell from "../../components/AppShell.jsx"

export default function PharmaciesPage() {
  const [orderId, setOrderId] = useState("")
  const [orders, setOrders] = useState([
    { id: "ORD-1001", status: "packed", location: "Accra Central", eta: "45m" },
    { id: "ORD-1002", status: "in transit", location: "Legon", eta: "20m" },
  ])

  const match = useMemo(() => {
    const q = orderId.trim().toLowerCase()
    if (!q) return null
    return orders.find((o) => o.id.toLowerCase() === q) || null
  }, [orderId, orders])

  function createDemoOrder() {
    const id = `ORD-${Math.floor(1000 + Math.random() * 9000)}`
    setOrders((p) => [{ id, status: "created", location: "Accra Central", eta: "—" }, ...p])
    setOrderId(id)
  }

  return (
    <AppShell title="Pharmacies">
      <div className="hcGrid hcGrid--2">
        <div className="hcCard">
          <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>Track orders</div>
          <div className="hcField" style={{ marginTop: 12 }}>
            <div className="hcLabel">Order ID</div>
            <input className="hcInput" value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="ORD-1001" />
          </div>
          <div style={{ marginTop: 10 }}>
            <button className="hcBtn hcBtn--primary" type="button" onClick={createDemoOrder}>
              Create demo order
            </button>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 900 }}>Result</div>
            <div style={{ marginTop: 8, color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
              {orderId.trim() && !match ? (
                <>No matching order.</>
              ) : match ? (
                <>
                  <div>
                    <b>{match.id}</b> • {match.status}
                  </div>
                  <div>
                    Location: <b>{match.location}</b>
                  </div>
                  <div>
                    ETA: <b>{match.eta}</b>
                  </div>
                </>
              ) : (
                <>Enter an Order ID to track.</>
              )}
            </div>
          </div>
        </div>

        <div className="hcCard">
          <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>Locations</div>
          <div style={{ marginTop: 10, overflow: "auto" }}>
            <table className="hcTable">
              <thead>
                <tr>
                  <th>Branch</th>
                  <th>Hours</th>
                  <th>Services</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Accra Central</td>
                  <td>08:00–22:00</td>
                  <td>Pickup • Delivery • Immunization</td>
                </tr>
                <tr>
                  <td>Legon</td>
                  <td>07:00–20:00</td>
                  <td>Pickup • Delivery</td>
                </tr>
                <tr>
                  <td>Kumasi</td>
                  <td>09:00–19:00</td>
                  <td>Pickup</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 12, lineHeight: 1.35 }}>
            Advanced roadmap: inventory, prescriptions, scanning, expiry tracking, batch recalls, route optimization, and rider assignment.
          </div>
        </div>
      </div>
    </AppShell>
  )
}

