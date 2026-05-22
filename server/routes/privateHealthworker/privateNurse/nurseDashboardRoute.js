const express = require('express')
const router = express.Router()

const Nurse = require('../../../models/privateHealthWorker/nurse/privateNurseRegistration')
const NurseNotification = require('../../../models/privateHealthWorker/nurse/nurseNotification')
const NurseAssignment = require('../../../models/privateHealthWorker/nurse/nurseAssignment')
const { listAssignmentsForNurse } = require('../../../lib/nurseAssignment')
const { loadUser } = require('../../../middleware/loadUserMiddleware')

function canEditOwnProfile(req, nurseId) {
  if (String(process.env.DISABLE_AUTH || '') === 'true') return true
  if (!req.user) return false
  return req.user.role === 'nurse' && String(req.user.id || '') === String(nurseId)
}

function canAccessOwnAssignment(req, nurseId, assignment) {
  if (String(process.env.DISABLE_AUTH || '') === 'true') return true
  if (!req.user || req.user.role !== 'nurse') return false
  if (String(req.user.id || '') !== String(nurseId)) return false
  return String(assignment?.nurseId || '') === String(nurseId)
}

function serializeAssignmentDetails(assignment) {
  if (!assignment) return null
  return {
    ...assignment,
    statusLabel: String(assignment.status || 'active').replace(/^[a-z]/, (char) => char.toUpperCase()),
  }
}

router.get('/', async (req, res) => {
  try {
    const nurses = await Nurse.find({}).select('uid nurseFirstName nurseLastName nursePhone nurseAddress nurseEmail profileImage isVerified isAvailable').sort({ nurseFirstName: 1, nurseLastName: 1 }).lean()

    res.status(200).json({
      nurses: nurses.map((nurse) => ({
        nurseId: nurse.uid,
        nurseFirstName: nurse.nurseFirstName,
        nurseLastName: nurse.nurseLastName,
        nurseName: [nurse.nurseFirstName, nurse.nurseLastName].filter(Boolean).join(' ').trim(),
        nursePhone: nurse.nursePhone,
        nurseAddress: nurse.nurseAddress,
        nurseEmail: nurse.nurseEmail,
        profileImage: nurse.profileImage || null,
        isVerified: Boolean(nurse.isVerified),
        isAvailable: nurse.isAvailable !== false,
      })),
    })
  } catch (error) {
    console.error('Failed to fetch nurses:', error)
    res.status(500).json({ message: 'Failed to fetch nurses' })
  }
})

router.get('/:nurseId/dashboard', async (req, res) => {
  try {
    const { nurseId } = req.params

    if (!nurseId) {
      return res.status(400).json({ message: 'Nurse ID is required' })
    }

    const nurse = await Nurse.findOne({ uid: nurseId }).lean()
    if (!nurse) {
      return res.status(404).json({ message: 'Nurse not found' })
    }

    const assignments = await listAssignmentsForNurse(nurseId)

    // Get unread notifications for this nurse
    const notifications = await NurseNotification.find({ nurseId: String(nurseId), isRead: false }).sort({ createdAt: -1 }).limit(10)

    res.status(200).json({
      stats: {
        unreadNotifications: notifications.length,
        assignmentCount: assignments.length,
      },
      assignments,
      notifications,
      nurse: {
        nurseId: nurse.uid,
        nurseFirstName: nurse.nurseFirstName,
        nurseLastName: nurse.nurseLastName,
        nurseEmail: nurse.nurseEmail,
        nursePhone: nurse.nursePhone,
        nurseAddress: nurse.nurseAddress,
        specialization: nurse.specialization || "",
        yearsOfExperience: Number.isFinite(Number(nurse.yearsOfExperience)) ? Number(nurse.yearsOfExperience) : 0,
        profileImage: nurse.profileImage || null,
        isVerified: nurse.isVerified,
        isAvailable: nurse.isAvailable !== false,
        createdAt: nurse.createdAt,
      },
    })
  } catch (error) {
    console.error('Failed to fetch nurse dashboard data:', error)
    res.status(500).json({ message: 'Failed to fetch nurse dashboard data' })
  }
})

