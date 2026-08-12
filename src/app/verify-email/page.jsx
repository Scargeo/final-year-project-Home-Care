"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import styles from "../auth/auth.module.css"

export default function VerifyEmailPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState("Verifying your email...")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(true)
  const [verified, setVerified] = useState(false)
  const [otpMode, setOtpMode] = useState(false)
  const [otp, setOtp] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("patient")
  const [expiresAt, setExpiresAt] = useState(null)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [resending, setResending] = useState(false)

  useEffect(() => {
    const verifyToken = async () => {
      try {
        const token = searchParams.get("token")
        const emailParam = searchParams.get("email")
        const roleParam = searchParams.get("role")
        if (emailParam) setEmail(emailParam)
        if (roleParam) setRole(roleParam)
        
        if (!token) {
          // No token in URL -> switch to OTP input mode
          setOtpMode(true)
          setExpiresAt(Date.now() + 5 * 60 * 1000)
          setRemainingSeconds(5 * 60)
          setLoading(false)
          return
        }

        const response = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, role }),
        })

        const data = await response.json().catch(() => ({}))
        
        if (!response.ok) {
          setError(data?.message || "Email verification failed. Please try again.")
          setLoading(false)
          return
        }

        setSuccess("Email verified successfully!")
        setStatus("Your account is now active. Redirecting to login...")
        setVerified(true)
        setLoading(false)

        setTimeout(() => router.push("/login"), 2000)
      } catch (err) {
        setError(err.message || "An error occurred during verification.")
        setLoading(false)
      }
    }

    verifyToken()
  }, [searchParams, router])

  useEffect(() => {
    if (!expiresAt) return undefined
    const timer = setInterval(() => {
      const secondsLeft = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
      setRemainingSeconds(secondsLeft)
      if (secondsLeft <= 0) {
        setStatus("The verification code has expired. Request a new code.")
        clearInterval(timer)
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [expiresAt])

  const countdownText = useMemo(() => {
    const remaining = Math.max(0, remainingSeconds)
    const minutes = String(Math.floor(remaining / 60)).padStart(2, "0")
    const seconds = String(remaining % 60).padStart(2, "0")
    return `${minutes}:${seconds}`
  }, [remainingSeconds])

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1>Email Verification</h1>
        </div>

        <div className={styles.content}>
          {loading && (
            <div style={{ textAlign: "center" }}>
              <div style={{
                width: "50px",
                height: "50px",
                border: "4px solid #f0f0f0",
                borderTop: "4px solid #4CAF50",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
                margin: "20px auto",
              }}>
              </div>
              <p style={{ color: "#666", marginTop: "10px" }}>{status}</p>
            </div>
          )}

          {error && (
            <div style={{
              padding: "15px",
              backgroundColor: "#ffebee",
              border: "1px solid #ef5350",
              borderRadius: "4px",
              marginBottom: "20px",
            }}>
              <p style={{ color: "#c62828", margin: 0, fontWeight: "500" }}>
                {error}
              </p>
            </div>
          )}

          {success && verified && (
            <div style={{
              padding: "15px",
              backgroundColor: "#e8f5e9",
              border: "1px solid #66bb6a",
              borderRadius: "4px",
              marginBottom: "20px",
            }}>
              <p style={{ color: "#2e7d32", margin: 0, fontWeight: "500" }}>
                ✓ {success}
              </p>
            </div>
          )}

          {!loading && !verified && error && (
            <div style={{ marginTop: "30px", textAlign: "center" }}>
              <p style={{ color: "#666", marginBottom: "20px" }}>
                If the link has expired, please sign up again to receive a new verification email.
              </p>
              <Link 
                href={role === 'patient' ? '/signup' : '/doctor-signup'}
                style={{
                  display: "inline-block",
                  padding: "10px 20px",
                  backgroundColor: "#4CAF50",
                  color: "white",
                  textDecoration: "none",
                  borderRadius: "4px",
                  fontWeight: "bold",
                  marginRight: "10px",
                }}
              >
                Sign Up Again
              </Link>
              <Link 
                href="/login"
                style={{
                  display: "inline-block",
                  padding: "10px 20px",
                  backgroundColor: "#2196F3",
                  color: "white",
                  textDecoration: "none",
                  borderRadius: "4px",
                  fontWeight: "bold",
                }}
              >
                Back to Login
              </Link>
            </div>
          )}

          {/* OTP input mode when there is no token in the URL */}
          {!loading && otpMode && !verified && (
            <div style={{ marginTop: "20px", textAlign: "center" }}>
              <p style={{ color: "#666", marginBottom: "6px" }}>Enter the 6-digit verification code sent to {email || "your email"}.</p>
              <p style={{ color: "#d97706", marginBottom: "10px", fontWeight: 600 }}>
                Code expires in {countdownText || "05:00"}
              </p>
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter OTP"
                maxLength={6}
                style={{ padding: "10px", fontSize: "16px", width: "200px", textAlign: "center", marginBottom: "12px" }}
              />
              <div>
                <button
                  onClick={async () => {
                    setLoading(true)
                    setError("")
                    try {
                      const response = await fetch("/api/auth/verify-email", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ token: otp.trim(), email, role }),
                      })
                      const data = await response.json().catch(() => ({}))
                      if (!response.ok) {
                        setError(data?.message || "OTP verification failed. Please try again.")
                        setLoading(false)
                        return
                      }

                      setSuccess("Email verified successfully!")
                      setStatus("Your account is now active. Redirecting to login...")
                      setVerified(true)
                      setLoading(false)
                      setTimeout(() => router.push("/login"), 2000)
                    } catch (err) {
                      setError(err.message || "An error occurred during verification.")
                      setLoading(false)
                    }
                  }}
                  style={{
                    display: "inline-block",
                    padding: "10px 20px",
                    backgroundColor: "#4CAF50",
                    color: "white",
                    textDecoration: "none",
                    borderRadius: "4px",
                    fontWeight: "bold",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Verify OTP
                </button>
              </div>

              <div style={{ marginTop: "12px" }}>
                <button
                  type="button"
                  disabled={resending}
                  onClick={async () => {
                    if (!email) {
                      setError("Missing email address. Please go back and register again.")
                      return
                    }
                    setResending(true)
                    setError("")
                    setStatus("Sending a new code...")
                    try {
                      const response = await fetch("/api/auth/resend-verification-code", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email, role }),
                      })
                      const data = await response.json().catch(() => ({}))
                      if (!response.ok) {
                        throw new Error(data?.message || "Could not resend verification code.")
                      }
                      setStatus("A new verification code has been sent.")
                      setExpiresAt(Date.now() + 5 * 60 * 1000)
                      setRemainingSeconds(5 * 60)
                      setOtp("")
                      setSuccess("")
                    } catch (err) {
                      setError(err.message || "Could not resend verification code.")
                    } finally {
                      setResending(false)
                    }
                  }}
                  style={{
                    display: "inline-block",
                    padding: "10px 20px",
                    backgroundColor: "#0f766e",
                    color: "white",
                    borderRadius: "4px",
                    fontWeight: "bold",
                    border: "none",
                    cursor: "pointer",
                    opacity: resending ? 0.7 : 1,
                  }}
                >
                  {resending ? "Resending..." : "Resend code"}
                </button>
              </div>
            </div>
          )}

          {!loading && verified && (
            <div style={{ marginTop: "30px", textAlign: "center" }}>
              <p style={{ color: "#666", marginBottom: "20px" }}>
                Redirecting to login page...
              </p>
              <Link 
                href="/login"
                style={{
                  display: "inline-block",
                  padding: "10px 20px",
                  backgroundColor: "#2196F3",
                  color: "white",
                  textDecoration: "none",
                  borderRadius: "4px",
                  fontWeight: "bold",
                }}
              >
                Go to Login
              </Link>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
