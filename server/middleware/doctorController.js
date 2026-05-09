const Doctor = require('../models/privateHealthWorker/doctor/doctorRegistration');
const bcrypt = require('bcrypt');
const { signToken } = require('./jwtAuth')

// Controller function to handle doctor registration
const registerDoctor = async (req, res) => {
  try {
    const {
      doctorFirstName,
      doctorLastName,
      doctorEmail,
      doctorPhone,
      doctorPassword,
      doctorAddress,
      specialization,
      licenseNumber,
      yearsOfExperience,
    } = req.body;

    bcrypt.hash(doctorPassword, 10).then((hash) => {
      const newDoctor = new Doctor({
        doctorFirstName,
        doctorLastName,
        doctorEmail,
        doctorPhone,
        doctorPassword: hash,
        doctorAddress,
        specialization,
        licenseNumber,
        yearsOfExperience,
      });
      newDoctor.save().then((savedDoctor) => {
        res.status(201).json({
          message: 'Doctor account created',
          user: {
            doctorId: savedDoctor.doctorId,
            doctorFirstName: savedDoctor.doctorFirstName,
            doctorLastName: savedDoctor.doctorLastName,
            doctorEmail: savedDoctor.doctorEmail,
            role: 'doctor',
            profileImage: savedDoctor.profileImage,
          },
        });
      });
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error registering doctor',
      error: error.message,
    });
  }
};

// Login controller function to handle doctor login
const loginDoctor = async (req, res) => {
  try {
    const { doctorEmail, doctorPassword } = req.body;
    // Find the doctor by email
    const doctor = await Doctor.findOne({ doctorEmail });
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }
    // Check if the password matches
    const isMatch = await bcrypt.compare(doctorPassword, doctor.doctorPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const userPayload = {
      id: doctor.doctorId,
      role: 'doctor',
      doctorId: doctor.doctorId,
      doctorEmail: doctor.doctorEmail,
    }

    const token = signToken(userPayload)

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        doctorId: doctor.doctorId,
        doctorFirstName: doctor.doctorFirstName,
        doctorLastName: doctor.doctorLastName,
        doctorEmail: doctor.doctorEmail,
        role: 'doctor',
        profileImage: doctor.profileImage,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error logging in doctor',
      error: error.message,
    });
  }
};

module.exports = {
  registerDoctor,
  loginDoctor,
};
