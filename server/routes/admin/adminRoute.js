const express = require('express')
const bcrypt = require('bcrypt')
const { nanoid } = require('nanoid')

const { loadUser } = require('../../middleware/loadUserMiddleware')
const { signToken } = require('../../middleware/jwtAuth')
const Admin = require('../../models/admin/adminUser')
const Doctor = require('../../models/privateHealthWorker/doctor/doctorRegistration')
const Nurse = require('../../models/privateHealthWorker/nurse/privateNurseRegistration')
const Patient = require('../../models/patient/patientRegistration')
const Post = require('../../models/posts/post')

const router = express.Router()

function requireAdmin(req, res, next) {
  if (req.user?.role === 'admin') return next()
  return res.status(403).json({ message: 'Admin access required' })
}

function stripAdmin(admin) {
  if (!admin) return null
  return {
    adminId: admin.adminId,
    adminName: admin.adminName,
    adminEmail: admin.adminEmail,
    role: 'admin',
    isSuperAdmin: Boolean(admin.isSuperAdmin),
    createdAt: admin.createdAt,
    updatedAt: admin.updatedAt,
  }
}

function stripDoctor(doctor) {
  if (!doctor) return null
  return {
    doctorId: doctor.doctorId,
    doctorFirstName: doctor.doctorFirstName,
    doctorLastName: doctor.doctorLastName,
    doctorEmail: doctor.doctorEmail,
    doctorPhone: doctor.doctorPhone,
    doctorAddress: doctor.doctorAddress,
    specialization: doctor.specialization,
    licenseNumber: doctor.licenseNumber,
    yearsOfExperience: doctor.yearsOfExperience || 0,
    profileImage: doctor.profileImage || null,
    isVerified: Boolean(doctor.isVerified),
    isAvailable: doctor.isAvailable !== false,
    role: doctor.role || 'doctor',
    createdAt: doctor.createdAt,
    updatedAt: doctor.updatedAt,
  }
}

function stripNurse(nurse) {
  if (!nurse) return null
  return {
    nurseId: nurse.uid,
    nurseFirstName: nurse.nurseFirstName,
    nurseLastName: nurse.nurseLastName,
    nurseEmail: nurse.nurseEmail,
    nursePhone: nurse.nursePhone,
    nurseAddress: nurse.nurseAddress,
    specialization: nurse.specialization,
    yearsOfExperience: nurse.yearsOfExperience || 0,
    profileImage: nurse.profileImage || null,
    isVerified: Boolean(nurse.isVerified),
    isAvailable: nurse.isAvailable !== false,
    role: nurse.role || 'nurse',
    createdAt: nurse.createdAt,
    updatedAt: nurse.updatedAt,
  }
}

function stripPatient(patient) {
  if (!patient) return null
  return {
    patientId: patient.patientId,
    patientFirstName: patient.patientFirstName,
    patientLastName: patient.patientLastName,
    patientEmail: patient.patientEmail,
    patientPhone: patient.patientPhone,
    patientAddress: patient.patientAddress,
    profileImage: patient.profileImage || null,
    online: Boolean(patient.online),
    aiActive: Boolean(patient.aiActive),
    role: 'patient',
    createdAt: patient.createdAt,
    updatedAt: patient.updatedAt,
  }
}

function stripPost(post) {
  if (!post) return null
  return {
    postId: post.postId,
    author: post.author,
    body: post.body,
    images: Array.isArray(post.images) ? post.images : [],
    visibility: post.visibility,
    likes: post.likes || { count: 0, userIds: [] },
    comments: post.comments || { count: 0, list: [] },
    shares: post.shares || { count: 0 },
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  }
}

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null) return fallback
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return ['true', '1', 'yes', 'on'].includes(value.toLowerCase())
  return Boolean(value)
}

async function hashPassword(password) {
  return bcrypt.hash(String(password), 10)
}

