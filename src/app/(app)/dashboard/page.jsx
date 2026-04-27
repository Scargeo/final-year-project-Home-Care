"use client";

import AppShell from "../../components/AppShell.jsx";

export default function DashboardPage() {
  return (
    <AppShell title="Executive dashboard">
      <div className="hcGrid hcGrid--3">
        <div className="hcCard hcKpi">
          <div className="hcKpi__k">Patient satisfaction (30d)</div>
          <div className="hcKpi__v">4.7</div>
          <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
            Rolling NPS-style score
          </div>
        </div>
        <div className="hcCard hcKpi">
          <div className="hcKpi__k">Caregiver utilization</div>
          <div className="hcKpi__v">78%</div>
          <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
            Scheduled vs available hours
          </div>
        </div>
        <div className="hcCard hcKpi">
          <div className="hcKpi__k">Revenue trend</div>
          <div className="hcKpi__v">+12%</div>
          <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
            vs prior month
          </div>
        </div>
      </div>

      <div className="hcGrid hcGrid--2" style={{ marginTop: 12 }}>
        <div className="hcCard">
          <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>
            Predictive staffing
          </div>
          <p
            style={{
              margin: "10px 0 0",
              color: "var(--muted)",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            Forecast suggests <b>+2</b> caregivers next week based on
            appointment growth and historical no-show rate.
          </p>
          <div
            style={{
              marginTop: 12,
              height: 120,
              borderRadius: 16,
              border: "1px dashed var(--border)",
              display: "grid",
              placeItems: "center",
              color: "var(--muted)",
              fontSize: 13,
            }}
          >
            Analytics chart feed connected. Expand with BI exports (Metabase,
            Looker, Power BI).
          </div>
        </div>
        <div className="hcCard">
          <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>
            Patient outcomes
          </div>
          <ul
            style={{
              margin: "10px 0 0",
              paddingLeft: 18,
              color: "var(--muted)",
              lineHeight: 1.7,
              fontSize: 13,
            }}
          >
            <li>
              Readmission risk cohort: <b>low</b> (12 patients flagged)
            </li>
            <li>
              Fall-risk home visits: <b>8</b> active plans
            </li>
            <li>
              Avg. days to first follow-up: <b>3.1</b>
            </li>
          </ul>
        </div>
      </div>

      <div className="hcGrid hcGrid--2" style={{ marginTop: 12 }}>
        <div className="hcCard">
          <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>
            Quick actions
          </div>
          <div
            style={{
              marginTop: 10,
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <a className="hcBtn hcBtn--primary" href="/appointments">
              Smart schedule
            </a>
            <a className="hcBtn hcBtn--primary" href="/patients">
              Patients
            </a>
            <a className="hcBtn hcBtn--primary" href="/telehealth">
              Telehealth
            </a>
            <a className="hcBtn hcBtn--primary" href="/billing">
              Billing
            </a>
            <a className="hcBtn hcBtn--primary" href="/reports">
              Reports
            </a>
            <a className="hcBtn hcBtn--primary" href="/marketplace">
              Marketplace
            </a>
            <a className="hcBtn hcBtn--primary" href="/medical-imaging">
              Imaging lab
            </a>
            <a className="hcBtn hcBtn--primary" href="/notifications">
              Notifications
            </a>
            <a className="hcBtn hcBtn--primary" href="/sos">
              SOS drill
            </a>
          </div>
        </div>
        <div className="hcCard">
          <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>
            Security & compliance
          </div>
          <div
            style={{
              marginTop: 10,
              color: "var(--muted)",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            Secure Chat uses browser E2EE for message payloads; configure RBAC +
            audit in <a href="/admin">Admin</a>. Production: hosted KMS, SSO,
            and PHI logging.
          </div>
        </div>
      </div>
    </AppShell>
  );
}
