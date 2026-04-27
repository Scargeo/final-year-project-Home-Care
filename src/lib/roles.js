export const ROLE_OPTIONS = [
  { value: "patient", label: "Patient" },
  { value: "doctor", label: "Doctor" },
  { value: "nurse", label: "Nurse" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "rider", label: "Rider" },
  { value: "ambulance", label: "Ambulance Personnel" },
  { value: "admin", label: "Admin" },
]

export const ROLE_LABELS = ROLE_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option.label
  return acc
}, {})

export const ROLE_FEATURES = {
  patient: [
    "Book smart appointments with reminders",
    "Track telehealth, chat, and prescription status",
    "Emergency SOS trigger with responder timeline",
    "Digital medical records and care plan progress",
  ],
  doctor: [
    "Daily appointment queue and triage board",
    "Virtual consultation room with secure chat/call",
    "Medication and lab orders with e-sign support",
    "High-risk patient alerts and follow-up tracker",
  ],
  nurse: [
    "Ward/home-care checklist and vitals log",
    "Medication administration reminders",
    "Care task progress with escalation flags",
    "Patient discharge and education checklist",
  ],
  pharmacy: [
    "Prescription intake, verification, and fulfillment",
    "Stock-level and low-inventory alerts",
    "Delivery handoff with rider assignment",
    "Controlled-drug audit and dispensing history",
  ],
  rider: [
    "Live assigned delivery queue",
    "Route and ETA optimization",
    "Proof-of-delivery status update",
    "Escalation flow for unreachable addresses",
  ],
  ambulance: [
    "Incoming SOS dispatch queue",
    "Response timer and arrival tracking",
    "Patient condition handoff notes",
    "Hospital destination and priority status",
  ],
  admin: [
    "Real-time activity stream across all roles",
    "User management (add, edit, block, suspend, delete)",
    "Security/audit controls and operational insights",
    "Role-level access visibility and system health checks",
  ],
}
