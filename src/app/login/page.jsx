"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import AuthShowcase from "../auth/AuthShowcase"
import styles from "../auth/auth.module.css"
import { buildPatientApiUrl } from "../../lib/patient-auth"

const initialForm = {
  patientEmail: "",
  patientPassword: "",
}

export default function LoginPage() {
  const router = useRouter()
  const [form, setForm] = useState(initialForm)
  const [status, setStatus] = useState("Welcome back. Log in with your patient account.")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError("")
    setSuccess("")
    setLoading(true)
    setStatus("Checking your patient credentials...")

    try {
      // Use local API proxy to avoid CORS issues
      const response = await fetch("/api/patients/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientEmail: form.patientEmail.trim().toLowerCase(),
          patientPassword: form.patientPassword,
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.message || "Could not log in.")
      }

      if (typeof window !== "undefined" && data?.user) {
        localStorage.setItem("patientAuth", JSON.stringify(data.user))
      }

      setSuccess("Login successful. Redirecting to your home feed...")
      setStatus("Access granted.")
      setForm(initialForm)
      setTimeout(() => router.push("/secure/home"), 1000)
    } catch (err) {
      setError(err.message || "Login failed.")
      setStatus("Unable to log in right now.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className={styles.authPage}>
      <section className={styles.authArt}>
        <Link href="/" className={styles.authBrand}>
          <span className={styles.authBrandMark} aria-hidden="true">
            +
          </span>
          <span className={styles.authBrandText}>Home Care+</span>
        </Link>

        <AuthShowcase />

        <div className={styles.authIntro}>
          <p className={styles.authKicker}>Patient access only</p>
          <h1>Return to your care space.</h1>
          <p>
            Log in to manage appointments, view services, and continue care requests as a patient.
          </p>

        </div>
      </section>

      <section className={styles.authPanel}>
        <div className={styles.authCard}>
          <h2>Patient login</h2>
          <p>Use the email and password tied to your patient registration.</p>

          <form className={styles.authForm} onSubmit={handleSubmit}>
            <label className={styles.authField}>
              <span>Email address</span>
              <input
                type="email"
                value={form.patientEmail}
                onChange={(event) => updateField("patientEmail", event.target.value)}
                placeholder="patient@example.com"
                required
                autoComplete="email"
                disabled={loading}
              />
            </label>

            <label className={styles.authField}>
              <span>Password</span>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.patientPassword}
                  onChange={(event) => updateField("patientPassword", event.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  disabled={loading}
                  style={{ paddingRight: "2.8rem" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "0.8rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "rgba(15, 23, 42, 0.5)",
                    fontSize: "0.95rem",
                    padding: "0.4rem",
                    transition: "color 200ms ease",
                  }}
                  onMouseEnter={(e) => (e.target.style.color = "rgba(15, 23, 42, 0.8)")}
                  onMouseLeave={(e) => (e.target.style.color = "rgba(15, 23, 42, 0.5)")}
                  disabled={loading}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            <div className={styles.authActions}>
              <button type="submit" className={styles.authButton} disabled={loading}>
                {loading ? (
                  <>
                    <span style={{ marginRight: "0.5rem" }}>⟳</span>
                    Logging in...
                  </>
                ) : (
                  "Log in"
                )}
              </button>
              <Link href="/signup" className={styles.authSecondary}>
                New patient? Create an account
              </Link>
            </div>
          </form>

          {status ? <div className={styles.authMessage}>{status}</div> : null}
          {error ? <div className={styles.authError}>{error}</div> : null}
          {success ? <div className={styles.authSuccess}>{success}</div> : null}
        </div>
      </section>
    </main>
  )
}