router.post('/bootstrap', async (req, res) => {
  try {
    // Protect bootstrap: require ADMIN_BOOTSTRAP_KEY when set, and disable in production if not set
    const bootstrapKeyRequired = Boolean(process.env.ADMIN_BOOTSTRAP_KEY)
    if (bootstrapKeyRequired) {
      const provided = String(req.body?.bootstrapKey || '')
      if (!provided || provided !== String(process.env.ADMIN_BOOTSTRAP_KEY)) {
        return res.status(403).json({ message: 'Bootstrap key missing or invalid' })
      }
    } else if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
      return res.status(403).json({ message: 'Bootstrap endpoint disabled in production' })
    }
    const existingCount = await Admin.countDocuments()
    if (existingCount > 0) {
      return res.status(409).json({ message: 'An admin account already exists.' })
    }

    const { adminName, adminEmail, adminPassword } = req.body || {}
    if (!adminName || !adminEmail || !adminPassword) {
      return res.status(400).json({ message: 'adminName, adminEmail, and adminPassword are required.' })
    }

    const admin = await Admin.create({
      adminId: `ADM-${nanoid(8).toUpperCase()}`,
      adminName: String(adminName).trim(),
      adminEmail: String(adminEmail).trim().toLowerCase(),
      adminPassword: await hashPassword(adminPassword),
      role: 'admin',
      isSuperAdmin: true,
    })

    const token = signToken({ id: admin.adminId, role: 'admin', adminId: admin.adminId, adminEmail: admin.adminEmail })
    const { signRefreshToken } = require('../../middleware/jwtAuth')
    const refreshToken = await signRefreshToken({ id: admin.adminId, role: 'admin', adminId: admin.adminId })

    return res.status(201).json({
      message: 'Admin account created',
      token,
      refreshToken,
      user: stripAdmin(admin),
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to bootstrap admin account', error: error.message })
  }
})

router.post('/login', async (req, res) => {
  try {
    const { adminEmail, adminPassword } = req.body || {}
    if (!adminEmail || !adminPassword) {
      return res.status(400).json({ message: 'adminEmail and adminPassword are required.' })
    }

    const admin = await Admin.findOne({ adminEmail: String(adminEmail).trim().toLowerCase() })
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' })
    }

    const isMatch = await bcrypt.compare(String(adminPassword), admin.adminPassword)
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const token = signToken({ id: admin.adminId, role: 'admin', adminId: admin.adminId, adminEmail: admin.adminEmail })
    const { signRefreshToken } = require('../../middleware/jwtAuth')
    const refreshToken = await signRefreshToken({ id: admin.adminId, role: 'admin', adminId: admin.adminId })
    return res.status(200).json({
      message: 'Login successful',
      token,
      refreshToken,
      user: stripAdmin(admin),
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to log in admin', error: error.message })
  }
})

router.use(loadUser)
router.use(requireAdmin)

router.get('/me', async (req, res) => {
  return res.status(200).json({ user: stripAdmin(req.user?.record) })
})

router.get('/summary', async (_req, res) => {
  try {
    const [doctorCount, pendingDoctorCount, nurseCount, patientCount, postCount, adminCount] = await Promise.all([
      Doctor.countDocuments(),
      Doctor.countDocuments({ isVerified: false }),
      Nurse.countDocuments(),
      Patient.countDocuments(),
      Post.countDocuments(),
      Admin.countDocuments(),
    ])

    return res.status(200).json({
      counts: {
        doctors: doctorCount,
        nurses: nurseCount,
        pendingDoctors: pendingDoctorCount,
        patients: patientCount,
        posts: postCount,
        admins: adminCount,
      },
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load admin summary', error: error.message })
  }
})

router.get('/doctors', async (_req, res) => {
  try {
    const doctors = await Doctor.find().sort({ createdAt: -1 }).lean()
    return res.status(200).json({ doctors: doctors.map(stripDoctor) })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch doctors', error: error.message })
  }
})

router.get('/doctors/pending', async (_req, res) => {
  try {
    const doctors = await Doctor.find({ isVerified: false }).sort({ createdAt: -1 }).lean()
    return res.status(200).json({ doctors: doctors.map(stripDoctor) })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch pending doctors', error: error.message })
  }
})

router.get('/nurses', async (_req, res) => {
  try {
    const nurses = await Nurse.find().sort({ createdAt: -1 }).lean()
    return res.status(200).json({ nurses: nurses.map(stripNurse) })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch nurses', error: error.message })
  }
})

router.post('/nurses', async (req, res) => {
  try {
    const {
      nurseFirstName,
      nurseLastName,
      nurseEmail,
      nursePhone,
      nursePassword,
      nurseAddress,
      specialization,
      yearsOfExperience,
      isVerified = false,
      isAvailable = true,
    } = req.body || {}

    if (!nurseFirstName || !nurseLastName || !nurseEmail || !nursePhone || !nursePassword || !nurseAddress) {
      return res.status(400).json({ message: 'nurseFirstName, nurseLastName, nurseEmail, nursePhone, nursePassword, and nurseAddress are required.' })
    }

    const nurse = await Nurse.create({
      uid: `PNUR-${nanoid(8).toUpperCase()}`,
      nurseFirstName: String(nurseFirstName).trim(),
      nurseLastName: String(nurseLastName).trim(),
      nurseEmail: String(nurseEmail).trim().toLowerCase(),
      nursePhone: String(nursePhone).trim(),
      nursePassword: await hashPassword(nursePassword),
      nurseAddress: String(nurseAddress).trim(),
      specialization: specialization ? String(specialization).trim() : '',
      yearsOfExperience: Number(yearsOfExperience) || 0,
      isVerified: normalizeBoolean(isVerified, false),
      isAvailable: normalizeBoolean(isAvailable, true),
      role: 'nurse',
    })

    return res.status(201).json({ message: 'Nurse created', nurse: stripNurse(nurse) })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create nurse', error: error.message })
  }
})

router.patch('/nurses/:nurseId', async (req, res) => {
  try {
    const { nurseId } = req.params
    const updates = { ...(req.body || {}) }

    if (updates.nursePassword) updates.nursePassword = await hashPassword(updates.nursePassword)
    if (updates.nurseEmail !== undefined) updates.nurseEmail = String(updates.nurseEmail).trim().toLowerCase()
    if (updates.nurseFirstName !== undefined) updates.nurseFirstName = String(updates.nurseFirstName).trim()
    if (updates.nurseLastName !== undefined) updates.nurseLastName = String(updates.nurseLastName).trim()
    if (updates.nursePhone !== undefined) updates.nursePhone = String(updates.nursePhone).trim()
    if (updates.nurseAddress !== undefined) updates.nurseAddress = String(updates.nurseAddress).trim()
    if (updates.specialization !== undefined) updates.specialization = String(updates.specialization).trim()
    if (updates.yearsOfExperience !== undefined) updates.yearsOfExperience = Number(updates.yearsOfExperience) || 0
    if (updates.isVerified !== undefined) updates.isVerified = normalizeBoolean(updates.isVerified, false)
    if (updates.isAvailable !== undefined) updates.isAvailable = normalizeBoolean(updates.isAvailable, true)

    const nurse = await Nurse.findOneAndUpdate({ uid: nurseId }, { $set: updates }, { new: true }).lean()
    if (!nurse) return res.status(404).json({ message: 'Nurse not found' })

    return res.status(200).json({ message: 'Nurse updated', nurse: stripNurse(nurse) })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update nurse', error: error.message })
  }
})

router.delete('/nurses/:nurseId', async (req, res) => {
  try {
    const { nurseId } = req.params
    const result = await Nurse.deleteOne({ uid: nurseId })
    if (!result.deletedCount) return res.status(404).json({ message: 'Nurse not found' })
    return res.status(200).json({ message: 'Nurse deleted', nurseId })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete nurse', error: error.message })
  }
})

router.patch('/nurses/:nurseId/verify', async (req, res) => {
  try {
    const { nurseId } = req.params
    const nextVerified = normalizeBoolean(req.body?.isVerified, true)

    const nurse = await Nurse.findOneAndUpdate(
      { uid: nurseId },
      { $set: { isVerified: nextVerified } },
      { new: true },
    ).lean()
    if (!nurse) return res.status(404).json({ message: 'Nurse not found' })

    return res.status(200).json({ message: 'Nurse updated', nurse: stripNurse(nurse) })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update nurse', error: error.message })
  }
})

router.post('/doctors', async (req, res) => {
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
      isVerified = false,
      isAvailable = true,
    } = req.body || {}

    if (!doctorFirstName || !doctorLastName || !doctorEmail || !doctorPhone || !doctorPassword) {
      return res.status(400).json({ message: 'doctorFirstName, doctorLastName, doctorEmail, doctorPhone, and doctorPassword are required.' })
    }

    const doctor = await Doctor.create({
      doctorId: `DOC-${nanoid(8).toUpperCase()}`,
      doctorFirstName: String(doctorFirstName).trim(),
      doctorLastName: String(doctorLastName).trim(),
      doctorEmail: String(doctorEmail).trim().toLowerCase(),
      doctorPhone: String(doctorPhone).trim(),
      doctorPassword: await hashPassword(doctorPassword),
      doctorAddress: doctorAddress ? String(doctorAddress).trim() : '',
      specialization: specialization ? String(specialization).trim() : '',
      licenseNumber: licenseNumber ? String(licenseNumber).trim() : '',
      yearsOfExperience: Number(yearsOfExperience) || 0,
      isVerified: normalizeBoolean(isVerified, false),
      isAvailable: normalizeBoolean(isAvailable, true),
    })

    return res.status(201).json({ message: 'Doctor created', doctor: stripDoctor(doctor) })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create doctor', error: error.message })
  }
})

router.patch('/doctors/:doctorId/verify', async (req, res) => {
  try {
    const { doctorId } = req.params
    const { isVerified = true } = req.body || {}

    const doctor = await Doctor.findOneAndUpdate(
      { doctorId },
      { $set: { isVerified: normalizeBoolean(isVerified, true) } },
      { new: true },
    )

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' })
    }

    return res.status(200).json({ message: 'Doctor verification updated', doctor: stripDoctor(doctor) })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update doctor verification', error: error.message })
  }
})

router.patch('/doctors/:doctorId', async (req, res) => {
  try {
    const { doctorId } = req.params
    const updates = { ...(req.body || {}) }

    if (updates.doctorPassword) {
      updates.doctorPassword = await hashPassword(updates.doctorPassword)
    }

    if (updates.doctorEmail) updates.doctorEmail = String(updates.doctorEmail).trim().toLowerCase()
    if (updates.doctorFirstName) updates.doctorFirstName = String(updates.doctorFirstName).trim()
    if (updates.doctorLastName) updates.doctorLastName = String(updates.doctorLastName).trim()
    if (updates.doctorPhone) updates.doctorPhone = String(updates.doctorPhone).trim()
    if (updates.doctorAddress !== undefined) updates.doctorAddress = String(updates.doctorAddress).trim()
    if (updates.specialization !== undefined) updates.specialization = String(updates.specialization).trim()
    if (updates.licenseNumber !== undefined) updates.licenseNumber = String(updates.licenseNumber).trim()
    if (updates.yearsOfExperience !== undefined) updates.yearsOfExperience = Number(updates.yearsOfExperience) || 0
    if (updates.isVerified !== undefined) updates.isVerified = normalizeBoolean(updates.isVerified, false)
    if (updates.isAvailable !== undefined) updates.isAvailable = normalizeBoolean(updates.isAvailable, true)

    const doctor = await Doctor.findOneAndUpdate({ doctorId }, { $set: updates }, { new: true })
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' })

    return res.status(200).json({ message: 'Doctor updated', doctor: stripDoctor(doctor) })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update doctor', error: error.message })
  }
})

router.delete('/doctors/:doctorId', async (req, res) => {
  try {
    const { doctorId } = req.params
    const result = await Doctor.deleteOne({ doctorId })
    if (!result.deletedCount) {
      return res.status(404).json({ message: 'Doctor not found' })
    }
    return res.status(200).json({ message: 'Doctor deleted', doctorId })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete doctor', error: error.message })
  }
})

router.get('/patients', async (_req, res) => {
  try {
    const patients = await Patient.find().sort({ createdAt: -1 }).lean()
    return res.status(200).json({ patients: patients.map(stripPatient) })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch patients', error: error.message })
  }
})

router.post('/patients', async (req, res) => {
  try {
    const {
      patientFirstName,
      patientLastName,
      patientEmail,
      patientPhone,
      patientPassword,
      patientAddress,
    } = req.body || {}

    if (!patientFirstName || !patientLastName || !patientEmail || !patientPhone || !patientPassword || !patientAddress) {
      return res.status(400).json({ message: 'All patient fields are required.' })
    }

    const patient = await Patient.create({
      patientId: `PAT-${nanoid(8).toUpperCase()}`,
      patientFirstName: String(patientFirstName).trim(),
      patientLastName: String(patientLastName).trim(),
      patientEmail: String(patientEmail).trim().toLowerCase(),
      patientPhone: String(patientPhone).trim(),
      patientPassword: await hashPassword(patientPassword),
      patientAddress: String(patientAddress).trim(),
    })

    return res.status(201).json({ message: 'Patient created', patient: stripPatient(patient) })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create patient', error: error.message })
  }
})

router.patch('/patients/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params
    const updates = { ...(req.body || {}) }

    if (updates.patientPassword) {
      updates.patientPassword = await hashPassword(updates.patientPassword)
    }
    if (updates.patientEmail) updates.patientEmail = String(updates.patientEmail).trim().toLowerCase()
    if (updates.patientFirstName) updates.patientFirstName = String(updates.patientFirstName).trim()
    if (updates.patientLastName) updates.patientLastName = String(updates.patientLastName).trim()
    if (updates.patientPhone) updates.patientPhone = String(updates.patientPhone).trim()
    if (updates.patientAddress !== undefined) updates.patientAddress = String(updates.patientAddress).trim()
    if (updates.online !== undefined) updates.online = normalizeBoolean(updates.online, false)
    if (updates.aiActive !== undefined) updates.aiActive = normalizeBoolean(updates.aiActive, false)

    const patient = await Patient.findOneAndUpdate({ patientId }, { $set: updates }, { new: true })
    if (!patient) return res.status(404).json({ message: 'Patient not found' })

    return res.status(200).json({ message: 'Patient updated', patient: stripPatient(patient) })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update patient', error: error.message })
  }
})

