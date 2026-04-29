const providers = [
  {
    id: "dr-ama",
    name: "Dr. Ama Mensah",
    role: "Doctor",
    specialty: "Emergency Medicine",
    status: "Available",
  },
  {
    id: "nurse-kwame",
    name: "Nurse Kwame Boateng",
    role: "Nurse",
    specialty: "Triage & Home Care",
    status: "Available",
  },
  {
    id: "dr-elijah",
    name: "Dr. Elijah Mensah",
    role: "Doctor",
    specialty: "Internal Medicine",
    status: "Available",
  },
]

const emergencyRequests = new Map()

function nowIso() {
  return new Date().toISOString()
}

function buildAlertTargets() {
  return providers.map((provider) => ({
    id: provider.id,
    name: provider.name,
    role: provider.role,
    specialty: provider.specialty,
  }))
}

export function listProviders() {
  return providers
}

export function listEmergencyRequests() {
  return Array.from(emergencyRequests.values()).sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  })
}

export function getEmergencyRequest(id) {
  return emergencyRequests.get(String(id)) || null
}

export function createEmergencyRequest(payload) {
  const id = crypto.randomUUID()
  const createdAt = nowIso()
  const request = {
    id,
    patientName: String(payload.patientName || "Unknown patient").trim(),
    patientPhone: String(payload.patientPhone || "").trim(),
    location: String(payload.location || "").trim(),
    address: String(payload.address || "").trim(),
    symptoms: String(payload.symptoms || "Emergency help requested").trim(),
    status: "pending",
    createdAt,
    acceptedAt: null,
    respondedBy: null,
    chatRoomId: `emergency-${id}`,
    notifiedTo: buildAlertTargets(),
    timeline: [
      {
        type: "created",
        label: "Emergency request sent to available doctors and nurses",
        at: createdAt,
      },
    ],
    notes: [],
  }

  emergencyRequests.set(id, request)
  return request
}

export function updateEmergencyRequest(id, updater) {
  const current = emergencyRequests.get(String(id))
  if (!current) return null

  const next = typeof updater === "function" ? updater({ ...current }) : { ...current, ...updater }
  emergencyRequests.set(String(id), next)
  return next
}

export function acceptEmergencyRequest(id, providerName) {
  const acceptedAt = nowIso()
  return updateEmergencyRequest(id, (current) => ({
    ...current,
    status: "accepted",
    acceptedAt,
    respondedBy: providerName || current.respondedBy || "Available provider",
    timeline: [
      ...current.timeline,
      {
        type: "accepted",
        label: `${providerName || "A provider"} accepted the emergency request`,
        at: acceptedAt,
      },
    ],
  }))
}

export function addEmergencyNote(id, note) {
  const at = nowIso()
  return updateEmergencyRequest(id, (current) => ({
    ...current,
    notes: [
      ...current.notes,
      {
        label: String(note || ""),
        at,
      },
    ],
    timeline: [
      ...current.timeline,
      {
        type: "note",
        label: String(note || "Provider note added"),
        at,
      },
    ],
  }))
}
