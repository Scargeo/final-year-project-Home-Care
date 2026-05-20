const express = require('express')
const router = express.Router()
const { Pinecone } = require('@pinecone-database/pinecone')
const OpenAI = require('openai')
const dotenv = require('dotenv')
const path = require('path')
const mongoose = require('mongoose')
const AIConversation = require('../../models/ai/aiConversation')
const AIMessage = require('../../models/ai/aiMessage')
const Appointment = require('../../models/privateHealthWorker/doctor/appointment')
const Doctor = require('../../models/privateHealthWorker/doctor/doctorRegistration')
const { buildMcpContext, evaluateAndAct } = require('../../lib/mcpClient')

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') })

const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'homecare-chatbot'
const PINECONE_NAMESPACE = process.env.PINECONE_NAMESPACE || 'default'
const PINECONE_API_KEY = process.env.PINECONE_API_KEY
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

const openRouterLLMModel = process.env.OPENROUTER_LLM_MODEL || 'openrouter/auto'
const openRouterFallbackLLMModel = process.env.OPENROUTER_FALLBACK_LLM_MODEL || 'openai/gpt-3.5-turbo'
const openRouterEmbedModel = process.env.OPENROUTER_EMBED_MODEL || 'text-embedding-3-small'

const shouldUseStructuredFormatting = (queryText) => {
  const text = String(queryText || '').toLowerCase().trim()
  if (!text) return false

  const smallTalkPattern = /^(hi|hello|hey|good\s*morning|good\s*afternoon|good\s*evening|how are you|thanks|thank you)\b/
  if (smallTalkPattern.test(text)) {
    return false
  }

  const instructionalPattern = /\b(how|steps?|procedure|guide|perform|what should i do|how do i|treat|first aid|cpr|instructions?)\b/
  return instructionalPattern.test(text)
}

const buildConversationTitle = (text) => {
  if (!text) {
    return 'New conversation'
  }

  const clean = String(text).replace(/\s+/g, ' ').trim()
  return clean.slice(0, 80)
}

const resolveConversation = async ({ conversationId, userId, firstPrompt }) => {
  if (conversationId && mongoose.Types.ObjectId.isValid(conversationId)) {
    const existing = await AIConversation.findOne({ _id: conversationId, userId })
    if (existing) {
      return existing
    }
  }

  return AIConversation.create({
    userId,
    title: buildConversationTitle(firstPrompt),
    status: 'active',
    lastMessageAt: new Date(),
  })
}

const loadConversationHistory = async (conversationId) => {
  if (!conversationId) return []

  const recentMessages = await AIMessage.find({ conversationId })
    .sort({ createdAt: -1 })
    .limit(12)
    .lean()

  return recentMessages
    .reverse()
    .map((message) => ({
      role: message.role,
      content: String(message.content || '').trim(),
    }))
    .filter((message) => message.content.length > 0)
}

const MONTH_ALIASES = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
}

const WEEKDAY_ALIASES = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
}

const hasAppointmentContext = (conversationHistory) =>
  conversationHistory.some((message) => /\b(book|appointment|schedule|date and time|what date|what time|when works best)\b/i.test(message.content))

const hasBookingIntent = (queryText) => /\b(book|schedule|make an appointment|see a doctor|need to see a doctor|appointment)\b/i.test(queryText)

const hasAppointmentConfirmationIntent = (queryText) =>
  /\b(confirm(?:\s+the)?(?:\s+previous)?\s+appointment|confirm\s+it|yes\s+book\s+it|go\s+ahead|proceed)\b/i.test(queryText)