router.delete('/patients/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params
    const result = await Patient.deleteOne({ patientId })
    if (!result.deletedCount) {
      return res.status(404).json({ message: 'Patient not found' })
    }
    return res.status(200).json({ message: 'Patient deleted', patientId })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete patient', error: error.message })
  }
})

router.get('/posts', async (_req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 }).lean()
    return res.status(200).json({ posts: posts.map(stripPost) })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch posts', error: error.message })
  }
})

router.post('/posts', async (req, res) => {
  try {
    const { body, images = [], visibility = 'public' } = req.body || {}
    if (!body && (!Array.isArray(images) || images.length === 0)) {
      return res.status(400).json({ message: 'Post must include text or images.' })
    }

    const admin = req.user?.record || {}
    const post = await Post.create({
      postId: `POST-${nanoid(8).toUpperCase()}`,
      author: {
        id: admin.adminId || req.user?.id || 'admin',
        name: admin.adminName || 'Admin',
        role: 'admin',
        profileImage: admin.profileImage || null,
      },
      body: String(body || '').trim(),
      images: Array.isArray(images) ? images : [],
      visibility: visibility === 'private' ? 'private' : 'public',
    })

    return res.status(201).json({ message: 'Post created', post: stripPost(post) })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create post', error: error.message })
  }
})

router.patch('/posts/:postId', async (req, res) => {
  try {
    const { postId } = req.params
    const updates = { ...(req.body || {}) }
    if (updates.body !== undefined) updates.body = String(updates.body).trim()
    if (updates.visibility !== undefined) updates.visibility = updates.visibility === 'private' ? 'private' : 'public'
    if (updates.images !== undefined && !Array.isArray(updates.images)) updates.images = []

    const post = await Post.findOneAndUpdate({ postId }, { $set: updates }, { new: true })
    if (!post) return res.status(404).json({ message: 'Post not found' })

    return res.status(200).json({ message: 'Post updated', post: stripPost(post) })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update post', error: error.message })
  }
})

router.delete('/posts/:postId', async (req, res) => {
  try {
    const { postId } = req.params
    const result = await Post.deleteOne({ postId })
    if (!result.deletedCount) {
      return res.status(404).json({ message: 'Post not found' })
    }
    return res.status(200).json({ message: 'Post deleted', postId })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete post', error: error.message })
  }
})

module.exports = router
