const { nanoid } = require('nanoid')
const Nurse = require('../models/privateHealthWorker/nurse/privateNurseRegistration')
const NurseAssignment = require('../models/privateHealthWorker/nurse/nurseAssignment')
const Patient = require('../models/patient/patientRegistration')
const PatientNotification = require('../models/patient/patientNotification')
const HealthRecord = require('../models/patient/healthRecord')
const { inferSpecialtyFromReason, buildSpecialtyMatcher } = require('../ai-components/appointmentReasoning')

const GENERAL_CARE_MATCHER = /(general\s*care|general\s*medicine|family\s*care|home\s*care|community\s*health|primary\s*care|gp|nurse)/i
const MAX_ACTIVE_ASSIGNMENTS_PER_NURSE = 5

function buildCareWindow(now = new Date()) {
  const careWeekStart = new Date(now)
  careWeekStart.setHours(0, 0, 0, 0)

  const careWeekEnd = new Date(careWeekStart)
  careWeekEnd.setDate(careWeekEnd.getDate() + 7)

  return { careWeekStart, careWeekEnd }
}

function mergeSessionReason(appointment, healthRecord) {
  return [
    appointment?.reason,
    appointment?.triageSummary,
    healthRecord?.medicalHistory,
    healthRecord?.prescriptions,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim())
    .join(' ')
}

function sortNursesByLoadAndExperience(nurses, loadMap) {
  return [...nurses].sort((left, right) => {
    const loadLeft = loadMap.get(String(left.uid)) || 0
    const loadRight = loadMap.get(String(right.uid)) || 0
    if (loadLeft !== loadRight) return loadLeft - loadRight

    const expLeft = Number(left.yearsOfExperience) || 0
    const expRight = Number(right.yearsOfExperience) || 0
    if (expLeft !== expRight) return expRight - expLeft

    return String(left.nurseFirstName || '').localeCompare(String(right.nurseFirstName || ''))
  })
}

async function getActiveAssignmentLoadMap(nurseIds, now = new Date()) {
  if (!Array.isArray(nurseIds) || nurseIds.length === 0) return new Map()

  const rows = await NurseAssignment.aggregate([
    {
      $match: {
        nurseId: { $in: nurseIds },
        status: { $nin: ['completed', 'cancelled'] },
        careWeekEnd: { $gte: now },
      },
    },
    {
      $group: {
        _id: '$nurseId',
        count: { $sum: 1 },
      },
    },
  ])

  return new Map(rows.map((row) => [String(row._id), Number(row.count) || 0]))
}

function serializeNurseAssignment(assignment) {
  if (!assignment) return null

  const nurseName = String(assignment.nurseName || '').trim()
  const patientName = String(assignment.patientName || '').trim()
  const condition = String(assignment.condition || '').trim()
  const drug = String(assignment.drug || '').trim()

  return {
    ...assignment,
    title: 'Weekly patient care assignment',
    task: 'Follow-up care and assistance',
    note: condition || drug ? 'Review the patient care plan below.' : 'Follow the assigned patient for the week.',
    patient: {
      patientId: assignment.patientId,
      patientName,
      patientPhone: assignment.patientPhone || '',
    },
    carePlan: {
      condition,
      drug,
      aiSpecialty: assignment.specialization || '',
      aiSummary: assignment.aiSummary || '',
      aiMatchedTerms: Array.isArray(assignment.aiMatchedTerms) ? assignment.aiMatchedTerms : [],
      aiConfidence: Number(assignment.aiConfidence) || 0,
      selectionReason: assignment.selectionReason || '',
    },
    schedule: {
      weekStart: assignment.careWeekStart,
      weekEnd: assignment.careWeekEnd,
    },
    nurse: {
      nurseId: assignment.nurseId,
      nurseName,
      specialization: assignment.specialization || '',
    },
  }
}

