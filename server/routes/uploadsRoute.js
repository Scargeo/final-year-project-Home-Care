const express = require('express')
const router = express.Router()
const multer = require('multer')
const { CloudinaryStorage } = require('multer-storage-cloudinary')
const cloudinary = require('cloudinary').v2
const Attachment = require('../models/media/attachment')
const Patient = require('../models/patient/patientRegistration')
const Doctor = require('../models/privateHealthWorker/doctor/doctorRegistration')
const HealthRecord = require('../models/patient/healthRecord')
const { allowOwnerOrDoctor } = require('../middleware/permissionMiddleware')
const { loadUser } = require('../middleware/loadUserMiddleware')

// Configure cloudinary from env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isPdf = String(file.mimetype || '').toLowerCase() === 'application/pdf'
    const folder = `homecare/${req.body.ownerRef || 'public'}`
    return {
      folder,
      resource_type: isPdf ? 'raw' : 'image',
      public_id: `${Date.now()}_${file.originalname.replace(/\.[^/.]+$/, '')}`,
    }
  },
})

const upload = multer({ storage })

function serializeDoctor(doctor) {
  if (!doctor) return null

  const doctorObject = typeof doctor.toObject === 'function' ? doctor.toObject() : doctor
  const safeDoctor = { ...doctorObject }
  delete safeDoctor.doctorPassword
  return safeDoctor
}

// Load user (from headers) for permission checks on all routes
router.use(loadUser)

// Upload one or multiple files. Expects multipart form-data with fields:
// - files (file inputs)
// - ownerRef (string): id of owner (patient or user)
// - purpose (profile|document|post|other)
// Doctors can upload without permission checks. Patients must own the resource.
router.post('/', upload.array('files', 10), async (req, res) => {
  try {
    const files = req.files || []
    const ownerRef = String(req.body.ownerRef || '')
    const purpose = String(req.body.purpose || 'other')
    let updatedDoctor = null

    if (!ownerRef) {
      return res.status(400).json({ message: 'Missing ownerRef in form data' })
    }

    if (files.length === 0) {
      console.warn('No files received in upload request. req.files:', req.files, 'req.body:', req.body)
      return res.status(400).json({ message: 'No files provided' })
    }

    const saved = []

    for (const f of files) {
      // multer-storage-cloudinary exposes path and filename info
      const url = f.path || f.secure_url || ''
      const publicId = f.filename || f.public_id || ''

      if (!url || !publicId) {
        console.error('Missing url or publicId from Cloudinary upload:', { url, publicId, file: f })
        continue
      }

      const doc = await Attachment.create({
        ownerRef,
        purpose,
        originalName: f.originalname,
        url,
        publicId,
        mimeType: f.mimetype,
        size: f.size,
        resourceType: f.resource_type || (f.mimetype && f.mimetype.includes('pdf') ? 'raw' : 'image'),
      })

      // If purpose is profile, update patient OR doctor record and remove previous image
      if (purpose === 'profile') {
        try {
          // Try updating patient first
          const patient = await Patient.findOne({ patientId: ownerRef })
          if (patient) {
            if (patient.profileImage && patient.profileImage.publicId) {
              try {
                await cloudinary.uploader.destroy(patient.profileImage.publicId, {
                  resource_type: patient.profileImage.mimeType && patient.profileImage.mimeType.includes('pdf') ? 'raw' : 'image',
                })
              } catch (e) {
                console.warn('Failed to delete previous Cloudinary image for patient:', e.message)
              }
            }

            await Patient.updateOne({ patientId: ownerRef }, { $set: { profileImage: { url, publicId, mimeType: f.mimetype, uploadedAt: new Date() } } })
          } else {
            // Not a patient — try doctor
            const doctor = await Doctor.findOne({ doctorId: ownerRef })
            if (doctor) {
              if (doctor.profileImage && doctor.profileImage.publicId) {
                try {
                  await cloudinary.uploader.destroy(doctor.profileImage.publicId, {
                    resource_type: doctor.profileImage.mimeType && doctor.profileImage.mimeType.includes('pdf') ? 'raw' : 'image',
                  })
                } catch (e) {
                  console.warn('Failed to delete previous Cloudinary image for doctor:', e.message)
                }
              }

              updatedDoctor = await Doctor.findOneAndUpdate(
                { doctorId: ownerRef },
                { $set: { profileImage: { url, publicId, mimeType: f.mimetype, uploadedAt: new Date() } } },
                { new: true },
              )
            }
          }
        } catch (err) {
          console.warn('Failed to update patient profile image', err)
        }
      }

      saved.push(doc)
    }

    return res.status(200).json({ files: saved, doctor: serializeDoctor(updatedDoctor) })
  } catch (error) {
    console.error('Upload failed', error)
    return res.status(500).json({ message: `File upload failed: ${error?.message || 'Unknown error'}` })
  }
})