router.get('/:nurseId/settings', loadUser, async (req, res) => {
  try {
    const { nurseId } = req.params
    if (String(process.env.DISABLE_AUTH || '') !== 'true' && !req.user) {
      return res.status(401).json({ message: 'Authentication required' })
    }
    if (!canEditOwnProfile(req, nurseId)) {
      return res.status(403).json({ message: 'You can only view your own nurse settings' })
    }

    const nurse = await Nurse.findOne({ uid: nurseId }).select('-nursePassword').lean()
    if (!nurse) {
      return res.status(404).json({ message: 'Nurse not found' })
    }

    res.status(200).json({ nurse })
  } catch (error) {
    console.error('Failed to fetch nurse settings:', error)
    res.status(500).json({ message: 'Failed to fetch nurse settings' })
  }
})

router.patch('/:nurseId/settings', loadUser, async (req, res) => {
  try {
    const { nurseId } = req.params
    if (String(process.env.DISABLE_AUTH || '') !== 'true' && !req.user) {
      return res.status(401).json({ message: 'Authentication required' })
    }
    if (!canEditOwnProfile(req, nurseId)) {
      return res.status(403).json({ message: 'You can only update your own nurse settings' })
    }

    const {
      firstName,
      lastName,
      nurseEmail,
      nursePhone,
      specialization,
      yearsOfExperience,
      notificationPrefs,
      privacyPrefs,
      personalizationPrefs,
      isAvailable,
    } = req.body || {}
    const hasField = (field) => Object.prototype.hasOwnProperty.call(req.body || {}, field)

    const updateFields = {}
    if (hasField('firstName')) updateFields.nurseFirstName = String(firstName || '').trim()
    if (hasField('lastName')) updateFields.nurseLastName = String(lastName || '').trim()
    if (hasField('nurseEmail')) updateFields.nurseEmail = String(nurseEmail || '').trim().toLowerCase()
    if (hasField('nursePhone')) updateFields.nursePhone = String(nursePhone || '').trim()
    if (hasField('specialization')) updateFields.specialization = String(specialization || '').trim()
    if (hasField('yearsOfExperience')) {
      const parsedYears = Number.parseInt(String(yearsOfExperience), 10)
      updateFields.yearsOfExperience = Number.isFinite(parsedYears) ? parsedYears : 0
    }
    if (hasField('notificationPrefs')) updateFields.notificationPrefs = notificationPrefs || {}
    if (hasField('privacyPrefs')) updateFields.privacyPrefs = privacyPrefs || {}
    if (hasField('personalizationPrefs')) updateFields.personalizationPrefs = personalizationPrefs || {}
    if (hasField('isAvailable')) updateFields.isAvailable = Boolean(isAvailable)

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ message: 'No nurse settings were provided to update' })
    }

    const nurse = await Nurse.findOneAndUpdate(
      { uid: nurseId },
      { $set: { ...updateFields, updatedAt: new Date() } },
      { new: true },
    ).select('-nursePassword').lean()

    if (!nurse) {
      return res.status(404).json({ message: 'Nurse not found' })
    }

    res.status(200).json({ nurse })
  } catch (error) {
    console.error('Failed to update nurse settings:', error)
    res.status(500).json({ message: 'Failed to update nurse settings' })
  }
})

router.get('/:nurseId/assignments', async (req, res) => {
  try {
    const { nurseId } = req.params
    const nurse = await Nurse.findOne({ uid: nurseId }).select('uid nurseFirstName nurseLastName nurseEmail nursePhone nurseAddress isAvailable profileImage').lean()

    if (!nurse) {
      return res.status(404).json({ message: 'Nurse not found' })
    }

    res.status(200).json({
      assignments: [],
      nurse: {
        nurseId: nurse.uid,
        nurseFirstName: nurse.nurseFirstName,
        nurseLastName: nurse.nurseLastName,
        nurseEmail: nurse.nurseEmail,
        nursePhone: nurse.nursePhone,
        nurseAddress: nurse.nurseAddress,
        profileImage: nurse.profileImage || null,
        isAvailable: nurse.isAvailable !== false,
      },
    })
  } catch (error) {
    console.error('Failed to fetch nurse assignments:', error)
    res.status(500).json({ message: 'Failed to fetch nurse assignments' })
  }
})

