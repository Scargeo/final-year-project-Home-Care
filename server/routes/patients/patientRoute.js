const express = require('express');
const router = express.Router();

const { registerPatient, loginPatient, updateStatus } = require('../../middleware/patientController');
const HealthRecord = require('../../models/patient/healthRecord');
const Appointment = require('../../models/privateHealthWorker/doctor/appointment');
const Doctor = require('../../models/privateHealthWorker/doctor/doctorRegistration');
const Patient = require('../../models/patient/patientRegistration');
const { allowOwnerOrDoctor } = require('../../middleware/permissionMiddleware')
const { loadUser } = require('../../middleware/loadUserMiddleware')
const settingsRoute = require('./settingsRoute');

// Attempt to load user object from headers for subsequent permission checks
router.use(loadUser)

// Route for patient registration
router.post('/register', registerPatient);

// Route for patient login
router.post('/login', loginPatient);

// Route to update patient presence / ai status
router.patch('/:id/status', updateStatus);

// Route for patient settings
router.use('/:id/settings', settingsRoute);

router.get('/:id/health-records', allowOwnerOrDoctor((req) => req.params.id), async (req, res) => {
	try {
		const { id } = req.params;
		if (!id) {
			return res.status(400).json({ message: 'Missing patient id' });
		}

		const record = await HealthRecord.findOne({ patientRef: id });
		return res.status(200).json(
			record || {
				patientRef: id,
				medicalHistory: '',
				prescriptions: '',
				allergies: '',
				labResults: [],
			},
		);
	} catch (error) {
		console.error('Failed to fetch health records:', error);
		return res.status(500).json({ message: 'Failed to fetch health records' });
	}
});

router.put('/:id/health-records', allowOwnerOrDoctor((req) => req.params.id), async (req, res) => {
	try {
		const { id } = req.params;
		if (!id) {
			return res.status(400).json({ message: 'Missing patient id' });
		}

		const { medicalHistory = '', prescriptions = '', allergies = '', labResults = [] } = req.body || {};
		const sanitizedLabResults = Array.isArray(labResults)
			? labResults
					.filter((entry) => entry && entry.fileName && (entry.fileData || entry.url))
					.map((entry) => {
						const base = {
							fileName: String(entry.fileName).trim(),
							mimeType: String(entry.mimeType || 'application/pdf').trim(),
							uploadedAt: entry.uploadedAt ? new Date(entry.uploadedAt) : new Date(),
						};
						// Support both base64 (fileData) and Cloudinary (url + publicId)
						if (entry.url) {
							return {
								...base,
								url: String(entry.url).trim(),
								publicId: entry.publicId ? String(entry.publicId).trim() : '',
								attachmentId: entry.attachmentId ? String(entry.attachmentId).trim() : '',
								size: entry.size || 0,
								resourceType: entry.resourceType || 'raw',
							};
						}
						return {
							...base,
							fileData: String(entry.fileData),
						};
					})
			: [];

		const record = await HealthRecord.findOneAndUpdate(
			{ patientRef: id },
			{
				$set: {
					medicalHistory: String(medicalHistory),
					prescriptions: String(prescriptions),
					allergies: String(allergies),
					labResults: sanitizedLabResults,
				},
			},
			{ new: true, upsert: true, setDefaultsOnInsert: true },
		);

		return res.status(200).json(record);
	} catch (error) {
		console.error('Failed to save health records:', error);
		return res.status(500).json({ message: 'Failed to save health records' });
	}
});

router.get('/:id/appointments', allowOwnerOrDoctor((req) => req.params.id), async (req, res) => {
	try {
		const { id } = req.params;
		if (!id) {
			return res.status(400).json({ message: 'Missing patient id' });
		}

		const appointments = await Appointment.find({ patientId: id })
			.sort({ appointmentDate: 1, appointmentTime: 1 })
			.lean();

		const uniqueAppointments = Array.from(
			appointments.reduce((map, appointment) => {
				const key = String(appointment.appointmentId || appointment._id || '')
				if (!key) return map
				map.set(key, appointment)
				return map
			}, new Map()).values(),
		)

		const doctorIds = [...new Set(uniqueAppointments.map((appointment) => String(appointment.doctorId || '')).filter(Boolean))];
		const doctors = doctorIds.length > 0
			? await Doctor.find({ doctorId: { $in: doctorIds } })
				.select('doctorId doctorFirstName doctorLastName specialization profileImage isVerified')
				.lean()
			: [];

		const doctorMap = new Map(doctors.map((doctor) => [String(doctor.doctorId), doctor]));
		const appointmentsWithDoctors = uniqueAppointments.map((appointment) => {
			const doctor = doctorMap.get(String(appointment.doctorId))
			return {
				...appointment,
				doctor: doctor
					? {
						doctorId: doctor.doctorId,
						doctorFirstName: doctor.doctorFirstName,
						doctorLastName: doctor.doctorLastName,
						doctorName: [doctor.doctorFirstName, doctor.doctorLastName].filter(Boolean).join(' ').trim(),
						specialization: doctor.specialization,
						profileImage: doctor.profileImage || null,
						isVerified: Boolean(doctor.isVerified),
					}
					: null,
			}
		})

		return res.status(200).json({ appointments: appointmentsWithDoctors })
	} catch (error) {
		console.error('Failed to fetch appointments:', error)
		return res.status(500).json({ message: 'Failed to fetch appointments' })
	}
});

