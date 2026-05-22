const path = require('path')
const { Client } = require('@modelcontextprotocol/sdk/client/index.js')
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js')
const mongoose = require('mongoose')
const dotenv = require('dotenv')
const connectDB = require('../configurations/dbConnection')
const Patients = require('../models/patient/patientRegistration')
const Doctor = require('../models/privateHealthWorker/doctor/doctorRegistration')

dotenv.config({ path: path.join(__dirname, '..', '.env') })

function getBackendBaseUrl() {
  const env = process.env || {}
  const base = String(env.BACKENDSERVER || 'http://localhost').trim().replace(/\/+$/, '')
  const port = String(env.BACKENDSERVER_PORT || '8000').trim()
  if (/^https?:\/\//i.test(base) && !base.match(/:\d+$/)) {
    return `${base}:${port}`
  }
  if (/^https?:\/\//i.test(base)) {
    return base
  }
  return `http://${base.replace(/^https?:\/\//i, '')}:${port}`
}

let clientPromise = null

const mcpServerEntry = path.join(__dirname, '..', 'mcp-server', 'index.js')

async function getClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const client = new Client(
        {
          name: 'homecare-chat-mcp-client',
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      )

      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [mcpServerEntry],
        cwd: path.join(__dirname, '..'),
      })

      await client.connect(transport)
      return client
    })().catch((error) => {
      clientPromise = null
      throw error
    })
  }

  return clientPromise
}

async function ensureDatabaseConnected() {
  if (mongoose.connection.readyState !== 1) {
    await connectDB()
  }
}

