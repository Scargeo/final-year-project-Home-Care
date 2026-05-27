const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from the server folder explicitly.
// Render may start the process from the repository root, so relying on CWD can miss server/.env.
dotenv.config({ path: path.resolve(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const Appointment = require('./models/privateHealthWorker/doctor/appointment');
const ConsultationRoom = require('./models/hospital/consultationRoom');
const { createNurseAssignmentForCompletedAppointment } = require('./lib/nurseAssignment')
// const { createProxyMiddleware } = require('http-proxy-middleware');

// Connect to the database
const connectDB = require('./configurations/dbConnection');
connectDB();

const app = express();
app.use(express.json());
// Basic security headers
app.use(helmet())

// Basic rate limiting to reduce abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith('/api/auth/login') || req.path.startsWith('/api/sos'),
})
app.use(limiter)

const authLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
})

app.use('/api/auth/login', authLoginLimiter)

// CORS configuration for frontend access
const allowedOrigins = [
  process.env.FRONTEND_LOCAL_URL,
  process.env.FRONTEND_APP_URL,
  process.env.FRONTEND_URL
  
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow non-browser requests (e.g., curl, server-to-server) when no origin is present
    if (!origin) return callback(null, true)
    if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true)
    return callback(new Error('CORS origin not allowed'), false)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PATCH'],
  },
});

// Real-time SOS sockets let providers see new alerts instantly without waiting for polling.
app.set('io', io);

function getAppointmentEndDate(appointment) {
  if (!appointment) return null

  const appointmentDate = new Date(appointment.appointmentDate)
  if (Number.isNaN(appointmentDate.getTime())) return null

  const [hours = 0, minutes = 0] = String(appointment.appointmentTime || '')
    .split(':')
    .map((value) => Number.parseInt(value, 10))

  appointmentDate.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0)
  appointmentDate.setMinutes(appointmentDate.getMinutes() + Number.parseInt(String(appointment.duration || 30), 10))
  return appointmentDate
}

async function completeEligibleRooms() {
  if (mongoose.connection.readyState !== 1) {
    return
  }

  const now = new Date()
  const rooms = await ConsultationRoom.find({
    status: { $nin: ['completed', 'cancelled'] },
    appointmentId: { $ne: '' },
    doctorJoinedAt: { $ne: null },
    patientJoinedAt: { $ne: null },
  }).lean()

  for (const room of rooms) {
    const appointment = await Appointment.findOne({ appointmentId: String(room.appointmentId || '') }).lean()
    if (!appointment) continue

    const terminalStatuses = new Set(['completed', 'cancelled', 'no-show'])
    if (terminalStatuses.has(String(appointment.status || '').toLowerCase())) continue

    const endTime = getAppointmentEndDate(appointment)
    if (!endTime || endTime.getTime() > now.getTime()) continue

    const completedAt = room.completedAt ? new Date(room.completedAt) : now
    const updatedAppointment = await Appointment.findOneAndUpdate(
      { appointmentId: appointment.appointmentId },
      { status: 'completed', updatedAt: now },
      { new: true },
    )

    if (!updatedAppointment) continue

    await ConsultationRoom.findOneAndUpdate(
      { roomId: room.roomId },
      { $set: { status: 'completed', completedAt } },
      { new: true },
    )

    await createNurseAssignmentForCompletedAppointment({
      appointment: updatedAppointment,
      room,
      io,
    }).catch((error) => {
      console.error('Failed to create nurse assignment from auto-completion:', error)
    })

    io.to(`appointments-doctor-${String(updatedAppointment.doctorId)}`).emit('appointment-updated', { appointment: updatedAppointment })
    io.to(`appointments-patient-${String(updatedAppointment.patientId)}`).emit('appointment-updated', { appointment: updatedAppointment })
  }
}

setInterval(() => {
  completeEligibleRooms().catch((error) => {
    console.error('Failed to auto-complete consultation rooms:', error?.message || error)
  })
}, 60 * 1000)

io.on('connection', (socket) => {
  socket.on('join-provider', () => {
    socket.join('providers');
  });

  socket.on('join-sos-room', (roomId) => {
    if (!roomId) return;
    socket.join(String(roomId));
  });

  // Real-time consent tracking: doctor receives updates on their consent requests
  socket.on('join-consent-doctor', (doctorId) => {
    if (!doctorId) return;
    socket.join(`consent-doctor-${String(doctorId)}`);
  });

  // Real-time consent tracking: patient receives consent requests and updates
  socket.on('join-consent-patient', (patientId) => {
    if (!patientId) return;
    socket.join(`consent-patient-${String(patientId)}`);
  });

  // Real-time patient notifications for assignment and care updates
  socket.on('join-notifications-patient', (patientId) => {
    if (!patientId) return;
    socket.join(`notifications-patient-${String(patientId)}`);
  });

  // Real-time appointment tracking: doctor receives appointment create/update events
  socket.on('join-appointments-doctor', (doctorId) => {
    if (!doctorId) return;
    socket.join(`appointments-doctor-${String(doctorId)}`);
  });

  // Real-time assignment tracking: nurse receives assignment create/update events
  socket.on('join-assignments-nurse', (nurseId) => {
    if (!nurseId) return;
    socket.join(`assignments-nurse-${String(nurseId)}`);
  });

  // Real-time nurse notifications room
  socket.on('join-notifications-nurse', (nurseId) => {
    if (!nurseId) return;
    socket.join(`notifications-nurse-${String(nurseId)}`);
  });

  // Real-time appointment tracking: patient receives appointment create/update events
  socket.on('join-appointments-patient', (patientId) => {
    if (!patientId) return;
    socket.join(`appointments-patient-${String(patientId)}`);
  });
});


app.use('/api/patients', require('./routes/patients/patientRoute'));
app.use('/api/nurses', require('./routes/privateHealthworker/privateNurse/nurseRoute'));
app.use('/api/doctors', require('./routes/privateHealthworker/privateDoctor/doctorDashboardRoute'));
// Unified auth (tries patient then doctor)
app.use('/api/auth', require('./routes/auth/authRoute'));
app.use('/api/admin', require('./routes/admin/adminRoute'));
// SOS routes persist alerts in MongoDB for live provider and patient tracking.
app.use('/api/sos', require('./routes/sos/sosRoute'));
// AI Chat routes for RAG chatbot
app.use('/api/ai', require('./routes/ai/chatRoute'));
// AI lab interpretation routes for doctor-uploaded lab files
app.use('/api/ai', require('./routes/ai/labResultRoute'));
// Uploads (images, pdfs) to Cloudinary
app.use('/api/uploads', require('./routes/uploadsRoute'));
// Public posts (doctors can post thoughts/images; visible to all users)
app.use('/api/posts', require('./routes/posts/postRoute'));
// Consultation room data for appointments (consent-aware record preview + doctor notes)
app.use('/api/rooms', require('./routes/rooms/roomRoute'));



// // Proxy API requests to the backend server
// app.use('/external-api', createProxyMiddleware({
//   target: process.env.BACKENDSERVER, // Backend server URL
//   changeOrigin: true,
// }));

const PORT = process.env.BACKENDSERVER_PORT || 3003;

server.on('error', (error) => {
  if (error?.code === 'EADDRINUSE') {
    console.log(`Server port ${PORT} is already in use. An existing backend server may already be running.`);
    process.exit(0);
  }

  console.error('Failed to start backend server:', error);
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
