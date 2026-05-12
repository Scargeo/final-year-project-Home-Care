const express = require('express')
const router = express.Router()
const { nanoid } = require('nanoid')
const Appointment = require('../../../models/privateHealthWorker/doctor/appointment')
const PatientQueue = require('../../../models/privateHealthWorker/doctor/patientQueue')
const DoctorNotification = require('../../../models/privateHealthWorker/doctor/doctorNotification')
const Doctor = require('../../../models/privateHealthWorker/doctor/doctorRegistration')
const ConsentRequest = require('../../../models/patient/consentRequest')
const { inferSpecialtyFromReason, buildSpecialtyMatcher } = require('../../../ai-components/appointmentReasoning')
const { registerDoctor, loginDoctor } = require('../../../middleware/doctorController')
const doctorSettingsRoute = require('./doctorSettingsRoute')

const GENERAL_PRACTICE_MATCHER = /(general\s*practice|general\s*medicine|family\s*medicine|gp)/i

function buildAppointmentDateTime(appointmentDate, appointmentTime) {
  const parsedDate = new Date(appointmentDate)
  if (Number.isNaN(parsedDate.getTime())) return null

  const [hours = 0, minutes = 0] = String(appointmentTime || '')
    .split(':')
    .map((value) => Number.parseInt(value, 10))

  const dateTime = new Date(parsedDate)
  dateTime.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0)
  return dateTime
}

function getEffectiveAppointmentStatus(appointment, now = new Date()) {
  const baseStatus = String(appointment?.status || '').toLowerCase()
  if (['completed', 'no-show', 'cancelled'].includes(baseStatus)) return baseStatus

  const appointmentDateTime = buildAppointmentDateTime(appointment?.appointmentDate, appointment?.appointmentTime)
  if (!appointmentDateTime) return baseStatus || 'scheduled'

  const sameDay = appointmentDateTime.toDateString() === now.toDateString()
  const minutesLate = (now.getTime() - appointmentDateTime.getTime()) / (60 * 1000)
  const withinGrace = sameDay && minutesLate >= 0 && minutesLate <= 10

  if (appointmentDateTime < now && !withinGrace) return 'no-show'
  return baseStatus || 'scheduled'
}

function compareByDateTimeAsc(a, b) {
  const aTime = buildAppointmentDateTime(a?.appointmentDate, a?.appointmentTime)?.getTime() || 0
  const bTime = buildAppointmentDateTime(b?.appointmentDate, b?.appointmentTime)?.getTime() || 0
  return aTime - bTime
}

function compareByDateTimeDesc(a, b) {
  return compareByDateTimeAsc(b, a)
}

function sortDoctorsByWorkloadAndExperience(doctors, workloadMap) {
  return [...doctors].sort((a, b) => {
    const loadA = workloadMap.get(String(a.doctorId)) || 0
    const loadB = workloadMap.get(String(b.doctorId)) || 0
    if (loadA !== loadB) return loadA - loadB

    const expA = Number(a.yearsOfExperience) || 0
    const expB = Number(b.yearsOfExperience) || 0
    if (expA !== expB) return expB - expA

    return String(a.doctorFirstName || '').localeCompare(String(b.doctorFirstName || ''))
  })
}

async function _getAvailableDoctorsForSlot(doctors, slotStart, slotEnd, appointmentTime) {
  const doctorIds = doctors.map((doctor) => String(doctor.doctorId))
  if (!doctorIds.length) {
    return { availableDoctors: [], busyDoctorIds: new Set() }
  }

  const busyAtRequestedTime = await Appointment.find({
    doctorId: { $in: doctorIds },
    appointmentDate: { $gte: slotStart, $lt: slotEnd },
    appointmentTime,
    status: { $in: ['scheduled', 'in-progress'] },
  })
    .select('doctorId')
    .lean()

  const busyDoctorIds = new Set(busyAtRequestedTime.map((appointment) => String(appointment.doctorId)))
  const availableDoctors = doctors.filter((doctor) => !busyDoctorIds.has(String(doctor.doctorId)))

  return { availableDoctors, busyDoctorIds }
}

async function getWorkloadMap(doctorIds, slotStart, slotEnd) {
  if (!doctorIds.length) return new Map()

  const workloadRows = await Appointment.aggregate([
    {
      $match: {
        doctorId: { $in: doctorIds },
        appointmentDate: { $gte: slotStart, $lt: slotEnd },
        status: { $in: ['scheduled', 'in-progress'] },
      },
    },
    {
      $group: {
        _id: '$doctorId',
        count: { $sum: 1 },
      },
    },
  ])

  return new Map(workloadRows.map((row) => [String(row._id), Number(row.count) || 0]))
}

