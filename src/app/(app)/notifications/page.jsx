"use client"

import { useEffect, useMemo, useState } from "react"
import AppShell from "../../components/AppShell.jsx"
import { randomId } from "../../lib/randomId.js"
import { appendAudit } from "../../lib/auditLog.js"

const STORAGE_KEY = "hc:notifications:v1"

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const p = raw ? JSON.parse(raw) : { rules: [], log: [] }
    return { rules: Array.isArray(p.rules) ? p.rules : [], log: Array.isArray(p.log) ? p.log : [] }
  } catch {
    return { rules: [], log: [] }
  }
}

function save(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export default function NotificationsPage() {
  const [rules, setRules] = useState(() => load().rules)
  const [log, setLog] = useState(() => load().log)
  const [title, setTitle] = useState("")
  const [channel, setChannel] = useState("in_app")
  const [schedule, setSchedule] = useState("daily")
  const [time, setTime] = useState("09:00")

  useEffect(() => {
    save({ rules, log })
  }, [rules, log])

  const upcoming = useMemo(() => {
    return rules.map((r) => ({ ...r, next: `${r.schedule} @ ${r.time}` }))
  }, [rules])

  function addRule() {
    const t = title.trim()
    if (!t) return
    const row = { id: randomId(), title: t, channel, schedule, time, enabled: true, createdAt: Date.now() }
    setRules((prev) => [row, ...prev])
    appendAudit({ action: "notification.rule_created", resource: "notifications", detail: `${t} (${channel})` })
    setTitle("")
  }

  function toggle(id) {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)))
  }

  function remove(id) {
    setRules((prev) => prev.filter((r) => r.id !== id))
  }

  function simulateFire() {
    const sample = rules.find((r) => r.enabled) || { title: "Medication reminder", channel: "push" }
    const evt = { id: randomId(), ts: Date.now(), text: `Fired: ${sample.title} via ${sample.channel}`, meta: "Demo only — connect Twilio / FCM / email worker." }
    setLog((prev) => [evt, ...prev].slice(0, 40))
    appendAudit({ action: "notification.simulated", resource: "notifications", detail: evt.text })
  }

  return (
    <AppShell title="Smart notifications">
      <div className="hcGrid hcGrid--2">
        <div className="hcCard">
          <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>Reminder rules</div>
          <p style={{ margin: "10px 0 0", color: "var(--muted)", fontSize: 13, lineHeight: 1.55 }}>
            Configure appointment nudges, medication windows, and follow-up tasks. Delivery is simulated here; production should use durable queues and user channel
            preferences.
          </p>
          <div className="hcField" style={{ marginTop: 12 }}>
            <div className="hcLabel">Title</div>
            <input className="hcInput" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Take Metformin with breakfast" />
          </div>
          <div className="hcFieldRow hcFieldRow--2" style={{ marginTop: 10 }}>
            <div className="hcField">
              <div className="hcLabel">Channel</div>
              <select className="hcSelect" value={channel} onChange={(e) => setChannel(e.target.value)}>
                <option value="in_app">In-app</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="push">Push</option>
              </select>
            </div>
            <div className="hcField">
              <div className="hcLabel">Cadence</div>
              <select className="hcSelect" value={schedule} onChange={(e) => setSchedule(e.target.value)}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div className="hcField">
              <div className="hcLabel">Time</div>
              <input className="hcInput" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="hcBtn hcBtn--primary" type="button" onClick={addRule}>
              Save rule
            </button>
            <button className="hcBtn hcBtn--ghost" type="button" onClick={simulateFire}>
              Simulate send
            </button>
          </div>
        </div>

        <div className="hcCard">
          <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>Active rules</div>
          <div style={{ marginTop: 10, overflow: "auto" }}>
            <table className="hcTable">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Channel</th>
                  <th>Schedule</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {upcoming.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ color: "var(--muted)" }}>
                      No rules yet.
                    </td>
                  </tr>
                ) : null}
                {upcoming.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 800 }}>{r.title}</td>
                    <td>{r.channel}</td>
                    <td>
                      {r.next}
                    </td>
                    <td style={{ textAlign: "right", display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                      <button className="hcBtn hcBtn--sm hcBtn--ghost" type="button" onClick={() => toggle(r.id)}>
                        {r.enabled ? "Pause" : "Resume"}
                      </button>
                      <button className="hcBtn hcBtn--sm hcBtn--danger" type="button" onClick={() => remove(r.id)}>
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

      <div className="hcCard" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>Delivery log (demo)</div>
        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          {log.length === 0 ? <div style={{ color: "var(--muted)", fontSize: 13 }}>No simulated events yet.</div> : null}
          {log.map((x) => (
            <div key={x.id} style={{ padding: 12, borderRadius: 14, border: "1px solid var(--border)", fontSize: 13 }}>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{new Date(x.ts).toLocaleString()}</div>
              <div style={{ marginTop: 6, fontWeight: 800 }}>{x.text}</div>
              <div style={{ marginTop: 4, color: "var(--muted)" }}>{x.meta}</div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
