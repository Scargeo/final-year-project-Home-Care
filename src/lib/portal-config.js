export const SIDEBAR_SECTIONS = [
  { slug: "dashboard", label: "Dashboard", permission: "dashboard.view" },
  { slug: "appointments", label: "Appointments", permission: "appointments.view" },
  { slug: "telehealth", label: "Telehealth", permission: "telehealth.view" },
  { slug: "patients", label: "Patients", permission: "patients.view" },
  { slug: "family-portal", label: "Family portal", permission: "family_portal.view" },
  { slug: "care-team", label: "Care team", permission: "care_team.view" },
  { slug: "marketplace", label: "Marketplace", permission: "marketplace.view" },
  { slug: "medical-imaging", label: "Medical imaging", permission: "medical_imaging.view" },
  { slug: "notifications", label: "Notifications", permission: "notifications.view" },
  { slug: "sos", label: "SOS", permission: "sos.view" },
  { slug: "billing", label: "Billing", permission: "billing.view" },
  { slug: "reports", label: "Reports", permission: "reports.view" },
  { slug: "pharmacies", label: "Pharmacies", permission: "pharmacies.view" },
]

export function getSectionBySlug(slug) {
  return SIDEBAR_SECTIONS.find((item) => item.slug === slug) || null
}

export const ADVANCED_FEATURE_LIBRARY = {
  dashboard: [
    "Predictive staffing",
    "Clinical utilization tracker",
    "Revenue trend insights",
    "Risk score alerts",
  ],
  appointments: [
    "AI triage slot suggestions",
    "No-show prediction",
    "Recurring care scheduling",
    "Multi-channel reminders",
  ],
  telehealth: [
    "Secure video consultations",
    "Device vitals ingestion",
    "Session recording flagging",
    "Escalation to emergency",
  ],
  patients: [
    "Unified patient timeline",
    "Medication adherence trend",
    "Care plan milestones",
    "Readmission risk ranking",
  ],
  "family-portal": [
    "Family updates stream",
    "Consent-controlled access",
    "Shared appointment calendar",
    "Emergency contact shortcuts",
  ],
  "care-team": [
    "Role-based assignment board",
    "Shift coverage alerts",
    "Task handoff notes",
    "Critical patient escalation",
  ],
  marketplace: [
    "Medicine inventory matching",
    "Service provider discovery",
    "Dynamic delivery pricing",
    "Quality score ranking",
  ],
  "medical-imaging": [
    "Upload and report workflow",
    "Priority case queue",
    "Radiology turnaround timer",
    "AI anomaly pre-screen",
  ],
  notifications: [
    "Rule-based alert builder",
    "Email/SMS/push orchestration",
    "Escalation policy engine",
    "Audit-ready delivery logs",
  ],
  sos: [
    "Live dispatcher queue",
    "Responder ETA tracking",
    "Incident timeline builder",
    "Post-incident report pack",
  ],
  billing: [
    "Claims validation checks",
    "Outstanding payment alerts",
    "Insurance status verification",
    "Revenue leak detection",
  ],
  reports: [
    "Operational KPI board",
    "Role-wise productivity",
    "Compliance export packs",
    "Executive monthly digest",
  ],
  pharmacies: [
    "E-prescription verification",
    "Controlled drug audit trail",
    "Stock-out early warnings",
    "Rider dispatch integration",
  ],
}

export const ROLE_DASHBOARD_METRICS = {
  doctor: [
    { label: "TODAY'S APPOINTMENTS", value: "14", note: "Virtual + in-person" },
    { label: "CRITICAL ALERTS", value: "3", note: "Requires immediate review" },
    { label: "PENDING TASKS", value: "9", note: "Sign-offs and follow-ups" },
  ],
  nurse: [
    { label: "ACTIVE TASKS", value: "22", note: "Medication, vitals, education" },
    { label: "PRIORITY PATIENTS", value: "6", note: "Flagged by doctor/AI" },
    { label: "SHIFT COMPLETION", value: "71%", note: "Updated in real time" },
  ],
  pharmacy: [
    { label: "PRESCRIPTION QUEUE", value: "37", note: "New + pending orders" },
    { label: "LOW STOCK ALERTS", value: "5", note: "Restock needed today" },
    { label: "DELIVERY SLA", value: "92%", note: "On-time dispatch rate" },
  ],
  patient: [
    { label: "UPCOMING APPOINTMENTS", value: "2", note: "This week" },
    { label: "ACTIVE MEDICATIONS", value: "4", note: "With reminders enabled" },
    { label: "CARE PLAN PROGRESS", value: "68%", note: "Milestones completed" },
  ],
  rider: [
    { label: "ASSIGNED DELIVERIES", value: "12", note: "Optimized route list" },
    { label: "ON-TIME RATE", value: "95%", note: "Last 30 days" },
    { label: "TODAY'S EARNINGS", value: "$127", note: "Base + tips + bonus" },
  ],
  ambulance: [
    { label: "LIVE DISPATCHES", value: "4", note: "SOS responses active" },
    { label: "AVG RESPONSE TIME", value: "7m", note: "City-wide average" },
    { label: "HIGH PRIORITY CASES", value: "2", note: "Escalated cases" },
  ],
}

