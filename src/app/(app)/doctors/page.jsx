"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "../../components/AppShell.jsx";
import { randomId } from "../../lib/randomId.js";

const STORAGE_KEY = "hc:doctors:v1";

function loadItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveItems(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function emptyForm() {
  return {
    name: "",
    phone: "",
    email: "",
    specialty: "",
    license: "",
    location: "",
    availability: "Weekdays",
    notes: "",
  };
}

export default function DoctorsPage() {
  const [items, setItems] = useState(() => loadItems());
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(emptyForm());

  useEffect(() => {
    saveItems(items);
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (d) =>
        (d.name || "").toLowerCase().includes(q) ||
        (d.specialty || "").toLowerCase().includes(q) ||
        (d.phone || "").toLowerCase().includes(q),
    );
  }, [items, query]);

  function startAdd() {
    setEditingId("");
    setForm(emptyForm());
  }

  function startEdit(d) {
    setEditingId(d.id);
    setForm({
      name: d.name || "",
      phone: d.phone || "",
      email: d.email || "",
      specialty: d.specialty || "",
      license: d.license || "",
      location: d.location || "",
      availability: d.availability || "Weekdays",
      notes: d.notes || "",
    });
  }

  function remove(id) {
    setItems((prev) => prev.filter((x) => x.id !== id));
    if (editingId === id) startAdd();
  }

  function submit() {
    const name = form.name.trim();
    const phone = form.phone.trim();
    const specialty = form.specialty.trim();
    if (!name || !phone || !specialty) return;

    if (editingId) {
      setItems((prev) =>
        prev.map((x) =>
          x.id === editingId ? { ...x, ...form, name, phone, specialty } : x,
        ),
      );
      return;
    }

    setItems((prev) => [
      {
        id: randomId(),
        createdAt: Date.now(),
        ...form,
        name,
        phone,
        specialty,
      },
      ...prev,
    ]);
    setForm(emptyForm());
  }

  return (
    <AppShell title="Care team directory">
      <div className="hcCard" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>
          Freelance marketplace
        </div>
        <p
          style={{
            margin: "8px 0 0",
            color: "var(--muted)",
            fontSize: 13,
            lineHeight: 1.55,
          }}
        >
          Publish visit bundles and rates for patients in the{" "}
          <a href="/marketplace">Marketplace</a>. This screen remains your
          internal roster for assignments and credential notes.
        </p>
      </div>
      <div className="hcGrid hcGrid--2">
        <div className="hcCard">
          <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>
            {editingId ? "Edit doctor" : "Add new doctor"}
          </div>

          <div className="hcFieldRow hcFieldRow--2" style={{ marginTop: 12 }}>
            <div className="hcField">
              <div className="hcLabel">Full name *</div>
              <input
                className="hcInput"
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="Doctor name"
              />
            </div>
            <div className="hcField">
              <div className="hcLabel">Phone *</div>
              <input
                className="hcInput"
                value={form.phone}
                onChange={(e) =>
                  setForm((p) => ({ ...p, phone: e.target.value }))
                }
                placeholder="+233..."
              />
            </div>
            <div className="hcField">
              <div className="hcLabel">Specialty *</div>
              <input
                className="hcInput"
                value={form.specialty}
                onChange={(e) =>
                  setForm((p) => ({ ...p, specialty: e.target.value }))
                }
                placeholder="e.g. Pediatrics"
              />
            </div>
            <div className="hcField">
              <div className="hcLabel">Email</div>
              <input
                className="hcInput"
                value={form.email}
                onChange={(e) =>
                  setForm((p) => ({ ...p, email: e.target.value }))
                }
                placeholder="name@email.com"
              />
            </div>
            <div className="hcField">
              <div className="hcLabel">License #</div>
              <input
                className="hcInput"
                value={form.license}
                onChange={(e) =>
                  setForm((p) => ({ ...p, license: e.target.value }))
                }
                placeholder="Registration / license"
              />
            </div>
            <div className="hcField">
              <div className="hcLabel">Location</div>
              <input
                className="hcInput"
                value={form.location}
                onChange={(e) =>
                  setForm((p) => ({ ...p, location: e.target.value }))
                }
                placeholder="Clinic / branch"
              />
            </div>
          </div>

          <div className="hcFieldRow hcFieldRow--2" style={{ marginTop: 10 }}>
            <div className="hcField">
              <div className="hcLabel">Availability</div>
              <select
                className="hcSelect"
                value={form.availability}
                onChange={(e) =>
                  setForm((p) => ({ ...p, availability: e.target.value }))
                }
              >
                <option value="Weekdays">Weekdays</option>
                <option value="Weekends">Weekends</option>
                <option value="24/7">24/7</option>
                <option value="On-call">On-call</option>
              </select>
            </div>
            <div className="hcField">
              <div className="hcLabel">Notes</div>
              <input
                className="hcInput"
                value={form.notes}
                onChange={(e) =>
                  setForm((p) => ({ ...p, notes: e.target.value }))
                }
                placeholder="Notes..."
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
            <button
              className="hcBtn hcBtn--primary"
              type="button"
              onClick={submit}
            >
              {editingId ? "Save changes" : "Add doctor"}
            </button>
            <button
              className="hcBtn hcBtn--primary"
              type="button"
              onClick={startAdd}
            >
              New
            </button>
            <a className="hcBtn hcBtn--primary" href="/appointments">
              Schedule appointment
            </a>
          </div>
          <div
            style={{
              marginTop: 10,
              color: "var(--muted)",
              fontSize: 12,
              lineHeight: 1.35,
            }}
          >
            Advanced: next step is calendars (Google/MS), shift planning, role
            permissions, and patient-to-doctor assignment rules.
          </div>
        </div>

        <div className="hcCard">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>
              Doctor list
            </div>
            <input
              className="hcInput"
              style={{ maxWidth: 280 }}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name/specialty/phone"
            />
          </div>

          <div style={{ marginTop: 10, overflow: "auto" }}>
            <table className="hcTable">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Specialty</th>
                  <th>Phone</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ color: "var(--muted)" }}>
                      No doctors found.
                    </td>
                  </tr>
                ) : null}
                {filtered.map((d) => (
                  <tr key={d.id}>
                    <td>{d.name}</td>
                    <td>{d.specialty}</td>
                    <td>{d.phone}</td>
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
                        className="hcBtn hcBtn--sm hcBtn--primary"
                        type="button"
                        onClick={() => startEdit(d)}
                      >
                        Edit
                      </button>
                      <button
                        className="hcBtn hcBtn--sm hcBtn--danger"
                        type="button"
                        onClick={() => remove(d.id)}
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
    </AppShell>
  );
}
