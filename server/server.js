const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const Appointment = require('./models/privateHealthWorker/doctor/appointment');
const ConsultationRoom = require('./models/hospital/consultationRoom');
// const { createProxyMiddleware } = require('http-proxy-middleware');
// Load environment variables from .env file
const dotenv = require('dotenv');
dotenv.config();

// Connect to the database
const connectDB = require('./configurations/dbConnection');
connectDB();

const app = express();
app.use(express.json());

// CORS configuration for frontend access
const allowedOrigins = [
  "http://localhost:3000",
  "https://final-year-project-home-care.vercel.app",
  "https://final-year-project-home-care.netlify.app",
  process.env.FRONTEND_URL,
  process.env.CLIENT_URL,
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, true); // Allow requests for now, remove CORS restriction
    }
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
    origin: true,
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

    io.to(`appointments-doctor-${String(updatedAppointment.doctorId)}`).emit('appointment-updated', { appointment: updatedAppointment })
    io.to(`appointments-patient-${String(updatedAppointment.patientId)}`).emit('appointment-updated', { appointment: updatedAppointment })
  }
}

setInterval(() => {
  completeEligibleRooms().catch((error) => {
    console.error('Failed to auto-complete consultation rooms:', error)
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

  // Real-time appointment tracking: doctor receives appointment create/update events
  socket.on('join-appointments-doctor', (doctorId) => {
    if (!doctorId) return;
    socket.join(`appointments-doctor-${String(doctorId)}`);
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
