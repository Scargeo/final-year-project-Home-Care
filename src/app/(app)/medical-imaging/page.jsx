"use client"

import { useCallback, useRef, useState } from "react"
import AppShell from "../../components/AppShell.jsx"

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Could not load image."))
    }
    img.src = url
  })
}

function analyzeCanvas(ctx, w, h) {
  const data = ctx.getImageData(0, 0, w, h)
  const d = data.data
  let sum = 0
  let sumSq = 0
  const step = 4 * 8
  let n = 0
  for (let i = 0; i < d.length; i += step) {
    const r = d[i]
    const g = d[i + 1]
    const b = d[i + 2]
    const y = 0.299 * r + 0.587 * g + 0.114 * b
    sum += y
    sumSq += y * y
    n += 1
  }
  const mean = n ? sum / n : 0
  const variance = n ? sumSq / n - mean * mean : 0
  const contrast = Math.sqrt(Math.max(0, variance))
  return { meanIntensity: mean, contrast, width: w, height: h }
}

function enhanceCanvas(ctx, w, h, { contrast = 1.25, brightness = 8 } = {}) {
  const imgData = ctx.getImageData(0, 0, w, h)
  const d = imgData.data
  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c += 1) {
      let v = d[i + c]
      v = (v - 128) * contrast + 128 + brightness
      d[i + c] = Math.max(0, Math.min(255, v))
    }
  }
  ctx.putImageData(imgData, 0, 0)
}

export default function MedicalImagingPage() {
  const sourceRef = useRef(null)
  const enhancedRef = useRef(null)
  const [status, setStatus] = useState("")
  const [apiResult, setApiResult] = useState(null)
  const [fileName, setFileName] = useState("")

  const runPipeline = useCallback(async (file) => {
    if (!file) return
    setFileName(file.name)
    setApiResult(null)
    setStatus("Loading image…")
    const img = await loadImageFile(file)
    const srcCanvas = sourceRef.current
    const enhCanvas = enhancedRef.current
    if (!srcCanvas || !enhCanvas) return
    const maxW = 640
    const scale = Math.min(1, maxW / img.width)
    const w = Math.max(1, Math.round(img.width * scale))
    const h = Math.max(1, Math.round(img.height * scale))
    srcCanvas.width = w
    srcCanvas.height = h
    enhCanvas.width = w
    enhCanvas.height = h
    const sctx = srcCanvas.getContext("2d", { willReadFrequently: true })
    const ectx = enhCanvas.getContext("2d", { willReadFrequently: true })
    if (!sctx || !ectx) return
    sctx.drawImage(img, 0, 0, w, h)
    ectx.drawImage(img, 0, 0, w, h)
    enhanceCanvas(ectx, w, h)

    const stats = analyzeCanvas(ectx, w, h)
    setStatus("Requesting demo analysis…")
    const res = await fetch("/api/ai/imaging", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stats),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json?.error || "Analysis failed.")
    setApiResult(json)
    setStatus("Done.")
  }, [])

  return (
    <AppShell title="Medical imaging (AI assist)">
      <div className="hcCard">
        <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>Upload & enhance (browser demo)</div>
        <p style={{ margin: "10px 0 0", color: "var(--muted)", fontSize: 13, lineHeight: 1.55 }}>
          Applies local contrast stretching in-canvas, then sends aggregate statistics to a Next.js route for <b>non-diagnostic</b> commentary. Wire OpenCV / deep
          models through a dedicated inference service for research or regulated workflows.
        </p>
        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <label className="hcBtn hcBtn--primary" style={{ cursor: "pointer" }}>
            Choose image
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={async (e) => {
                const f = e.target.files?.[0]
                e.target.value = ""
                if (!f) return
                try {
                  await runPipeline(f)
                } catch (err) {
                  setStatus(err.message || "Failed.")
                }
              }}
            />
          </label>
          {fileName ? <span style={{ fontSize: 13, color: "var(--muted)" }}>{fileName}</span> : null}
          {status ? <span style={{ fontSize: 13, color: "var(--muted)" }}>{status}</span> : null}
        </div>
      </div>

      <div className="hcGrid hcGrid--2" style={{ marginTop: 12 }}>
        <div className="hcCard">
          <div style={{ fontWeight: 900, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)" }}>Original (resized)</div>
          <canvas ref={sourceRef} style={{ marginTop: 10, width: "100%", height: "auto", borderRadius: 14, border: "1px solid var(--border)" }} />
        </div>
        <div className="hcCard">
          <div style={{ fontWeight: 900, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)" }}>Enhanced preview</div>
          <canvas ref={enhancedRef} style={{ marginTop: 10, width: "100%", height: "auto", borderRadius: 14, border: "1px solid var(--border)" }} />
        </div>
      </div>

      {apiResult ? (
        <div className="hcCard" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>Model commentary (demo)</div>
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted)" }}>
            {apiResult.disclaimer} Confidence shown is synthetic: {Math.round((apiResult.confidence || 0) * 100)}%.
          </p>
          <ul style={{ margin: "12px 0 0", paddingLeft: 18, lineHeight: 1.65 }}>
            {(apiResult.findings || []).map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </AppShell>
  )
}
