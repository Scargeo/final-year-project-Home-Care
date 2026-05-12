"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import styles from "../../doctor/doctor.module.css"

function getStoredToken() {
  if (typeof window === 'undefined') return null
  try {
    const doctorAuth = window.localStorage.getItem('doctorAuth')
    const parsed = doctorAuth ? JSON.parse(doctorAuth) : null
    return parsed?.token || parsed?.accessToken || null
  } catch {
    return null
  }
}

function getDoctorIdentity() {
  if (typeof window === "undefined") return { doctorId: "doctor" }
  try {
    const stored = window.localStorage.getItem('doctorAuth')
    if (!stored) return { doctorId: 'doctor' }
    const auth = JSON.parse(stored)
    return { doctorId: auth?.doctorId || auth?.id || auth?._id }
  } catch {
    return { doctorId: 'doctor' }
  }
}

export default function AppointmentDetailPage({ params }) {
  const { appointmentId } = params || {}
  const [appointment, setAppointment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [actionBusy, setActionBusy] = useState(false)
  const router = useRouter()

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError("")
      try {
        const { doctorId } = getDoctorIdentity()
        const token = getStoredToken()
        const headers = {}
        if (token) headers.authorization = `Bearer ${token}`
        const res = await fetch(`/api/doctors/${encodeURIComponent(doctorId)}/appointments/${encodeURIComponent(appointmentId)}`, { cache: 'no-store', headers })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.message || 'Failed to load appointment')
        if (!active) return
        setAppointment(data)
      } catch (err) {
        if (active) setError(err?.message || 'Failed to load appointment')
      } finally {
        if (active) setLoading(false)
      }
    }

    if (appointmentId) load()
    return () => { active = false }
  }, [appointmentId])

  if (loading) return <div style={{ padding: 16 }}>Loading appointment…</div>
  if (error) return <div style={{ padding: 16, color: '#b42318' }}>{error}</div>
  if (!appointment) return <div style={{ padding: 16 }}>No appointment found.</div>

  return (
    <main className={styles.page} style={{ padding: 16 }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 8px' }}>Appointment details</h1>
        <p style={{ margin: 0, color: '#475569' }}>ID: {appointment.appointmentId || appointment._id}</p>

        <section style={{ marginTop: 16, padding: 12, borderRadius: 12, background: '#fff', border: '1px solid rgba(8,145,178,0.08)' }}>
          <h2 style={{ margin: '0 0 8px' }}>{appointment.patientName || appointment.patientRef || 'Patient'}</h2>
          <p style={{ margin: 0, color: '#475569' }}><strong>Phone:</strong> {appointment.patientPhone || '—'}</p>
          <p style={{ marginTop: 8 }}><strong>When:</strong> {appointment.appointmentDate ? new Date(appointment.appointmentDate).toLocaleString() : 'TBD'} {appointment.appointmentTime ? `at ${appointment.appointmentTime}` : ''}</p>
          <p style={{ marginTop: 8 }}><strong>Type:</strong> {appointment.consultationType || 'visit'}</p>
          <p style={{ marginTop: 8 }}><strong>Status:</strong> {appointment.status || 'scheduled'}</p>
          {appointment.reason ? <div style={{ marginTop: 12 }}><strong>Reason:</strong><p style={{ margin: '6px 0 0', color: '#334155' }}>{appointment.reason}</p></div> : null}
        </section>

        <section style={{ marginTop: 12 }}>
          <h3 style={{ margin: '0 0 8px' }}>Doctor</h3>
          <div style={{ padding: 12, borderRadius: 12, background: '#f8fbff', border: '1px solid rgba(8,145,178,0.08)' }}>
            <div style={{ fontWeight: 800 }}>{appointment.doctor?.doctorName || `${appointment.doctor?.doctorFirstName || ''} ${appointment.doctor?.doctorLastName || ''}`}</div>
            <div style={{ color: '#475569' }}>{appointment.doctor?.specialization || 'General care'}</div>
          </div>
        </section>

        <div style={{ marginTop: 18, display: 'flex', gap: 8 }}>
          <button
            disabled={actionBusy}
            onClick={async () => {
              if (!window.confirm('Accept this appointment?')) return
              setActionBusy(true)
              setError("")
              try {
                const { doctorId } = getDoctorIdentity()
                const token = getStoredToken()
                const headers = { 'Content-Type': 'application/json' }
                if (token) headers.authorization = `Bearer ${token}`
                const res = await fetch(`/api/doctors/${encodeURIComponent(doctorId)}/appointments/${encodeURIComponent(appointmentId)}`, {
                  method: 'PATCH',
                  headers,
                  body: JSON.stringify({ status: 'accepted', notes: 'Accepted by doctor via details page.' }),
                })
                const data = await res.json().catch(() => ({}))
                if (!res.ok) throw new Error(data?.message || 'Could not accept appointment')
                router.push('/secure/doctor')
              } catch (err) {
                setError(err?.message || 'Could not accept appointment')
              } finally {
                setActionBusy(false)
              }
            }}
            style={{ padding: '0.6rem 1rem', background: '#0a66c2', color: 'white', border: 'none', borderRadius: 8 }}
          >
            {actionBusy ? 'Processing...' : 'Accept'}
          </button>

          <button
            disabled={actionBusy}
            onClick={async () => {
              if (!window.confirm('Cancel this appointment?')) return
              setActionBusy(true)
              setError("")
              try {
                const { doctorId } = getDoctorIdentity()
                const token = getStoredToken()
                const headers = { 'Content-Type': 'application/json' }
                if (token) headers.authorization = `Bearer ${token}`
                const res = await fetch(`/api/doctors/${encodeURIComponent(doctorId)}/appointments/${encodeURIComponent(appointmentId)}`, {
                  method: 'PATCH',
                  headers,
                  body: JSON.stringify({ status: 'cancelled', notes: 'Cancelled by doctor via details page.' }),
                })
                const data = await res.json().catch(() => ({}))
                if (!res.ok) throw new Error(data?.message || 'Could not cancel appointment')
                router.push('/secure/doctor')
              } catch (err) {
                setError(err?.message || 'Could not cancel appointment')
              } finally {
                setActionBusy(false)
              }
            }}
            style={{ padding: '0.6rem 1rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: 8 }}
          >
            {actionBusy ? 'Processing...' : 'Cancel'}
          </button>

          <button onClick={() => router.back()} style={{ padding: '0.6rem 1rem', background: '#f1f5f9', color: '#0f172a', border: 'none', borderRadius: 8 }}>Back</button>
        </div>
      </div>
    </main>
  )
}