router.get('/:nurseId/assignments/:assignmentId', loadUser, async (req, res) => {
  try {
    const { nurseId, assignmentId } = req.params

    if (String(process.env.DISABLE_AUTH || '') !== 'true' && !req.user) {
      return res.status(401).json({ message: 'Authentication required' })
    }

    const assignment = await NurseAssignment.findOne({ assignmentId: String(assignmentId), nurseId: String(nurseId) }).lean()
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' })
    }

    if (!canAccessOwnAssignment(req, nurseId, assignment)) {
      return res.status(403).json({ message: 'You can only access your own assignments' })
    }

    return res.status(200).json({ assignment: serializeAssignmentDetails(assignment) })
  } catch (error) {
    console.error('Failed to fetch nurse assignment details:', error)
    return res.status(500).json({ message: 'Failed to fetch nurse assignment details' })
  }
})

router.patch('/:nurseId/assignments/:assignmentId', loadUser, async (req, res) => {
  try {
    const { nurseId, assignmentId } = req.params

    if (String(process.env.DISABLE_AUTH || '') !== 'true' && !req.user) {
      return res.status(401).json({ message: 'Authentication required' })
    }

    const assignment = await NurseAssignment.findOne({ assignmentId: String(assignmentId), nurseId: String(nurseId) })
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' })
    }

    if (!canAccessOwnAssignment(req, nurseId, assignment)) {
      return res.status(403).json({ message: 'You can only update your own assignments' })
    }

    const action = String(req.body?.action || req.body?.status || '').toLowerCase()
    const now = new Date()

    if (action === 'acknowledge' || action === 'acknowledged') {
      assignment.status = 'acknowledged'
      assignment.acknowledgedAt = assignment.acknowledgedAt || now
    } else if (action === 'contacted') {
      assignment.status = 'contacted'
      assignment.acknowledgedAt = assignment.acknowledgedAt || now
      assignment.contactedAt = now
    } else if (action === 'completed' || action === 'complete') {
      assignment.status = 'completed'
      assignment.acknowledgedAt = assignment.acknowledgedAt || now
      assignment.contactedAt = assignment.contactedAt || now
      assignment.completedAt = now
    } else {
      return res.status(400).json({ message: 'Unsupported assignment action' })
    }

    await assignment.save()

    const payload = serializeAssignmentDetails(assignment.toObject())
    const io = req?.app?.get('io')
    if (io) {
      io.to(`assignments-nurse-${String(nurseId)}`).emit('assignment-updated', { assignment: payload })
    }

    return res.status(200).json({ assignment: payload })
  } catch (error) {
    console.error('Failed to update nurse assignment:', error)
    return res.status(500).json({ message: 'Failed to update nurse assignment' })
  }
})

// Nurse notifications list
router.get('/:nurseId/notifications', async (req, res) => {
  try {
    const { nurseId } = req.params
    const { limit = 20, skip = 0 } = req.query
    if (!nurseId) return res.status(400).json({ message: 'Nurse ID is required' })

    const notifications = await NurseNotification.find({ nurseId: String(nurseId) })
      .sort({ createdAt: -1 })
      .skip(parseInt(skip) || 0)
      .limit(parseInt(limit) || 20)

    const total = await NurseNotification.countDocuments({ nurseId: String(nurseId) })

    res.status(200).json({ notifications, total })
  } catch (error) {
    console.error('Failed to fetch nurse notifications:', error)
    res.status(500).json({ message: 'Failed to fetch nurse notifications' })
  }
})

// Mark notification as read
router.patch('/:nurseId/notifications/:notificationId', async (req, res) => {
  try {
    const { nurseId, notificationId } = req.params
    const notification = await NurseNotification.findOneAndUpdate(
      { notificationId, nurseId: String(nurseId) },
      { isRead: true, readAt: new Date() },
      { new: true },
    )

    if (!notification) return res.status(404).json({ message: 'Notification not found' })
    res.status(200).json(notification)
  } catch (error) {
    console.error('Failed to update nurse notification:', error)
    res.status(500).json({ message: 'Failed to update nurse notification' })
  }
})

module.exports = router