const hasDateOrTimeHint = (queryText) =>
  /\b(today|tomorrow|tonight|\d{1,2}(?::\d{2})?\s*(?:am|pm)|\d{1,2}:\d{2}|\d{4}-\d{2}-\d{2}|\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(
    queryText
  )

const parseAppointmentFromText = (queryText) => {
  const text = String(queryText || '').trim().toLowerCase()
  if (!text) return { date: '', time: '' }

  const now = new Date()
  const date = new Date(now)
  let matchedWeekday = null

  const explicitIso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
  const slashDate = text.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/)
  const monthDate = text.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:,?\s*(\d{4}))?\b/)
  const weekdayMatch = text.match(/\b(sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r?s(?:day)?)?|fri(?:day)?|sat(?:urday)?)\b/)

  if (weekdayMatch) {
    matchedWeekday = WEEKDAY_ALIASES[weekdayMatch[1].slice(0, 3)] ?? WEEKDAY_ALIASES[weekdayMatch[1]] ?? null
  }

  if (/\btoday\b/.test(text)) {
    date.setHours(0, 0, 0, 0)
  } else if (/\btomorrow\b/.test(text)) {
    date.setDate(date.getDate() + 1)
    date.setHours(0, 0, 0, 0)
  } else if (matchedWeekday !== null) {
    const currentDay = date.getDay()
    let daysUntilTarget = (matchedWeekday - currentDay + 7) % 7
    const timeMatch = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i)

    if (daysUntilTarget === 0 && timeMatch) {
      let hours = Number(timeMatch[1])
      const minutes = Number(timeMatch[2] || 0)
      const meridiem = timeMatch[3].toLowerCase()
      if (meridiem === 'pm' && hours < 12) hours += 12
      if (meridiem === 'am' && hours === 12) hours = 0

      const candidate = new Date(date)
      candidate.setHours(hours, minutes, 0, 0)
      if (candidate.getTime() <= now.getTime()) {
        daysUntilTarget = 7
      }
    } else if (daysUntilTarget === 0) {
      daysUntilTarget = 7
    }

    date.setDate(date.getDate() + daysUntilTarget)
    date.setHours(0, 0, 0, 0)
  } else if (explicitIso) {
    const [, year, month, day] = explicitIso
    date.setFullYear(Number(year), Number(month) - 1, Number(day))
    date.setHours(0, 0, 0, 0)
  } else if (slashDate) {
    const [, partA, partB, partC] = slashDate
    const first = Number(partA)
    const second = Number(partB)
    const yearValue = partC ? Number(partC.length === 2 ? `20${partC}` : partC) : now.getFullYear()
    const monthValue = first > 12 ? second : first
    const dayValue = first > 12 ? first : second
    if (!Number.isNaN(monthValue) && !Number.isNaN(dayValue)) {
      date.setFullYear(yearValue, monthValue - 1, dayValue)
      date.setHours(0, 0, 0, 0)
    }
  } else if (monthDate) {
    const [, monthName, dayValue, yearValue] = monthDate
    const monthValue = MONTH_ALIASES[monthName.slice(0, 3)] || MONTH_ALIASES[monthName]
    if (monthValue) {
      date.setFullYear(Number(yearValue || now.getFullYear()), monthValue - 1, Number(dayValue))
      date.setHours(0, 0, 0, 0)
    }
  }

  const timeMatch = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i)
  if (timeMatch) {
    let hours = Number(timeMatch[1])
    const minutes = Number(timeMatch[2] || 0)
    const meridiem = timeMatch[3].toLowerCase()
    if (meridiem === 'pm' && hours < 12) hours += 12
    if (meridiem === 'am' && hours === 12) hours = 0
    return {
      date: Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10),
      time: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
    }
  }

  return { date: Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10), time: '' }
}

const formatAppointmentDateTime = (appointment) => {
  if (!appointment) return { dateLabel: 'the requested date', timeLabel: 'the requested time' }

  const appointmentDate = appointment.appointmentDate ? new Date(appointment.appointmentDate) : null
  const dateLabel = appointmentDate
    ? appointmentDate.toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'the requested date'

  return {
    dateLabel,
    timeLabel: appointment.appointmentTime || 'the requested time',
  }
}

const findLatestAppointmentForUser = async ({ patientId, doctorId }) => {
  const query = {}

  if (patientId && String(patientId).trim().length > 0) {
    query.patientId = String(patientId).trim()
  }

  if (doctorId && String(doctorId).trim().length > 0) {
    query.doctorId = String(doctorId).trim()
  }

  if (Object.keys(query).length === 0) {
    return null
  }

  return Appointment.findOne({
    ...query,
    status: { $in: ['scheduled', 'in-progress'] },
  })
    .sort({ appointmentDate: -1, createdAt: -1 })
    .lean()
}

