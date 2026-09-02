const express = require('express')
// mergeParams is required so the nested "/:id/home-care" child router can read
// the parent ":id" (req.params.id). Without it, allowOwnerOrDoctor compares the
// authenticated patient id against an empty ownerRef and rejects with 403.
const router = express.Router({ mergeParams: true })

const HomeCareRequest = require('../../models/patient/homeCareRequest')
const NurseReview = require('../../models/patient/nurseReview')
const Attachment = require('../../models/media/attachment')
const {
  assignNurseToRequest,
  transitionRequestStatus,
  serializeHomeCareRequest,
  findAssignedNurse,
} = require('../../lib/homeCareAssignment')
const { loadUser } = require('../../middleware/loadUserMiddleware')
const { allowOwnerOrDoctor } = require('../../middleware/permissionMiddleware')

const SERVICE_TYPES = ['nursing care', 'elderly care', 'post-hospitalization care', 'physiotherapy']

// Create a home care request
router.post('/', loadUser, allowOwnerOrDoctor((req) => req.params.id), async (req, res) => {
  try {
    const { id } = req.params
    const {
      serviceType,
      description,
      address,
      location,
      locationCoords,
      preferredDate,
      preferredTime,
      emergencyContactName,
      emergencyContactPhone,
      patientName,
      patientPhone,
      verificationPhoto,
    } = req.body || {}

    const coords = locationCoords && Number.isFinite(Number(locationCoords.lat)) && Number.isFinite(Number(locationCoords.lng))
      ? { lat: Number(locationCoords.lat), lng: Number(locationCoords.lng) }
      : null

    const normalizedType = String(serviceType || '').trim().toLowerCase()
    if (!SERVICE_TYPES.includes(normalizedType)) {
      return res.status(400).json({ message: 'Please select a valid home care service type.' })
    }
    if (!description || !String(description).trim()) {
      return res.status(400).json({ message: 'Please provide a description of the care needed.' })
    }
    if (!verificationPhoto?.url || !verificationPhoto?.publicId || !verificationPhoto?.attachmentId) {
      return res.status(400).json({ message: 'A live identity verification photo is required.' })
    }
    const savedVerificationPhoto = await Attachment.findOne({
      _id: verificationPhoto.attachmentId,
      ownerRef: String(id),
      purpose: 'verification',
      url: String(verificationPhoto.url).trim(),
      publicId: String(verificationPhoto.publicId).trim(),
    }).lean()
    if (!savedVerificationPhoto) {
      return res.status(400).json({ message: 'Please take a new live identity verification photo.' })
    }

    const request = await HomeCareRequest.create({
      patientId: String(id),
      patientName: String(patientName || 'Patient').trim(),
      patientPhone: String(patientPhone || '').trim(),
      serviceType: normalizedType,
      description: String(description).trim(),
      verificationPhoto: {
        attachmentId: verificationPhoto.attachmentId,
        url: String(verificationPhoto.url).trim(),
        publicId: String(verificationPhoto.publicId).trim(),
        mimeType: String(verificationPhoto.mimeType || 'image/jpeg').trim(),
        capturedAt: verificationPhoto.capturedAt ? new Date(verificationPhoto.capturedAt) : new Date(),
      },
address: String(address || '').trim(),
      location: String(location || '').trim(),
      locationCoords: coords,
      preferredDate: preferredDate ? new Date(preferredDate) : null,
      preferredTime: String(preferredTime || '').trim(),
      emergencyContactName: String(emergencyContactName || '').trim(),
      emergencyContactPhone: String(emergencyContactPhone || '').trim(),
      status: 'pending',
      submittedAt: new Date(),
      timeline: [
        {
          type: 'created',
          label: 'Home care request submitted',
          at: new Date(),
        },
      ],
    })

    return res.status(201).json({ message: 'Home care request submitted', request: serializeHomeCareRequest(request) })
  } catch (error) {
    console.error('Failed to create home care request:', error)
    return res.status(500).json({ message: 'Failed to create home care request' })
  }
})

// List a patient's home care requests
router.get('/', loadUser, allowOwnerOrDoctor((req) => req.params.id), async (req, res) => {
  try {
    const { id } = req.params
    const requests = await HomeCareRequest.find({ patientId: String(id) }).sort({ createdAt: -1 }).lean()

    const nurseIds = [...new Set(requests.map((request) => String(request.assignedNurseId || '')).filter(Boolean))]
    const nurseMap = new Map()
    if (nurseIds.length > 0) {
      const Nurse = require('../../models/privateHealthWorker/nurse/privateNurseRegistration')
      const nurses = await Nurse.find({ uid: { $in: nurseIds } })
        .select('uid nurseFirstName nurseLastName nursePhone nurseEmail nurseAddress specialization profileImage isVerified')
        .lean()
      nurses.forEach((nurse) => nurseMap.set(String(nurse.uid), nurse))
    }

    const reviews = await NurseReview.find({ homeCareRequestId: { $in: requests.map((request) => String(request.homeCareRequestId)) } }).lean()
    const reviewMap = new Map(reviews.map((review) => [String(review.homeCareRequestId), review]))
    return res.status(200).json({
      requests: requests.map((request) => ({
        ...serializeHomeCareRequest(request, nurseMap.get(String(request.assignedNurseId || '')) || null),
        nurseReview: reviewMap.get(String(request.homeCareRequestId)) || null,
      })),
    })
  } catch (error) {
    console.error('Failed to list home care requests:', error)
    return res.status(500).json({ message: 'Failed to list home care requests' })
  }
})

