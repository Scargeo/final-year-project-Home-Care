"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DoctorNewAppointmentRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/secure/dashboard#appointments')
  }, [router])

  return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '2rem' }}>Redirecting to appointment booking...</main>
}