const resolveDoctorDisplayName = async (doctorId) => {
  if (!doctorId) return 'the doctor'

  try {
    const doctor = await Doctor.findOne({ doctorId: String(doctorId).trim() }).lean()
    if (!doctor) return 'the doctor'

    return [doctor.doctorFirstName, doctor.doctorLastName].filter(Boolean).join(' ').trim() || doctor.doctorFirstName || 'the doctor'
  } catch {
    return 'the doctor'
  }
}

// Validate required environment variables
if (!PINECONE_API_KEY || !OPENROUTER_API_KEY) {
  console.error('Missing PINECONE_API_KEY or OPENROUTER_API_KEY in environment variables')
}

const aiDependenciesReady = Boolean(PINECONE_API_KEY && OPENROUTER_API_KEY)

// Initialize Pinecone client
const pc = new Pinecone({ apiKey: PINECONE_API_KEY })
const index = pc.index(PINECONE_INDEX_NAME)

// Initialize OpenRouter client (OpenAI-compatible)
const openai = new OpenAI({
  apiKey: OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost:3000',
    'X-Title': process.env.OPENROUTER_APP_NAME || 'Home Care AI Components',
  },
})

/**
 * POST /api/ai/chat
 * Query Pinecone for relevant documents and generate a response using LLM
 */
