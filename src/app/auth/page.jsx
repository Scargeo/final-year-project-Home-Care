"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ROLES, getRoleHome } from "../../lib/auth-config.js"
import { signIn, signUp } from "../../lib/auth-client.js"
import "../../styles/hc-shell.css"

const ROLE_LABELS = {
  doctor: "Doctor",
  nurse: "Nurse",
  pharmacist: "Pharmacist",
  patient: "Patient",
  rider: "Rider",
  admin: "Admin",
}

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState("signin")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [form, setForm] = useState({ fullName: "", email: "", password: "", role: "patient", rememberMe: true })

  const title = useMemo(() => (mode === "signin" ? "Sign in to Home Care Plus" : "Create your Home Care Plus account"), [mode])

  async function onSubmit(e) {
    e.preventDefault()
    setError("")
    setSuccess("")
    setBusy(true)
    try {
      const payload = mode === "signin" ? await signIn({ email: form.email, password: form.password }) : await signUp(form)
      const next = getRoleHome(payload?.user?.role)
      setSuccess("Authentication successful. Redirecting...")
      router.replace(next)
    } catch (err) {
      setError(err.message || "Request failed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="hcAuth">
      <div className="hcAuth__card">
        <h1 className="hcAuth__title">{title}</h1>
        <p className="hcAuth__subtitle">Role-based access, hashed passwords, and lightweight trust screening on signup (demo heuristics).</p>

        <div className="hcAuth__modes">
          <button className={`hcBtn ${mode === "signin" ? "hcBtn--primary" : "hcBtn--ghost"}`} type="button" onClick={() => setMode("signin")} disabled={busy}>
            Sign in
          </button>
          <button className={`hcBtn ${mode === "signup" ? "hcBtn--primary" : "hcBtn--ghost"}`} type="button" onClick={() => setMode("signup")} disabled={busy}>
            Sign up
          </button>
        </div>

        <form className="hcAuth__form" onSubmit={onSubmit}>
          {mode === "signup" ? (
            <label className="hcField">
              <span className="hcLabel">Full name</span>
              <input className="hcInput" value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} required />
            </label>
          ) : null}

          <label className="hcField">
            <span className="hcLabel">Email</span>
            <input className="hcInput" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} required />
          </label>

          <label className="hcField">
            <span className="hcLabel">Password</span>
            <input className="hcInput" type="password" minLength={8} value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} required />
          </label>

          {mode === "signup" ? (
            <label className="hcField">
              <span className="hcLabel">Role</span>
              <select className="hcSelect" value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}>
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {error ? <div className="hcAuth__error">{error}</div> : null}
          {success ? <div className="hcAuth__success">{success}</div> : null}

          <button className="hcBtn hcBtn--primary" type="submit" disabled={busy}>
            {busy ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
      </div>
    </main>
  )
}
