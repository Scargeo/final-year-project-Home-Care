"use client"

import { useEffect, useState } from "react"
import AppShell from "../../components/AppShell.jsx"
import { randomId } from "../../lib/randomId.js"

const KEY = "hc:community:v1"

const DEFAULT_GROUPS = [
  { id: "g1", name: "Diabetes peer support", members: 42, joined: false },
  { id: "g2", name: "Post-surgery recovery", members: 28, joined: true },
  { id: "g3", name: "Caregiver burnout", members: 15, joined: false },
]

function loadCommunity() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { points: 120, groups: DEFAULT_GROUPS }
    const p = JSON.parse(raw)
    return {
      points: typeof p.points === "number" ? p.points : 120,
      groups: Array.isArray(p.groups) ? p.groups : DEFAULT_GROUPS,
    }
  } catch {
    return { points: 120, groups: DEFAULT_GROUPS }
  }
}

export default function CommunityPage() {
  const [cg, setCg] = useState(() => loadCommunity())
  const points = cg.points
  const groups = cg.groups
  const [ratings, setRatings] = useState([
    { id: "r1", caregiver: "Nurse Ama K.", stars: 5, comment: "Kind and on time." },
    { id: "r2", caregiver: "Rider Kojo", stars: 4, comment: "Fast delivery." },
  ])

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ points: cg.points, groups: cg.groups }))
    } catch {
      // ignore
    }
  }, [cg])

  function toggleGroup(id) {
    setCg((prev) => ({
      ...prev,
      points: prev.points + 5,
      groups: prev.groups.map((g) => (g.id === id ? { ...g, joined: !g.joined } : g)),
    }))
  }

  function completeTask() {
    setCg((prev) => ({ ...prev, points: prev.points + 5 }))
    alert("Task completed (+5 pts). Demo gamification.")
  }

  return (
    <AppShell title="Community & engagement">
      <div className="hcGrid hcGrid--3">
        <div className="hcCard hcKpi">
          <div className="hcKpi__k">Wellness points</div>
          <div className="hcKpi__v">{points}</div>
          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="hcBtn hcBtn--sm hcBtn--primary" type="button" onClick={completeTask}>
              Log care task
            </button>
          </div>
        </div>
        <div className="hcCard">
          <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>Support groups</div>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {groups.map((g) => (
              <div key={g.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{g.name}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{g.members} members</div>
                </div>
                <button className="hcBtn hcBtn--sm hcBtn--ghost" type="button" onClick={() => toggleGroup(g.id)}>
                  {g.joined ? "Leave" : "Join"}
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="hcCard">
          <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>Caregiver ratings</div>
          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {ratings.map((r) => (
              <div key={r.id} style={{ padding: 10, borderRadius: 14, border: "1px solid var(--border)", background: "color-mix(in srgb, var(--surface) 82%, transparent)" }}>
                <div style={{ fontWeight: 950 }}>{r.caregiver}</div>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>{"★".repeat(r.stars)}{"☆".repeat(5 - r.stars)}</div>
                <div style={{ marginTop: 6, fontSize: 13 }}>{r.comment}</div>
              </div>
            ))}
          </div>
          <button
            className="hcBtn hcBtn--sm hcBtn--ghost"
            type="button"
            style={{ marginTop: 10 }}
            onClick={() => {
              const name = prompt("Caregiver name?")
              if (!name?.trim()) return
              setRatings((prev) => [{ id: randomId(), caregiver: name.trim(), stars: 5, comment: "Great care (demo)." }, ...prev])
            }}
          >
            Add demo review
          </button>
        </div>
      </div>
    </AppShell>
  )
}
