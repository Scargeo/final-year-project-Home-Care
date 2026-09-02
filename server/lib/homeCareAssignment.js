const { nanoid } = require('nanoid')
const HomeCareRequest = require('../models/patient/homeCareRequest')
const Patient = require('../models/patient/patientRegistration')
const PatientNotification = require('../models/patient/patientNotification')
const NurseNotification = require('../models/privateHealthWorker/nurse/nurseNotification')
const healthRecordModel = require('../models/patient/healthRecord')
const { resolveNurseAssignmentPlan } = require('./nurseAssignment')

const STATUS_TRANSITIONS = {
  'pending': ['under review', 'cancelled'],
  'under review': ['assigned', 'cancelled'],
  'assigned': ['accepted', 'cancelled'],
  'accepted': ['in progress', 'cancelled'],
  'in progress': ['completed'],
  'completed': [],
  'cancelled': [],
}

function canTransition(fromStatus, toStatus) {
  if (fromStatus === toStatus) return false
  const allowed = STATUS_TRANSITIONS[String(fromStatus || '').toLowerCase()] || []
  return allowed.includes(String(toStatus || '').toLowerCase())
}

function statusTimestampField(status) {
  const map = {
    'under review': 'reviewedAt',
    'assigned': 'assignedAt',
    'accepted': 'acceptedAt',
    'in progress': 'inProgressAt',
    'completed': 'completedAt',
    'cancelled': 'cancelledAt',
  }
  return map[String(status || '').toLowerCase()] || null
}

function statusLabel(status) {
  const map = {
    pending: 'Request submitted',
    'under review': 'Request is under review',
    assigned: 'A healthcare professional has been assigned',
    accepted: 'The professional accepted your request',
    'in progress': 'Care is in progress',
    completed: 'Care completed',
    cancelled: 'Request cancelled',
  }
  return map[String(status || '').toLowerCase()] || String(status || '')
}

function parseLocationCoordinates(value) {
  if (!value) return null
  if (typeof value === 'object') {
    const lat = Number(value.lat ?? value.latitude)
    const lng = Number(value.lng ?? value.longitude)
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
    return null
  }
  const text = String(value).trim()
  if (!text) return null
  // Try JSON like {"lat":5.6,"lng":-0.19}
  try {
    const parsed = JSON.parse(text)
    const lat = Number(parsed.lat ?? parsed.latitude)
    const lng = Number(parsed.lng ?? parsed.longitude)
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
  } catch {
    // not JSON, fall through to plain-text match
  }
  // Try "lat,lng" numeric pair
  const pair = text.match(/-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?/)
  if (pair) {
    const [lat, lng] = pair[0].split(',').map((v) => Number.parseFloat(v))
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
  }
  return null
}

function serializeHomeCareRequest(document, nurse = null) {
  if (!document) return null
  const json = typeof document.toObject === 'function' ? document.toObject() : document

  return {
    ...json,
    assignmentReason: undefined,
    id: String(json._id || ''),
    statusLabel: statusLabel(json.status),
    careRecords: Array.isArray(json.careRecords) ? json.careRecords : [],
    observations: Array.isArray(json.observations) ? json.observations : [],
    declineReason: json.declineReason || '',
    locationCoords: parseLocationCoordinates(json.location || json.coordinates || null),
    assignedNurse: nurse
      ? {
          nurseId: nurse.nurseId || String(nurse.uid || ''),
          nurseName: nurse.nurseName || [nurse.nurseFirstName, nurse.nurseLastName].filter(Boolean).join(' ').trim(),
          nursePhone: nurse.nursePhone || '',
          nurseEmail: nurse.nurseEmail || '',
          nurseAddress: nurse.nurseAddress || '',
          specialization: nurse.specialization || '',
          profileImage: nurse.profileImage || null,
          isVerified: Boolean(nurse.isVerified),
        }
      : json.assignedNurseName
        ? {
            nurseId: json.assignedNurseId || '',
            nurseName: json.assignedNurseName || '',
          }
        : null,
  }
}

async function findAssignedNurse(assignedNurseId) {
  if (!assignedNurseId) return null
  try {
    const Nurse = require('../models/privateHealthWorker/nurse/privateNurseRegistration')
    const nurse = await Nurse.findOne({ uid: String(assignedNurseId) })
      .select('uid nurseFirstName nurseLastName nursePhone nurseEmail nurseAddress specialization profileImage isVerified')
      .lean()
    return nurse || null
  } catch {
    return null
  }
}

