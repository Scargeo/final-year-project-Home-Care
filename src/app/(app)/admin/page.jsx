"use client";

import { useEffect, useState } from "react";
import AppShell from "../../components/AppShell.jsx";
import { randomId } from "../../lib/randomId.js";
import { readAudit } from "../../lib/auditLog.js";
import { loadAuth } from "../../lib/auth-client.js";
import { getKnownRoles, hasPermission, PERMISSIONS } from "../../lib/rbac.js";

const USERS_KEY = "hc:users:v1";
const SETTINGS_KEY = "hc:settings:v1";

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export default function AdminPage() {
  const [users, setUsers] = useState(() =>
    load(USERS_KEY, [
      {
        id: "u1",
        name: "Admin",
        email: "admin@homecare.local",
        role: "admin",
        status: "active",
      },
    ]),
  );
  const [settings, setSettings] = useState(() =>
    load(SETTINGS_KEY, {
      orgName: "Home Care Plus",
      require2fa: false,
      auditMode: true,
    }),
  );
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    role: "patient",
  });
  const [audit, setAudit] = useState(() => readAudit());
  const [directory, setDirectory] = useState([]);
  const roles = getKnownRoles();

  useEffect(() => {
    save(USERS_KEY, users);
  }, [users]);
  useEffect(() => {
    save(SETTINGS_KEY, settings);
  }, [settings]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const auth = loadAuth();
      if (!auth?.token) return;
      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!cancelled) setDirectory(Array.isArray(data.users) ? data.users : []);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  function addUser() {
    const name = newUser.name.trim();
    const email = newUser.email.trim();
    if (!name || !email) return;
    setUsers((prev) => [
      { id: randomId(), name, email, role: newUser.role, status: "active" },
      ...prev,
    ]);
    setNewUser({ name: "", email: "", role: "staff" });
  }

  function toggleUser(id) {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id
          ? { ...u, status: u.status === "active" ? "disabled" : "active" }
          : u,
      ),
    );
  }

  function removeUser(id) {
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }

  return (
    <AppShell title="Admin">
      <div className="hcGrid hcGrid--2">
        <div className="hcCard">
          <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>
            System settings
          </div>
          <div className="hcFieldRow hcFieldRow--2" style={{ marginTop: 12 }}>
            <div className="hcField">
              <div className="hcLabel">Organization name</div>
              <input
                className="hcInput"
                value={settings.orgName}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, orgName: e.target.value }))
                }
              />
            </div>
            <div className="hcField">
              <div className="hcLabel">Signal server (chat/calls)</div>
              <input
                className="hcInput"
                value={
                  process.env.NEXT_PUBLIC_SIGNAL_URL || "ws://localhost:3001"
                }
                readOnly
              />
            </div>
          </div>

          <div
            style={{
              marginTop: 10,
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontWeight: 800,
                color: "var(--muted)",
              }}
            >
              <input
                type="checkbox"
                checked={settings.require2fa}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, require2fa: e.target.checked }))
                }
              />
              Require 2FA
            </label>
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontWeight: 800,
                color: "var(--muted)",
              }}
            >
              <input
                type="checkbox"
                checked={settings.auditMode}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, auditMode: e.target.checked }))
                }
              />
              Audit mode
            </label>
          </div>

          <div
            style={{
              marginTop: 10,
              color: "var(--muted)",
              fontSize: 12,
              lineHeight: 1.35,
            }}
          >
            Role-based access below reflects baseline policies. Extend with
            policy engine + attribute-based access (ABAC).
          </div>

          <div style={{ marginTop: 14, fontWeight: 950 }}>RBAC matrix</div>
          <div style={{ marginTop: 8, overflow: "auto" }}>
            <table className="hcTable">
              <thead>
                <tr>
                  <th>Permission</th>
                  {roles.map((r) => (
                    <th key={r} style={{ textTransform: "capitalize" }}>
                      {r}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map((perm) => (
                  <tr key={perm}>
                    <td
                      style={{
                        fontFamily: "ui-monospace, monospace",
                        fontSize: 12,
                      }}
                    >
                      {perm}
                    </td>
                    {roles.map((r) => (
                      <td key={r}>{hasPermission(r, perm) ? "✓" : "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="hcCard">
          <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>
            User management
          </div>

          <div className="hcFieldRow hcFieldRow--2" style={{ marginTop: 12 }}>
            <div className="hcField">
              <div className="hcLabel">Name</div>
              <input
                className="hcInput"
                value={newUser.name}
                onChange={(e) =>
                  setNewUser((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="Full name"
              />
            </div>
            <div className="hcField">
              <div className="hcLabel">Email</div>
              <input
                className="hcInput"
                value={newUser.email}
                onChange={(e) =>
                  setNewUser((p) => ({ ...p, email: e.target.value }))
                }
                placeholder="name@org.com"
              />
            </div>
            <div className="hcField">
              <div className="hcLabel">Role</div>
              <select
                className="hcSelect"
                value={newUser.role}
                onChange={(e) =>
                  setNewUser((p) => ({ ...p, role: e.target.value }))
                }
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div
              className="hcField"
              style={{ display: "flex", alignItems: "flex-end" }}
            >
              <button
                className="hcBtn hcBtn--primary"
                type="button"
                onClick={addUser}
                style={{ width: "100%" }}
              >
                Add user
              </button>
            </div>
          </div>

          <div style={{ marginTop: 10, overflow: "auto" }}>
            <table className="hcTable">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>{u.role}</td>
                    <td>{u.status}</td>
                    <td
                      style={{
                        textAlign: "right",
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        className="hcBtn hcBtn--sm hcBtn--ghost"
                        type="button"
                        onClick={() => toggleUser(u.id)}
                      >
                        {u.status === "active" ? "Disable" : "Enable"}
                      </button>
                      <button
                        className="hcBtn hcBtn--sm hcBtn--danger"
                        type="button"
                        onClick={() => removeUser(u.id)}
                      >
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>
            Registered accounts & trust signals
          </div>
          <button
            className="hcBtn hcBtn--sm hcBtn--ghost"
            type="button"
            onClick={async () => {
              const auth = loadAuth();
              if (!auth?.token) return;
              const res = await fetch("/api/admin/users", {
                headers: { Authorization: `Bearer ${auth.token}` },
              });
              if (!res.ok) return;
              const data = await res.json();
              setDirectory(Array.isArray(data.users) ? data.users : []);
            }}
          >
            Refresh directory
          </button>
        </div>
        <p
          style={{
            margin: "8px 0 0",
            fontSize: 12,
            color: "var(--muted)",
            lineHeight: 1.45,
          }}
        >
          Trust scores are computed on signup using disposable-email and naming
          heuristics. Extend with license verification, document uploads, and
          device reputation.
        </p>
        <div style={{ marginTop: 10, overflow: "auto", maxHeight: 280 }}>
          <table className="hcTable">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Trust</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {directory.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ color: "var(--muted)" }}>
                    No accounts loaded yet. Sign in as admin and refresh after
                    new users register.
                  </td>
                </tr>
              ) : null}
              {directory.map((u) => (
                <tr key={u.id}>
                  <td>{u.fullName}</td>
                  <td style={{ fontSize: 12 }}>{u.email}</td>
                  <td>{u.role}</td>
                  <td style={{ fontSize: 12 }}>
                    {u.trust ? (
                      <>
                        {u.trust.level} ({u.trust.score})
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {u.trust?.flags?.join(", ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="hcCard" style={{ marginTop: 12 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>
            Audit log
          </div>
          <button
            className="hcBtn hcBtn--sm hcBtn--ghost"
            type="button"
            onClick={() => setAudit(readAudit())}
          >
            Refresh
          </button>
        </div>
        <div style={{ marginTop: 10, overflow: "auto", maxHeight: 320 }}>
          <table className="hcTable">
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Resource</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {audit.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ color: "var(--muted)" }}>
                    No events yet. Create appointments, prescriptions, or rider
                    actions to populate.
                  </td>
                </tr>
              ) : null}
              {audit.slice(0, 50).map((a) => (
                <tr key={a.id}>
                  <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                    {new Date(a.ts).toLocaleString()}
                  </td>
                  <td style={{ fontSize: 12 }}>{a.action}</td>
                  <td style={{ fontSize: 12 }}>{a.resource}</td>
                  <td style={{ fontSize: 12 }}>{a.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--muted)" }}>
          HIPAA/GDPR: export logs to your SIEM; restrict access to security
          officers only.
        </p>
      </div>
    </AppShell>
  );
}
