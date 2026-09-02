const express = require('express')
const { nanoid } = require('nanoid')

const HomeCareRequest = require('../../models/patient/homeCareRequest')
const Patient = require('../../models/patient/patientRegistration')
const Nurse = require('../../models/privateHealthWorker/nurse/privateNurseRegistration')
const PatientNotification = require('../../models/patient/patientNotification')
const NurseNotification = require('../../models/privateHealthWorker/nurse/nurseNotification')
const healthRecordModel = require('../../models/patient/healthRecord')
const NurseReview = require('../../models/patient/nurseReview')
const {
  serializeHomeCareRequest,
  transitionRequestStatus,
  findAssignedNurse,
} = require('../../lib/homeCareAssignment')
const { resolveNurseAssignmentPlan } = require('../../lib/nurseAssignment')

const router = express.Router()

const SERVICE_LABELS = {
  'nursing care': 'Nursing Care',
  'elderly care': 'Elderly Care',
  'post-hospitalization care': 'Post-Hospitalization Care',
  physiotherapy: 'Physiotherapy',
}

function stripPatient(patient) {
  if (!patient) return null
  return {
    patientId: patient.patientId,
    patientFirstName: patient.patientFirstName,
    patientLastName: patient.patientLastName,
    patientEmail: patient.patientEmail,
    patientPhone: patient.patientPhone,
    patientAddress: patient.patientAddress,
    profileImage: patient.profileImage || null,
    createdAt: patient.createdAt,
  }
}

function stripNurse(nurse) {
  if (!nurse) return null
  return {
    nurseId: nurse.uid,
    nurseFirstName: nurse.nurseFirstName,
    nurseLastName: nurse.nurseLastName,
    nurseName: [nurse.nurseFirstName, nurse.nurseLastName].filter(Boolean).join(' ').trim(),
    nurseEmail: nurse.nurseEmail,
    nursePhone: nurse.nursePhone,
    nurseAddress: nurse.nurseAddress,
    specialization: nurse.specialization || '',
    yearsOfExperience: Number(nurse.yearsOfExperience) || 0,
    profileImage: nurse.profileImage || null,
    isVerified: Boolean(nurse.isVerified),
    isAvailable: nurse.isAvailable !== false,
  }
}

async function serializeWithPatient(request) {
  const serialized = serializeHomeCareRequest(request)
  const patient = request.patient
    ? request.patient
    : await Patient.findOne({ patientId: String(request.patientId || '') }).select('patientId patientFirstName patientLastName patientEmail patientPhone patientAddress profileImage').lean()
  return { ...serialized, patient: stripPatient(patient) }
}

// List all requests. Optional ?status= and ?view=completed filters.
router.get('/', async (req, res) => {
  try {
    const { status, view } = req.query
    const filter = {}
    const requestedStatus = String(status || '').trim().toLowerCase()
    const requestedView = String(view || '').trim().toLowerCase()

    if (requestedView === 'completed') {
      filter.status = 'completed'
    } else if (requestedStatus) {
      filter.status = requestedStatus
    }

    const requests = await HomeCareRequest.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(req.query.limit) || 200)
      .lean()

    const patientIds = [...new Set(requests.map((request) => String(request.patientId || '')).filter(Boolean))]
    const patients = patientIds.length > 0
      ? await Patient.find({ patientId: { $in: patientIds } })
          .select('patientId patientFirstName patientLastName patientEmail patientPhone patientAddress profileImage')
          .lean()
      : []
    const patientMap = new Map(patients.map((patient) => [String(patient.patientId), patient]))

    const nurseIds = [...new Set(requests.map((request) => String(request.assignedNurseId || '')).filter(Boolean))]
    const nurses = nurseIds.length > 0
      ? await Nurse.find({ uid: { $in: nurseIds } })
          .select('uid nurseFirstName nurseLastName nursePhone nurseEmail nurseAddress specialization profileImage isVerified isAvailable')
          .lean()
      : []
    const nurseMap = new Map(nurses.map((nurse) => [String(nurse.uid), nurse]))

    const result = await Promise.all(
      requests.map(async (request) => {
        const base = serializeHomeCareRequest(request, nurseMap.get(String(request.assignedNurseId || '')) || null)
        const review = await NurseReview.findOne({ homeCareRequestId: String(request.homeCareRequestId) }).lean()
        return {
          ...base,
          assignmentReason: request.assignmentReason || '',
          nurseReview: review || null,
          patient: stripPatient(patientMap.get(String(request.patientId || ''))),
        }
      }),
    )

    return res.status(200).json({ requests: result })
  } catch (error) {
    console.error('Failed to list all home care requests:', error)
    return res.status(500).json({ message: 'Failed to list home care requests' })
  }
})