async function resolveAssignmentPlan({ appointmentDate, patientReason, excludeDoctorId = null }) {
  const parsedAppointmentDate = new Date(appointmentDate)
  if (Number.isNaN(parsedAppointmentDate.getTime())) {
    return { error: 'Invalid appointment date', statusCode: 400 }
  }

  const excludedDoctorIds = new Set(
    Array.isArray(excludeDoctorId)
      ? excludeDoctorId.map((value) => String(value)).filter(Boolean)
      : excludeDoctorId
        ? [String(excludeDoctorId)]
        : [],
  )

  const doctorFilter = excludedDoctorIds.size > 0 ? { doctorId: { $nin: [...excludedDoctorIds] } } : {}

  const inference = inferSpecialtyFromReason(patientReason)
  const specialtyMatcher = buildSpecialtyMatcher(inference)
  const slotStart = new Date(parsedAppointmentDate)
  slotStart.setHours(0, 0, 0, 0)
  const slotEnd = new Date(slotStart)
  slotEnd.setDate(slotEnd.getDate() + 1)

  // Stage 1: inferred specialty pool.
  const specialtyDoctors = specialtyMatcher
    ? await Doctor.find({ role: 'doctor', isVerified: true, isAvailable: { $ne: false }, specialization: specialtyMatcher, ...doctorFilter })
      .select('doctorId doctorFirstName doctorLastName specialization yearsOfExperience isAvailable')
      .lean()
    : []

  const specialtyDoctorsList = specialtyDoctors.map((d) => ({ doctorId: d.doctorId, specialization: d.specialization, isAvailable: d.isAvailable !== false }))
  let generalPracticeDoctorsList = []

  // For assignment we consider only the doctor's `isAvailable` flag and ignore slot conflicts.
  // This allows assigning to any doctor who marked themselves available even if they have
  // appointments at the same time.
  let candidateDoctors = specialtyDoctors
  let assignmentPool = 'specialty'
  let usedGeneralPracticeFallback = false

  // Stage 2: when specialty has no available doctor, fallback to General Practice only.
  if (!candidateDoctors.length) {
    const generalPracticeDoctors = await Doctor.find({
      role: 'doctor',
      isVerified: true,
      isAvailable: { $ne: false },
      specialization: GENERAL_PRACTICE_MATCHER,
      ...doctorFilter,
    })
      .select('doctorId doctorFirstName doctorLastName specialization yearsOfExperience')
      .lean()

    generalPracticeDoctorsList = generalPracticeDoctors.map((d) => ({ doctorId: d.doctorId, specialization: d.specialization, isAvailable: d.isAvailable !== false }))

    // Fallback: assign to any available GP regardless of time conflicts.
    candidateDoctors = generalPracticeDoctors
    assignmentPool = 'general-practice'
    usedGeneralPracticeFallback = true
  }

  if (!candidateDoctors.length) {
    return {
      error: 'No available doctor found. Please try again later.',
      statusCode: 409,
      inference,
      debug: {
        assignmentPool,
        usedGeneralPracticeFallback,
        inferredSpecialtyDoctorCount: specialtyDoctors.length,
        specialtyDoctors: specialtyDoctorsList,
        generalPracticeDoctors: (typeof generalPracticeDoctorsList !== 'undefined') ? generalPracticeDoctorsList : [],
      },
    }
  }

  const workloadMap = await getWorkloadMap(
    candidateDoctors.map((doctor) => String(doctor.doctorId)),
    slotStart,
    slotEnd,
  )

  const sortedDoctors = sortDoctorsByWorkloadAndExperience(candidateDoctors, workloadMap)
  const selectedDoctor = sortedDoctors[0]

  return {
    parsedAppointmentDate,
    slotStart,
    slotEnd,
    inference,
    selectedDoctor,
    assignmentPool,
    usedGeneralPracticeFallback,
    debug: {
      inferredSpecialtyDoctorCount: specialtyDoctors.length,
      // Time-availability checks are intentionally skipped for assignment (we honor isAvailable only).
      candidateDoctorCount: candidateDoctors.length,
      selectedDoctorLoad: workloadMap.get(String(selectedDoctor.doctorId)) || 0,
      specialtyDoctors: specialtyDoctorsList,
      generalPracticeDoctors: (typeof generalPracticeDoctorsList !== 'undefined') ? generalPracticeDoctorsList : [],
    },
  }
}

// Doctor authentication routes
router.post('/register', registerDoctor)
router.post('/login', loginDoctor)

// Public doctor directory for patient booking
router.get('/', async (req, res) => {
  try {
    const doctors = await Doctor.find({ role: 'doctor', isVerified: true })
      .select('doctorId doctorFirstName doctorLastName doctorPhone doctorAddress specialization yearsOfExperience profileImage isVerified isAvailable')
      .sort({ doctorFirstName: 1, doctorLastName: 1 })
      .lean()

    res.status(200).json({
      doctors: doctors.map((doctor) => ({
        doctorId: doctor.doctorId,
        doctorFirstName: doctor.doctorFirstName,
        doctorLastName: doctor.doctorLastName,
        doctorName: [doctor.doctorFirstName, doctor.doctorLastName].filter(Boolean).join(' ').trim(),
        doctorPhone: doctor.doctorPhone,
        doctorAddress: doctor.doctorAddress,
        specialization: doctor.specialization,
        yearsOfExperience: doctor.yearsOfExperience || 0,
        profileImage: doctor.profileImage || null,
        isVerified: Boolean(doctor.isVerified),
        isAvailable: doctor.isAvailable !== false,
      })),
    })
  } catch (error) {
    console.error('Failed to fetch doctors:', error)
    res.status(500).json({ message: 'Failed to fetch doctors' })
  }
})

