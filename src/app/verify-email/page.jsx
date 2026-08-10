"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
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

  useEffect(() => {
    const verifyToken = async () => {
      try {
        const token = searchParams.get("token")
        
        if (!token) {
          setError("Verification token is missing. Please check your email link.")
          setLoading(false)
          return
        }

        const response = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
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
                href="/signup"
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