// Single request with patient profile.
router.get('/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params
    const request = await HomeCareRequest.findOne({ homeCareRequestId: String(requestId) }).lean()
    if (!request) return res.status(404).json({ message: 'Home care request not found' })

    const payload = await serializeWithPatient(request)
    return res.status(200).json({ request: payload })
  } catch (error) {
    console.error('Failed to load home care request:', error)
    return res.status(500).json({ message: 'Failed to load home care request' })
  }
})

// Available healthcare professionals for manual assignment.
router.get('/:requestId/nurses', async (req, res) => {
  try {
    const { requestId } = req.params
    const request = await HomeCareRequest.findOne({ homeCareRequestId: String(requestId) }).lean()
    if (!request) return res.status(404).json({ message: 'Home care request not found' })

    const nurses = await Nurse.find({ role: 'nurse', isVerified: true, isAvailable: { $ne: false } })
      .select('uid nurseFirstName nurseLastName nursePhone nurseEmail nurseAddress specialization yearsOfExperience profileImage isVerified isAvailable')
      .sort({ yearsOfExperience: -1 })
      .lean()

    return res.status(200).json({ nurses: nurses.map(stripNurse) })
  } catch (error) {
    console.error('Failed to list available nurses:', error)
    return res.status(500).json({ message: 'Failed to list available nurses' })
  }
})

async function assignNurse({ requestId, specificNurseId = null, excludeNurseId = null, io = null }) {
  const request = await HomeCareRequest.findOne({ homeCareRequestId: String(requestId) })
  if (!request) return { error: 'Home care request not found', statusCode: 404 }

  if (!['pending', 'under review', 'assigned', 'accepted', 'in progress'].includes(String(request.status).toLowerCase())) {
    return { error: 'Request is not assignable in its current state', statusCode: 409 }
  }

  let selectedNurse = null
  let assignmentReason = ''

  if (specificNurseId) {
    selectedNurse = await Nurse.findOne({ uid: String(specificNurseId), role: 'nurse', isVerified: true, isAvailable: { $ne: false } })
      .select('uid nurseFirstName nurseLastName specialization yearsOfExperience')
      .lean()
    if (!selectedNurse) return { error: 'Selected healthcare professional is not available', statusCode: 409 }
    assignmentReason = 'Nurse was selected manually by an administrator.'
  } else {
    const healthRecord = await healthRecordModel.findOne({ patientRef: String(request.patientId || '') }).lean()
    const reason = [request.description, request.serviceType, healthRecord?.medicalHistory].filter(Boolean).join(' ')
    const plan = await resolveNurseAssignmentPlan({ reason, healthRecord, excludeNurseId })
    if (plan.error) return { error: plan.error, statusCode: plan.statusCode || 409 }
    selectedNurse = plan.selectedNurse
    assignmentReason = plan.selectionReason || `Matched the requested care specialty: ${plan.inference?.specialtyLabel || 'general care'}.`
  }

  const nurseName = [selectedNurse.nurseFirstName, selectedNurse.nurseLastName].filter(Boolean).join(' ').trim()
  const now = new Date()

  request.status = 'assigned'
  request.assignedNurseId = String(selectedNurse.uid)
  request.assignedNurseName = nurseName
  request.assignmentReason = assignmentReason
  request.assignedAt = now
  request.reviewedAt = request.reviewedAt || now
  request.timeline.push({
    type: 'assigned',
    label: `${nurseName} was assigned for ${request.serviceType}`,
    at: now,
  })

  await request.save()

  const payload = serializeHomeCareRequest(request, await findAssignedNurse(request.assignedNurseId))
  const patientPayload = { ...payload, patient: request.patient ? stripPatient(request.patient) : null }

  if (io) {
    io.to(`notifications-patient-${String(request.patientId)}`).emit('home-care-updated', { request: payload })
  }

  try {
    const patient = await Patient.findOne({ patientId: String(request.patientId) }).select('patientFirstName patientLastName').lean()
    const patientName = [patient?.patientFirstName, patient?.patientLastName].filter(Boolean).join(' ').trim() || request.patientName || 'Patient'

    await PatientNotification.create({
      notificationId: `PNOT-${nanoid(10).toUpperCase()}`,
      patientId: String(request.patientId),
      type: 'assignment',
      title: 'Healthcare professional assigned',
      message: `${nurseName} has been assigned for your ${request.serviceType} request.`,
      relatedTo: request.homeCareRequestId,
      priority: 'normal',
      actionUrl: `/secure/home-care?requestId=${encodeURIComponent(request.homeCareRequestId)}`,
    })

    await NurseNotification.create({
      notificationId: `NNOT-${nanoid(10).toUpperCase()}`,
      nurseId: String(selectedNurse.uid),
      type: 'assignment',
      title: 'New home care request',
      message: `You have been assigned a ${request.serviceType} request for ${patientName}.`,
      relatedTo: request.homeCareRequestId,
      priority: 'normal',
actionUrl: `/secure/nurse?requestId=${encodeURIComponent(request.homeCareRequestId)}`,
    })

    if (io) {
      io.to(`notifications-nurse-${String(selectedNurse.uid)}`).emit('nurse-notification-created', {
        notification: { title: 'New home care request', message: `You have been assigned a ${request.serviceType} request for ${patientName}.` },
      })
    }
  } catch (notificationError) {
    console.error('Failed to create home-care assignment notifications:', notificationError)
  }

  return { request: patientPayload }
}

