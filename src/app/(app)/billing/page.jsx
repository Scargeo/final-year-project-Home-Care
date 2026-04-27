"use client"

import { useMemo, useState } from "react"
import AppShell from "../../components/AppShell.jsx"
import { randomId } from "../../lib/randomId.js"
import { appendAudit } from "../../lib/auditLog.js"

function formatMoney(n) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "GHS" }).format(n)
  } catch {
    return `GHS ${Number(n || 0).toFixed(2)}`
  }
}

export default function BillingPage() {
  const [invoice, setInvoice] = useState({ customer: "", items: [{ name: "Consultation", qty: 1, price: 150 }], note: "" })
  const [payments, setPayments] = useState([])
  const [claim, setClaim] = useState({ insurer: "", policy: "", amount: "" })
  const [plan, setPlan] = useState({ total: 600, months: 3, label: "Care plan installment" })
  const [estimator, setEstimator] = useState({ service: "consultation", insurancePct: 70 })

  const total = useMemo(() => {
    return invoice.items.reduce((sum, it) => sum + Number(it.qty || 0) * Number(it.price || 0), 0)
  }, [invoice.items])

  const estimatedOop = useMemo(() => {
    const base = estimator.service === "consultation" ? 150 : estimator.service === "home_visit" ? 320 : 95
    const covered = (base * Number(estimator.insurancePct || 0)) / 100
    return Math.max(0, base - covered)
  }, [estimator])

  const planInstallment = useMemo(() => {
    const m = Math.max(1, Number(plan.months) || 1)
    return plan.total / m
  }, [plan])

  function addLine() {
    setInvoice((p) => ({ ...p, items: [...p.items, { name: "", qty: 1, price: 0 }] }))
  }

  function updateLine(idx, patch) {
    setInvoice((p) => ({ ...p, items: p.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }))
  }

  function removeLine(idx) {
    setInvoice((p) => ({ ...p, items: p.items.filter((_, i) => i !== idx) }))
  }

  function createInvoice() {
    if (!invoice.customer.trim()) return
    const invId = randomId()
    const createdAt = Date.now()
    const invTotal = total
    alert(`Invoice created (demo): ${invId}\nTotal: ${formatMoney(invTotal)}`)
    setPayments((prev) => [{ id: randomId(), invoiceId: invId, amount: 0, method: "cash", status: "unpaid", createdAt, total: invTotal, customer: invoice.customer.trim() }, ...prev])
    setInvoice({ customer: "", items: [{ name: "Consultation", qty: 1, price: 150 }], note: "" })
    appendAudit({ action: "invoice.created", resource: "billing", detail: invoice.customer.trim() })
  }

  function submitClaim() {
    if (!claim.insurer.trim() || !claim.amount) return
    appendAudit({ action: "insurance.claim.submitted", resource: "billing", detail: claim.insurer })
    alert("Claim queued for clearinghouse (demo). Track status in production via payer APIs.")
    setClaim({ insurer: "", policy: "", amount: "" })
  }

  function recordPayment(id, amount) {
    setPayments((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p
        const paid = Math.max(0, Math.min(p.total, Number(amount || 0)))
        return { ...p, amount: paid, status: paid >= p.total ? "paid" : paid > 0 ? "partial" : "unpaid" }
      }),
    )
  }

  return (
    <AppShell title="Billing">
      <div className="hcGrid hcGrid--2">
        <div className="hcCard">
          <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>Invoice</div>
          <div className="hcField" style={{ marginTop: 12 }}>
            <div className="hcLabel">Customer</div>
            <input className="hcInput" value={invoice.customer} onChange={(e) => setInvoice((p) => ({ ...p, customer: e.target.value }))} placeholder="Patient / organization" />
          </div>

          <div style={{ marginTop: 10, overflow: "auto" }}>
            <table className="hcTable">
              <thead>
                <tr>
                  <th>Item</th>
                  <th style={{ width: 90 }}>Qty</th>
                  <th style={{ width: 140 }}>Price</th>
                  <th style={{ width: 80 }} />
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((it, idx) => (
                  <tr key={idx}>
                    <td>
                      <input className="hcInput" value={it.name} onChange={(e) => updateLine(idx, { name: e.target.value })} placeholder="Service" />
                    </td>
                    <td>
                      <input className="hcInput" value={it.qty} onChange={(e) => updateLine(idx, { qty: e.target.value })} />
                    </td>
                    <td>
                      <input className="hcInput" value={it.price} onChange={(e) => updateLine(idx, { price: e.target.value })} />
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button className="hcBtn hcBtn--sm hcBtn--danger" type="button" onClick={() => removeLine(idx)} disabled={invoice.items.length <= 1}>
                        X
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
            <button className="hcBtn hcBtn--ghost" type="button" onClick={addLine}>
              Add line
            </button>
            <div style={{ fontWeight: 950 }}>Total: {formatMoney(total)}</div>
          </div>

          <div className="hcField" style={{ marginTop: 10 }}>
            <div className="hcLabel">Note</div>
            <textarea className="hcTextarea" value={invoice.note} onChange={(e) => setInvoice((p) => ({ ...p, note: e.target.value }))} placeholder="Terms, notes..." />
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="hcBtn hcBtn--primary" type="button" onClick={createInvoice}>
              Create invoice
            </button>
            <a className="hcBtn hcBtn--ghost" href="/reports">
              Billing report
            </a>
          </div>

          <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 12, lineHeight: 1.35 }}>
            Advanced roadmap: tax/VAT rules, discounts, multi-currency, PDF invoice export, payment links (MoMo/Stripe), recurring invoices, aging + dunning,
            and reconciliation.
          </div>
        </div>

        <div className="hcCard">
          <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>Payments (demo)</div>
          <div style={{ marginTop: 10, overflow: "auto" }}>
            <table className="hcTable">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ color: "var(--muted)" }}>
                      No invoices yet.
                    </td>
                  </tr>
                ) : null}
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>{p.customer}</td>
                    <td>{formatMoney(p.total)}</td>
                    <td style={{ minWidth: 160 }}>
                      <input className="hcInput" value={p.amount} onChange={(e) => recordPayment(p.id, e.target.value)} />
                    </td>
                    <td>{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="hcGrid hcGrid--3" style={{ marginTop: 12 }}>
        <div className="hcCard">
          <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>Insurance claims (demo)</div>
          <div className="hcField" style={{ marginTop: 10 }}>
            <div className="hcLabel">Insurer</div>
            <input className="hcInput" value={claim.insurer} onChange={(e) => setClaim((c) => ({ ...c, insurer: e.target.value }))} placeholder="Payer name" />
          </div>
          <div className="hcFieldRow hcFieldRow--2" style={{ marginTop: 10 }}>
            <div className="hcField">
              <div className="hcLabel">Policy #</div>
              <input className="hcInput" value={claim.policy} onChange={(e) => setClaim((c) => ({ ...c, policy: e.target.value }))} />
            </div>
            <div className="hcField">
              <div className="hcLabel">Claim amount</div>
              <input className="hcInput" type="number" value={claim.amount} onChange={(e) => setClaim((c) => ({ ...c, amount: e.target.value }))} />
            </div>
          </div>
          <button className="hcBtn hcBtn--primary" type="button" style={{ marginTop: 10 }} onClick={submitClaim}>
            Submit claim
          </button>
        </div>

        <div className="hcCard">
          <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>Flexible payment plan</div>
          <div className="hcField" style={{ marginTop: 10 }}>
            <div className="hcLabel">Label</div>
            <input className="hcInput" value={plan.label} onChange={(e) => setPlan((p) => ({ ...p, label: e.target.value }))} />
          </div>
          <div className="hcFieldRow hcFieldRow--2" style={{ marginTop: 10 }}>
            <div className="hcField">
              <div className="hcLabel">Total (GHS)</div>
              <input className="hcInput" type="number" value={plan.total} onChange={(e) => setPlan((p) => ({ ...p, total: Number(e.target.value) }))} />
            </div>
            <div className="hcField">
              <div className="hcLabel">Months</div>
              <input className="hcInput" type="number" min={1} value={plan.months} onChange={(e) => setPlan((p) => ({ ...p, months: Number(e.target.value) }))} />
            </div>
          </div>
          <div style={{ marginTop: 10, fontSize: 13, color: "var(--muted)" }}>
            ≈ {formatMoney(planInstallment)} / month ({plan.months} payments)
          </div>
        </div>

        <div className="hcCard">
          <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>Cost estimator</div>
          <div className="hcField" style={{ marginTop: 10 }}>
            <div className="hcLabel">Service</div>
            <select className="hcSelect" value={estimator.service} onChange={(e) => setEstimator((x) => ({ ...x, service: e.target.value }))}>
              <option value="consultation">Consultation</option>
              <option value="home_visit">Home visit</option>
              <option value="lab">Lab bundle</option>
            </select>
          </div>
          <div className="hcField" style={{ marginTop: 10 }}>
            <div className="hcLabel">Insurance coverage %</div>
            <input className="hcInput" type="number" min={0} max={100} value={estimator.insurancePct} onChange={(e) => setEstimator((x) => ({ ...x, insurancePct: Number(e.target.value) }))} />
          </div>
          <div style={{ marginTop: 10, fontWeight: 950 }}>Est. out-of-pocket: {formatMoney(estimatedOop)}</div>
        </div>
      </div>
    </AppShell>
  )
}