async function resolveNurseAssignmentPlan({ reason, healthRecord, excludeNurseId = null }) {
  const combinedReason = mergeSessionReason({ reason }, healthRecord)
  const inference = inferSpecialtyFromReason(combinedReason)
  const specialtyMatcher = buildSpecialtyMatcher(inference)
  const excludedIds = new Set(
    Array.isArray(excludeNurseId)
      ? excludeNurseId.map((value) => String(value)).filter(Boolean)
      : excludeNurseId
        ? [String(excludeNurseId)]
        : [],
  )

  const nurseFilter = {
    role: 'nurse',
    isVerified: true,
    isAvailable: { $ne: false },
  }

  if (excludedIds.size > 0) {
    nurseFilter.uid = { $nin: [...excludedIds] }
  }

  const candidatePools = []
  let assignmentPool = 'specialty'
  let usedGeneralFallback = false
  let selectionReason = ''

  const specialtyNurses = specialtyMatcher
    ? await Nurse.find({ ...nurseFilter, specialization: specialtyMatcher })
      .select('uid nurseFirstName nurseLastName specialization yearsOfExperience isAvailable')
      .lean()
    : []

  candidatePools.push({ label: 'specialty', nurses: specialtyNurses })

  if (!specialtyNurses.length) {
    const generalCareNurses = await Nurse.find({ ...nurseFilter, specialization: GENERAL_CARE_MATCHER })
      .select('uid nurseFirstName nurseLastName specialization yearsOfExperience isAvailable')
      .lean()
    candidatePools.push({ label: 'general-care', nurses: generalCareNurses })
    assignmentPool = 'general-care'
    usedGeneralFallback = true
    selectionReason = 'No nurse matched the requested specialty, so a general-care nurse was chosen.'
  }

  const fallbackNurses = await Nurse.find(nurseFilter)
    .select('uid nurseFirstName nurseLastName specialization yearsOfExperience isAvailable')
    .lean()
  candidatePools.push({ label: 'any-available', nurses: fallbackNurses })

  let candidateNurses = specialtyNurses
  if (!candidateNurses.length) candidateNurses = candidatePools.find((pool) => pool.label === 'general-care')?.nurses || []
  if (!candidateNurses.length) {
    candidateNurses = fallbackNurses
    assignmentPool = 'any-available'
    selectionReason = 'No nurse matched the requested specialty, so the next available verified nurse was chosen.'
  }

  if (!candidateNurses.length) {
    return {
      error: 'No available nurse found. Please try again later.',
      statusCode: 409,
      inference,
      assignmentPool,
      usedGeneralFallback,
    }
  }

  const now = new Date()
  const loadMap = await getActiveAssignmentLoadMap(candidateNurses.map((nurse) => String(nurse.uid)), now)
  const eligibleNurses = candidateNurses.filter((nurse) => (loadMap.get(String(nurse.uid)) || 0) < MAX_ACTIVE_ASSIGNMENTS_PER_NURSE)

  if (!eligibleNurses.length) {
    return {
      error: 'No available nurse has remaining weekly capacity.',
      statusCode: 409,
      inference,
      assignmentPool,
      usedGeneralFallback,
      debug: {
        candidateCount: candidateNurses.length,
        maxActiveAssignmentsPerNurse: MAX_ACTIVE_ASSIGNMENTS_PER_NURSE,
      },
    }
  }

  const selectedNurse = sortNursesByLoadAndExperience(eligibleNurses, loadMap)[0]

  return {
    inference,
    selectedNurse,
    assignmentPool,
    usedGeneralFallback,
    selectionReason,
    debug: {
      candidateCount: candidateNurses.length,
      eligibleCount: eligibleNurses.length,
      selectedNurseLoad: loadMap.get(String(selectedNurse.uid)) || 0,
      maxActiveAssignmentsPerNurse: MAX_ACTIVE_ASSIGNMENTS_PER_NURSE,
    },
  }
}