async function assignNurseToRequest(requestId, { io = null } = {}) {
  const request = await HomeCareRequest.findOne({ homeCareRequestId: String(requestId) })
  if (!request) return { error: 'Home care request not found', statusCode: 404 }

  if (String(request.status).toLowerCase() !== 'pending' && String(request.status).toLowerCase() !== 'under review') {
    return { error: 'Request is not in a reviewable state', statusCode: 409 }
  }

  const healthRecord = await healthRecordModel.findOne({ patientRef: String(request.patientId || '') }).lean()
  const reason = [request.description, request.serviceType, healthRecord?.medicalHistory].filter(Boolean).join(' ')

  const plan = await resolveNurseAssignmentPlan({ reason, healthRecord })

  if (plan.error) {
    return { error: plan.error, statusCode: plan.statusCode || 409 }
  }

  const nurseName = [plan.selectedNurse?.nurseFirstName, plan.selectedNurse?.nurseLastName].filter(Boolean).join(' ').trim()
  const now = new Date()

  request.status = 'assigned'
  request.assignedNurseId = String(plan.selectedNurse.uid)
  request.assignedNurseName = nurseName
  request.assignedAt = now
  request.timeline.push({
    type: 'assigned',
    label: `${nurseName} was assigned for ${request.serviceType}`,
    at: now,
  })

  await request.save()

  const payload = serializeHomeCareRequest(request, plan.selectedNurse)

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
      nurseId: String(plan.selectedNurse.uid),
      type: 'assignment',
      title: 'New home care request',
      message: `You have been assigned a ${request.serviceType} request for ${patientName}.`,
      relatedTo: request.homeCareRequestId,
      priority: 'normal',
actionUrl: `/secure/nurse?requestId=${encodeURIComponent(request.homeCareRequestId)}`,
    })

    if (io) {
      io.to(`notifications-nurse-${String(plan.selectedNurse.uid)}`).emit('nurse-notification-created', {
        notification: { title: 'New home care request', message: `You have been assigned a ${request.serviceType} request for ${patientName}.` },
      })
    }
  } catch (notificationError) {
    console.error('Failed to create home-care assignment notifications:', notificationError)
  }

  return { request: payload }
}

async function declineAssignment(reqOrRequest) {
  const request = typeof reqOrRequest.save === 'function' ? reqOrRequest : null
  if (!request) return { error: 'Request not found', statusCode: 404 }

  const current = String(request.status || '').toLowerCase()
  if (!['assigned', 'accepted', 'in progress'].includes(current)) {
    return { error: 'This request is not in an assignable state to decline', statusCode: 409 }
  }

const now = new Date()
  const previousNurseName = String(request.assignedNurseName || '')
  const patientId = String(request.patientId || '')

  request.status = 'under review'
  request.assignedNurseId = ''
  request.assignedNurseName = ''
  request.timeline.push({
    type: 'declined',
    label: previousNurseName
      ? `${previousNurseName} declined this home care request and it was returned for reassignment.`
      : 'A healthcare professional declined this request and it was returned for reassignment.',
    at: now,
  })

  await request.save()

  try {
    await PatientNotification.create({
      notificationId: `PNOT-${nanoid(10).toUpperCase()}`,
      patientId,
      type: 'assignment',
      title: 'Professional declined the request',
      message: previousNurseName
        ? `${previousNurseName} declined your home care request. A new professional will be assigned soon.`
        : 'A healthcare professional declined your request. A new professional will be assigned soon.',
      relatedTo: request.homeCareRequestId,
      priority: 'normal',
      actionUrl: `/secure/home-care?requestId=${encodeURIComponent(request.homeCareRequestId)}`,
    })
  } catch (notificationError) {
    console.error('Failed to create home-care decline patient notification:', notificationError)
  }

  return { request }
}

async function transitionRequestStatus(request, nextStatus, { actor = 'system' } = {}) {
  const current = String(request.status || '').toLowerCase()
  const target = String(nextStatus || '').toLowerCase()

  if (!canTransition(current, target)) {
    return { error: `Cannot transition from "${current}" to "${target}"`, statusCode: 409 }
  }

  const now = new Date()
  request.status = target

  if (target === 'accepted') {
    request.acceptedAt = request.acceptedAt || now
  } else if (target === 'in progress') {
    request.inProgressAt = now
  } else if (target === 'completed') {
    request.completedAt = now
  } else if (target === 'cancelled') {
    request.cancelledAt = now
  }

  const field = statusTimestampField(target)
  if (field) request[field] = request[field] || now

  request.timeline.push({
    type: target.replace(/\s+/g, '-'),
    label: `${actor} ${target} the request`,
    at: now,
  })

  await request.save()
  return { request }
}

module.exports = {
  assignNurseToRequest,
  transitionRequestStatus,
  serializeHomeCareRequest,
  findAssignedNurse,
  canTransition,
  statusLabel,
  declineAssignment,
}
