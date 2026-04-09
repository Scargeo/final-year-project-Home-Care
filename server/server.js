const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { createProxyMiddleware } = require('http-proxy-middleware');
// Load environment variables from .env file
const dotenv = require('dotenv');
dotenv.config();

// Connect to the database
const connectDB = require('./configurations/dbConnection');
connectDB();

const app = express();
app.use(express.json());
app.use(cors());

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



// Proxy API requests to the backend server
app.use('/external-api', createProxyMiddleware({
  target: process.env.BACKENDSERVER, // Backend server URL
  changeOrigin: true,
}));

const PORT = process.env.BACKENDSERVER_PORT || 3003;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
