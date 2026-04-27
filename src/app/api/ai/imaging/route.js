import { NextResponse } from "next/server"

/**
 * Demo-only imaging insights from simple image statistics.
 * Replace with a Python/TensorFlow service for real CXR models and QA workflows.
 */
export async function POST(request) {
  try {
    const body = await request.json()
    const mean = Number(body?.meanIntensity)
    const contrast = Number(body?.contrast)
    const w = Number(body?.width) || 0
    const h = Number(body?.height) || 0

    if (!Number.isFinite(mean) || !Number.isFinite(contrast)) {
      return NextResponse.json({ error: "meanIntensity and contrast are required numbers." }, { status: 400 })
    }

    const findings = []
    if (mean < 70) findings.push("Overall exposure appears dark; consider brightness normalization for review.")
    if (mean > 200) findings.push("Overall exposure appears bright; check for saturation or over-penetration.")
    if (contrast < 18) findings.push("Low local contrast; enhancement may help radiologist review (decision support only).")
    if (contrast > 85) findings.push("High local contrast; verify artifact reduction and edge enhancement settings.")
    if (w > 0 && h > 0 && Math.abs(w / h - 1) > 0.5) findings.push("Unusual aspect ratio for a chest study; confirm correct modality and orientation.")

    if (findings.length === 0) {
      findings.push("No strong heuristic flags from global statistics; clinical correlation still required.")
    }

    const confidence = Math.min(0.92, 0.35 + contrast / 200)

    return NextResponse.json({
      modality: "CXR (demo)",
      confidence,
      findings,
      disclaimer: "Not a medical device. Not for diagnosis. For educational and UX demonstration only.",
    })
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }
}
