"use client"

import { useMemo, useRef, useState } from "react"
import AppShell from "../../components/AppShell.jsx"
import { randomId } from "../../lib/randomId.js"

function symptomAssess(input) {
  const t = input.toLowerCase()
  if (/chest|crush|can't breathe|severe pain/.test(t)) return { level: "urgent", msg: "Seek emergency care or call your local emergency number now. This tool is not a substitute for triage." }
  if (/fever|cough|cold/.test(t)) return { level: "routine", msg: "Possible viral illness. Rest, fluids, monitor symptoms; book a visit if worsening or high fever persists." }
  if (/wound|bleed|infection/.test(t)) return { level: "soon", msg: "Consider nurse or clinician review within 24–48h; keep wound clean and documented." }
  return { level: "info", msg: "Not enough detail for a structured triage. Describe duration, severity (1–10), and any red-flag symptoms." }
}

function estimateRisk(age, conditions) {
  let fall = 12
  let readmit = 8
  if (Number(age) > 75) fall += 15
  if (/diabetes|chf|copd/i.test(conditions)) readmit += 12
  return { fall: Math.min(99, fall), readmit: Math.min(99, readmit) }
}

export default function AiAssistantPage() {
  const [input, setInput] = useState("")
  const [history, setHistory] = useState([])
  const [symptomText, setSymptomText] = useState("")
  const [symptomResult, setSymptomResult] = useState(null)
  const [age, setAge] = useState("72")
  const [conditions, setConditions] = useState("diabetes, hypertension")
  const [voiceStatus, setVoiceStatus] = useState("")
  const [isSending, setIsSending] = useState(false)

  const tips = useMemo(
    () => [
      "Summarize a patient's notes into a plan.",
      "Generate a discharge checklist.",
      "Draft a follow-up message for a patient.",
      "Explain medication usage in simple language.",
    ],
    [],
  )

  const recRef = useRef(null)

  async function send() {
    const text = input.trim()
    if (!text || isSending) return
    const userMsg = { id: randomId(), role: "user", text, ts: Date.now() }
    setHistory((prev) => [userMsg, ...prev])
    setInput("")
    setIsSending(true)
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      })
      const data = await res.json().catch(() => ({}))
      const reply = data?.reply || data?.answer || data?.message || data?.error || "I could not generate a response right now. Please try again."
      setHistory((prev) => [{ id: randomId(), role: "ai", text: String(reply), ts: Date.now() }, ...prev])
    } catch {
      setHistory((prev) => [
        {
          id: randomId(),
          role: "ai",
          text: "The assistant service is currently unavailable. You can still use triage and risk tools while connectivity is restored.",
          ts: Date.now(),
        },
        ...prev,
      ])
    } finally {
      setIsSending(false)
    }
  }

  function runSymptomChecker() {
    const r = symptomAssess(symptomText)
    setSymptomResult(r)
  }

  const risks = useMemo(() => estimateRisk(age, conditions), [age, conditions])

  function startVoice() {
    const SR = typeof globalThis !== "undefined" && (globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition)
    if (!SR) {
      setVoiceStatus("Voice not supported in this browser.")
      return
    }
    if (recRef.current) {
      recRef.current.stop()
      recRef.current = null
      setVoiceStatus("")
      return
    }
    const rec = new SR()
    rec.lang = "en-US"
    rec.continuous = false
    rec.interimResults = false
    rec.onresult = (e) => {
      const t = e.results[0]?.[0]?.transcript?.trim()
      if (t) setInput((p) => (p ? `${p} ${t}` : t))
      setVoiceStatus("")
      recRef.current = null
    }
    rec.onerror = () => setVoiceStatus("Voice capture error.")
    rec.start()
    recRef.current = rec
    setVoiceStatus("Listening…")
  }

  return (
    <AppShell title="AI assistant">
      <div className="hcGrid hcGrid--2">
        <div className="hcCard">
          <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>Symptom checker (clinical ruleset)</div>
          <div className="hcField" style={{ marginTop: 12 }}>
            <div className="hcLabel">Describe symptoms</div>
            <textarea className="hcTextarea" value={symptomText} onChange={(e) => setSymptomText(e.target.value)} placeholder="e.g. fever and sore throat for 2 days" />
          </div>
          <button className="hcBtn hcBtn--primary" type="button" onClick={runSymptomChecker}>
            Assess
          </button>
          {symptomResult ? (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 14, border: "1px solid var(--border)", background: "color-mix(in srgb, var(--surface) 84%, transparent)" }}>
              <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)" }}>{symptomResult.level}</div>
              <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.5 }}>{symptomResult.msg}</div>
            </div>
          ) : null}
        </div>

        <div className="hcCard">
          <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>Predictive analytics</div>
          <div className="hcFieldRow hcFieldRow--2" style={{ marginTop: 12 }}>
            <div className="hcField">
              <div className="hcLabel">Age</div>
              <input className="hcInput" value={age} onChange={(e) => setAge(e.target.value)} />
            </div>
            <div className="hcField">
              <div className="hcLabel">Conditions (comma-separated)</div>
              <input className="hcInput" value={conditions} onChange={(e) => setConditions(e.target.value)} />
            </div>
          </div>
          <div style={{ marginTop: 12, display: "grid", gap: 8, fontSize: 13 }}>
            <div>
              Estimated <b>fall risk</b> score: {risks.fall}/100
            </div>
            <div>
              Estimated <b>readmission</b> risk: {risks.readmit}/100
            </div>
            <div style={{ color: "var(--muted)", fontSize: 12 }}>Scores are decision-support signals and should be reviewed alongside clinician judgment.</div>
          </div>
        </div>
      </div>

      <div className="hcGrid hcGrid--2" style={{ marginTop: 12 }}>
        <div className="hcCard">
          <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>Ask</div>
          <div className="hcField" style={{ marginTop: 12 }}>
            <div className="hcLabel">Prompt</div>
            <textarea className="hcTextarea" value={input} onChange={(e) => setInput(e.target.value)} placeholder="What do you want help with?" />
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button className="hcBtn hcBtn--primary" type="button" onClick={() => void send()} disabled={isSending}>
              {isSending ? "Sending..." : "Send"}
            </button>
            <button className="hcBtn hcBtn--ghost" type="button" onClick={startVoice}>
              Voice input
            </button>
            {voiceStatus ? <span style={{ fontSize: 12, color: "var(--muted)" }}>{voiceStatus}</span> : null}
            <a className="hcBtn hcBtn--ghost" href="/medical-imaging">
              Medical imaging
            </a>
            <a className="hcBtn hcBtn--ghost" href="/admin">
              Safety & audit
            </a>
          </div>
        </div>

        <div className="hcCard">
          <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>Ideas</div>
          <ul style={{ marginTop: 10, marginBottom: 0, color: "var(--muted)", lineHeight: 1.7 }}>
            {tips.map((t) => (
              <li key={t}>
                <button className="hcBtn hcBtn--sm hcBtn--ghost" type="button" onClick={() => setInput(t)} style={{ width: "100%", justifyContent: "flex-start" }}>
                  {t}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="hcCard" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>Conversation</div>
        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          {history.length === 0 ? <div style={{ color: "var(--muted)", fontSize: 13 }}>No messages yet.</div> : null}
          {history
            .slice()
            .reverse()
            .map((m) => (
              <div key={m.id} style={{ padding: 12, borderRadius: 16, border: "1px solid var(--border)", background: "color-mix(in srgb, var(--surface) 82%, transparent)" }}>
                <div style={{ fontWeight: 950, fontSize: 12, letterSpacing: 0.12, textTransform: "uppercase", color: "var(--muted)" }}>{m.role === "ai" ? "Assistant" : "You"}</div>
                <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{m.text}</div>
              </div>
            ))}
        </div>
      </div>
    </AppShell>
  )
}