router.patch('/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params
    const { action, status, nurseId } = req.body || {}
    const io = req?.app?.get('io')
    const normalizedAction = String(action || '').toLowerCase()

    const request = await HomeCareRequest.findOne({ homeCareRequestId: String(requestId) })
    if (!request) return res.status(404).json({ message: 'Home care request not found' })

    if (normalizedAction === 'assign') {
      const result = await assignNurse({ requestId, specificNurseId: nurseId || null, io })
      if (result.error) return res.status(result.statusCode || 409).json({ message: result.error })
      return res.status(200).json({ message: 'Healthcare professional assigned', request: result.request })
    }

    if (normalizedAction === 'reassign') {
      const result = await assignNurse({
        requestId,
        specificNurseId: nurseId || null,
        excludeNurseId: request.assignedNurseId || null,
        io,
      })
      if (result.error) return res.status(result.statusCode || 409).json({ message: result.error })
      return res.status(200).json({ message: 'Healthcare professional reassigned', request: result.request })
    }

    if (normalizedAction === 'status' || normalizedAction === 'advance') {
      const nextStatus = String(status || '').trim().toLowerCase()
      if (!nextStatus) return res.status(400).json({ message: 'A target status is required' })
      const result = await transitionRequestStatus(request, nextStatus, { actor: 'Admin' })
      if (result.error) return res.status(result.statusCode || 409).json({ message: result.error })
      const payload = await serializeWithPatient(result.request)
      if (io) io.to(`notifications-patient-${String(request.patientId)}`).emit('home-care-updated', { request: result.request })
      return res.status(200).json({ message: 'Home care request updated', request: payload })
    }

    if (normalizedAction === 'reject') {
      if (!['pending', 'under review', 'assigned', 'accepted', 'in progress'].includes(String(request.status).toLowerCase())) {
        return res.status(409).json({ message: 'This request can no longer be rejected' })
      }
      const result = await transitionRequestStatus(request, 'cancelled', { actor: 'Admin' })
      if (result.error) return res.status(result.statusCode || 409).json({ message: result.error })
      const payload = await serializeWithPatient(result.request)
      if (io) io.to(`notifications-patient-${String(request.patientId)}`).emit('home-care-updated', { request: result.request })
      return res.status(200).json({ message: 'Home care request rejected', request: payload })
    }

    return res.status(400).json({ message: 'Unsupported home care review action' })
  } catch (error) {
    console.error('Failed to update home care request (admin):', error)
    return res.status(500).json({ message: 'Failed to update home care request' })
  }
})

module.exports = router