// Get doctor dashboard data
router.get('/:doctorId/dashboard', async (req, res) => {
  try {
    const { doctorId } = req.params

    if (!doctorId) {
      return res.status(400).json({ message: 'Doctor ID is required' })
    }

    // Get today's date range
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Get today's appointments - excluding cancelled
    const todaysAppointmentsRaw = await Appointment.find({
      doctorId,
      appointmentDate: {
        $gte: today,
        $lt: tomorrow,
      },
      status: { $ne: 'cancelled' }
    })
      .sort({ appointmentTime: 1 })
      .limit(10)
      .lean()

    const appointmentIds = todaysAppointmentsRaw
      .map((appointment) => String(appointment?.appointmentId || ''))
      .filter(Boolean)

    const consentByAppointmentId = new Map()
    if (appointmentIds.length > 0) {
      const consentRequests = await ConsentRequest.find({
        doctorId: String(doctorId),
        appointmentId: { $in: appointmentIds },
      })
        .select('appointmentId requestId status message respondedAt updatedAt')
        .sort({ updatedAt: -1 })
        .lean()

      for (const request of consentRequests) {
        const appointmentKey = String(request?.appointmentId || '')
        if (!appointmentKey || consentByAppointmentId.has(appointmentKey)) continue
        consentByAppointmentId.set(appointmentKey, request)
      }
    }

    const now = new Date()
    const todaysAppointments = todaysAppointmentsRaw.map((appointment) => {
      const appointmentKey = String(appointment?.appointmentId || '')
      const consent = consentByAppointmentId.get(appointmentKey)
      const effectiveStatus = getEffectiveAppointmentStatus(appointment, now)

      return {
        ...appointment,
        status: effectiveStatus,
        consentStatus: consent ? String(consent.status || '') : '',
        consentRequestId: consent ? String(consent.requestId || '') : '',
        consentMessage: consent ? String(consent.message || '') : '',
        consentRespondedAt: consent?.respondedAt || null,
      }
    }).filter((appointment) => !['cancelled', 'completed'].includes(String(appointment?.status || '').toLowerCase()))

    // Sort to show accepted appointments first, missed later, then by time
    todaysAppointments.sort((a, b) => {
      const statusA = String(a?.status || '').toLowerCase()
      const statusB = String(b?.status || '').toLowerCase()
      
      // Accepted appointments come first
      if (statusA === 'accepted' && statusB !== 'accepted') return -1
      if (statusA !== 'accepted' && statusB === 'accepted') return 1

      // Missed appointments go after active appointments
      if (statusA === 'no-show' && statusB !== 'no-show') return 1
      if (statusA !== 'no-show' && statusB === 'no-show') return -1
      
      // If same status, sort by time
      const timeA = String(a?.appointmentTime || '')
      const timeB = String(b?.appointmentTime || '')
      return timeA.localeCompare(timeB)
    })

    // Get patient queue
    const patientQueue = await PatientQueue.find({
      doctorId,
      status: { $in: ['waiting', 'in-consultation'] },
    })
      .sort({ queuePosition: 1 })
      .limit(20)

    // Get unread notifications
    const notifications = await DoctorNotification.find({
      doctorId,
      isRead: false,
    })
      .sort({ createdAt: -1 })
      .limit(10)

    // Get recent appointments (completed today or yesterday)
    const recentActivity = await Appointment.find({
      doctorId,
      status: 'completed',
      appointmentDate: {
        $gte: new Date(today.getTime() - 48 * 60 * 60 * 1000),
        $lt: tomorrow,
      },
    })
      .sort({ updatedAt: -1 })
      .limit(10)

    // Calculate dashboard stats
    const stats = {
      todayAppointments: todaysAppointments.length,
      queueCount: patientQueue.length,
      unreadNotifications: notifications.length,
      completedToday: recentActivity.filter((a) => {
        const actDate = new Date(a.appointmentDate)
        return (
          actDate.toDateString() === today.toDateString()
        )
      }).length,
    }

    const doctor = await Doctor.findOne({ doctorId }).select('-doctorPassword')

    res.status(200).json({
      stats,
      todaysAppointments,
      patientQueue,
      notifications,
      recentActivity,
      doctor: doctor
        ? {
            doctorId: doctor.doctorId,
            doctorFirstName: doctor.doctorFirstName,
            doctorLastName: doctor.doctorLastName,
            doctorEmail: doctor.doctorEmail,
            doctorPhone: doctor.doctorPhone,
            doctorAddress: doctor.doctorAddress,
            specialization: doctor.specialization,
            licenseNumber: doctor.licenseNumber,
            yearsOfExperience: doctor.yearsOfExperience,
            profileImage: doctor.profileImage,
            isVerified: doctor.isVerified,
            role: doctor.role,
            createdAt: doctor.createdAt,
          }
        : null,
    })
  } catch (error) {
    console.error('Failed to fetch dashboard data:', error)
    res.status(500).json({ message: 'Failed to fetch dashboard data' })
  }
})

