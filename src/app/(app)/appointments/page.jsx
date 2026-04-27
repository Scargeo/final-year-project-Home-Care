"use client"

import { useMemo, useState } from "react"
import AppShell from "../../components/AppShell.jsx"
import { randomId } from "../../lib/randomId.js"
import { appendAudit } from "../../lib/auditLog.js"
import { suggestSlots } from "../../lib/schedulingDemo.js"

function todayISO() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

export default function AppointmentsPage() {
  const [form, setForm] = useState({
    patient: "",
    doctor: "",
    date: todayISO(),
    time: "09:00",
    reason: "",
    recurring: "none",
    remindSms: true,
    remindEmail: true,
    remindWhatsapp: false,
  })
  const [items, setItems] = useState([])
  const [busyMock, setBusyMock] = useState(["10:30"])

  const suggested = useMemo(() => suggestSlots({ reason: form.reason, doctorBusy: busyMock }), [form.reason, busyMock])

  const nextItems = useMemo(() => {
    return [...items].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  }, [items])

  function add() {
    const patient = form.patient.trim()
    const doctor = form.doctor.trim()
    const reason = form.reason.trim()
    if (!patient || !doctor) return
    const row = {
      id: randomId(),
      ...form,
      patient,
      doctor,
      reason,
      createdAt: Date.now(),
    }
    setItems((prev) => [row, ...prev])
    appendAudit({ action: "appointment.created", resource: "appointments", detail: `${patient} @ ${form.date} ${form.time}` })
    if (form.recurring !== "none") {
      appendAudit({ action: "appointment.recurring", resource: "appointments", detail: form.recurring })
    }
    if (form.remindSms || form.remindEmail || form.remindWhatsapp) {
      appendAudit({ action: "reminder.scheduled", resource: "appointments", detail: [form.remindSms && "SMS", form.remindEmail && "Email", form.remindWhatsapp && "WhatsApp"].filter(Boolean).join(",") })
    }
    setForm((p) => ({ ...p, patient: "", reason: "" }))
    alert("Appointment saved (demo). Reminders would be sent via your configured channels in production.")
  }

  function remove(id) {
    setItems((prev) => prev.filter((x) => x.id !== id))
    appendAudit({ action: "appointment.deleted", resource: "appointments", detail: id })
  }

  function applySuggestedTime(t) {
    setForm((p) => ({ ...p, time: t }))
  }

  return (
    <AppShell title="Appointments">
      <div className="hcGrid hcGrid--2">
        <div className="hcCard">
          <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>Smart scheduling (demo)</div>
          <p style={{ margin: "10px 0 0", color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
            Suggested slots use simple rules (chronic vs acute keywords) and avoid mocked busy times. Connect ML + real calendars in production.
          </p>
          <div className="hcFieldRow hcFieldRow--2" style={{ marginTop: 12 }}>
            <div className="hcField">
              <div className="hcLabel">Patient</div>
              <input className="hcInput" value={form.patient} onChange={(e) => setForm((p) => ({ ...p, patient: e.target.value }))} placeholder="Patient name" />
            </div>
            <div className="hcField">
              <div className="hcLabel">Clinician</div>
              <input className="hcInput" value={form.doctor} onChange={(e) => setForm((p) => ({ ...p, doctor: e.target.value }))} placeholder="Doctor / nurse" />
            </div>
            <div className="hcField">
              <div className="hcLabel">Date</div>
              <input className="hcInput" type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
            </div>
            <div className="hcField">
              <div className="hcLabel">Time</div>
              <input className="hcInput" type="time" value={form.time} onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))} />
            </div>
          </div>
          <div className="hcField" style={{ marginTop: 10 }}>
            <div className="hcLabel">Reason (helps AI suggest slots)</div>
            <textarea className="hcTextarea" value={form.reason} onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))} placeholder="e.g. Wound care follow-up, physio, or acute fever" />
          </div>

          <div className="hcFieldRow hcFieldRow--2" style={{ marginTop: 10 }}>
            <div className="hcField">
              <div className="hcLabel">Recurring</div>
              <select className="hcSelect" value={form.recurring} onChange={(e) => setForm((p) => ({ ...p, recurring: e.target.value }))}>
                <option value="none">One-time</option>
                <option value="weekly">Weekly (home visit)</option>
                <option value="biweekly">Every 2 weeks</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div className="hcField">
              <div className="hcLabel">Mock busy time (doctor)</div>
              <select className="hcSelect" value={busyMock[0] || ""} onChange={(e) => setBusyMock([e.target.value])}>
                <option value="">None</option>
                <option value="09:00">09:00 busy</option>
                <option value="10:30">10:30 busy</option>
                <option value="14:00">14:00 busy</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 900, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)" }}>Suggested times</div>
            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {suggested.map((s) => (
                <button key={s.time} className="hcBtn hcBtn--sm hcBtn--ghost" type="button" onClick={() => applySuggestedTime(s.time)} title={s.label}>
                  {s.time} · {s.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 900, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)" }}>Automated reminders</div>
            <div style={{ marginTop: 8, display: "flex", gap: 16, flexWrap: "wrap" }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                <input type="checkbox" checked={form.remindSms} onChange={(e) => setForm((p) => ({ ...p, remindSms: e.target.checked }))} />
                SMS
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                <input type="checkbox" checked={form.remindEmail} onChange={(e) => setForm((p) => ({ ...p, remindEmail: e.target.checked }))} />
                Email
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                <input type="checkbox" checked={form.remindWhatsapp} onChange={(e) => setForm((p) => ({ ...p, remindWhatsapp: e.target.checked }))} />
                WhatsApp
              </label>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted)" }}>Production: Twilio / MessageBird + templates + confirm/cancel links.</p>
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="hcBtn hcBtn--primary" type="button" onClick={add}>
              Save appointment
            </button>
            <a className="hcBtn hcBtn--ghost" href="/telehealth">
              Video visit
            </a>
            <a className="hcBtn hcBtn--ghost" href="/secure/chat">
              Message patient
            </a>
          </div>
        </div>

        <div className="hcCard">
          <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>Upcoming</div>
          <div style={{ marginTop: 10, overflow: "auto" }}>
            <table className="hcTable">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>When</th>
                  <th>Recurring</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {nextItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ color: "var(--muted)" }}>
                      No appointments yet.
                    </td>
                  </tr>
                ) : null}
                {nextItems.map((x) => (
                  <tr key={x.id}>
                    <td>
                      <div style={{ fontWeight: 800 }}>{x.patient}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>{x.doctor}</div>
                    </td>
                    <td>
                      {x.date} {x.time}
                    </td>
                    <td>{x.recurring === "none" ? "—" : x.recurring}</td>
                    <td style={{ textAlign: "right" }}>
                      <button className="hcBtn hcBtn--sm hcBtn--danger" type="button" onClick={() => remove(x.id)}>
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