// Get a single home care request
router.get('/:requestId', loadUser, allowOwnerOrDoctor((req) => req.params.id), async (req, res) => {
  try {
    const { id, requestId } = req.params
    const request = await HomeCareRequest.findOne({ homeCareRequestId: String(requestId), patientId: String(id) }).lean()
    if (!request) {
      return res.status(404).json({ message: 'Home care request not found' })
    }

    const nurse = await findAssignedNurse(request.assignedNurseId)
    const nurseReview = await NurseReview.findOne({ homeCareRequestId: String(requestId) }).lean()
    return res.status(200).json({ request: { ...serializeHomeCareRequest(request, nurse), nurseReview: nurseReview || null } })
  } catch (error) {
    console.error('Failed to load home care request:', error)
    return res.status(500).json({ message: 'Failed to load home care request' })
  }
})

router.post('/:requestId/review', loadUser, allowOwnerOrDoctor((req) => req.params.id), async (req, res) => {
  try {
    const { id, requestId } = req.params
    const rating = Number(req.body?.rating)
    const comment = String(req.body?.comment || '').trim()
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be a whole number from 1 to 5' })
    }

    const request = await HomeCareRequest.findOne({ homeCareRequestId: String(requestId), patientId: String(id), status: 'completed' }).lean()
    if (!request || !request.assignedNurseId) {
      return res.status(409).json({ message: 'A review is available after your completed assignment' })
    }

    const review = await NurseReview.findOneAndUpdate(
      { homeCareRequestId: String(requestId) },
      { patientId: String(id), nurseId: String(request.assignedNurseId), rating, comment },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean()
    return res.status(200).json({ review })
  } catch (error) {
    console.error('Failed to save home care nurse review:', error)
    return res.status(500).json({ message: 'Failed to save nurse review' })
  }
})

// Update a home care request (patient can cancel; owner/admin/nurse can advance status)
router.patch('/:requestId', loadUser, allowOwnerOrDoctor((req) => req.params.id), async (req, res) => {
  try {
    const { id, requestId } = req.params
    const { action, status } = req.body || {}

    const request = await HomeCareRequest.findOne({ homeCareRequestId: String(requestId), patientId: String(id) })
    if (!request) {
      return res.status(404).json({ message: 'Home care request not found' })
    }

    const io = req?.app?.get('io')
    const currentStatus = String(request.status || '').toLowerCase()

    // Patient cancels
    if (action === 'cancel') {
      if (!['pending', 'under review', 'assigned', 'accepted', 'in progress'].includes(currentStatus)) {
        return res.status(409).json({ message: 'This request can no longer be cancelled.' })
      }
      const result = await transitionRequestStatus(request, 'cancelled', { actor: 'You' })
      if (result.error) return res.status(result.statusCode || 409).json({ message: result.error })
      const payload = serializeHomeCareRequest(result.request)
      if (io) io.to(`notifications-patient-${String(id)}`).emit('home-care-updated', { request: payload })
      return res.status(200).json({ message: 'Home care request cancelled', request: payload })
    }

    // Advance status (nurse/admin/provider)
    if (action === 'advance') {
      const result = await transitionRequestStatus(request, status, { actor: 'Provider' })
      if (result.error) return res.status(result.statusCode || 409).json({ message: result.error })
      const payload = serializeHomeCareRequest(result.request)
      if (io) io.to(`notifications-patient-${String(id)}`).emit('home-care-updated', { request: payload })
      return res.status(200).json({ message: 'Home care request updated', request: payload })
    }

    // Trigger nurse assignment (review step)
    if (action === 'assign') {
      const result = await assignNurseToRequest(request.homeCareRequestId, { io })
      if (result.error) return res.status(result.statusCode || 409).json({ message: result.error })
      return res.status(200).json({ message: 'Healthcare professional assigned', request: result.request })
    }

    return res.status(400).json({ message: 'Unsupported home care action' })
  } catch (error) {
    console.error('Failed to update home care request:', error)
    return res.status(500).json({ message: 'Failed to update home care request' })
  }
})

module.exports = router