// Get appointments for a specific date
router.get('/:doctorId/appointments/:date', async (req, res) => {
  try {
    const { doctorId, date } = req.params

    if (!doctorId || !date) {
      return res.status(400).json({ message: 'Doctor ID and date are required' })
    }

    const appointmentDate = new Date(date)
    appointmentDate.setHours(0, 0, 0, 0)
    const nextDay = new Date(appointmentDate)
    nextDay.setDate(nextDay.getDate() + 1)

    const appointments = await Appointment.find({
      doctorId,
      appointmentDate: {
        $gte: appointmentDate,
        $lt: nextDay,
      },
    }).sort({ appointmentTime: 1 })

    res.status(200).json(appointments)
  } catch (error) {
    console.error('Failed to fetch appointments:', error)
    res.status(500).json({ message: 'Failed to fetch appointments' })
  }
})

// Get patient queue
router.get('/:doctorId/queue', async (req, res) => {
  try {
    const { doctorId } = req.params

    if (!doctorId) {
      return res.status(400).json({ message: 'Doctor ID is required' })
    }

    const queue = await PatientQueue.find({
      doctorId,
      status: { $in: ['waiting', 'in-consultation'] },
    }).sort({ queuePosition: 1 })

    res.status(200).json(queue)
  } catch (error) {
    console.error('Failed to fetch queue:', error)
    res.status(500).json({ message: 'Failed to fetch queue' })
  }
})

// Get notifications
router.get('/:doctorId/notifications', async (req, res) => {
  try {
    const { doctorId } = req.params
    const { limit = 20, skip = 0 } = req.query

    if (!doctorId) {
      return res.status(400).json({ message: 'Doctor ID is required' })
    }

    const notifications = await DoctorNotification.find({ doctorId })
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))

    const total = await DoctorNotification.countDocuments({ doctorId })

    res.status(200).json({ notifications, total })
  } catch (error) {
    console.error('Failed to fetch notifications:', error)
    res.status(500).json({ message: 'Failed to fetch notifications' })
  }
})

// Mark notification as read
router.patch('/:doctorId/notifications/:notificationId', async (req, res) => {
  try {
    const { doctorId, notificationId } = req.params

    const notification = await DoctorNotification.findOneAndUpdate(
      { notificationId, doctorId },
      {
        isRead: true,
        readAt: new Date(),
      },
      { new: true },
    )

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' })
    }

    res.status(200).json(notification)
  } catch (error) {
    console.error('Failed to update notification:', error)
    res.status(500).json({ message: 'Failed to update notification' })
  }
})

// Get all appointments for a doctor (history)
router.get('/:doctorId/appointments-history', async (req, res) => {
  try {
    const { doctorId } = req.params
    const { status = 'all', limit = 100, skip = 0 } = req.query

    if (!doctorId) {
      return res.status(400).json({ message: 'Doctor ID is required' })
    }

    const skip_num = parseInt(skip) || 0
    const limit_num = parseInt(limit) || 100

    const now = new Date()
    const allAppointmentsRaw = await Appointment.find({ doctorId }).lean()
    const allAppointments = allAppointmentsRaw.map((appointment) => ({
      ...appointment,
      status: getEffectiveAppointmentStatus(appointment, now),
    }))

    const pendingAppointments = allAppointments
      .filter((appointment) => ['scheduled', 'accepted', 'in-progress'].includes(String(appointment?.status || '').toLowerCase()))
      .sort(compareByDateTimeAsc)

    const pastAppointments = allAppointments
      .filter((appointment) => ['completed', 'no-show', 'cancelled'].includes(String(appointment?.status || '').toLowerCase()))
      .sort(compareByDateTimeDesc)

    let selectedAppointments = []
    if (status === 'pending') {
      selectedAppointments = pendingAppointments
    } else if (status === 'past') {
      selectedAppointments = pastAppointments
    } else {
      selectedAppointments = [...pendingAppointments, ...pastAppointments]
    }

    const total = selectedAppointments.length
    const appointments = selectedAppointments.slice(skip_num, skip_num + limit_num)

    res.status(200).json({
      appointments,
      total,
      skip: skip_num,
      limit: limit_num,
      status,
    })
  } catch (error) {
    console.error('Failed to fetch appointment history:', error)
    res.status(500).json({ message: 'Failed to fetch appointment history' })
  }
})

