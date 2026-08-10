const mongoose = require('mongoose');
const SOSAlert = require('../models/sos/sosAlert');

function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

function dbUnavailable(res) {
  return res.status(503).json({ message: 'Database temporarily unavailable. Please try again in a moment.' });
}

function isTransientDbError(error) {
  const message = String(error?.message || error?.name || '').toLowerCase();
  return message.includes('enotfound') ||
    message.includes('eai_again') ||
    message.includes('getaddrinfo') ||
    message.includes('connection error') ||
    message.includes('topology was destroyed') ||
    message.includes('server selection') ||
    message.includes('buffering timed out');
}

// Static provider roster can be replaced by authenticated provider records later.
const providers = [
  {
    id: 'dr-ama',
    name: 'Dr. Ama Mensah',
    role: 'Doctor',
    specialty: 'Emergency Medicine',
    status: 'Available',
  },
  {
    id: 'nurse-kwame',
    name: 'Nurse Kwame Boateng',
    role: 'Nurse',
    specialty: 'Triage & Home Care',
    status: 'Available',
  },
  {
    id: 'dr-elijah',
    name: 'Dr. Elijah Mensah',
    role: 'Doctor',
    specialty: 'Internal Medicine',
    status: 'Available',
  },
];

function providerTargets() {
  return providers.map((provider) => ({
    id: provider.id,
    name: provider.name,
    role: provider.role,
    specialty: provider.specialty,
  }));
}

function emitSosEvent(req, eventName, payload) {
  const io = req?.app?.get('io');
  if (!io) return;

  // Socket broadcasts keep provider views in sync the moment SOS state changes.
  io.to('providers').emit(eventName, payload);
  if (payload?.emergency?.chatRoomId) {
    io.to(payload.emergency.chatRoomId).emit(eventName, payload);
  }
}

function emitRoomEvent(req, roomId, eventName, payload) {
  const io = req?.app?.get('io');
  if (!io || !roomId) return;

  io.to(String(roomId)).emit(eventName, payload);
}

function toClientShape(document) {
  const json = document.toJSON ? document.toJSON() : document;
  return {
    ...json,
    id: String(json._id),
  };
}

const listSOSRequests = async (_req, res) => {
  try {
    if (!isDbConnected()) return dbUnavailable(res);
    const requests = await SOSAlert.find({}).sort({ createdAt: -1 }).maxTimeMS(30000).lean();
    return res.status(200).json({
      requests: requests.map((request) => ({ ...request, id: String(request._id) })),
      providers,
    });
  } catch (error) {
    if (isTransientDbError(error)) return dbUnavailable(res);
    return res.status(500).json({ message: 'Failed to load SOS requests.' });
  }
};

const createSOSRequest = async (req, res) => {
  try {
    if (!isDbConnected()) return dbUnavailable(res);
    const location = String(req.body.location || '').trim();
    if (!location) {
      return res.status(400).json({ message: 'Location is required for emergency alerts.' });
    }

const patientName = String(req.body.patientName || 'Unknown patient').trim() || 'Unknown patient';
    const createdAt = new Date();
    const coordsRaw = req.body.locationCoords;
    const locationCoords = coordsRaw && Number.isFinite(Number(coordsRaw.lat)) && Number.isFinite(Number(coordsRaw.lng))
      ? { lat: Number(coordsRaw.lat), lng: Number(coordsRaw.lng) }
      : null;
    const alert = await SOSAlert.create({
      patientName,
      patientPhone: String(req.body.patientPhone || '').trim(),
      location,
      address: String(req.body.address || '').trim(),
      locationCoords,
      symptoms: String(req.body.symptoms || 'Emergency help requested').trim() || 'Emergency help requested',
      chatRoomId: `emergency-${Date.now()}`,
      notifiedTo: providerTargets(),
      timeline: [
        {
          type: 'created',
          label: 'Emergency request sent to available doctors and nurses',
          at: createdAt,
        },
      ],
    });

    // Keep room IDs stable and tied to the persisted SOS identifier.
    alert.chatRoomId = `emergency-${alert._id}`;
    await alert.save();

emitSosEvent(req, 'sos-created', {
      emergency: toClientShape(alert),
    });

    return res.status(201).json({
      message: 'Emergency alert sent',
      emergency: toClientShape(alert),
    });
  } catch (error) {
    if (isTransientDbError(error)) return dbUnavailable(res);
    return res.status(500).json({ message: 'Failed to create SOS request.' });
  }
};

