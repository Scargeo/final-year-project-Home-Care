"use client"

import { useMemo } from "react"
import AppShell from "../../components/AppShell.jsx"

function pct(n, max = 100) {
  const v = Math.max(0, Math.min(max, Number(n) || 0))
  return `${(v / max) * 100}%`
}

function barTone(value, target = 100) {
  const r = target > 0 ? value / target : 0
  if (r >= 0.85) return ""
  if (r >= 0.6) return "reportHBarFill--warn"
  return "reportHBarFill--risk"
}

export default function ReportsPage() {
  const performance = useMemo(
    () => [
      { label: "Care plan adherence", value: 87, target: 100, hint: "vs org goal" },
      { label: "Follow-up completion", value: 64, target: 100, hint: "7-day window" },
      { label: "Medication sync accuracy", value: 92, target: 100, hint: "pharmacy handoff" },
      { label: "Telehealth show rate", value: 78, target: 100, hint: "scheduled sessions" },
      { label: "Patient satisfaction (NPS-style)", value: 71, target: 100, hint: "rolling 30d" },
    ],
    [],
  )

  const weeklyVolume = useMemo(
    () => [
      { label: "Mon", value: 42, max: 60 },
      { label: "Tue", value: 38, max: 60 },
      { label: "Wed", value: 51, max: 60 },
      { label: "Thu", value: 44, max: 60 },
      { label: "Fri", value: 49, max: 60 },
      { label: "Sat", value: 22, max: 60 },
      { label: "Sun", value: 18, max: 60 },
    ],
    [],
  )

  const specialtyLoad = useMemo(
    () => [
      { label: "Nursing", value: 88, max: 100 },
      { label: "Physio", value: 62, max: 100 },
      { label: "Lab", value: 45, max: 100 },
      { label: "Doctor", value: 74, max: 100 },
      { label: "Elderly", value: 91, max: 100 },
    ],
    [],
  )

  const appointmentByDoctor = useMemo(
    () => [
      { name: "Cardio", value: 6 },
      { name: "Ortho", value: 5 },
      { name: "General", value: 7 },
      { name: "Neuro", value: 3 },
    ],
    [],
  )
  const maxAppointments = Math.max(1, ...appointmentByDoctor.map((x) => x.value))

  const pieStyle = {
    background: "conic-gradient(#22d3ee 0 40%, #f59e0b 40% 75%, #22c55e 75% 100%)",
  }

  return (
    <AppShell title="Reports">
      <div className="reportGrid">
        <div className="reportCard reportChartCard reportChartWide">
          <div className="reportTitle">Performance & progress</div>
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "#94a3b8", lineHeight: 1.45 }}>
            Demo KPIs as share of target. Bars reflow on small screens; connect to your analytics API for live numbers.
          </p>
          <div className="reportHBarList" role="group" aria-label="Performance progress bar chart">
            {performance.map((row) => (
              <div key={row.label} className="reportHBarRow">
                <div>
                  <div className="reportHBarLabel">{row.label}</div>
                  <div className="reportHBarMeta">{row.hint}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <div className="reportHBarTrack" style={{ flex: 1 }} title={`${row.value}% of target`}>
                    <div className={`reportHBarFill ${barTone(row.value, row.target)}`} style={{ width: pct(row.value, row.target) }} />
                  </div>
                  <span className="reportHBarPct">{Math.round(row.value)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="reportCard reportChartCard">
          <div className="reportTitle">Weekly visit volume</div>
          <div className="reportVChartWrap">
            <div className="reportVChart" role="img" aria-label="Bar chart of visits by weekday">
              {weeklyVolume.map((d) => (
                <div key={d.label} className="reportVCol">
                  <span className="reportVValue">{d.value}</span>
                  <div className="reportVTrack" title={`${d.value} visits`}>
                    <div className="reportVBar" style={{ height: pct(d.value, d.max) }} />
                  </div>
                  <span className="reportVLabel">{d.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="reportCard reportChartCard">
          <div className="reportTitle">Home care load by service</div>
          <div className="reportVChartWrap">
            <div className="reportVChart" role="img" aria-label="Relative load by home care service">
              {specialtyLoad.map((d) => (
                <div key={d.label} className="reportVCol">
                  <span className="reportVValue">{d.value}%</span>
                  <div className="reportVTrack">
                    <div className="reportVBar reportVBar--secondary" style={{ height: pct(d.value, d.max) }} />
                  </div>
                  <span className="reportVLabel">{d.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="reportCard">
          <div className="reportTitle">Appointments by specialty</div>
          <div className="reportBars">
            {appointmentByDoctor.map((item) => (
              <div key={item.name} className="reportBarItem">
                <div className="reportBar" style={{ height: `${(item.value / maxAppointments) * 100}%` }} />
                <div className="reportAxisLabel">{item.name}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="reportCard">
          <div className="reportTitle">Appointment status</div>
          <div className="reportPieWrap">
            <div className="reportPie" style={pieStyle} role="img" aria-label="Completed 40 percent, confirmed 35, in progress 25" />
            <div className="reportLegend">
              <span>Completed: 40%</span>
              <span>Confirmed: 35%</span>
              <span>In progress: 25%</span>
            </div>
          </div>
        </div>

        <div className="reportCard">
          <div className="reportTitle">Revenue summary</div>
          <div className="reportSummary">
            <div>
              <span>Total invoices</span>
              <b>12</b>
            </div>
            <div>
              <span>Total revenue</span>
              <b className="reportGood">$4,270.00</b>
            </div>
            <div>
              <span>Collected</span>
              <b className="reportGood">$3,890.00</b>
            </div>
            <div>
              <span>Outstanding</span>
              <b className="reportWarn">$380.00</b>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, color: "var(--muted)", fontSize: 12, lineHeight: 1.5 }}>
        Charts use CSS only (no canvas dependency) so they stay sharp on retina and resize cleanly. Next: wire to your warehouse, add date range filters, and export CSV/PDF.
      </div>
    </AppShell>
  )
}