// Debug endpoint for assignment auditability.
// It explains which specialty was inferred, what fallback pool was used, and which doctor would be selected.
router.post('/appointments/auto-assign/debug', async (req, res) => {
  try {
    const { appointmentDate, appointmentTime, reason } = req.body
    const patientReason = String(reason || '').trim()

    if (!appointmentDate || !appointmentTime || !patientReason) {
      return res.status(400).json({ message: 'appointmentDate, appointmentTime, and reason are required' })
    }

    const plan = await resolveAssignmentPlan({
      appointmentDate,
      appointmentTime,
      patientReason,
    })

    if (plan.error) {
      return res.status(plan.statusCode || 400).json({
        message: plan.error,
        assignment: {
          specialty: plan.inference?.specialtyLabel || 'General Medicine',
          confidence: plan.inference?.confidence || 0,
          matchedTerms: plan.inference?.matchedTerms || [],
          summary: plan.inference?.summary || 'No inference summary available.',
          assignmentPool: plan.debug?.assignmentPool || 'none',
          usedGeneralPracticeFallback: Boolean(plan.debug?.usedGeneralPracticeFallback),
        },
        debug: plan.debug || {},
      })
    }

    return res.status(200).json({
      assignment: {
        specialty: plan.inference.specialtyLabel,
        confidence: plan.inference.confidence,
        matchedTerms: plan.inference.matchedTerms,
        summary: plan.inference.summary,
        assignmentPool: plan.assignmentPool,
        usedGeneralPracticeFallback: plan.usedGeneralPracticeFallback,
      },
      selectedDoctor: {
        doctorId: plan.selectedDoctor.doctorId,
        doctorFirstName: plan.selectedDoctor.doctorFirstName,
        doctorLastName: plan.selectedDoctor.doctorLastName,
        doctorName: [plan.selectedDoctor.doctorFirstName, plan.selectedDoctor.doctorLastName].filter(Boolean).join(' ').trim(),
        specialization: plan.selectedDoctor.specialization,
      },
      debug: plan.debug,
    })
  } catch (error) {
    console.error('Failed to generate auto-assignment debug report:', error)
    return res.status(500).json({ message: 'Failed to generate assignment debug report' })
  }
})

// Create appointment with automatic doctor assignment.
// The reasoning engine maps symptom text to a specialty, then we pick a free doctor.
router.post('/appointments/auto-assign', async (req, res) => {
  try {
    const {
      appointmentId,
      patientId,
      patientName,
      patientPhone,
      appointmentDate,
      appointmentTime,
      duration,
      reason,
      consultationType,
    } = req.body

    if (!patientId || !patientName || !appointmentDate || !appointmentTime) {
      return res.status(400).json({ message: 'Missing required fields' })
    }

    const patientReason = String(reason || '').trim()
    if (!patientReason) {
      return res.status(400).json({ message: 'Please describe why you are booking this appointment' })
    }

    const resolvedAppointmentId = appointmentId ? String(appointmentId).trim() : `APT-${nanoid(10).toUpperCase()}`
    const resolvedConsultationType = ['messaging', 'video', 'phone'].includes(String(consultationType))
      ? String(consultationType)
      : 'messaging'

    const plan = await resolveAssignmentPlan({
      appointmentDate,
      appointmentTime,
      patientReason,
    })

    if (plan.error) {
      return res.status(plan.statusCode || 400).json({
        message: plan.error,
        assignment: {
          specialty: plan.inference?.specialtyLabel || 'General Medicine',
          confidence: plan.inference?.confidence || 0,
          matchedTerms: plan.inference?.matchedTerms || [],
          summary: plan.inference?.summary || 'No inference summary available.',
          assignmentPool: plan.debug?.assignmentPool || 'none',
          usedGeneralPracticeFallback: Boolean(plan.debug?.usedGeneralPracticeFallback),
        },
      })
    }

    const selectedDoctor = plan.selectedDoctor
    // Guard against race conditions: doctor could switch to unavailable after selection but before insert.
    const latestDoctorState = await Doctor.findOne({
      doctorId: selectedDoctor.doctorId,
      role: 'doctor',
      isVerified: true,
      isAvailable: { $ne: false },
    })
      .select('doctorId')
      .lean()

    if (!latestDoctorState) {
      return res.status(409).json({
        message: 'Selected doctor is currently unavailable. Please try booking again.',
      })
    }

    const parsedAppointmentDate = plan.parsedAppointmentDate
    const inference = plan.inference
    const appointment = await Appointment.create({
      appointmentId: resolvedAppointmentId,
      doctorId: selectedDoctor.doctorId,
      patientId,
      patientName,
      patientPhone,
      appointmentDate: parsedAppointmentDate,
      appointmentTime,
      duration: Number(duration) > 0 ? Number(duration) : 30,
      reason: patientReason,
      consultationType: resolvedConsultationType,
      triageCategory: inference.specialtyLabel,
      triageConfidence: inference.confidence,
      triageSummary: inference.summary,
      triageMatchedTerms: inference.matchedTerms,
    })

    const io = req?.app?.get('io')
    if (io) {
      io.to(`appointments-doctor-${String(selectedDoctor.doctorId)}`).emit('appointment-created', { appointment })
      io.to(`appointments-patient-${String(patientId)}`).emit('appointment-created', { appointment })
    }

    try {
      await DoctorNotification.create({
        notificationId: `NOTIF-${nanoid(10).toUpperCase()}`,
        doctorId: selectedDoctor.doctorId,
        type: 'appointment',
        title: 'New appointment assigned',
        message: `${patientName} was assigned to you for ${appointmentTime} on ${parsedAppointmentDate.toLocaleDateString()}.`,
        relatedTo: resolvedAppointmentId,
        priority: 'normal',
        actionUrl: '/secure/doctor',
      })
    } catch (notificationError) {
      console.error('Failed to create auto-assigned appointment notification:', notificationError)
    }

    res.status(201).json({
      ...appointment.toObject(),
      doctor: {
        doctorId: selectedDoctor.doctorId,
        doctorFirstName: selectedDoctor.doctorFirstName,
        doctorLastName: selectedDoctor.doctorLastName,
        doctorName: [selectedDoctor.doctorFirstName, selectedDoctor.doctorLastName].filter(Boolean).join(' ').trim(),
        specialization: selectedDoctor.specialization,
      },
      assignment: {
        specialty: inference.specialtyLabel,
        confidence: inference.confidence,
        matchedTerms: inference.matchedTerms,
        summary: inference.summary,
        assignmentPool: plan.assignmentPool,
        usedGeneralPracticeFallback: plan.usedGeneralPracticeFallback,
      },
    })
  } catch (error) {
    console.error('Failed to auto-assign appointment:', error)
    res.status(500).json({ message: 'Failed to auto-assign appointment' })
  }
})

