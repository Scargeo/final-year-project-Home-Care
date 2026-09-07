"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import styles from "../auth/auth.module.css"

export default function VerifyEmailPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get("email") || ""
  const role = searchParams.get("role") || "patient"
  const [otp, setOtp] = useState("")
  const [status, setStatus] = useState("Enter the code sent to your email.")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [expiresAt, setExpiresAt] = useState(Date.now() + 5 * 60 * 1000)
  const [remainingSeconds, setRemainingSeconds] = useState(300)

  useEffect(() => {
    const timer = window.setInterval(() => setRemainingSeconds(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))), 1000)
    return () => window.clearInterval(timer)
  }, [expiresAt])

  const countdown = useMemo(() => `${String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:${String(remainingSeconds % 60).padStart(2, "0")}`, [remainingSeconds])

  async function verifyOtp(event) {
    event.preventDefault()
    setError("")
    if (!email) return setError("Your email address is missing. Please sign up again.")
    if (!/^\d{6}$/.test(otp)) return setError("Enter the six-digit verification code.")
    setLoading(true)
    try {
      const response = await fetch("/api/auth/verify-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: otp, email, role }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.message || "Verification failed. Please try again.")
      setSuccess(data?.message || "Email verified successfully.")
      setStatus("Your account is ready. Redirecting to login...")
      window.setTimeout(() => router.push("/login"), 1500)
    } catch (verificationError) {
      setError(verificationError.message)
    } finally {
      setLoading(false)
    }
  }

  async function resendOtp() {
    setError("")
    setResending(true)
    try {
      const response = await fetch("/api/auth/resend-verification-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, role }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.message || "Could not resend the verification code.")
      setOtp("")
      setSuccess("A new verification code was sent to your email.")
      setStatus("Enter the new code before it expires.")
      setExpiresAt(Date.now() + 5 * 60 * 1000)
      setRemainingSeconds(300)
    } catch (resendError) {
      setError(resendError.message)
    } finally {
      setResending(false)
    }
  }

  return <main className={styles.verificationPage}><section className={styles.verificationCard}>
    <div className={styles.verificationIcon} aria-hidden="true">✉</div>
    <h1>Verify your email</h1>
    <p className={styles.verificationLead}>Enter the six-digit code sent to <span className={styles.verificationEmail}>{email || "your email"}</span>.</p>
    <div className={styles.verificationStatus} aria-live="polite"><span>{status}</span></div>
    {success ? <div className={styles.verificationSuccess}>{success}</div> : null}
    {error ? <div className={styles.verificationError} role="alert">{error}</div> : null}
    <form className={styles.verificationActions} onSubmit={verifyOtp}>
      <input value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" aria-label="Verification code" disabled={loading} required />
      <p>Code expires in {countdown}</p>
      <button type="submit" className={styles.verificationPrimary} disabled={loading || remainingSeconds === 0}>{loading ? "Verifying..." : "Verify code"}</button>
      <button type="button" className={styles.verificationSecondary} onClick={resendOtp} disabled={resending || !email}>{resending ? "Sending..." : "Resend code"}</button>
    </form>
    <Link className={styles.verificationBackLink} href={role === "patient" ? "/signup" : "/doctor-signup"}>Return to signup</Link>
  </section></main>
}
