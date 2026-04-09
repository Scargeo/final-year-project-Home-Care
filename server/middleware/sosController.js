const SOSAlert = require('../models/sos/sosAlert');

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

function toClientShape(document) {
  const json = document.toJSON ? document.toJSON() : document;
  return {
    ...json,
    id: String(json._id),
  };
}

const listSOSRequests = async (_req, res) => {
  try {
    const requests = await SOSAlert.find({}).sort({ createdAt: -1 }).lean();
    return res.status(200).json({
      requests: requests.map((request) => ({ ...request, id: String(request._id) })),
      providers,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load SOS requests.', error: error.message });
  }
};

const createSOSRequest = async (req, res) => {
  try {
    const location = String(req.body.location || '').trim();
    if (!location) {
      return res.status(400).json({ message: 'Location is required for emergency alerts.' });
    }

    const patientName = String(req.body.patientName || 'Unknown patient').trim() || 'Unknown patient';
    const createdAt = new Date();
    const alert = await SOSAlert.create({
      patientName,
      patientPhone: String(req.body.patientPhone || '').trim(),
      location,
      address: String(req.body.address || '').trim(),
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
    return res.status(500).json({ message: 'Failed to create SOS request.', error: error.message });
  }
};

const getSOSRequestById = async (req, res) => {
  try {
    const emergency = await SOSAlert.findById(req.params.id);
    if (!emergency) {
      return res.status(404).json({ message: 'Emergency request not found' });
    }

    return res.status(200).json({ emergency: toClientShape(emergency) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load SOS request.', error: error.message });
  }
};

const updateSOSRequest = async (req, res) => {
  try {
    const action = String(req.body.action || '').toLowerCase();
    const providerName = String(req.body.providerName || '').trim();

    const emergency = await SOSAlert.findById(req.params.id);
    if (!emergency) {
      return res.status(404).json({ message: 'Emergency request not found' });
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
      const chatNote = `Chat started by ${providerName || 'provider'}`;
      const noteAt = new Date();
      emergency.notes.push({ label: chatNote, at: noteAt });
      emergency.timeline.push({ type: 'note', label: chatNote, at: noteAt });
    }

    await emergency.save();

    emitSosEvent(req, 'sos-updated', {
      emergency: toClientShape(emergency),
    });

    return res.status(200).json({
      message: 'Emergency request updated',
      emergency: toClientShape(emergency),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update SOS request.', error: error.message });
  }
};

module.exports = {
  listSOSRequests,
  createSOSRequest,
  getSOSRequestById,
  updateSOSRequest,
};