// Create appointment
router.post('/:doctorId/appointments', async (req, res) => {
  try {
    const { doctorId } = req.params
    const {
      appointmentId,
      patientId,
      patientName,
      patientPhone,
      appointmentDate,
      appointmentTime,
      duration,
      reason,
      consultationType,
      triageCategory,
      triageConfidence,
      triageSummary,
      triageMatchedTerms,
    } = req.body
    const resolvedAppointmentId = appointmentId ? String(appointmentId).trim() : `APT-${nanoid(10).toUpperCase()}`
    const resolvedConsultationType = ['messaging', 'video', 'phone'].includes(String(consultationType))
      ? String(consultationType)
      : 'messaging'

    if (!doctorId) {
      return res.status(400).json({ message: 'Doctor ID is required' })
    }

    // Direct doctor booking must also honor the doctor availability flag.
    const doctor = await Doctor.findOne({ doctorId, role: 'doctor' }).select('doctorId isAvailable')
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' })
    }

    if (doctor.isAvailable === false) {
      return res.status(409).json({ message: 'Doctor is currently unavailable for appointments' })
    }

    if (!patientId || !patientName || !appointmentDate || !appointmentTime) {
      return res.status(400).json({ message: 'Missing required fields' })
    }

    const parsedAppointmentDate = new Date(appointmentDate)
    if (Number.isNaN(parsedAppointmentDate.getTime())) {
      return res.status(400).json({ message: 'Invalid appointment date' })
    }

    const appointment = await Appointment.create({
      appointmentId: resolvedAppointmentId,
      doctorId,
      patientId,
      patientName,
      patientPhone,
      appointmentDate: parsedAppointmentDate,
      appointmentTime,
      duration: duration || 30,
      reason,
      consultationType: resolvedConsultationType,
      triageCategory,
      triageConfidence,
      triageSummary,
      triageMatchedTerms: Array.isArray(triageMatchedTerms) ? triageMatchedTerms : [],
    })

    const io = req?.app?.get('io')
    if (io) {
      io.to(`appointments-doctor-${String(doctorId)}`).emit('appointment-created', { appointment })
      io.to(`appointments-patient-${String(patientId)}`).emit('appointment-created', { appointment })
    }

    try {
      await DoctorNotification.create({
        notificationId: `NOTIF-${nanoid(10).toUpperCase()}`,
        doctorId,
        type: 'appointment',
        title: 'New appointment booked',
        message: `${patientName} booked an appointment for ${appointmentTime} on ${parsedAppointmentDate.toLocaleDateString()}.`,
        relatedTo: resolvedAppointmentId,
        priority: 'normal',
        actionUrl: '/secure/doctor',
      })
    } catch (notificationError) {
      console.error('Failed to create appointment notification:', notificationError)
    }

    res.status(201).json(appointment)
  } catch (error) {
    console.error('Failed to create appointment:', error)
    res.status(500).json({ message: 'Failed to create appointment' })
  }
})

