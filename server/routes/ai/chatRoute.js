const express = require('express')
const router = express.Router()
const { Pinecone } = require('@pinecone-database/pinecone')
const OpenAI = require('openai')
const dotenv = require('dotenv')
const path = require('path')

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') })

const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'homecare-chatbot'
const PINECONE_NAMESPACE = process.env.PINECONE_NAMESPACE || 'default'
const PINECONE_API_KEY = process.env.PINECONE_API_KEY
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

const openRouterLLMModel = process.env.OPENROUTER_LLM_MODEL || 'openrouter/auto'
const openRouterFallbackLLMModel = process.env.OPENROUTER_FALLBACK_LLM_MODEL || 'openai/gpt-3.5-turbo'
const openRouterEmbedModel = process.env.OPENROUTER_EMBED_MODEL || 'text-embedding-3-small'

// Validate required environment variables
if (!PINECONE_API_KEY || !OPENROUTER_API_KEY) {
  console.error('Missing PINECONE_API_KEY or OPENROUTER_API_KEY in environment variables')
}

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
    const { query } = req.body

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
      return res.status(500).json({
        error: 'Failed to generate query embedding',
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
      return res.status(500).json({
        error: 'Failed to query knowledge base',
        details: queryError.message,
      })
    }

    // Step 3: Extract context from query results
    const contextChunks = queryResults.matches
      .filter((match) => match.score > 0.5) // Only use relevant matches
      .map((match) => {
        const metadata = match.metadata || {}
        return metadata.chunk_text || ''
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
      const systemPrompt = `You are a helpful medical information assistant for HomeCare Hospital. 
You have access to medical knowledge and information about first aid, healthcare procedures, and general medical information.
Provide accurate, helpful, and compassionate responses to user queries.
If you don't know something or if the information is not in your knowledge base, be honest about it and suggest consulting a healthcare professional.
Keep responses concise and understandable for a general audience.`

      const userPrompt = context
        ? `Based on the following medical information:\n\n${context}\n\nPlease answer this question: ${sanitizedQuery}`
        : `Please answer this medical question: ${sanitizedQuery}`

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
            temperature: 0.7,
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

    // Step 5: Return response and context sources
    return res.status(200).json({
      response: llmResponse,
      context: contextChunks,
      sourceCount: contextChunks.length,
    })
  } catch (error) {
    console.error('Unexpected error in /api/ai/chat:', error)
    return res.status(500).json({
      error: 'Internal server error',
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
