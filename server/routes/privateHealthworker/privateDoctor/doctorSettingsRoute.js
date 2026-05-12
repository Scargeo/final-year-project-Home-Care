const express = require('express');
const router = express.Router({ mergeParams: true });
const Doctor = require('../../../models/privateHealthWorker/doctor/doctorRegistration');
const { loadUser } = require('../../../middleware/loadUserMiddleware');

// Load user from headers for permission checks
router.use(loadUser);

/**
 * GET /api/doctors/:doctorId/settings
 * Fetch doctor settings and profile information
 */
router.get('/', async (req, res) => {
  try {
    const { doctorId } = req.params;
    if (!doctorId) {
      return res.status(400).json({ message: 'Missing doctor ID' });
    }

    const doctor = await Doctor.findOne({ doctorId }).select('-doctorPassword');

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    res.status(200).json({
      doctor: {
        doctorId: doctor.doctorId,
        doctorFirstName: doctor.doctorFirstName,
        doctorLastName: doctor.doctorLastName,
        doctorEmail: doctor.doctorEmail,
        doctorPhone: doctor.doctorPhone,
        doctorAddress: doctor.doctorAddress,
        licenseNumber: doctor.licenseNumber,
        specialization: doctor.specialization,
        // Legacy records may not have this field yet; treat missing as available.
        isAvailable: doctor.isAvailable !== false,
        yearsOfExperience: doctor.yearsOfExperience,
        profileImage: doctor.profileImage,
        notificationPrefs: doctor.notificationPrefs,
        privacyPrefs: doctor.privacyPrefs,
        personalizationPrefs: doctor.personalizationPrefs,
        isVerified: doctor.isVerified,
        role: doctor.role,
        createdAt: doctor.createdAt,
      },
    });
  } catch (error) {
    console.error('Error fetching doctor settings:', error);
    res.status(500).json({ message: 'Failed to fetch doctor settings', error: error.message });
  }
});

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
      isAvailable,
    } = req.body;

    // Build update object with only provided fields
    const updateFields = {};
    if (firstName) updateFields.doctorFirstName = firstName;
    if (lastName) updateFields.doctorLastName = lastName;
    if (doctorEmail) updateFields.doctorEmail = doctorEmail;
    if (doctorPhone) updateFields.doctorPhone = doctorPhone;
    if (doctorAddress) updateFields.doctorAddress = doctorAddress;
    if (licenseNumber) updateFields.licenseNumber = licenseNumber;
    if (specialty) updateFields.specialization = specialty;
    if (notificationPrefs) updateFields.notificationPrefs = notificationPrefs;
    if (privacyPrefs) updateFields.privacyPrefs = privacyPrefs;
    if (personalizationPrefs) updateFields.personalizationPrefs = personalizationPrefs;
    if (typeof isAvailable !== 'undefined') updateFields.isAvailable = Boolean(isAvailable);

    // Update doctor in database
    const updated = await Doctor.findOneAndUpdate(
      { doctorId: doctorId },
      { $set: updateFields },
      { new: true, runValidators: false }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    res.status(200).json({
      message: 'Doctor settings updated successfully',
      doctor: {
        doctorId: updated.doctorId,
        doctorFirstName: updated.doctorFirstName,
        doctorLastName: updated.doctorLastName,
        doctorEmail: updated.doctorEmail,
        doctorPhone: updated.doctorPhone,
        doctorAddress: updated.doctorAddress,
        licenseNumber: updated.licenseNumber,
        specialization: updated.specialization,
            isAvailable: updated.isAvailable !== false,
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