// Update appointment status
router.patch('/:doctorId/appointments/:appointmentId', async (req, res) => {
  try {
    const { doctorId, appointmentId } = req.params
    const { status, notes } = req.body

    const appointment = await Appointment.findOneAndUpdate(
      { appointmentId, doctorId },
      {
        status,
        notes: notes || undefined,
        updatedAt: new Date(),
      },
      { new: true },
    )

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' })
    }

    let reassignedAppointment = null
    const normalizedStatus = String(status || '').toLowerCase()
    const scheduledDateTime = buildAppointmentDateTime(appointment.appointmentDate, appointment.appointmentTime)
    const shouldReassign = normalizedStatus === 'cancelled' && scheduledDateTime && scheduledDateTime.getTime() > Date.now()

    if (shouldReassign) {
      const plan = await resolveAssignmentPlan({
        appointmentDate: appointment.appointmentDate,
        patientReason: appointment.reason || appointment.triageSummary || appointment.notes || 'follow-up appointment',
        excludeDoctorId: doctorId,
      })

      if (!plan.error && plan.selectedDoctor?.doctorId) {
        const nextAppointment = await Appointment.create({
          appointmentId: `APT-${nanoid(10).toUpperCase()}`,
          doctorId: plan.selectedDoctor.doctorId,
          patientId: appointment.patientId,
          patientName: appointment.patientName,
          patientPhone: appointment.patientPhone,
          appointmentDate: appointment.appointmentDate,
          appointmentTime: appointment.appointmentTime,
          duration: appointment.duration,
          status: 'scheduled',
          reason: appointment.reason,
          consultationType: appointment.consultationType,
          triageCategory: appointment.triageCategory,
          triageConfidence: appointment.triageConfidence,
          triageSummary: appointment.triageSummary,
          triageMatchedTerms: Array.isArray(appointment.triageMatchedTerms) ? appointment.triageMatchedTerms : [],
          notes: `Reassigned after cancellation by ${doctorId}.`,
        })

        reassignedAppointment = {
          ...nextAppointment.toObject(),
          doctor: {
            doctorId: plan.selectedDoctor.doctorId,
            doctorFirstName: plan.selectedDoctor.doctorFirstName,
            doctorLastName: plan.selectedDoctor.doctorLastName,
            doctorName: [plan.selectedDoctor.doctorFirstName, plan.selectedDoctor.doctorLastName].filter(Boolean).join(' ').trim(),
            specialization: plan.selectedDoctor.specialization,
          },
        }

        const io = req?.app?.get('io')
        if (io) {
          io.to(`appointments-doctor-${String(plan.selectedDoctor.doctorId)}`).emit('appointment-created', { appointment: reassignedAppointment })
          io.to(`appointments-patient-${String(appointment.patientId)}`).emit('appointment-created', { appointment: reassignedAppointment })
          io.to(`appointments-patient-${String(appointment.patientId)}`).emit('appointment-reassigned', {
            appointment: reassignedAppointment,
            previousDoctorId: String(doctorId),
          })
        }

        try {
          await DoctorNotification.create({
            notificationId: `NOTIF-${nanoid(10).toUpperCase()}`,
            doctorId: plan.selectedDoctor.doctorId,
            type: 'appointment',
            title: 'Reassigned appointment',
            message: `${appointment.patientName} was reassigned to you after another doctor cancelled their upcoming appointment.`,
            relatedTo: reassignedAppointment.appointmentId,
            priority: 'normal',
            actionUrl: '/secure/doctor',
          })
        } catch (notificationError) {
          console.error('Failed to create reassignment notification:', notificationError)
        }
      }
    }

    // If this cancellation is for a rebooked appointment created from an original missed appointment,
    // find the original appointment id from the stored field first and mark the original appointment as cancelled.
    try {
      const originalAppointmentId = String(appointment?.rebookedFromAppointmentId || '') || (() => {
        const normalizedNotes = String(appointment?.notes || '')
        const m = normalizedNotes.match(/Rebooked after missed appointment\s+(APT-[A-Z0-9-_]+)/i)
        return m && m[1] ? String(m[1]) : ''
      })()

      console.log('[PATCH cancel] Checking rebook: cancelledAppointmentId=%s, rebookedFromAppointmentId=%s, originalFromField=%s', String(appointment?.appointmentId || ''), String(appointment?.rebookedFromAppointmentId || 'N/A'), originalAppointmentId)

      if (originalAppointmentId) {

        try {
          console.log('[PATCH cancel] Found original appointment %s, marking as cancelled...', originalAppointmentId)
          const updatedOriginal = await Appointment.findOneAndUpdate(
            { appointmentId: originalAppointmentId },
            { status: 'cancelled', notes: `Cancelled after rebook ${String(appointment?.appointmentId || '')}`, updatedAt: new Date() },
            { new: true },
          ).lean()
          
          console.log('[PATCH cancel] Updated original appointment %s: %s', originalAppointmentId, updatedOriginal ? 'SUCCESS' : 'NOT FOUND')

          // clear rebooked marker if present (best-effort)
          await Appointment.updateOne({ appointmentId: originalAppointmentId }, { $unset: { rebooked: "" } }).catch(() => {})

          const io = req?.app?.get('io')
          if (io && updatedOriginal) {
            io.to(`appointments-doctor-${String(doctorId)}`).emit('appointment-updated', { appointment: updatedOriginal })
            io.to(`appointments-patient-${String(updatedOriginal.patientId)}`).emit('appointment-updated', { appointment: updatedOriginal })

            // also emit a rebook-cancelled signal for UI handling
            io.to(`appointments-doctor-${String(doctorId)}`).emit('rebook-cancelled', { originalAppointmentId, cancelledAppointmentId: String(appointment?.appointmentId || '') })
            if (appointment?.patientId) {
              io.to(`appointments-patient-${String(appointment.patientId)}`).emit('rebook-cancelled', { originalAppointmentId, cancelledAppointmentId: String(appointment?.appointmentId || '') })
            }
          }
        } catch (innerErr) {
          // best-effort; log and continue
          console.error('Failed to mark original appointment cancelled after rebook cancellation:', innerErr && innerErr.stack ? innerErr.stack : innerErr)
        }
      }
    } catch {
      // best-effort; ignore errors
    }

    const io = req?.app?.get('io')
    if (io) {
      io.to(`appointments-doctor-${String(doctorId)}`).emit('appointment-updated', { appointment })
      if (appointment?.patientId) {
        io.to(`appointments-patient-${String(appointment.patientId)}`).emit('appointment-updated', { appointment })
      }
    }

    res.status(200).json({
      ...appointment.toObject(),
      reassignedAppointment,
    })
  } catch (error) {
    console.error('Failed to update appointment:', error)
    res.status(500).json({ message: 'Failed to update appointment' })
  }
})

