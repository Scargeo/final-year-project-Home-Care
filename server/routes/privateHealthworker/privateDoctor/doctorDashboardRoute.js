const express = require('express')
const router = express.Router()
const Appointment = require('../../../models/privateHealthWorker/doctor/appointment')
const PatientQueue = require('../../../models/privateHealthWorker/doctor/patientQueue')
const DoctorNotification = require('../../../models/privateHealthWorker/doctor/doctorNotification')
const Doctor = require('../../../models/privateHealthWorker/doctor/doctorRegistration')
const { registerDoctor, loginDoctor } = require('../../../middleware/doctorController')
const doctorSettingsRoute = require('./doctorSettingsRoute')

// Doctor authentication routes
router.post('/register', registerDoctor)
router.post('/login', loginDoctor)

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

    // Get today's appointments
    const todaysAppointments = await Appointment.find({
      doctorId,
      appointmentDate: {
        $gte: today,
        $lt: tomorrow,
      },
    })
      .sort({ appointmentTime: 1 })
      .limit(10)

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

// Create appointment
router.post('/:doctorId/appointments', async (req, res) => {
  try {
    const { doctorId } = req.params
    const { appointmentId, patientId, patientName, patientPhone, appointmentDate, appointmentTime, duration, reason, consultationType } = req.body

    if (!appointmentId || !patientId || !appointmentDate || !appointmentTime) {
      return res.status(400).json({ message: 'Missing required fields' })
    }

    const appointment = await Appointment.create({
      appointmentId,
      doctorId,
      patientId,
      patientName,
      patientPhone,
      appointmentDate: new Date(appointmentDate),
      appointmentTime,
      duration: duration || 30,
      reason,
      consultationType: consultationType || 'in-person',
    })

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

    res.status(200).json(appointment)
  } catch (error) {
    console.error('Failed to update appointment:', error)
    res.status(500).json({ message: 'Failed to update appointment' })
  }
})

// Doctor settings route
router.use('/:doctorId/settings', doctorSettingsRoute)

module.exports = router
