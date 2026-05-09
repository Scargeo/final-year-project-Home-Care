const express = require('express');
const router = express.Router({ mergeParams: true });
const Doctor = require('../../../models/privateHealthWorker/doctor/doctorRegistration');
const { loadUser } = require('../../../middleware/loadUserMiddleware');

// Load user from headers for permission checks
router.use(loadUser);

/**
 * PATCH /api/doctors/:doctorId/settings
 * Update doctor settings (account, notifications, privacy, personalization)
 */
router.patch('/', async (req, res) => {
  try {
    const { doctorId } = req.params;
    if (!doctorId) {
      return res.status(400).json({ message: 'Missing doctor ID' });
    }

    const {
      firstName,
      lastName,
      doctorEmail,
      doctorPhone,
      doctorAddress,
      licenseNumber,
      specialty,
      notificationPrefs,
      privacyPrefs,
      personalizationPrefs,
    } = req.body;

    // Build update object with only provided fields
    const updateFields = {};
    if (firstName) updateFields.firstName = firstName;
    if (lastName) updateFields.lastName = lastName;
    if (doctorEmail) updateFields.doctorEmail = doctorEmail;
    if (doctorPhone) updateFields.doctorPhone = doctorPhone;
    if (doctorAddress) updateFields.doctorAddress = doctorAddress;
    if (licenseNumber) updateFields.licenseNumber = licenseNumber;
    if (specialty) updateFields.specialty = specialty;
    if (notificationPrefs) updateFields.notificationPrefs = notificationPrefs;
    if (privacyPrefs) updateFields.privacyPrefs = privacyPrefs;
    if (personalizationPrefs) updateFields.personalizationPrefs = personalizationPrefs;

    // Update doctor in database
    const updated = await Doctor.findOneAndUpdate(
      { doctorId: doctorId },
      { $set: updateFields },
      { returnDocument: 'after', runValidators: false }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    res.status(200).json({
      message: 'Doctor settings updated successfully',
      doctor: {
        doctorId: updated.doctorId,
        firstName: updated.firstName,
        lastName: updated.lastName,
        doctorEmail: updated.doctorEmail,
        doctorPhone: updated.doctorPhone,
        doctorAddress: updated.doctorAddress,
        licenseNumber: updated.licenseNumber,
        specialty: updated.specialty,
        notificationPrefs: updated.notificationPrefs,
        privacyPrefs: updated.privacyPrefs,
        personalizationPrefs: updated.personalizationPrefs,
      },
    });
  } catch (error) {
    console.error('Error updating doctor settings:', error);
    res.status(500).json({ message: 'Failed to update doctor settings', error: error.message });
  }
});

module.exports = router;