// Rebook a missed appointment to next day same time, then auto-assign
router.post('/:doctorId/appointments/:appointmentId/rebook', async (req, res) => {
  try {
    const { doctorId, appointmentId } = req.params

    console.log('[rebook] request for doctorId=%s appointmentId=%s', doctorId, appointmentId)

    const existingAppointment = await Appointment.findOne({ appointmentId, doctorId }).lean()
    if (!existingAppointment) {
      return res.status(404).json({ message: 'Appointment not found' })
    }

    console.log('[rebook] found existing appointment:', existingAppointment?.appointmentId || existingAppointment?._id)

    const currentStatus = getEffectiveAppointmentStatus(existingAppointment)
    if (currentStatus !== 'no-show') {
      return res.status(400).json({ message: 'Only missed appointments can be rebooked' })
    }

    const oldDate = new Date(existingAppointment.appointmentDate)
    if (Number.isNaN(oldDate.getTime())) {
      return res.status(400).json({ message: 'Invalid appointment date' })
    }

    const nextDate = new Date(oldDate)
    nextDate.setDate(nextDate.getDate() + 1)

    console.log('[rebook] scheduling nextDate=%s', nextDate.toISOString())

    // Notify patient and doctor rooms that a rebook is being attempted so UIs can disable rebook buttons
    try {
      const io = req?.app?.get('io')
      if (io) {
        io.to(`appointments-doctor-${String(doctorId)}`).emit('appointment-rebooking', {
          appointmentId: String(existingAppointment.appointmentId || ''),
          initiator: 'doctor',
        })
        if (existingAppointment.patientId) {
          io.to(`appointments-patient-${String(existingAppointment.patientId)}`).emit('appointment-rebooking', {
            appointmentId: String(existingAppointment.appointmentId || ''),
            initiator: 'doctor',
          })
        }
      }
    } catch (e) {
      // best-effort notify; continue
      console.error('Failed to emit appointment-rebooking event:', e)
    }

    const plan = await resolveAssignmentPlan({
      appointmentDate: nextDate,
      patientReason: existingAppointment.reason || existingAppointment.triageSummary || existingAppointment.notes || 'follow-up appointment',
    })

    console.log('[rebook] assignment plan result:', { error: plan?.error, selectedDoctor: plan?.selectedDoctor && String(plan.selectedDoctor.doctorId) })

    if (plan.error || !plan.selectedDoctor?.doctorId) {
      return res.status(409).json({ message: plan.error || 'No available doctor found for rebooking' })
    }

    let rebookedAppointment
    try {
      rebookedAppointment = await Appointment.create({
        appointmentId: `APT-${nanoid(10).toUpperCase()}`,
        doctorId: plan.selectedDoctor.doctorId,
        patientId: existingAppointment.patientId,
        patientName: existingAppointment.patientName,
        patientPhone: existingAppointment.patientPhone,
        appointmentDate: nextDate,
        appointmentTime: existingAppointment.appointmentTime,
        duration: existingAppointment.duration,
        status: 'scheduled',
        rebookedFromAppointmentId: String(existingAppointment.appointmentId || ''),
        reason: existingAppointment.reason,
        consultationType: existingAppointment.consultationType,
        triageCategory: existingAppointment.triageCategory,
        triageConfidence: existingAppointment.triageConfidence,
        triageSummary: existingAppointment.triageSummary,
        triageMatchedTerms: Array.isArray(existingAppointment.triageMatchedTerms) ? existingAppointment.triageMatchedTerms : [],
        notes: `Rebooked after missed appointment ${existingAppointment.appointmentId}.`,
      })
    } catch (createErr) {
      console.error('[rebook] Appointment.create failed:', createErr && createErr.stack ? createErr.stack : createErr)
      return res.status(500).json({ message: 'Failed to create rebooked appointment', detail: createErr?.message || null })
    }

    const io = req?.app?.get('io')
    if (io) {
      const payload = {
        ...rebookedAppointment.toObject(),
        doctor: {
          doctorId: plan.selectedDoctor.doctorId,
          doctorFirstName: plan.selectedDoctor.doctorFirstName,
          doctorLastName: plan.selectedDoctor.doctorLastName,
          doctorName: [plan.selectedDoctor.doctorFirstName, plan.selectedDoctor.doctorLastName].filter(Boolean).join(' ').trim(),
          specialization: plan.selectedDoctor.specialization,
        },
      }
      console.log('[rebook] emitting appointment-created to doctor %s and patient %s', String(plan.selectedDoctor.doctorId), String(existingAppointment.patientId))
      io.to(`appointments-doctor-${String(plan.selectedDoctor.doctorId)}`).emit('appointment-created', { appointment: payload })
      io.to(`appointments-patient-${String(existingAppointment.patientId)}`).emit('appointment-created', { appointment: payload })
    }

    return res.status(201).json({
      message: 'Appointment rebooked successfully',
      appointment: rebookedAppointment,
    })
  } catch (error) {
    console.error('Failed to rebook appointment:', error && error.stack ? error.stack : error)
    return res.status(500).json({ message: 'Failed to rebook appointment' })
  }
})

// Doctor settings route
router.use('/:doctorId/settings', doctorSettingsRoute)

module.exports = router