export const ROLE_DASHBOARD_MODULES = {
  doctor: [
    {
      title: "Clinical overview",
      features: ["Today's schedule", "Critical alerts", "Patient queue", "Pending tasks"],
    },
    {
      title: "Patient management",
      features: ["Patient timeline", "Vitals trend graphs", "Care plan manager", "Risk-level filters"],
    },
    {
      title: "Clinical tools",
      features: ["E-prescription", "Lab ordering", "AI diagnostic assistant", "Drug interaction checks"],
    },
    {
      title: "Telehealth and communication",
      features: ["One-click video consult", "Secure threaded chat", "Emergency alerts", "Second-opinion requests"],
    },
  ],
  nurse: [
    {
      title: "Daily operations",
      features: ["Task list", "Priority patients", "Checklist completion", "Shift schedule view"],
    },
    {
      title: "Patient monitoring",
      features: ["Vital signs tracker", "Medication administration", "Alert management", "Severity board"],
    },
    {
      title: "Clinical support",
      features: ["Doctor orders", "Lab result viewer", "Care plan tasks", "Patient education handouts"],
    },
    {
      title: "Documentation",
      features: ["Nursing notes templates", "Incident reporting", "Flow sheets", "Shift handoff report"],
    },
  ],
  pharmacy: [
    {
      title: "Prescription workflow",
      features: ["Prescription queue", "Validation checks", "Insurance verification", "Priority sorting"],
    },
    {
      title: "Dispensing and inventory",
      features: ["Barcode verification", "Stock alerts", "Alternative suggestions", "Label printing"],
    },
    {
      title: "Delivery coordination",
      features: ["Rider assignment", "Live tracking", "Proof of delivery", "Cold-chain monitoring"],
    },
    {
      title: "Medication safety",
      features: ["Allergy alerts", "Interaction checker", "Dosage calculator", "Returns management"],
    },
  ],
  patient: [
    {
      title: "Appointment management",
      features: ["Book appointments", "Virtual queue", "Waitlist options", "Past visit summaries"],
    },
    {
      title: "Health records",
      features: ["Medical history", "Lab results", "Prescriptions", "Care plans"],
    },
    {
      title: "Medication management",
      features: ["Dose reminders", "Refill requests", "Adherence log", "Delivery tracking"],
    },
    {
      title: "Communication and self-service",
      features: ["Care team chat", "Video visits", "Symptom checker", "Family portal access"],
    },
  ],
  rider: [
    {
      title: "Delivery management",
      features: ["Available deliveries", "Assigned routes", "Priority indicators", "Batch optimization"],
    },
    {
      title: "Navigation",
      features: ["Turn-by-turn routing", "Traffic-aware ETA", "Geofencing alerts", "Alternate routes"],
    },
    {
      title: "Pickup and dropoff",
      features: ["QR verification", "Photo proof", "Signature capture", "Failed-delivery workflow"],
    },
    {
      title: "Performance",
      features: ["Daily earnings", "Ratings dashboard", "Incentive tracker", "Safety check-ins"],
    },
  ],
  ambulance: [
    {
      title: "Dispatch control",
      features: ["Live SOS queue", "Priority triage", "ETA tracking", "Route handoff to hospital"],
    },
    {
      title: "Field operations",
      features: ["Patient condition capture", "Critical alerts", "Responder notes", "Incident timeline"],
    },
    {
      title: "Communication",
      features: ["Doctor channel", "Nurse channel", "Emergency broadcast", "Patient contact bridge"],
    },
    {
      title: "Compliance and reporting",
      features: ["Response SLA monitor", "Case audit trail", "Equipment checklist", "Post-incident reports"],
    },
  ],
}
