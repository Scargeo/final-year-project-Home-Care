const fs = require("fs")
const path = require("path")
const dotenv = require("dotenv")
const { Pinecone } = require("@pinecone-database/pinecone")
const OpenAI = require("openai")

dotenv.config({ path: path.join(__dirname, "..", "..", ".env") })

const chunksPath = path.join(__dirname, "..", "data", "chunks.json")
const pineconeIndexName = process.env.PINECONE_INDEX_NAME || "homecare-chatbot"
const pineconeNamespace = process.env.PINECONE_NAMESPACE || "default"
const openRouterEmbedModel = process.env.OPENROUTER_EMBED_MODEL || process.env.OPENROUTER_MODEL || "text-embedding-3-small"

function loadChunks() {
  const raw = fs.readFileSync(chunksPath, "utf8")
  const parsed = JSON.parse(raw)

  if (!Array.isArray(parsed)) {
    throw new Error("chunks.json must contain an array of chunk strings")
  }

  return parsed
    .map((item) => String(item || "").trim())
    .filter(Boolean)
}

async function run() {
  const apiKey = String(process.env.PINECONE_API_KEY || "").trim()
  if (!apiKey) {
    throw new Error("PINECONE_API_KEY is required in server/.env")
  }

  const chunks = loadChunks()
  if (chunks.length === 0) {
    throw new Error("No chunks found to upload")
  }

  const pc = new Pinecone({ apiKey })
  const index = pc.index(pineconeIndexName)

  const integratedRecords = chunks.map((chunk, i) => ({
    id: `chunk-${i}`,
    chunk_text: chunk,
    source: "first-aid-reference-guide.pdf",
    chunk_index: i,
  }))

  try {
    await index.upsertRecords({
      namespace: pineconeNamespace,
      records: integratedRecords,
    })

    console.log(`Uploaded ${integratedRecords.length} chunks to Pinecone index '${pineconeIndexName}' (namespace: '${pineconeNamespace}') using integrated mode.`)
    return
  } catch (integratedError) {
    const openRouterApiKey = String(process.env.OPENROUTER_API_KEY || "").trim()
    if (!openRouterApiKey) {
      throw new Error(`Integrated upsert failed (${integratedError.message}) and OPENROUTER_API_KEY is missing for vector fallback.`)
    }

    const openai = new OpenAI({
      apiKey: openRouterApiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:3000",
        "X-Title": process.env.OPENROUTER_APP_NAME || "Home Care AI Components",
      },
    })
    const batchSize = 20
    let uploaded = 0

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize)
      const embeddingResponse = await openai.embeddings.create({
        model: openRouterEmbedModel,
        input: batch,
      })

      const records = batch.map((chunk, offset) => {
        const values = embeddingResponse?.data?.[offset]?.embedding
        if (!Array.isArray(values) || values.length === 0) {
          throw new Error(`Missing embedding vector for chunk ${i + offset}`)
        }

        return {
          id: `chunk-${i + offset}`,
          values,
          metadata: {
            text: chunk,
            source: "first-aid-reference-guide.pdf",
            chunk_index: i + offset,
          },
        }
      })

      await index.upsert({
        namespace: pineconeNamespace,
        records,
      })

      uploaded += records.length
    }

    console.log(`Uploaded ${uploaded} chunks to Pinecone index '${pineconeIndexName}' (namespace: '${pineconeNamespace}') using OpenRouter vector fallback.`)
  }
}

run().catch((error) => {
  console.error("Failed to upload chunks to Pinecone:", error.message)
  process.exitCode = 1
})
