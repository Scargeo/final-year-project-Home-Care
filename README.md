# HomeCare Hospital - Healthcare Platform

A comprehensive healthcare management system built with **Next.js**, **React**, **Node.js**, and **MongoDB**.

## Project Structure

- **Frontend**: Next.js with React components
- **Backend**: Express.js server with MongoDB
- **Database**: MongoDB Atlas for data persistence
- **Real-time**: Socket.io for live SOS alerts and emergency response

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB Atlas connection string
- npm or yarn

### Installation

1. **Install dependencies**:
   ```bash
   npm install
   npm --prefix ./server install
   ```

2. **Configure environment variables**:
   - Create `.env.local` in root for frontend
   - Create `server/.env` for backend
   - Update database credentials

3. **Start development servers**:
   ```bash
   npm run dev        # Starts frontend (Next.js) + signaling
   npm run dev:frontend  # Frontend only
   npm run dev:signaling  # Signaling / API server only
   ```

4. **Build for production**:
   ```bash
   npm run build
   npm start
   ```

## Features

- Emergency SOS system with real-time notifications
- Doctor and nurse appointment booking
- Pharmacy locator and medication ordering
- RAG-based AI chatbot for health assistance
- Secure video/audio calls
- Patient health records management

## Environment Variables

**Frontend local development (.env.local)**:
```
LOCAL_BACKEND_URL=http://localhost:8000
LOCAL_SOS_SOCKET_URL=http://localhost:3003
```

**Frontend production on Vercel**:
```
NEXT_PUBLIC_API_BASE_URL=https://home-care-ob1m.onrender.com
NEXT_PUBLIC_SOS_SOCKET_URL=https://home-care-ob1m.onrender.com
```

Do not set localhost values in Vercel. The deployed frontend should point to Render only.
After changing backend CORS settings, redeploy the Render server so Vercel browsers can call it directly.

**Backend (server/.env)**:
```
BACKENDSERVER=http://localhost
BACKENDSERVER_PORT=8000
MONGO_STRING=mongodb+srv://...
```

## Troubleshooting

See [QUICKSTART.md](QUICKSTART.md) and [VERIFICATION_CHECKLIST.md](VERIFICATION_CHECKLIST.md) for detailed setup guides and debugging steps.

