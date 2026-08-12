const express = require('express');
const router = express.Router({ mergeParams: true });
const Patient = require('../../models/patient/patientRegistration');
const { loadUser } = require('../../middleware/loadUserMiddleware');

// Load user from headers for permission checks
router.use(loadUser);

/**
 * GET /api/patients/:id/settings
 * Fetch patient settings and profile information
 */
router.get('/', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: 'Missing patient ID' });
    }

    const patient = await Patient.findOne({ patientId: id }).select('-patientPassword');
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    return res.status(200).json({
      patient: {
        patientId: patient.patientId,
        patientFirstName: patient.patientFirstName,
        patientLastName: patient.patientLastName,
        patientEmail: patient.patientEmail,
        patientPhone: patient.patientPhone,
        patientAddress: patient.patientAddress,
        notificationPrefs: patient.notificationPrefs,
        privacyPrefs: patient.privacyPrefs,
        personalizationPrefs: patient.personalizationPrefs,
        profileImage: patient.profileImage,
        isVerified: patient.isVerified,
        emailVerified: Boolean(patient.emailVerified),
        online: patient.online,
        aiActive: patient.aiActive,
      },
    });
  } catch (error) {
    console.error('Error fetching patient settings:', error);
    return res.status(500).json({ message: 'Failed to fetch patient settings', error: error.message });
  }
});

/**
 * PATCH /api/patients/:id/settings
 * Update patient settings (account, notifications, privacy)
 */
router.patch('/', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: 'Missing patient ID' });
    }

    const {
      patientFirstName,
      patientLastName,
      patientEmail,
      patientPhone,
      patientAddress,
      notificationPrefs,
      privacyPrefs,
      personalizationPrefs,
    } = req.body;

    // Build update object with only provided fields
    const updateFields = {};
    if (patientFirstName) updateFields.patientFirstName = patientFirstName;
    if (patientLastName) updateFields.patientLastName = patientLastName;
    if (patientEmail) updateFields.patientEmail = patientEmail;
    if (patientPhone) updateFields.patientPhone = patientPhone;
    if (patientAddress) updateFields.patientAddress = patientAddress;
    if (notificationPrefs) updateFields.notificationPrefs = notificationPrefs;
    if (privacyPrefs) updateFields.privacyPrefs = privacyPrefs;
    if (personalizationPrefs) updateFields.personalizationPrefs = personalizationPrefs;

    // Update patient in database
    const updated = await Patient.findOneAndUpdate(
      { patientId: id },
      { $set: updateFields },
      { new: true, runValidators: false }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    res.status(200).json({
      message: 'Patient settings updated successfully',
      patient: {
        patientId: updated.patientId,
        patientFirstName: updated.patientFirstName,
        patientLastName: updated.patientLastName,
        patientEmail: updated.patientEmail,
        patientPhone: updated.patientPhone,
        patientAddress: updated.patientAddress,
        notificationPrefs: updated.notificationPrefs,
        privacyPrefs: updated.privacyPrefs,
        personalizationPrefs: updated.personalizationPrefs,
      },
    });
  } catch (error) {
    console.error('Error updating patient settings:', error);
    res.status(500).json({ message: 'Failed to update patient settings', error: error.message });
  }
});

module.exports = router;