const getSOSRequestById = async (req, res) => {
  try {
    if (!isDbConnected()) return dbUnavailable(res);
    const emergency = await SOSAlert.findById(req.params.id).maxTimeMS(30000);
    if (!emergency) {
      return res.status(404).json({ message: 'Emergency request not found' });
    }

    return res.status(200).json({ emergency: toClientShape(emergency) });
  } catch (error) {
    if (isTransientDbError(error)) return dbUnavailable(res);
    return res.status(500).json({ message: 'Failed to load SOS request.' });
  }
};

const SOS_EXPIRY_MS = 24 * 60 * 60 * 1000;

function isRequestExpired(emergency) {
  if (!emergency?.createdAt) return false;
  const created = new Date(emergency.createdAt).getTime();
  if (Number.isNaN(created)) return false;
  return Date.now() - created > SOS_EXPIRY_MS;
}

const updateSOSRequest = async (req, res) => {
  try {
    if (!isDbConnected()) return dbUnavailable(res);
    const action = String(req.body.action || '').toLowerCase();
    const providerName = String(req.body.providerName || '').trim();
    const isGatedAction = ['accept', 'chat', 'call'].includes(action);

    const emergency = await SOSAlert.findById(req.params.id).maxTimeMS(30000);
    if (!emergency) {
      return res.status(404).json({ message: 'Emergency request not found' });
    }

    // Enforce 24-hour expiry and single-provider ownership on the server so the
    // UI gating cannot be bypassed by calling the API directly.
    if (isGatedAction) {
      if (isRequestExpired(emergency)) {
        return res.status(410).json({ message: 'This emergency request has expired.' });
      }

      if (emergency.status === 'accepted' && emergency.respondedBy && emergency.respondedBy !== providerName) {
        return res.status(409).json({ message: 'This request has already been claimed by another provider.' });
      }
    }

    if (action === 'accept') {
      emergency.status = 'accepted';
      emergency.acceptedAt = new Date();
      emergency.respondedBy = providerName || emergency.respondedBy || 'Available provider';
      emergency.timeline.push({
        type: 'accepted',
        label: `${emergency.respondedBy} accepted the emergency request`,
        at: emergency.acceptedAt,
      });
    } else if (action === 'note') {
      const noteLabel = String(req.body.note || '').trim() || 'Provider note added';
      const noteAt = new Date();
      emergency.notes.push({ label: noteLabel, at: noteAt });
      emergency.timeline.push({ type: 'note', label: noteLabel, at: noteAt });
} else if (action === 'chat') {
      const noteAt = new Date();
      const joinedBy = providerName || emergency.respondedBy || 'provider';
      const chatNote = `${joinedBy} started chat`;
      emergency.notes.push({ label: chatNote, at: noteAt });
      emergency.timeline.push({ type: 'chat-started', label: chatNote, at: noteAt });
    } else if (action === 'call') {
      const noteAt = new Date();
      const callerName = providerName || emergency.respondedBy || 'provider';
      const callNote = `${callerName} started a voice call`;
      emergency.notes.push({ label: callNote, at: noteAt });
      emergency.timeline.push({ type: 'call-started', label: callNote, at: noteAt });
    }

    await emergency.save();

    emitSosEvent(req, 'sos-updated', {
      emergency: toClientShape(emergency),
    });

    if (action === 'chat') {
      const startedAt = new Date().toISOString();
      emitRoomEvent(req, emergency.chatRoomId, 'provider-joined-chat', {
        emergency: toClientShape(emergency),
        chatRoomId: emergency.chatRoomId,
        providerName: emergency.respondedBy || providerName || 'provider',
        startedAt,
      });
    }

    if (action === 'call') {
      const startedAt = new Date().toISOString();
      // Ring the patient's app so they know a provider is calling them.
      emitRoomEvent(req, emergency.chatRoomId, 'provider-calling', {
        emergency: toClientShape(emergency),
        chatRoomId: emergency.chatRoomId,
        providerName: emergency.respondedBy || providerName || 'provider',
        startedAt,
      });
    }

return res.status(200).json({
      message: 'Emergency request updated',
      emergency: toClientShape(emergency),
    });
  } catch (error) {
    if (isTransientDbError(error)) return dbUnavailable(res);
    return res.status(500).json({ message: 'Failed to update SOS request.' });
  }
};

module.exports = {
  listSOSRequests,
  createSOSRequest,
  getSOSRequestById,
  updateSOSRequest,
};
