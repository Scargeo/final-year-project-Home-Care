const express = require('express')
const router = express.Router()

const Appointment = require('../../models/privateHealthWorker/doctor/appointment')
const ConsentRequest = require('../../models/patient/consentRequest')
const HealthRecord = require('../../models/patient/healthRecord')
const ConsultationRoom = require('../../models/hospital/consultationRoom')
const { loadUser } = require('../../middleware/loadUserMiddleware')
const { createNurseAssignmentForCompletedAppointment } = require('../../lib/nurseAssignment')

router.use(loadUser)

function buildAppointmentDateTime(appointmentDate, appointmentTime) {
  const parsedDate = new Date(appointmentDate)
  if (Number.isNaN(parsedDate.getTime())) return new Date()

  const [hours = 0, minutes = 0] = String(appointmentTime || '')
    .split(':')
    .map((value) => Number.parseInt(value, 10))

  parsedDate.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0)
  return parsedDate
}

function toRoomStatus(appointmentStatus) {
  const normalized = String(appointmentStatus || '').toLowerCase()
  if (normalized === 'cancelled') return 'cancelled'
  if (normalized === 'completed') return 'completed'
  if (normalized === 'in-progress' || normalized === 'accepted') return 'active'
  return 'scheduled'
}

function isParticipant(user, room) {
  if (String(process.env.DISABLE_AUTH || '') === 'true') return true
  if (!user?.role || !user?.id) return false

  if (user.role === 'doctor') return String(user.id) === String(room.doctorId)
  if (user.role === 'patient') return String(user.id) === String(room.patientId)
  return false
}

function sanitizeFiles(files) {
  if (!Array.isArray(files)) return []
  return files
    .filter((item) => item && item.url)
    .map((item) => ({
      name: String(item.name || '').trim(),
      url: String(item.url || '').trim(),
      mimeType: String(item.mimeType || '').trim(),
      uploadedAt: item.uploadedAt ? new Date(item.uploadedAt) : new Date(),
    }))
}

function getAppointmentEndDate(appointment) {
  if (!appointment) return null

  const appointmentDate = new Date(appointment.appointmentDate)
  if (Number.isNaN(appointmentDate.getTime())) return null

  const [hours = 0, minutes = 0] = String(appointment.appointmentTime || '')
    .split(':')
    .map((value) => Number.parseInt(value, 10))

  appointmentDate.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0)
  appointmentDate.setMinutes(appointmentDate.getMinutes() + Number.parseInt(String(appointment.duration || 30), 10))
  return appointmentDate
}

function getParticipantJoinField(role) {
  const normalized = String(role || '').toLowerCase()
  if (normalized === 'doctor') return 'doctorJoinedAt'
  if (normalized === 'patient') return 'patientJoinedAt'
  return ''
}

async function completeAppointmentForRoom(room, appointment, io, options = {}) {
  if (!room || !appointment) return false

  const terminalStatuses = new Set(['completed', 'cancelled', 'no-show'])
  if (terminalStatuses.has(String(appointment.status || '').toLowerCase())) return false
  if (!room.doctorJoinedAt || !room.patientJoinedAt) return false

  const now = new Date()
  const forceComplete = Boolean(options.forceComplete)
  if (!forceComplete) {
    const endTime = getAppointmentEndDate(appointment)
    if (endTime && endTime.getTime() > now.getTime()) return false
  }

  const updatedAppointment = await Appointment.findOneAndUpdate(
    { appointmentId: String(room.appointmentId || appointment.appointmentId || '') },
    { status: 'completed', updatedAt: now },
    { new: true },
  )

  if (!updatedAppointment) return false

  const completedAt = room.completedAt ? new Date(room.completedAt) : now
  await ConsultationRoom.findOneAndUpdate(
    { roomId: String(room.roomId || '') },
    { $set: { status: 'completed', completedAt } },
    { new: true },
  )

  if (io) {
    io.to(`appointments-doctor-${String(updatedAppointment.doctorId)}`).emit('appointment-updated', { appointment: updatedAppointment })
    io.to(`appointments-patient-${String(updatedAppointment.patientId)}`).emit('appointment-updated', { appointment: updatedAppointment })
  }

  return updatedAppointment
}