async function createNurseAssignmentForCompletedAppointment({ appointment, room = null, io = null } = {}) {
  if (!appointment) return null

  const sourceAppointmentId = String(appointment.appointmentId || appointment._id || '').trim()
  if (!sourceAppointmentId) return null

  const existing = await NurseAssignment.findOne({ sourceAppointmentId }).lean()
  if (existing) return serializeNurseAssignment(existing)

  const healthRecord = await HealthRecord.findOne({ patientRef: String(appointment.patientId || '') }).lean()
  const reason = mergeSessionReason(appointment, healthRecord)
  const plan = await resolveNurseAssignmentPlan({ reason, healthRecord })

  if (plan.error) {
    return { error: plan.error, statusCode: plan.statusCode || 409, inference: plan.inference, debug: plan.debug || {} }
  }

  const now = new Date()
  const { careWeekStart, careWeekEnd } = buildCareWindow(now)
  const nurseName = [plan.selectedNurse?.nurseFirstName, plan.selectedNurse?.nurseLastName].filter(Boolean).join(' ').trim()
  const assignmentDoc = await NurseAssignment.create({
    assignmentId: `NASG-${nanoid(10).toUpperCase()}`,
    sourceAppointmentId,
    roomId: String(room?.roomId || appointment.roomId || ''),
    patientId: String(appointment.patientId || ''),
    patientName: String(appointment.patientName || 'Patient').trim(),
    patientPhone: String(appointment.patientPhone || '').trim(),
    nurseId: String(plan.selectedNurse.uid),
    nurseName,
    specialization: plan.inference.specialtyLabel,
    condition: String(appointment.reason || healthRecord?.medicalHistory || plan.inference.summary || '').trim(),
    drug: String(healthRecord?.prescriptions || '').trim(),
    careWeekStart,
    careWeekEnd,
    status: 'active',
    sourceReason: reason,
    aiSummary: plan.inference.summary,
    aiMatchedTerms: Array.isArray(plan.inference.matchedTerms) ? plan.inference.matchedTerms : [],
    aiConfidence: Number(plan.inference.confidence) || 0,
    selectionReason: plan.selectionReason || '',
  })

  const assignment = serializeNurseAssignment(assignmentDoc.toObject())
  if (io && assignment?.nurse?.nurseId) {
    io.to(`assignments-nurse-${String(assignment.nurse.nurseId)}`).emit('assignment-created', { assignment })
  }

  try {
    const patient = await Patient.findOne({ patientId: String(assignment.patient.patientId) }).select('patientFirstName patientLastName').lean()
    const patientName = [patient?.patientFirstName, patient?.patientLastName].filter(Boolean).join(' ').trim() || assignment.patient.patientName || 'Patient'
    const message = plan.selectionReason
      ? `${assignment.nurse.nurseName} was assigned to follow up on your care. ${plan.selectionReason}`
      : `${assignment.nurse.nurseName} was assigned to follow up on your care.`

    const patientNotification = await PatientNotification.create({
      notificationId: `PNOT-${nanoid(10).toUpperCase()}`,
      patientId: String(assignment.patient.patientId),
      type: 'assignment',
      title: 'New nurse assignment',
      message,
      relatedTo: assignment.assignmentId,
      priority: plan.selectionReason ? 'high' : 'normal',
      actionUrl: `/secure/patient-assignment?assignmentId=${encodeURIComponent(assignment.assignmentId)}`,
    })

    if (io) {
      io.to(`notifications-patient-${String(assignment.patient.patientId)}`).emit('patient-notification-created', {
        notification: {
          notificationId: patientNotification.notificationId,
          patientId: patientNotification.patientId,
          type: patientNotification.type,
          title: patientNotification.title,
          message: patientNotification.message,
          relatedTo: patientNotification.relatedTo,
          isRead: patientNotification.isRead,
          priority: patientNotification.priority,
          actionUrl: patientNotification.actionUrl,
          createdAt: patientNotification.createdAt,
          readAt: patientNotification.readAt,
        },
        patientName,
        assignment,
      })
    }
  } catch (notificationError) {
    console.error('Failed to create patient assignment notification:', notificationError)
  }

  return assignment
}

async function listAssignmentsForNurse(nurseId) {
  const assignments = await NurseAssignment.find({
    nurseId: String(nurseId || ''),
    status: { $nin: ['completed', 'cancelled'] },
  })
    .sort({ careWeekStart: -1, createdAt: -1 })
    .lean()

  return assignments.map(serializeNurseAssignment)
}

module.exports = {
  createNurseAssignmentForCompletedAppointment,
  listAssignmentsForNurse,
  resolveNurseAssignmentPlan,
  serializeNurseAssignment,
}