function parseJsonText(response) {
  const text = response?.content?.find((item) => item?.type === 'text')?.text
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function inferMcpIntent(query) {
  const text = String(query || '').toLowerCase()

  return {
    wantsHealthRecord:
      /\b(health record|medical history|prescription|prescriptions|allerg(y|ies)|lab result|lab results|my record|my history)\b/.test(
        text
      ),
    wantsAppointments:
      /\b(appointment|appointments|booking|booked|schedule|scheduled|visit|consultation)\b/.test(text),
    wantsDoctorInfo: /\b(doctor|dr\.|specialist|specialty|specialization|available doctor|find a doctor)\b/.test(text),
    wantsMyData: /\b(my|me|mine|for me|my profile|my appointments|my records)\b/.test(text),
  }
}

function normalizeLookupValue(value) {
  return String(value || '').trim()
}

function isValidAppointmentDate(value) {
  const parsed = new Date(value)
  return Boolean(value) && !Number.isNaN(parsed.getTime())
}

async function resolvePatientIdentity({ patientId, userId }) {
  await ensureDatabaseConnected()
  const candidate = normalizeLookupValue(patientId || userId)
  if (!candidate) return null

  const query = {
    $or: [{ patientId: candidate }, { patientEmail: candidate }],
  }

  if (candidate.length === 24) {
    query.$or.push({ _id: candidate })
  }

  return Patients.findOne(query).lean()
}

async function resolveDoctorIdentity({ doctorId, userId }) {
  await ensureDatabaseConnected()
  const candidate = normalizeLookupValue(doctorId || userId)
  if (!candidate) return null

  const query = {
    $or: [{ doctorId: candidate }, { doctorEmail: candidate }],
  }

  if (candidate.length === 24) {
    query.$or.push({ _id: candidate })
  }

  return Doctor.findOne(query).lean()
}

async function buildMcpContext({ query, userId, patientId, doctorId, userRole }) {
  const intent = inferMcpIntent(query)
  const requestedSections = []
  const snippets = []
  const client = await getClient()
  await ensureDatabaseConnected()
  const resolvedPatient = await resolvePatientIdentity({ patientId, userId })
  const resolvedDoctor = await resolveDoctorIdentity({ doctorId, userId })
  const candidatePatientId = normalizeLookupValue(resolvedPatient?.patientId || resolvedPatient?.patientEmail || patientId || userId)
  const candidateDoctorId = normalizeLookupValue(resolvedDoctor?.doctorId || resolvedDoctor?.doctorEmail || doctorId || userId)

  if (resolvedPatient) {
    requestedSections.push('resolved patient identity')
    snippets.push(
      `Resolved patient identity:\n${JSON.stringify(
        {
          patientId: resolvedPatient.patientId,
          name: [resolvedPatient.patientFirstName, resolvedPatient.patientLastName].filter(Boolean).join(' ').trim(),
          email: resolvedPatient.patientEmail,
        },
        null,
        2
      )}`
    )
  }

  if (resolvedDoctor && normalizeLookupValue(userRole) === 'doctor') {
    requestedSections.push('resolved doctor identity')
    snippets.push(
      `Resolved doctor identity:\n${JSON.stringify(
        {
          doctorId: resolvedDoctor.doctorId,
          name: [resolvedDoctor.doctorFirstName, resolvedDoctor.doctorLastName].filter(Boolean).join(' ').trim(),
          email: resolvedDoctor.doctorEmail,
          specialization: resolvedDoctor.specialization,
        },
        null,
        2
      )}`
    )
  }

  if (intent.wantsHealthRecord && candidatePatientId && candidatePatientId !== 'anonymous') {
    const result = await client.callTool({
      name: 'get_patient_health_record',
      arguments: { patientId: candidatePatientId },
    })
    const parsed = parseJsonText(result)
    if (parsed) {
      requestedSections.push('patient health record')
      snippets.push(`Patient health record:\n${JSON.stringify(parsed, null, 2)}`)
    }
  }

  if (intent.wantsAppointments && candidatePatientId && candidatePatientId !== 'anonymous') {
    const result = await client.callTool({
      name: 'get_patient_appointments',
      arguments: { patientId: candidatePatientId },
    })
    const parsed = parseJsonText(result)
    if (parsed) {
      requestedSections.push('patient appointments')
      snippets.push(`Patient appointments:\n${JSON.stringify(parsed, null, 2)}`)
    }
  }

  if (intent.wantsDoctorInfo) {
    if (candidateDoctorId && normalizeLookupValue(userRole) === 'doctor') {
      const doctorInfo = await client.callTool({
        name: 'get_doctor_info',
        arguments: { doctorId: candidateDoctorId },
      })
      const parsedDoctor = parseJsonText(doctorInfo)
      if (parsedDoctor) {
        requestedSections.push('doctor profile')
        snippets.push(`Doctor profile:\n${JSON.stringify(parsedDoctor, null, 2)}`)
      }
    }

    const result = await client.callTool({
      name: 'search_available_doctors',
      arguments: {
        specialty: String(query || '').replace(/.*\b(?:doctor|specialist|specialty|specialization|find a doctor)\b/i, '').trim() || 'general',
      },
    })
    const parsed = parseJsonText(result)
    if (parsed) {
      requestedSections.push('doctor availability')
      snippets.push(`Doctor availability:\n${JSON.stringify(parsed, null, 2)}`)
    }
  }

  if (snippets.length === 0 && intent.wantsMyData && candidatePatientId && candidatePatientId !== 'anonymous') {
    const results = []

    const healthRecord = await client.callTool({
      name: 'get_patient_health_record',
      arguments: { patientId: candidatePatientId },
    })
    const healthParsed = parseJsonText(healthRecord)
    if (healthParsed) {
      results.push(`Patient health record:\n${JSON.stringify(healthParsed, null, 2)}`)
    }

    const appointments = await client.callTool({
      name: 'get_patient_appointments',
      arguments: { patientId: candidatePatientId },
    })
    const appointmentsParsed = parseJsonText(appointments)
    if (appointmentsParsed) {
      results.push(`Patient appointments:\n${JSON.stringify(appointmentsParsed, null, 2)}`)
    }

    if (results.length > 0) {
      requestedSections.push('personal data')
      snippets.push(...results)
    }
  }

  if (snippets.length === 0) {
    return { context: '', sections: [] }
  }

  return {
    context: [`MCP context (${requestedSections.join(', ')}):`, ...snippets].join('\n\n'),
    sections: requestedSections,
  }
}

// Evaluate query intent, perform system actions (book appointment, add note) when appropriate
async function evaluateAndAct({ query, userId, patientId, preferredAppointment = null }) {
  const intent = inferMcpIntent(query)
  await getClient()
  const actions = []

  // Urgent signs - recommend emergency services, do not book
  const urgentPattern = /\b(chest pain|difficulty breathing|shortness of breath|severe bleeding|unconscious|faint|loss of consciousness|severe pain|high fever|spreading infection|dangerous)\b/i
  if (urgentPattern.test(query)) {
    return { actionTaken: false, recommendation: 'URGENT: Advise emergency services immediately. Do not book; instruct patient to seek emergency care.' }
  }

  // If user explicitly asks to book or intent indicates appointments
  const wantsBooking =
    /\b(book|schedule|make an appointment|see a doctor|need to see a doctor|appointment)\b/i.test(query) ||
    intent.wantsAppointments ||
    Boolean(preferredAppointment?.date && preferredAppointment?.time)

  if (wantsBooking) {
    try {
      const resolvedPatient = await resolvePatientIdentity({ patientId, userId })
      const patientName = String(
        [resolvedPatient?.patientFirstName, resolvedPatient?.patientLastName].filter(Boolean).join(' ').trim() ||
        resolvedPatient?.patientName ||
        userId ||
        patientId ||
        'Patient'
      )
      const patientPhone = String(resolvedPatient?.patientPhone || resolvedPatient?.phone || '')

      const specialtyMap = [
        { re: /\b(chest|cardio|heart|cardiac)\b/i, specialty: 'cardiology' },
        { re: /\b(kidney|renal)\b/i, specialty: 'nephrology' },
        { re: /\b(child|pediatri)\b/i, specialty: 'pediatrics' },
        { re: /\b(skin|derma|rash)\b/i, specialty: 'dermatology' },
        { re: /\b(dentist|tooth|teeth|mouth|dental)\b/i, specialty: 'dentist' },
        { re: /\b(mental|psychiat|anxiety|depress)\b/i, specialty: 'psychiatry' },
      ]

      let specialty = 'general'
      for (const m of specialtyMap) {
        if (m.re.test(query)) {
          specialty = m.specialty
          break
        }
      }

      const preferredDate = String(preferredAppointment?.date || '').trim()
      const preferredTime = String(preferredAppointment?.time || '').trim()

      if (!isValidAppointmentDate(preferredDate) || !preferredTime) {
        return {
          actionTaken: false,
          needsAppointmentDetails: true,
          question: 'What date and time would you like me to book the appointment for?',
        }
      }

      const appointmentDate = new Date(preferredDate)
      appointmentDate.setHours(0, 0, 0, 0)
      const appointmentDateString = appointmentDate.toISOString().slice(0, 10)
      const appointmentTimeString = preferredTime
      const consultationType = (preferredAppointment && preferredAppointment.consultationType) || 'messaging'

      const proposedAppointment = {
        patientId: patientId || userId || '',
        appointmentDate: appointmentDate.toISOString(),
        reason: query,
        consultationType,
        specialty,
        patientName,
        patientPhone,
      }

      const backendUrl = `${getBackendBaseUrl()}/api/doctors/appointments/auto-assign`
      const appointmentPayload = {
        appointmentId: `APT-${Date.now().toString(36).toUpperCase()}`,
        patientId: proposedAppointment.patientId,
        patientName,
        patientPhone,
        appointmentDate: appointmentDateString,
        appointmentTime: appointmentTimeString,
        duration: 30,
        reason: query,
        consultationType,
      }

      const headers = { 'Content-Type': 'application/json' }
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(appointmentPayload),
      })
      const created = await response.json().catch(() => ({}))

      if (!response.ok) {
        return { actionTaken: false, proposedAppointment, error: created?.message || 'Could not create appointment' }
      }

      actions.push({ type: 'create_appointment', result: created })
      return { actionTaken: true, actions, appointment: created }
    } catch (error) {
      console.error('[MCP] evaluateAndAct error:', error)
      return { actionTaken: false, error: String(error) }
    }
  }

  // No automated action taken; suggest home remedies for non-urgent
  const suggestHome = /\b(fever|mild pain|sore throat|cold|cough|headache|stomach ache|nausea|diarrhea)\b/i.test(query)
  if (suggestHome) {
    return { actionTaken: false, recommendation: 'ADVICE: Suggest safe home remedies and monitoring steps; no appointment booked.' }
  }

  return { actionTaken: false }
}

module.exports = {
  buildMcpContext,
  evaluateAndAct,
}