async function markRoomParticipantJoined(room, role) {
  const joinField = getParticipantJoinField(role)
  if (!joinField) return room

  const now = new Date()
  const updates = { status: 'active' }

  if (!room[joinField]) updates[joinField] = now
  if (!room.doctorJoinedAt || !room.patientJoinedAt) {
    if (room.doctorJoinedAt || joinField === 'doctorJoinedAt') updates.doctorJoinedAt = room.doctorJoinedAt || now
    if (room.patientJoinedAt || joinField === 'patientJoinedAt') updates.patientJoinedAt = room.patientJoinedAt || now
  }
  if (!room.bothJoinedAt && (updates.doctorJoinedAt || room.doctorJoinedAt) && (updates.patientJoinedAt || room.patientJoinedAt)) {
    updates.bothJoinedAt = now
  }

  return ConsultationRoom.findOneAndUpdate(
    { roomId: String(room.roomId || '') },
    { $set: updates },
    { new: true },
  )
}

function normalizeCallType(callType) {
  const normalized = String(callType || '').toLowerCase()
  if (normalized === 'audio' || normalized === 'video') return normalized
  return ''
}

async function getAcceptedConsent({ patientId, doctorId, appointmentId }) {
  const baseQuery = {
    patientId: String(patientId || ''),
    doctorId: String(doctorId || ''),
    status: 'accepted',
  }

  if (appointmentId) {
    const byAppointment = await ConsentRequest.findOne({
      ...baseQuery,
      appointmentId: String(appointmentId),
    })
      .sort({ respondedAt: -1, updatedAt: -1 })
      .lean()
    if (byAppointment) return byAppointment
  }

  return ConsentRequest.findOne(baseQuery)
    .sort({ respondedAt: -1, updatedAt: -1 })
    .lean()
}

async function getOrCreateRoom(roomId) {
  const roomKey = String(roomId || '').trim()
  if (!roomKey) return { error: 'Missing room id', status: 400 }

  const appointment = await Appointment.findOne({ roomId: roomKey }).lean()
  if (!appointment) {
    return { error: 'Room is not linked to an appointment', status: 404 }
  }

  const defaults = {
    roomId: roomKey,
    appointmentId: String(appointment.appointmentId || ''),
    patientId: String(appointment.patientId || ''),
    doctorId: String(appointment.doctorId || ''),
    date: buildAppointmentDateTime(appointment.appointmentDate, appointment.appointmentTime),
    status: toRoomStatus(appointment.status),
  }

  const room = await ConsultationRoom.findOneAndUpdate(
    { roomId: roomKey },
    { $setOnInsert: defaults },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  return { room, appointment }
}

function getSharedRecordPreview(record, consent) {
  if (!record || !consent) return null

  const allowedFields = Array.isArray(consent.sharedRecords)
    ? consent.sharedRecords.map((field) => String(field))
    : []

  const labResults = allowedFields.includes('labResults')
    ? (Array.isArray(record.labResults) ? record.labResults.map((item) => ({
        fileName: String(item?.fileName || item?.name || ''),
        url: String(item?.url || ''),
        publicId: String(item?.publicId || ''),
        mimeType: String(item?.mimeType || ''),
        uploadedAt: item?.uploadedAt ? new Date(item.uploadedAt) : new Date(),
      })) : [])
    : []

  return {
    allowedFields,
    medicalHistory: allowedFields.includes('medicalHistory') ? String(record.medicalHistory || '') : '',
    prescriptions: allowedFields.includes('prescriptions') ? String(record.prescriptions || '') : '',
    allergies: allowedFields.includes('allergies') ? String(record.allergies || '') : '',
    labResults,
  }
}

router.get('/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params
    const resolved = await getOrCreateRoom(roomId)
    if (resolved.error) return res.status(resolved.status || 400).json({ message: resolved.error })

    let { room, appointment } = resolved
    if (!isParticipant(req.user, room)) return res.status(403).json({ message: 'Forbidden' })

    const roomIsTerminal = ['completed', 'cancelled'].includes(String(room.status || '').toLowerCase())
    if (req.user?.role && !roomIsTerminal) {
      const joinedRoom = await markRoomParticipantJoined(room, req.user.role)
      if (joinedRoom) room = joinedRoom
    }

    const completedAppointment = await completeAppointmentForRoom(room, appointment, req?.app?.get('io')).catch((error) => {
      console.error('Failed to auto-complete consultation room:', error)
      return null
    })

    if (completedAppointment) {
      await createNurseAssignmentForCompletedAppointment({
        appointment: completedAppointment,
        room,
        io: req?.app?.get('io'),
      }).catch((error) => {
        console.error('Failed to create nurse assignment:', error)
      })
    }

    const consent = await getAcceptedConsent({
      patientId: room.patientId,
      doctorId: room.doctorId,
      appointmentId: room.appointmentId || appointment?.appointmentId,
    })

    const consentAccepted = Boolean(consent && String(consent.status) === 'accepted')
    const record = consentAccepted ? await HealthRecord.findOne({ patientRef: room.patientId }).lean() : null
    const recordPreview = consentAccepted ? getSharedRecordPreview(record, consent) : null

    return res.status(200).json({
      room,
      appointment,
      consent: consent
        ? {
            requestId: consent.requestId,
            status: consent.status,
            respondedAt: consent.respondedAt,
            sharedRecords: Array.isArray(consent.sharedRecords) ? consent.sharedRecords : [],
            sharedAttachments: Array.isArray(consent.sharedAttachments) ? consent.sharedAttachments : [],
          }
        : null,
      consentAccepted,
      recordPreview,
    })
  } catch (error) {
    console.error('Failed to fetch consultation room:', error)
    return res.status(500).json({ message: 'Failed to fetch consultation room' })
  }
})

