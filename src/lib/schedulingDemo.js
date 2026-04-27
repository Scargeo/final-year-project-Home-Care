/** Demo “AI” slot suggestions: prefers morning for chronic follow-ups, afternoon for acute. */
export function suggestSlots({ reason = "", doctorBusy = [] }) {
  const base = ["09:00", "10:30", "11:15", "14:00", "15:30", "16:45"]
  const chronic = /wound|physio|chronic|diabetes|hypertension/i.test(reason)
  const preferred = chronic ? ["09:00", "10:30", "11:15"] : ["14:00", "15:30", "16:45"]
  const busySet = new Set(doctorBusy)
  const scored = base.map((t) => {
    let score = preferred.includes(t) ? 10 : 5
    if (busySet.has(t)) score -= 100
    return { time: t, score, label: preferred.includes(t) ? "Optimal" : "Available" }
  })
  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 4)
}
