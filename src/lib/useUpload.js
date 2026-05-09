import { useState, useCallback } from 'react'

/**
 * useUpload - Reusable hook for uploading files to Cloudinary via `/api/uploads`
 *
 * Usage:
 *   const { upload, uploading, error } = useUpload()
 *   await upload(files, ownerRef, purpose)
 */
export function useUpload() {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const upload = useCallback(async (files, ownerRef, purpose = 'other') => {
    if (!files || files.length === 0) {
      setError('No files selected')
      return []
    }

    if (!ownerRef) {
      setError('Missing ownerRef (user/patient ID)')
      return []
    }

    setUploading(true)
    setError('')

    try {
      const formData = new FormData()
      for (const file of files) {
        formData.append('files', file)
      }
      formData.append('ownerRef', ownerRef)
      formData.append('purpose', purpose)

      // Get auth info from localStorage to send headers
      let userId = ''
      let userRole = ''

      if (typeof window !== 'undefined') {
        // Try patient auth first
        try {
          const patientAuth = window.localStorage.getItem('patientAuth')
          if (patientAuth) {
            const parsed = JSON.parse(patientAuth)
            userId = parsed.patientId || parsed.id || ''
            userRole = 'patient'
          }
        } catch {
          // Ignore parse errors
        }

        // Try doctor auth if no patient auth
        if (!userId) {
          try {
            const doctorAuth = window.localStorage.getItem('doctorAuth')
            if (doctorAuth) {
              const parsed = JSON.parse(doctorAuth)
              userId = parsed.doctorId || parsed.id || ''
              userRole = 'doctor'
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      const fetchOptions = {
        method: 'POST',
        body: formData,
      }

      // Add auth headers if available (send token if present; keep legacy x-user headers)
      if (userId && userRole) {
        fetchOptions.headers = {
          'x-user-id': userId,
          'x-user-role': userRole,
        }
      }

      // Check for token on either auth object
      try {
        const patientAuth = typeof window !== 'undefined' ? window.localStorage.getItem('patientAuth') : null
        const doctorAuth = typeof window !== 'undefined' ? window.localStorage.getItem('doctorAuth') : null
        const parsed = patientAuth ? JSON.parse(patientAuth) : doctorAuth ? JSON.parse(doctorAuth) : null
        const token = parsed?.token || parsed?.accessToken || null
        if (token) {
          fetchOptions.headers = fetchOptions.headers || {}
          fetchOptions.headers['authorization'] = `Bearer ${token}`
        }
      } catch {
        // ignore
      }

      const response = await fetch('/api/uploads', fetchOptions)

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.message || 'Upload failed')
      }

      const uploadedFiles = data.files || []
      if (Array.isArray(uploadedFiles)) {
        uploadedFiles.doctor = data.doctor || null
      }

      return uploadedFiles
    } catch (err) {
      const errMsg = err?.message || 'Upload failed'
      setError(errMsg)
      return []
    } finally {
      setUploading(false)
    }
  }, [])

  return { upload, uploading, error, setError }
}