// Consent requests: create, list, and patient response
const ConsentRequest = require('../../models/patient/consentRequest')
const DoctorNotification = require('../../models/privateHealthWorker/doctor/doctorNotification')

// Create a consent request (doctor requests patient to share records)
// One-time consent: if consent already accepted for this appointment, return existing consent
router.post('/:id/consent-requests', allowOwnerOrDoctor((req) => req.params.id), async (req, res) => {
	try {
		const { id } = req.params
		const { doctorId, appointmentId, message } = req.body || {}
		if (!id || !doctorId) return res.status(400).json({ message: 'Missing patient id or doctorId' })

		// Check if consent already exists and has been accepted for this appointment
		if (appointmentId) {
			const existingAccepted = await ConsentRequest.findOne({
				patientId: id,
				doctorId: String(doctorId),
				appointmentId: String(appointmentId),
				status: 'accepted'
			}).lean()

			if (existingAccepted) {
				// Consent already accepted - return it with 200 status indicating it was previously granted
				return res.status(200).json({ ...existingAccepted, alreadyAccepted: true })
			}
		}

		const reqDoc = await ConsentRequest.create({ patientId: id, doctorId: String(doctorId), appointmentId: appointmentId || '', message: String(message || '') })
		
		// Emit real-time notification to patient when doctor requests consent
		const io = req?.app?.get('io')
		if (io) {
			io.to(`consent-patient-${String(id)}`).emit('consent-requested', { request: reqDoc })
		}
		
		return res.status(201).json(reqDoc)
	} catch (error) {
		console.error('Failed to create consent request:', error)
		return res.status(500).json({ message: 'Failed to create consent request' })
	}
})

// List consent requests for a patient (patient or doctor)
router.get('/:id/consent-requests', allowOwnerOrDoctor((req) => req.params.id), async (req, res) => {
	try {
		const { id } = req.params
		if (!id) return res.status(400).json({ message: 'Missing patient id' })
		const items = await ConsentRequest.find({ patientId: id }).sort({ requestedAt: -1 }).lean()
		return res.status(200).json({ requests: items })
	} catch (error) {
		console.error('Failed to list consent requests:', error)
		return res.status(500).json({ message: 'Failed to list consent requests' })
	}
})

// Patient (owner) responds to a consent request
router.patch('/:id/consent-requests/:requestId', allowOwnerOrDoctor((req) => req.params.id), async (req, res) => {
	try {
		const { id, requestId } = req.params
		const { status, sharedRecords = [], sharedAttachments = [] } = req.body || {}
		if (!id || !requestId) return res.status(400).json({ message: 'Missing parameters' })
		if (!['accepted', 'rejected', 'pending'].includes(String(status))) return res.status(400).json({ message: 'Invalid status' })

		const updated = await ConsentRequest.findOneAndUpdate(
			{ patientId: id, requestId: requestId },
			{ $set: { status: status, sharedRecords: Array.isArray(sharedRecords) ? sharedRecords : [], sharedAttachments: Array.isArray(sharedAttachments) ? sharedAttachments : [], respondedAt: new Date() } },
			{ new: true }
		)
		if (!updated) return res.status(404).json({ message: 'Request not found' })
		
		// Emit real-time notification to doctor when patient responds to consent
		const io = req?.app?.get('io')
		if (io && updated?.doctorId) {
			io.to(`consent-doctor-${String(updated.doctorId)}`).emit('consent-responded', { request: updated })
		}

		try {
			const patient = await Patient.findOne({ patientId: id }).select('patientFirstName patientLastName').lean()
			const patientName = [patient?.patientFirstName, patient?.patientLastName].filter(Boolean).join(' ').trim() || updated.patientId
			const responseLabel = String(status) === 'accepted' ? 'approved' : 'rejected'
			await DoctorNotification.create({
				notificationId: `NOTIF-${Date.now()}-${String(requestId).slice(-4).toUpperCase()}`,
				doctorId: String(updated.doctorId),
				type: 'patient-update',
				title: `Consent ${responseLabel}`,
				message: `${patientName} has ${responseLabel} your request to records sharing.`,
				relatedTo: String(updated.appointmentId || requestId),
				priority: String(status) === 'accepted' ? 'normal' : 'high',
				actionUrl: '/secure/doctor',
			})
		} catch (notificationError) {
			console.error('Failed to create consent response notification:', notificationError)
		}
		
		return res.status(200).json(updated)
	} catch (error) {
		console.error('Failed to update consent request:', error)
		return res.status(500).json({ message: 'Failed to update consent request' })
	}
})

module.exports = router;