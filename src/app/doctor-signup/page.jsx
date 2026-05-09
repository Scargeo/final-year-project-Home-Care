"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import AuthShowcase from "../auth/AuthShowcase"
import styles from "../auth/auth.module.css"

const initialForm = {
  doctorFirstName: "",
  doctorLastName: "",
  doctorEmail: "",
  doctorPhone: "",
  doctorAddress: "",
  doctorPassword: "",
  confirmPassword: "",
  specialization: "",
  licenseNumber: "",
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

export default function DoctorSignupPage() {
  const router = useRouter()
  const [form, setForm] = useState(initialForm)
  const [status, setStatus] = useState("Fill in your details to create your doctor account.")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const passwordStrength = useMemo(
    () => calculatePasswordStrength(form.doctorPassword),
    [form.doctorPassword]
  )

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError("")
    setSuccess("")

    if (form.doctorPassword !== form.confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    if (form.doctorPassword.length < 8) {
      setError("Password must be at least 8 characters long.")
      return
    }

    setLoading(true)
    setStatus("Creating your doctor account...")

    try {
      const response = await fetch("/api/doctors/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorFirstName: form.doctorFirstName.trim(),
          doctorLastName: form.doctorLastName.trim(),
          doctorEmail: form.doctorEmail.trim().toLowerCase(),
          doctorPhone: form.doctorPhone.trim(),
          doctorAddress: form.doctorAddress.trim(),
          doctorPassword: form.doctorPassword,
          specialization: form.specialization.trim(),
          licenseNumber: form.licenseNumber.trim(),
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.message || "Could not create doctor account.")
      }

      // success - redirect to login so the practitioner signs in
      setSuccess("Account created successfully. Please sign in to continue.")
      setStatus("Redirecting to login...")
      setForm(initialForm)
      setTimeout(() => router.push('/login'), 1000)
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
          <p className={styles.authKicker}>Provider access</p>
          <h1>Create your practitioner account.</h1>
          <p>
            Register as a health worker to manage appointments, access patient queues, and collaborate with care teams.
          </p>

        </div>
      </section>

      <section className={styles.authPanel}>
        <div className={styles.authCard}>
          <h2>Doctor signup</h2>
          <p>Use a work email and your professional license details.</p>

          <form className={styles.authForm} onSubmit={handleSubmit}>
            <div className={styles.authGridTwo}>
              <label className={styles.authField}>
                <span>First name</span>
                <input
                  type="text"
                  value={form.doctorFirstName}
                  onChange={(event) => updateField("doctorFirstName", event.target.value)}
                  placeholder="John"
                  required
                  disabled={loading}
                  autoComplete="given-name"
                />
              </label>
              <label className={styles.authField}>
                <span>Last name</span>
                <input
                  type="text"
                  value={form.doctorLastName}
                  onChange={(event) => updateField("doctorLastName", event.target.value)}
                  placeholder="Doe"
                  required
                  disabled={loading}
                  autoComplete="family-name"
                />
              </label>
            </div>

            <label className={styles.authField}>
              <span>Work email</span>
              <input
                type="email"
                value={form.doctorEmail}
                onChange={(event) => updateField("doctorEmail", event.target.value)}
                placeholder="doctor@hospital.org"
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
                  value={form.doctorPhone}
                  onChange={(event) => updateField("doctorPhone", event.target.value)}
                  placeholder="0123456789"
                  required
                  disabled={loading}
                  autoComplete="tel"
                />
              </label>
              <label className={styles.authField}>
                <span>Specialization</span>
                <input
                  type="text"
                  value={form.specialization}
                  onChange={(event) => updateField("specialization", event.target.value)}
                  placeholder="General Practice"
                  disabled={loading}
                />
              </label>
            </div>

            <label className={styles.authField}>
              <span>License number</span>
              <input
                type="text"
                value={form.licenseNumber}
                onChange={(event) => updateField("licenseNumber", event.target.value)}
                placeholder="LIC-123456"
                disabled={loading}
              />
            </label>

            <label className={styles.authField}>
              <span>Create password</span>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.doctorPassword}
                  onChange={(event) => updateField("doctorPassword", event.target.value)}
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

            {form.doctorPassword && (
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
                value={form.doctorAddress}
                onChange={(event) => updateField("doctorAddress", event.target.value)}
                placeholder="Clinic address or practice location"
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
                      form.confirmPassword && form.doctorPassword === form.confirmPassword
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
              {form.confirmPassword && form.doctorPassword !== form.confirmPassword && (
                <span style={{ fontSize: "0.85rem", color: "#ef4444", marginTop: "0.3rem", display: "block" }}>
                  Passwords do not match
                </span>
              )}
              {form.confirmPassword && form.doctorPassword === form.confirmPassword && (
                <span style={{ fontSize: "0.85rem", color: "#10b981", marginTop: "0.3rem", display: "block" }}>
                  Passwords match
                </span>
              )}
            </label>

            <div className={styles.authActions}>
              <button type="submit" className={styles.authButton} disabled={loading || form.doctorPassword !== form.confirmPassword}>
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
