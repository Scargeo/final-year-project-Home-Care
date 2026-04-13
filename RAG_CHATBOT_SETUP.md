# HomeCare AI Chatbot - RAG System Documentation

## Overview

The HomeCare AI Chatbot is a Retrieval-Augmented Generation (RAG) system that combines:
- **PDF Knowledge Base**: First-aid reference guide chunked into 500-character segments
- **Vector Database**: Pinecone for semantic search of relevant documents
- **LLM**: OpenRouter for intelligent response generation
- **Frontend UI**: React-based chatbot interface

## Architecture

### Data Pipeline
```
PDF File → extract.js → chunks.json → uploadPDF.js → Pinecone Index
                                            ↓
                                    OpenRouter Embeddings
```

### Query Pipeline
```
User Query → ChatBot Component → /api/ai/chat → Pinecone Vector Search
                                                      ↓
                                          OpenRouter Embeddings + LLM
                                                      ↓
                                          Response + Source Documents
```

## Components

### Frontend (src/)

#### ChatBot.jsx
- **Location**: `src/ChatBot.jsx`
- **Purpose**: Interactive chat interface component
- **Features**:
  - Message history with timestamps
  - Typing indicator for loading states
  - Source document display (expandable)
  - Auto-scroll to latest message
  - Responsive design (mobile-friendly)
  - Open/close functionality

#### ChatBot.css
- **Location**: `src/ChatBot.css`
- **Features**: 
  - Gradient purple header (667eea to 764ba2)
  - Smooth animations and transitions
  - Message bubble styling (user vs bot)
  - Custom scrollbar styling
  - Mobile responsive (320px+)

#### App.jsx (Updated)
- Added "AI Assistant" button in header
- State management for chatbot visibility
- Conditional rendering of ChatBot component

### Backend (server/)

#### chatRoute.js
- **Location**: `server/routes/ai/chatRoute.js`
- **Main Endpoints**:

##### POST /api/ai/chat
```javascript
// Request
{
  "query": "What are the steps for CPR?"
}

// Response
{
  "response": "...",  // LLM-generated response
  "context": [...],   // Relevant documents from knowledge base
  "sourceCount": 3    // Number of documents used
}
```

**Flow**:
1. Validate query (non-empty string)
2. Generate embedding using OpenRouter's text-embedding-3-small
3. Query Pinecone for similar documents (top 5, score > 0.5)
4. Combine retrieved context with system prompt
5. Generate response using OpenRouter's LLM
6. Return response + sources

##### GET /api/ai/health
- Health check endpoint
- Returns Pinecone index name and namespace
- Useful for debugging connection issues

### Backend AI Components

#### extract.js
- **Location**: `server/ai-components/scripts/extract.js`
- **Purpose**: Extract PDF text and create 500-character chunks
- **Output**: `server/ai-components/data/chunks.json`
- **Usage**: `node scripts/extract.js`

#### uploadPDF.js
- **Location**: `server/ai-components/scripts/uploadPDF.js`
- **Purpose**: Upload chunks to Pinecone with vector embeddings
- **Features**:
  - Tries integrated Pinecone inference first
  - Falls back to OpenRouter embeddings
  - Batch processes chunks (20 at a time)
  - Includes metadata (source, chunk index)
- **Usage**: `node scripts/uploadPDF.js`
- **Last Run**: Successfully uploaded 248 chunks

## Environment Variables

Create/update `server/.env`:

```env
# Server Configuration
BACKENDSERVER=http://localhost:3001
BACKENDSERVER_PORT=3003

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/homecare

# Pinecone Configuration
PINECONE_API_KEY=pcsk_xxxx...
PINECONE_INDEX_NAME=homecare-chatbot
PINECONE_NAMESPACE=default
PINECONE_ENVIRONMENT=us-east-1

# OpenRouter LLM Configuration
OPENROUTER_API_KEY=sk-or-v1-xxxx...
OPENROUTER_LLM_MODEL=mistral-7b-instruct  # or your preferred model
OPENROUTER_EMBED_MODEL=text-embedding-3-small
OPENROUTER_SITE_URL=http://localhost:3000  # Optional
OPENROUTER_APP_NAME=Home Care AI Components  # Optional
```

## Installation & Setup

### 1. Install Dependencies
```bash
cd server
npm install
```