router.post('/chat', async (req, res) => {
  try {
    if (!aiDependenciesReady) {
      return res.status(503).json({
        error: 'AI service is not configured on the server',
        details: 'Missing PINECONE_API_KEY or OPENROUTER_API_KEY',
      })
    }

    const { query, conversationId, userId, patientId, doctorId, userRole } = req.body

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Invalid request: "query" field is required and must be a string',
      })
    }

    // Trim and validate query
    const sanitizedQuery = query.trim()
    if (sanitizedQuery.length === 0) {
      return res.status(400).json({ error: 'Query cannot be empty' })
    }

    const normalizedUserId =
      typeof userId === 'string' && userId.trim().length > 0 ? userId.trim() : 'anonymous'

    const conversation = await resolveConversation({
      conversationId,
      userId: normalizedUserId,
      firstPrompt: sanitizedQuery,
    })

    const conversationHistory = await loadConversationHistory(conversation._id)
    let mcpContext = ''
    const bookingIntent = hasBookingIntent(sanitizedQuery)
    const confirmationIntent = hasAppointmentConfirmationIntent(sanitizedQuery)
    const bookingFollowUp = !bookingIntent && hasDateOrTimeHint(sanitizedQuery) && hasAppointmentContext(conversationHistory)
    const shouldHandleBooking = bookingIntent || bookingFollowUp || confirmationIntent
    const preferredAppointment = req.body.preferredAppointment || (shouldHandleBooking ? parseAppointmentFromText(sanitizedQuery) : null)
    const latestAppointment = confirmationIntent ? await findLatestAppointmentForUser({ patientId, doctorId }) : null

    try {
      const mcpResult = await buildMcpContext({
        query: sanitizedQuery,
        userId: normalizedUserId,
        patientId,
        doctorId,
        userRole,
      })
      mcpContext = mcpResult.context || ''
    } catch (mcpError) {
      console.error('[AI Chat] MCP context lookup failed:', mcpError)
    }

    // Step 1: Generate embedding for query using OpenRouter
    console.log(`[AI Chat] Processing query: "${sanitizedQuery}"`)

    let queryEmbedding
    try {
      const embeddingResponse = await openai.embeddings.create({
        model: openRouterEmbedModel,
        input: sanitizedQuery,
      })

      queryEmbedding = embeddingResponse.data[0].embedding

      if (!queryEmbedding || !Array.isArray(queryEmbedding)) {
        throw new Error('Invalid embedding response from OpenRouter')
      }
    } catch (embeddingError) {
      console.error('Error generating query embedding:', embeddingError)
      return res.status(503).json({
        error: 'AI service temporarily unavailable',
        details: embeddingError.message,
      })
    }

    // Step 2: Query Pinecone for similar documents
    let queryResults
    try {
      queryResults = await index.query({
        vector: queryEmbedding,
        topK: 5, // Retrieve top 5 similar chunks
        namespace: PINECONE_NAMESPACE,
        includeMetadata: true,
      })
    } catch (queryError) {
      console.error('Error querying Pinecone:', queryError)
      return res.status(503).json({
        error: 'Knowledge base temporarily unavailable',
        details: queryError.message,
      })
    }

    // Step 3: Extract context from query results
    const relevantMatches = queryResults.matches.filter((match) => match.score > 0.5)

    const contextChunks = relevantMatches
      .map((match) => {
        const metadata = match.metadata || {}
        return metadata.chunk_text || metadata.text || ''
      })
      .filter(Boolean)

    const context = contextChunks.join('\n\n')

    if (contextChunks.length === 0) {
      console.warn('[AI Chat] No relevant context found in knowledge base')
    } else {
      console.log(`[AI Chat] Found ${contextChunks.length} relevant documents`)
    }

    // Step 4: Generate response using LLM with context
    let llmResponse
    try {
      const systemPrompt = `You are a patient decision-support assistant for HomeCare Hospital.
    Your role is to help the patient understand their symptoms, weigh safe next steps, and decide when to self-care, monitor, book care, or seek urgent help.
    Speak naturally, warmly, and in plain language.
    **IMPORTANT: Be action-oriented and decisive. Avoid asking many questions. Instead:**
    - If the patient asks to see a doctor or describes a clinical concern, suggest the AI will help book an appointment.
    - If symptoms are mild (cold, sore throat, mild pain, fever), suggest safe home remedies and monitoring steps immediately.
    - Ask at most ONE focused follow-up question if a critical detail is missing. Then give your best guidance.
    - Prioritize symptoms, duration, severity, age, fever, breathing, pain location, bleeding, pregnancy, and existing conditions when they matter.
    Do not diagnose with certainty or replace a clinician.
    If the situation may be urgent or dangerous, say that clearly and tell the patient to contact emergency services or a healthcare professional right away.
    If the situation is not urgent, give practical next steps and let the system handle any appointment or home remedy suggestions automatically.`

      const formattingPrompt = `Format the answer in GitHub-flavored Markdown.
    Keep the tone friendly and easy to read.
    Use short sentences when helpful, but do not make the answer feel clipped.
    If missing a critical detail, ask just ONE follow-up question instead of multiple.
    If the user asks for first aid, emergency care, or a how-to guide, structure the answer like a guide with a short title, a brief opening line, and numbered steps.
    Add a short "When to get urgent help" note when that improves safety.
    Use numbered steps only when giving instructions.
    Use bullets only for short lists.
    Do not use markdown headings (#, ##, ###).
    Do not add an introduction like "Based on the medical information provided".
    Do not repeat the question.
    Do not use tables.
    Keep the answer concise, but allow a little more detail when it helps the user.`

      const conversationContext = conversationHistory.length > 0
        ? `Conversation so far:\n${conversationHistory.map((message) => `${message.role.toUpperCase()}: ${message.content}`).join('\n')}`
        : ''

      const baseUserPrompt = [
        conversationContext,
        mcpContext ? `Live system context from MCP:\n\n${mcpContext}` : '',
        context ? `Based on the following medical information:\n\n${context}` : '',
        `Please help the patient with this request: ${sanitizedQuery}`,
        'If a critical detail is missing, ask just ONE follow-up question to clarify before giving your full response.',
      ]
        .filter(Boolean)
        .join('\n\n')

      const userPrompt = shouldUseStructuredFormatting(sanitizedQuery)
        ? `${formattingPrompt}\n\n${baseUserPrompt}`
        : baseUserPrompt

      const modelsToTry = Array.from(new Set([openRouterLLMModel, openRouterFallbackLLMModel].filter(Boolean)))
      let lastError

      for (const model of modelsToTry) {
        try {
          const completion = await openai.chat.completions.create({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.6,
            max_tokens: 500,
          })

          llmResponse = completion.choices[0]?.message?.content
          if (llmResponse) {
            break
          }

          lastError = new Error('Empty response from LLM')
        } catch (modelError) {
          lastError = modelError
          const modelErrorMessage = String(modelError?.message || '')

          if (!modelErrorMessage.includes('No endpoints found')) {
            break
          }
        }
      }

      if (!llmResponse) {
        throw lastError || new Error('Empty response from LLM')
      }
    } catch (llmError) {
      console.error('Error generating LLM response:', llmError)
      return res.status(500).json({
        error: 'Failed to generate response',
        details: llmError.message,
      })
    }

    // Step 5: Optionally evaluate and act (book appointments, suggest remedies)
    let actionResult = null
    try {
      if (confirmationIntent && latestAppointment) {
        const confirmedDoctorName = await resolveDoctorDisplayName(latestAppointment.doctorId)
        actionResult = {
          actionTaken: true,
          appointment: {
            ...latestAppointment,
            doctor: {
              doctorId: latestAppointment.doctorId,
              doctorName: confirmedDoctorName,
            },
          },
          confirmedExistingAppointment: true,
        }
      } else if (shouldHandleBooking && (!preferredAppointment?.date || !preferredAppointment?.time)) {
        actionResult = {
          actionTaken: false,
          needsAppointmentDetails: true,
          question: 'What date and time would you like me to book the appointment for?',
        }
      } else {
        actionResult = await evaluateAndAct({
          query: sanitizedQuery,
          userId: normalizedUserId,
          patientId,
          doctorId,
          userRole,
          preferredAppointment,
        })
      }
    } catch (actErr) {
      console.error('[AI Chat] evaluateAndAct failed:', actErr)
      actionResult = { actionTaken: false, error: String(actErr) }
    }

    if (confirmationIntent && latestAppointment) {
      const confirmedDoctor = actionResult?.appointment?.doctor?.doctorName || 'the doctor'
      const { dateLabel, timeLabel } = formatAppointmentDateTime(latestAppointment)
      llmResponse = `Your previous appointment is confirmed with ${confirmedDoctor} for ${dateLabel} at ${timeLabel}.`
    } else if (confirmationIntent) {
      llmResponse = 'I could not find a previous appointment to confirm. If you want to book a new one, tell me the date and time and I will handle it.'
    } else if (shouldHandleBooking) {
      if (actionResult?.needsAppointmentDetails) {
        llmResponse = actionResult.question || 'What date and time would you like me to book the appointment for?'
      } else if (actionResult?.actionTaken && actionResult?.appointment) {
        const bookedDoctor = actionResult.appointment?.doctor?.doctorName || actionResult.appointment?.doctor?.doctorFirstName || 'the doctor'
        const { dateLabel: bookedDate, timeLabel: bookedTime } = formatAppointmentDateTime(actionResult.appointment)
        llmResponse = `Your appointment has been booked successfully with ${bookedDoctor} for ${bookedDate} at ${bookedTime}. Please wait while the system finishes saving it.`
      } else if (actionResult && actionResult.actionTaken === false) {
        llmResponse = actionResult.error
          ? `I could not complete the booking right now. ${actionResult.error}`
          : 'I could not complete the booking right now. Please try again shortly.'
      }
    }

    // Step 6: Return response and context sources
    let persistedConversationId = null

    try {
      persistedConversationId = String(conversation._id)

      await AIMessage.insertMany([
        {
          conversationId: conversation._id,
          role: 'user',
          content: sanitizedQuery,
          model: '',
          sources: [],
        },
        {
          conversationId: conversation._id,
          role: 'assistant',
          content: llmResponse,
          model: openRouterLLMModel,
          sources: relevantMatches
            .map((match) => ({
              text: String(match?.metadata?.chunk_text || match?.metadata?.text || ''),
              score: Number.isFinite(match?.score) ? match.score : null,
            }))
            .filter((source) => source.text.length > 0),
        },
      ])

      await AIConversation.updateOne(
        { _id: conversation._id },
        {
          $set: { lastMessageAt: new Date() },
          $inc: { messageCount: 2 },
        },
      )
    } catch (persistError) {
      console.error('[AI Chat] Failed to persist chat messages:', persistError)
    }

    return res.status(200).json({
      response: llmResponse,
      context: contextChunks,
      mcpContext: mcpContext ? [mcpContext] : [],
      sourceCount: contextChunks.length,
      action: actionResult,
      conversationId: persistedConversationId,
    })
  } catch (error) {
    console.error('Unexpected error in /api/ai/chat:', error)
    return res.status(503).json({
      error: 'AI service temporarily unavailable',
      details: error.message,
    })
  }
})

/**
 * GET /api/ai/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    pineconeIndex: PINECONE_INDEX_NAME,
    namespace: PINECONE_NAMESPACE,
  })
})

module.exports = router