router.patch('/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params
    const resolved = await getOrCreateRoom(roomId)
    if (resolved.error) return res.status(resolved.status || 400).json({ message: resolved.error })

    const { room, appointment } = resolved

    const body = req.body || {}
    const participantAction = String(body.participantAction || '').toLowerCase()
    const updates = {}

    if (participantAction) {
      const role = String(body.role || req.user?.role || '').toLowerCase()
      const joinField = getParticipantJoinField(role)
      const callType = normalizeCallType(body.callType)
      if (!joinField || !['join', 'end', 'request-call', 'approve-call', 'decline-call'].includes(participantAction)) {
        return res.status(400).json({ message: 'Invalid room participation request' })
      }

      const roomIsTerminal = ['completed', 'cancelled'].includes(String(room.status || '').toLowerCase())
      if (participantAction === 'join' && roomIsTerminal) {
        return res.status(409).json({ message: 'Room has already ended' })
      }

      if (String(process.env.DISABLE_AUTH || '') !== 'true') {
        const userId = String(req.user?.id || '')
        if (role === 'doctor' && userId !== String(room.doctorId || '')) {
          return res.status(403).json({ message: 'Only the assigned doctor can update this room' })
        }
        if (role === 'patient' && userId !== String(room.patientId || '')) {
          return res.status(403).json({ message: 'Only the assigned patient can update this room' })
        }
      }

      if (participantAction === 'join') {
        updates.status = 'active'
        if (!room[joinField]) updates[joinField] = new Date()
        if (!room.doctorJoinedAt || !room.patientJoinedAt) {
          if (room.doctorJoinedAt || joinField === 'doctorJoinedAt') updates.doctorJoinedAt = room.doctorJoinedAt || new Date()
          if (room.patientJoinedAt || joinField === 'patientJoinedAt') updates.patientJoinedAt = room.patientJoinedAt || new Date()
        }
        if (!room.bothJoinedAt && (updates.doctorJoinedAt || room.doctorJoinedAt) && (updates.patientJoinedAt || room.patientJoinedAt)) {
          updates.bothJoinedAt = new Date()
        }
      }

      if (participantAction === 'end') {
        updates.status = 'completed'
        updates.completedAt = new Date()
        updates.callRequestStatus = 'idle'
      }

      if (participantAction === 'request-call') {
        if (role !== 'doctor') {
          return res.status(403).json({ message: 'Only the assigned doctor can request a call switch' })
        }
        if (!callType) {
          return res.status(400).json({ message: 'Missing call type' })
        }
        updates.callRequestStatus = 'pending'
        updates.callRequestType = callType
        updates.callRequestedBy = String(req.user?.id || room.doctorId || '')
        updates.callRequestedAt = new Date()
        updates.callRespondedAt = null
      }

      if (participantAction === 'approve-call') {
        if (role !== 'patient') {
          return res.status(403).json({ message: 'Only the assigned patient can approve a call request' })
        }
        if (String(room.callRequestStatus || '') !== 'pending') {
          return res.status(409).json({ message: 'No pending call request to approve' })
        }
        updates.callRequestStatus = 'approved'
        updates.callRespondedAt = new Date()
      }

      if (participantAction === 'decline-call') {
        if (role !== 'patient') {
          return res.status(403).json({ message: 'Only the assigned patient can decline a call request' })
        }
        if (String(room.callRequestStatus || '') !== 'pending') {
          return res.status(409).json({ message: 'No pending call request to decline' })
        }
        updates.callRequestStatus = 'declined'
        updates.callRespondedAt = new Date()
      }

      const updatedRoom = await ConsultationRoom.findOneAndUpdate(
        { roomId: String(roomId || '').trim() },
        { $set: updates },
        { new: true },
      )

      if (participantAction === 'end') {
        await completeAppointmentForRoom(updatedRoom || room, appointment, req?.app?.get('io'), { forceComplete: true }).catch((error) => {
          console.error('Failed to complete appointment from room end:', error)
        })
      }

      if (participantAction === 'request-call' || participantAction === 'approve-call' || participantAction === 'decline-call') {
        const io = req?.app?.get('io')
        if (io && updatedRoom) {
          io.to(`appointments-doctor-${String(updatedRoom.doctorId)}`).emit('appointment-updated', { appointment })
          io.to(`appointments-patient-${String(updatedRoom.patientId)}`).emit('appointment-updated', { appointment })
        }
      }

      return res.status(200).json({
        room: updatedRoom,
        healthRecordUpdated: false,
        healthRecordSkippedReason: '',
      })
    }

    if (String(process.env.DISABLE_AUTH || '') !== 'true') {
      if (req.user?.role !== 'doctor' || String(req.user?.id || '') !== String(room.doctorId || '')) {
        return res.status(403).json({ message: 'Only the assigned doctor can update this room' })
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'date')) {
      const parsedDate = new Date(body.date)
      if (!Number.isNaN(parsedDate.getTime())) updates.date = parsedDate
    }

    if (Object.prototype.hasOwnProperty.call(body, 'status')) {
      const status = String(body.status || '').toLowerCase()
      if (['scheduled', 'active', 'completed', 'cancelled'].includes(status)) {
        updates.status = status
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'notes')) {
      updates.notes = String(body.notes || '')
    }

    if (Object.prototype.hasOwnProperty.call(body, 'prescription')) {
      updates.prescription = String(body.prescription || '')
    }

    if (Object.prototype.hasOwnProperty.call(body, 'allergies')) {
      updates.allergies = String(body.allergies || '')
    }

    if (Object.prototype.hasOwnProperty.call(body, 'files')) {
      updates.files = sanitizeFiles(body.files)
    }

    const updatedRoom = await ConsultationRoom.findOneAndUpdate(
      { roomId: String(roomId || '').trim() },
      { $set: updates },
      { new: true },
    )

    const shouldSync = body.syncToHealthRecord !== false
    let healthRecordUpdated = false
    let healthRecordSkippedReason = ''

    if (shouldSync) {
      const consent = await getAcceptedConsent({
        patientId: room.patientId,
        doctorId: room.doctorId,
        appointmentId: room.appointmentId,
      })

      if (!consent || String(consent.status) !== 'accepted') {
        healthRecordSkippedReason = 'Consent has not been accepted for this appointment'
      } else {
        const record = (await HealthRecord.findOne({ patientRef: room.patientId })) || new HealthRecord({ patientRef: room.patientId })

        if (Object.prototype.hasOwnProperty.call(updates, 'notes')) {
          const noteText = String(updates.notes || '').trim()
          if (noteText) {
            const entry = `[${new Date().toLocaleString()}] Consultation note by Doctor ${room.doctorId}: ${noteText}`
            record.medicalHistory = String(record.medicalHistory || '').trim()
              ? `${String(record.medicalHistory || '').trim()}\n\n${entry}`
              : entry
          }
        }

        if (Object.prototype.hasOwnProperty.call(updates, 'prescription')) {
          record.prescriptions = String(updates.prescription || '').trim()
        }

        if (Object.prototype.hasOwnProperty.call(updates, 'allergies')) {
          record.allergies = String(updates.allergies || '').trim()
        }

        await record.save()
        healthRecordUpdated = true
      }
    }

    return res.status(200).json({
      room: updatedRoom,
      healthRecordUpdated,
      healthRecordSkippedReason,
    })
  } catch (error) {
    console.error('Failed to update consultation room:', error)
    return res.status(500).json({ message: 'Failed to update consultation room' })
  }
})

module.exports = router