### 2. Prepare Knowledge Base
```bash
# Extract PDF to chunks
cd server/ai-components
node scripts/extract.js

# Upload chunks to Pinecone
node scripts/uploadPDF.js
```

### 3. Start Application
```bash
# From project root
npm run dev:server  # Start backend

# In another terminal
npm run dev        # Start frontend (Vite)
```

### 4. Test Chatbot
1. Navigate to http://localhost:3000
2. Click "AI Assistant" button in header
3. Ask a medical question (e.g., "How do I perform CPR?")
4. View response and source documents

## API Testing

### Health Check
```bash
curl http://localhost:3003/api/ai/health
```

### Query Chatbot
```bash
curl -X POST http://localhost:3003/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"query":"What should I do for a burn?"}'
```

## Dependencies

### Frontend
- React (already included)
- CSS (no additional libraries)

### Backend
- `@pinecone-database/pinecone`: ^7.1.0 - Vector database client
- `openai`: ^4.24.0 - LLM client (OpenAI-compatible for OpenRouter)
- `pdf-parse`: ^2.4.5 - PDF text extraction
- `express`: ^5.2.1 - Web framework
- `dotenv`: ^17.3.1 - Environment configuration
- `cors`: ^2.8.6 - Cross-origin requests

## Configuration Options

### LLM Model Selection (OpenRouter)
Update `OPENROUTER_LLM_MODEL` in `.env`:
- `mistral-7b-instruct` (default) - Fast, good for chat
- `llama-2-70b` - Larger context window
- `gpt-3.5-turbo` - Higher quality responses
- See: https://openrouter.ai/docs/models

### Embedding Model
Update `OPENROUTER_EMBED_MODEL` in `.env`:
- `text-embedding-3-small` (default) - 512 dimensions
- `text-embedding-3-large` - 3072 dimensions (more accurate)

### Search Parameters (chatRoute.js)
```javascript
// Adjust these for better/faster results:
topK: 5              // Number of documents to retrieve
score > 0.5          // Minimum relevance threshold
temperature: 0.7     // LLM creativity (0.0 = deterministic, 1.0 = creative)
max_tokens: 500      // Max response length
```

## Troubleshooting

### "Cannot find Pinecone index"
- Verify PINECONE_API_KEY is correct
- Check PINECONE_INDEX_NAME matches your Pinecone console
- Ensure index is in the correct region (PINECONE_ENVIRONMENT)

### "Failed to generate embedding"
- Check OPENROUTER_API_KEY is valid
- Verify OpenRouter account has credits
- Check baseURL is set to https://openrouter.ai/api/v1

### "No response from chatbot"
- Check /api/ai/health endpoint
- Verify chunks.json was successfully uploaded to Pinecone
- Check server logs for error messages
- Ensure server is running on port 3003

### Empty or irrelevant responses
- Upload more comprehensive PDF chunks
- Adjust `topK` parameter (increase for more context)
- Lower `score > 0.5` threshold to include less relevant documents
- Try different LLM model
- Adjust system prompt in chatRoute.js

## Performance Considerations

- **Latency**: ~1-3 seconds (embedding + search + LLM generation)
- **Chunking**: 500 characters is a good balance (smaller = more search overhead, larger = less context precision)
- **Batch Embeddings**: Processed in batches of 20 to reduce API calls
- **Caching**: Consider caching frequent queries at frontend level

## Security Notes

- API keys should never be exposed in frontend code
- All queries go through backend to keep keys secure
- Consider rate limiting on /api/ai/chat endpoint
- Validate user input to prevent prompt injection

## Future Enhancements

- [ ] Add conversation history/sessions
- [ ] Implement streaming responses
- [ ] Add feedback mechanism (thumbs up/down)
- [ ] Query caching layer
- [ ] Support for multiple knowledge bases
- [ ] Admin panel for knowledge base management
- [ ] Analytics/logging for query patterns

## Files Modified/Created

### New Files
- `src/ChatBot.jsx` - Chatbot component
- `src/ChatBot.css` - Chatbot styles
- `server/routes/ai/chatRoute.js` - API endpoint

### Modified Files
- `src/App.jsx` - Added chatbot integration
- `server/server.js` - Registered AI routes
- `server/package.json` - Added dependencies

### Existing Files (Part of RAG)
- `server/ai-components/scripts/extract.js`
- `server/ai-components/scripts/uploadPDF.js`
- `server/.env` - Configuration
