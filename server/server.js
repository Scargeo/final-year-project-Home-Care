const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
// const { createProxyMiddleware } = require('http-proxy-middleware');
// Load environment variables from .env file
const dotenv = require('dotenv');
dotenv.config();

// Connect to the database
const connectDB = require('./configurations/dbConnection');
connectDB();

const app = express();
app.use(express.json());

const corsOptions = {
  origin: [
    "http://localhost:3000",
    "https://final-year-project-home-care.vercel.app",
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: true,
    methods: ['GET', 'POST', 'PATCH'],
  },
});

// Real-time SOS sockets let providers see new alerts instantly without waiting for polling.
app.set('io', io);

io.on('connection', (socket) => {
  socket.on('join-provider', () => {
    socket.join('providers');
  });

  socket.on('join-sos-room', (roomId) => {
    if (!roomId) return;
    socket.join(String(roomId));
  });
});


app.use('/api/patients', require('./routes/patients/patientRoute'));
app.use('/api/nurses', require('./routes/privateHealthworker/privateNurse/nurseRoute'));
// SOS routes persist alerts in MongoDB for live provider and patient tracking.
app.use('/api/sos', require('./routes/sos/sosRoute'));
// AI Chat routes for RAG chatbot
app.use('/api/ai', require('./routes/ai/chatRoute'));



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
