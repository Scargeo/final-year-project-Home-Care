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

      const response = await fetch('/api/uploads', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.message || 'Upload failed')
      }

      return data.files || []
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
