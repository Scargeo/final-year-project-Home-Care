const express = require('express');
const router = express.Router();

const { registerPatient, loginPatient, updateStatus } = require('../../middleware/patientController');
const HealthRecord = require('../../models/patient/healthRecord');
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
			{ returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
		);

		return res.status(200).json(record);
	} catch (error) {
		console.error('Failed to save health records:', error);
		return res.status(500).json({ message: 'Failed to save health records' });
	}
});

module.exports = router;