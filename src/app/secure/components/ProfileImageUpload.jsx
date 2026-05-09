import { useCallback, useState } from 'react'
import { useUpload } from '../../../lib/useUpload'
import styles from './ProfileImageUpload.module.css'

/**
 * ProfileImageUpload - Component for uploading and managing user profile images
 * Props:
 *   - patientId: string (owner reference)
 *   - currentImage: { url, publicId } or null
 *   - onUploadComplete: (attachment) => void
 *   - onError: (error) => void
 */
export default function ProfileImageUpload({ patientId, currentImage, onUploadComplete, onError }) {
  const [showUpload, setShowUpload] = useState(false)
  const { upload, uploading, error: uploadError, setError } = useUpload()

  const handleImageSelect = useCallback(
    async (event) => {
      const files = Array.from(event.target.files || [])
      if (files.length === 0) return

      setError('')

      const imageFiles = files.filter((file) => file.type.startsWith('image/'))
      if (imageFiles.length !== files.length) {
        setError('Only image files are allowed for profile pictures.')
        onError?.('Only image files are allowed')
        return
      }

      // Upload to Cloudinary
      const uploaded = await upload(imageFiles, patientId, 'profile')
      if (uploaded.length > 0) {
        const attachment = uploaded.doctor || uploaded[0]
        onUploadComplete?.(attachment)
        setShowUpload(false)
      } else {
        onError?.(uploadError || 'Upload failed')
      }
    },
    [patientId, upload, onUploadComplete, onError, uploadError, setError],
  )

  return (
    <div className={styles.container}>
      {!showUpload ? (
        <button type="button" className={styles.button} onClick={() => setShowUpload(true)}>
          {currentImage?.url ? 'Change' : 'Upload'} photo
        </button>
      ) : (
        <div className={styles.uploadArea}>
          <label className={styles.inputLabel}>
            <input type="file" accept="image/*" onChange={handleImageSelect} disabled={uploading} />
            <span>{uploading ? 'Uploading...' : 'Click to select image'}</span>
          </label>
          {uploadError && <p className={styles.error}>{uploadError}</p>}
          <button type="button" className={styles.cancelButton} onClick={() => setShowUpload(false)} disabled={uploading}>
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