// Get attachments for an ownerRef (only owner or doctor)
router.get('/owner/:ownerRef', allowOwnerOrDoctor((req) => req.params.ownerRef), async (req, res) => {
  try {
    const { ownerRef } = req.params
    if (!ownerRef) return res.status(400).json({ message: 'Missing ownerRef' })
    const attachments = await Attachment.find({ ownerRef }).sort({ uploadedAt: -1 })
    return res.status(200).json({ files: attachments })
  } catch (err) {
    console.error('Failed to fetch attachments by ownerRef', err)
    return res.status(500).json({ message: 'Failed to fetch attachments' })
  }
})

// Delete an attachment by id. This will remove from cloudinary and the DB.
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const attachment = await Attachment.findById(id)
    if (!attachment) return res.status(404).json({ message: 'Attachment not found' })

    // Permission check: only owner (patient) or doctor may delete
    try {
      if (String(process.env.DISABLE_AUTH || '') !== 'true') {
        // Prefer req.user if loaded
        if (req.user && req.user.role) {
          if (!(req.user.role === 'doctor' || (req.user.role === 'patient' && req.user.id === String(attachment.ownerRef)))) {
            return res.status(403).json({ message: 'Forbidden' })
          }
        } else {
          const userId = String(req.get('x-user-id') || '').trim()
          const userRole = String(req.get('x-user-role') || '').trim().toLowerCase()
          const ownerRef = String(attachment.ownerRef || '').trim()

          if (!userId || !userRole) {
            return res.status(401).json({ message: 'Missing authentication headers' })
          }

          if (!(userRole === 'doctor' || (userRole === 'patient' && userId === ownerRef))) {
            return res.status(403).json({ message: 'Forbidden' })
          }
        }
      }
    } catch (permErr) {
      console.error('Permission check failed for delete', permErr)
      return res.status(500).json({ message: 'Permission check failed' })
    }

    // Delete from Cloudinary
    try {
      await cloudinary.uploader.destroy(attachment.publicId, { resource_type: attachment.resourceType === 'raw' ? 'raw' : 'image' })
    } catch (err) {
      console.warn('Cloudinary deletion failed', err)
    }

    // If attachment was a profile image, clear patient.profileImage
    if (attachment.purpose === 'profile') {
      try {
        await Patient.updateOne({ patientId: attachment.ownerRef }, { $set: { profileImage: { url: '', publicId: '', mimeType: '', uploadedAt: null } } })
      } catch (err) {
        console.warn('Failed to clear patient profileImage', err)
      }
    }

    if (attachment.purpose === 'document') {
      try {
        const record = await HealthRecord.findOne({ patientRef: attachment.ownerRef })
        if (record) {
          const nextLabResults = Array.isArray(record.labResults)
            ? record.labResults.filter((entry) => {
                if (!entry) return false

                const attachmentId = String(entry.attachmentId || '')
                const publicId = String(entry.publicId || '')
                const url = String(entry.url || '')

                return !(
                  attachmentId === String(attachment._id) ||
                  publicId === String(attachment.publicId) ||
                  url === String(attachment.url)
                )
              })
            : []

          record.labResults = nextLabResults
          await record.save()
        }
      } catch (err) {
        console.warn('Failed to remove lab result from health record', err)
      }
    }

    await attachment.deleteOne()
    return res.status(200).json({ message: 'Deleted' })
  } catch (error) {
    console.error('Failed to delete attachment', error)
    return res.status(500).json({ message: 'Failed to delete attachment' })
  }
})

module.exports = router
