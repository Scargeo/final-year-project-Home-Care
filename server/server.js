const express = require('express');
const cors = require('cors');
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


app.use('/api/patients', require('./routes/patients/patientRoute'));
app.use('/api/nurses', require('./routes/privateHealthworker/privateNurse/nurseRoute'));



// Proxy API requests to the backend server
app.use('/external-api', createProxyMiddleware({
  target: process.env.BACKENDSERVER, // Backend server URL
  changeOrigin: true,
}));

const PORT = process.env.BACKENDSERVER_PORT || 3003;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
