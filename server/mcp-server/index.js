/**
 * MCP Server for Home Care System
 * Exposes patient data, doctor information, appointments, and medical resources
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js')
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js')
const {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  TextContent,
  ToolResponse,
} = require('@modelcontextprotocol/sdk/types.js')
const mongoose = require('mongoose')
const dotenv = require('dotenv')
const path = require('path')
const connectDB = require('../configurations/dbConnection')

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') })

// Import MongoDB models
const PatientRegistration = require('../models/patient/patientRegistration')
const HealthRecord = require('../models/patient/healthRecord')
const Doctor = require('../models/privateHealthWorker/doctor/doctorRegistration')
const Appointment = require('../models/privateHealthWorker/doctor/appointment')

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Connect to MongoDB
 */
async function connectDatabase() {
  if (mongoose.connection.readyState === 0) {
    await connectDB()
    console.error('[MCP] MongoDB connected successfully')
  }
}

/**
 * Format a date for display
 */
function formatDate(date) {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// ============================================================================
// MCP Server Definition
// ============================================================================

const server = new Server({
  name: 'homecare-mcp-server',
  version: '1.0.0',
}, {
  capabilities: {
    resources: {},
    tools: {},
  },
})

// ============================================================================
// RESOURCES
// ============================================================================

/**
 * List available resources
 * Resources are named items (patient records, doctor profiles, etc.) that can be read
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  await connectDatabase()

  return {
    resources: [
      {
        uri: 'patient://health-records',
        name: 'Patient Health Records',
        description: 'Access patient health records and medical history',
        mimeType: 'application/json',
      },
      {
        uri: 'doctor://profiles',
        name: 'Doctor Profiles',
        description: 'Access doctor information and availability',
        mimeType: 'application/json',
      },
      {
        uri: 'appointments://active',
        name: 'Active Appointments',
        description: 'View active appointments for patients and doctors',
        mimeType: 'application/json',
      },
      {
        uri: 'medical://reference',
        name: 'Medical Reference Data',
        description: 'General medical information and guidelines',
        mimeType: 'application/json',
      },
    ],
  }
})

/**
 * Read a specific resource
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  await connectDatabase()

  const { uri } = request.params
  console.error(`[MCP] Reading resource: ${uri}`)

  // Parse resource URI
  const [scheme, ...rest] = uri.split('://')
  const path = rest.join('://')

  try {
    // Patient Health Records
    if (scheme === 'patient' && path === 'health-records') {
      const healthRecords = await HealthRecord.find().limit(10).lean()
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              type: 'Patient Health Records',
              count: healthRecords.length,
              records: healthRecords.map((record) => ({
                id: record._id,
                patientId: record.patientId,
                recordType: record.recordType,
                dateCreated: formatDate(record.dateCreated),
                summary: record.summary || 'No summary available',
              })),
            }, null, 2),
          },
        ],
      }
    }

    // Doctor Profiles
    if (scheme === 'doctor' && path === 'profiles') {
      const doctors = await Doctor.find().limit(10).lean()
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              type: 'Doctor Profiles',
              count: doctors.length,
              doctors: doctors.map((doc) => ({
                id: doc._id,
                name: doc.name || 'N/A',
                specialty: doc.specialty || 'N/A',
                available: doc.available || false,
                consultationType: doc.consultationType || [],
              })),
            }, null, 2),
          },
        ],
      }
    }

    // Active Appointments
    if (scheme === 'appointments' && path === 'active') {
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              type: 'Active Appointments',
              message: 'Appointments resource initialized. Use tools to query specific appointments.',
              status: 'ready',
            }, null, 2),
          },
        ],
      }
    }

    // Medical Reference
    if (scheme === 'medical' && path === 'reference') {
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              type: 'Medical Reference Data',
              message: 'Medical reference data initialized. Use tools to search for specific conditions.',
              status: 'ready',
            }, null, 2),
          },
        ],
      }
    }

    return {
      contents: [
        {
          uri,
          mimeType: 'text/plain',
          text: 'Resource not found',
        },
      ],
    }
  } catch (error) {
    console.error(`[MCP] Error reading resource ${uri}:`, error)
    return {
      contents: [
        {
          uri,
          mimeType: 'text/plain',
          text: `Error: ${error.message}`,
        },
      ],
    }
  }
})

// ============================================================================
// TOOLS
// ============================================================================

/**
 * List available tools
 * Tools are actions the AI can perform (query data, create records, etc.)
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_patient_health_record',
        description: 'Retrieve a patient\'s health record by patient ID',
        inputSchema: {
          type: 'object',
          properties: {
            patientId: {
              type: 'string',
              description: 'The MongoDB ID of the patient',
            },
          },
          required: ['patientId'],
        },
      },
      {
        name: 'search_patient_by_name',
        description: 'Search for patients by name',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Patient name or partial name to search for',
            },
          },
          required: ['name'],
        },
      },
      {
        name: 'get_doctor_info',
        description: 'Get information about a doctor by ID',
        inputSchema: {
          type: 'object',
          properties: {
            doctorId: {
              type: 'string',
              description: 'The MongoDB ID of the doctor',
            },
          },
          required: ['doctorId'],
        },
      },
      {
        name: 'search_available_doctors',
        description: 'Search for available doctors by specialty',
        inputSchema: {
          type: 'object',
          properties: {
            specialty: {
              type: 'string',
              description: 'Medical specialty to search for (e.g., "cardiology", "pediatrics")',
            },
          },
          required: ['specialty'],
        },
      },
      {
        name: 'get_patient_appointments',
        description: 'Get all appointments for a patient',
        inputSchema: {
          type: 'object',
          properties: {
            patientId: {
              type: 'string',
              description: 'The MongoDB ID of the patient',
            },
            status: {
              type: 'string',
              enum: ['pending', 'confirmed', 'completed', 'cancelled'],
              description: 'Filter by appointment status (optional)',
            },
          },
          required: ['patientId'],
        },
      },
      {
        name: 'create_appointment',
        description: 'Create a new appointment for a patient with a doctor',
        inputSchema: {
          type: 'object',
          properties: {
            patientId: {
              type: 'string',
              description: 'The MongoDB ID of the patient',
            },
            doctorId: {
              type: 'string',
              description: 'The MongoDB ID of the doctor',
            },
            appointmentDate: {
              type: 'string',
              description: 'Appointment date and time (ISO format: YYYY-MM-DDTHH:mm:ss)',
            },
            reason: {
              type: 'string',
              description: 'Reason for the appointment',
            },
            consultationType: {
              type: 'string',
              enum: ['video', 'phone', 'messaging', 'in-person'],
              description: 'Type of consultation',
            },
          },
          required: ['patientId', 'doctorId', 'appointmentDate', 'reason'],
        },
      },
      {
        name: 'add_health_note',
        description: 'Add a clinical note to a patient\'s health record',
        inputSchema: {
          type: 'object',
          properties: {
            patientId: {
              type: 'string',
              description: 'The MongoDB ID of the patient',
            },
            note: {
              type: 'string',
              description: 'The clinical note to add',
            },
            noteType: {
              type: 'string',
              enum: ['symptom', 'diagnosis', 'treatment', 'follow-up'],
              description: 'Type of note',
            },
          },
          required: ['patientId', 'note'],
        },
      },
    ],
  }
})

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  console.error(`[MCP] Calling tool: ${name}`, args)

  try {
    await connectDatabase()

    switch (name) {
      case 'get_patient_health_record': {
        const { patientId } = args
        const healthRecord = await HealthRecord.findOne({ patientId }).lean()

        if (!healthRecord) {
          return {
            content: [
              {
                type: 'text',
                text: `No health record found for patient ${patientId}`,
              },
            ],
            isError: true,
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(healthRecord, null, 2),
            },
          ],
        }
      }

      case 'search_patient_by_name': {
        const { name } = args
        const patients = await PatientRegistration.find({
          $or: [
            { firstName: new RegExp(name, 'i') },
            { lastName: new RegExp(name, 'i') },
            { email: new RegExp(name, 'i') },
          ],
        })
          .limit(5)
          .lean()

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  count: patients.length,
                  patients: patients.map((p) => ({
                    id: p._id,
                    name: `${p.firstName} ${p.lastName}`,
                    email: p.email,
                    age: p.age,
                  })),
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case 'get_doctor_info': {
        const { doctorId } = args
        const doctor = await Doctor.findById(doctorId).lean()

        if (!doctor) {
          return {
            content: [
              {
                type: 'text',
                text: `No doctor found with ID ${doctorId}`,
              },
            ],
            isError: true,
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(doctor, null, 2),
            },
          ],
        }
      }

      case 'search_available_doctors': {
        const { specialty } = args
        const doctors = await Doctor.find({
          available: true,
          specialty: new RegExp(specialty, 'i'),
        })
          .limit(10)
          .lean()

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  count: doctors.length,
                  doctors: doctors.map((doc) => ({
                    id: doc._id,
                    name: doc.name,
                    specialty: doc.specialty,
                    consultationType: doc.consultationType,
                    rating: doc.rating,
                  })),
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case 'get_patient_appointments': {
        const { patientId, status } = args
        const query = { patientId }
        if (status) {
          query.status = status
        }

        const appointments = await Appointment.find(query).lean()

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  count: appointments.length,
                  appointments: appointments.map((apt) => ({
                    id: apt._id,
                    date: formatDate(apt.appointmentDate),
                    doctorId: apt.doctorId,
                    reason: apt.reason,
                    status: apt.status,
                    consultationType: apt.consultationType,
                  })),
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case 'create_appointment': {
        const { patientId, doctorId, appointmentDate, reason, consultationType } = args

        // Validate patient and doctor exist
        const patient = await PatientRegistration.findById(patientId)
        const doctor = await Doctor.findById(doctorId)

        if (!patient) {
          return {
            content: [
              {
                type: 'text',
                text: `Patient ${patientId} not found`,
              },
            ],
            isError: true,
          }
        }

        if (!doctor) {
          return {
            content: [
              {
                type: 'text',
                text: `Doctor ${doctorId} not found`,
              },
            ],
            isError: true,
          }
        }

        // Create appointment (adjust model creation based on your schema)
        const appointment = new Appointment({
          patientId,
          doctorId,
          appointmentDate: new Date(appointmentDate),
          reason,
          consultationType: consultationType || 'video',
          status: 'pending',
          createdAt: new Date(),
        })

        await appointment.save()

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  appointmentId: appointment._id,
                  message: `Appointment created for ${patient.firstName} ${patient.lastName} with Dr. ${doctor.name}`,
                  appointment: {
                    id: appointment._id,
                    date: formatDate(appointment.appointmentDate),
                    reason,
                    consultationType,
                    status: appointment.status,
                  },
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case 'add_health_note': {
        const { patientId, note, noteType } = args

        // Find or create health record
        let healthRecord = await HealthRecord.findOne({ patientId })

        if (!healthRecord) {
          healthRecord = new HealthRecord({
            patientId,
            notes: [],
          })
        }

        healthRecord.notes = healthRecord.notes || []
        healthRecord.notes.push({
          content: note,
          type: noteType || 'general',
          timestamp: new Date(),
        })

        await healthRecord.save()

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: `Health note added for patient ${patientId}`,
                  note: {
                    type: noteType,
                    content: note,
                    timestamp: formatDate(new Date()),
                  },
                },
                null,
                2
              ),
            },
          ],
        }
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        }
    }
  } catch (error) {
    console.error(`[MCP] Error calling tool ${name}:`, error)
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    }
  }
})

// ============================================================================
// Server Lifecycle
// ============================================================================

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[MCP] Home Care MCP Server running on stdio')
}

main().catch((error) => {
  console.error('[MCP] Fatal error:', error)
  process.exit(1)
})
