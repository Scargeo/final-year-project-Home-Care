"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import AuthShowcase from "../auth/AuthShowcase"
import styles from "../auth/auth.module.css"

const initialForm = {
  patientFirstName: "",
  patientLastName: "",
  patientEmail: "",
  patientPhone: "",
  patientAddress: "",
  patientPassword: "",
  confirmPassword: "",
}

function calculatePasswordStrength(password) {
  if (!password) return { score: 0, label: "" }
  
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password)) score++
  if (/[a-z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  const strength = score <= 2 ? "weak" : score <= 4 ? "medium" : "strong"
  return { score: Math.min(3, Math.ceil(score / 2)), label: strength }
}

export default function SignupPage() {
  const router = useRouter()
  const [form, setForm] = useState(initialForm)
  const [status, setStatus] = useState("Fill in your patient details to create your account.")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const passwordStrength = useMemo(
    () => calculatePasswordStrength(form.patientPassword),
    [form.patientPassword]
  )

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError("")
    setSuccess("")

    if (form.patientPassword !== form.confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    if (form.patientPassword.length < 8) {
      setError("Password must be at least 8 characters long.")
      return
    }

    setLoading(true)
    setStatus("Creating your patient account...")

    try {
      const response = await fetch("/api/patients/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientFirstName: form.patientFirstName.trim(),
          patientLastName: form.patientLastName.trim(),
          patientEmail: form.patientEmail.trim().toLowerCase(),
          patientPhone: form.patientPhone.trim(),
          patientAddress: form.patientAddress.trim(),
          patientPassword: form.patientPassword,
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.message || "Could not create account.")
      }

      setSuccess("Account created successfully. You can now log in.")
      setStatus("Redirecting to patient login...")
      setForm(initialForm)
      setTimeout(() => router.push("/login"), 1000)
    } catch (err) {
      setError(err.message || "Signup failed.")
      setStatus("Unable to create account right now.")
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
          <h1>Create your care profile.</h1>
          <p>
            Sign up once to book appointments, request home care, access your health records, and send emergency alerts from your own patient account.
          </p>

        </div>
      </section>

      <section className={styles.authPanel}>
        <div className={styles.authCard}>
          <h2>Patient signup</h2>
          <p>Join as a patient. Providers and staff use separate flows.</p>

          <form className={styles.authForm} onSubmit={handleSubmit}>
            <div className={styles.authGridTwo}>
              <label className={styles.authField}>
                <span>First name</span>
                <input
                  type="text"
                  value={form.patientFirstName}
                  onChange={(event) => updateField("patientFirstName", event.target.value)}
                  placeholder="Ama"
                  required
                  disabled={loading}
                  autoComplete="given-name"
                />
              </label>
              <label className={styles.authField}>
                <span>Last name</span>
                <input
                  type="text"
                  value={form.patientLastName}
                  onChange={(event) => updateField("patientLastName", event.target.value)}
                  placeholder="Mensah"
                  required
                  disabled={loading}
                  autoComplete="family-name"
                />
              </label>
            </div>

            <label className={styles.authField}>
              <span>Email address</span>
              <input
                type="email"
                value={form.patientEmail}
                onChange={(event) => updateField("patientEmail", event.target.value)}
                placeholder="patient@example.com"
                required
                disabled={loading}
                autoComplete="email"
              />
            </label>

            <div className={styles.authGridTwo}>
              <label className={styles.authField}>
                <span>Phone number</span>
                <input
                  type="tel"
                  value={form.patientPhone}
                  onChange={(event) => updateField("patientPhone", event.target.value)}
                  placeholder="0123456789"
                  required
                  disabled={loading}
                  autoComplete="tel"
                />
              </label>
              <label className={styles.authField}>
                <span>Create password</span>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={form.patientPassword}
                    onChange={(event) => updateField("patientPassword", event.target.value)}
                    placeholder="••••••••"
                    required
                    disabled={loading}
                    autoComplete="new-password"
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
            </div>

            {form.patientPassword && (
              <div className={styles.passwordStrength}>
                <div className={styles.strengthBar}>
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className={`${styles.strengthSegment} ${
                        i < passwordStrength.score
                          ? passwordStrength.label === "strong"
                            ? styles.strengthStrong
                            : styles.strengthActive
                          : ""
                      }`}
                    />
                  ))}
                </div>
                <span
                  className={`${styles.strengthLabel} ${
                    passwordStrength.label === "weak"
                      ? styles.strengthWeak
                      : passwordStrength.label === "medium"
                      ? styles.strengthMedium
                      : passwordStrength.label === "strong"
                      ? styles.strengthStrongLabel
                      : ""
                  }`}
                >
                  {passwordStrength.label ? `Password strength: ${passwordStrength.label}` : "Enter a password"}
                </span>
              </div>
            )}

            <label className={styles.authField}>
              <span>Address</span>
              <textarea
                value={form.patientAddress}
                onChange={(event) => updateField("patientAddress", event.target.value)}
                placeholder="Where should care teams reach you?"
                required
                disabled={loading}
                autoComplete="street-address"
              />
            </label>

            <label className={styles.authField}>
              <span>Confirm password</span>
              <div style={{ position: "relative" }}>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={form.confirmPassword}
                  onChange={(event) => updateField("confirmPassword", event.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  autoComplete="new-password"
                  style={{
                    paddingRight: "2.8rem",
                    borderColor: 
                      form.confirmPassword && form.patientPassword === form.confirmPassword
                        ? "#10b981"
                        : form.confirmPassword
                        ? "#ef4444"
                        : undefined,
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
              {form.confirmPassword && form.patientPassword !== form.confirmPassword && (
                <span style={{ fontSize: "0.85rem", color: "#ef4444", marginTop: "0.3rem", display: "block" }}>
                  Passwords do not match
                </span>
              )}
              {form.confirmPassword && form.patientPassword === form.confirmPassword && (
                <span style={{ fontSize: "0.85rem", color: "#10b981", marginTop: "0.3rem", display: "block" }}>
                  Passwords match
                </span>
              )}
            </label>

            <div className={styles.authActions}>
              <button type="submit" className={styles.authButton} disabled={loading || form.patientPassword !== form.confirmPassword}>
                {loading ? (
                  <>
                    <span style={{ marginRight: "0.5rem" }}>⟳</span>
                    Creating account...
                  </>
                ) : (
                  "Create account"
                )}
              </button>
              <Link href="/login" className={styles.authSecondary}>
                Already have an account? Log in
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