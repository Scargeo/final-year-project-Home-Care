# HomeCare AI Chatbot - Quick Start Guide

## ✅ What's Been Set Up

### Frontend
- ✅ ChatBot component with message UI
- ✅ "AI Assistant" button in home page header
- ✅ Responsive chat interface (desktop & mobile)
- ✅ Source document display

### Backend
- ✅ API endpoint at `/api/ai/chat` for chat queries
- ✅ Health check endpoint at `/api/ai/health`
- ✅ Pinecone vector search integration
- ✅ OpenRouter LLM integration for responses

### Data Pipeline
- ✅ PDF extraction script (extract.js)
- ✅ Pinecone upload script (uploadPDF.js)
- ✅ 248 chunks already uploaded to Pinecone

## 🚀 Quick Start (3 Steps)

### Step 1: Verify Environment
Ensure `server/.env` has these keys:
```env
PINECONE_API_KEY=your_key_here
PINECONE_INDEX_NAME=homecare-chatbot
OPENROUTER_API_KEY=your_key_here
```

### Step 2: Start Backend
```bash
cd server
npm install  # (already done, but good to verify)
npm start    # Starts nodemon on port 3003
```

Expected output:
```
Server is running on port 3003
```

### Step 3: Start Frontend & Test
```bash
# In new terminal, from project root
npm run dev  # Starts Vite on port 5173

# Open browser: http://localhost:5173
# Click "AI Assistant" button
# Ask: "How do I treat a burn?"
```

## 🧪 Testing the Chatbot

### Test 1: Health Check
```bash
curl http://localhost:3003/api/ai/health
```
Expected: `{"status":"ok","pineconeIndex":"homecare-chatbot","namespace":"default"}`

### Test 2: Simple Query
```bash
curl -X POST http://localhost:3003/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"query":"What is first aid?"}'
```

### Test 3: Interactive Testing
1. Open home page (http://localhost:5173)
2. Click "AI Assistant" in header
3. Try these sample questions:
   - "How do I perform CPR?"
   - "What should I do for a sprained ankle?"
   - "How to treat a cut?"
   - "What are the signs of a heart attack?"

## 🔍 Troubleshooting

### Issue: "ChatBot component not found"
**Solution**: Ensure ChatBot.jsx is in `src/` directory
```bash
ls -la src/ChatBot.jsx src/ChatBot.css
```

### Issue: 404 on /api/ai/chat
**Solution**: Verify chatRoute.js is registered in server.js
```bash
grep "require.*routes/ai" server/server.js
```

### Issue: "Failed to generate embedding"
**Solution**: Check OpenRouter API key
```bash
curl -H "Authorization: Bearer $YOUR_KEY" \
  https://openrouter.ai/api/v1/models
```

### Issue: "No chunks found"
**Solution**: Re-upload PDF chunks
```bash
cd server/ai-components
node scripts/uploadPDF.js
```

### Issue: Slow responses (>5 seconds)
**Solution**: 
- Check network latency to OpenRouter
- Reduce topK from 5 to 3 in chatRoute.js
- Use faster LLM model: `neural-chat-7b-v3-1`

## 📊 Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                     │
│  ┌────────────────────────────────────────────────┐    │
│  │  App.jsx                                       │    │
│  │  - "AI Assistant" Button (Header)              │    │
│  │  - Toggles ChatBot visibility                  │    │
│  └────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────┐    │
│  │  ChatBot.jsx                                   │    │
│  │  - Message UI                                  │    │
│  │  - Sends query to /api/ai/chat                │    │
│  │  - Displays response + sources                │    │
│  └────────────────────────────────────────────────┘    │
└──────────────────────────────────┬──────────────────────┘
                                   │ HTTP POST
                                   ↓
┌─────────────────────────────────────────────────────────┐
│                Backend (Express.js)                     │
│  ┌────────────────────────────────────────────────┐    │
│  │  server.js                                     │    │
│  │  - Mounts /api/ai routes                       │    │
│  └────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────┐    │
│  │  chatRoute.js (/api/ai/chat)                   │    │
│  │  1. Embed query (OpenRouter)                   │    │
│  │  2. Search Pinecone (similarity)               │    │
│  │  3. Generate response (LLM)                    │    │
│  │  4. Return response + sources                  │    │
│  └────────────────────────────────────────────────┘    │
└──────────┬──────────────────────────────────────────────┘
           │
      ┌────┴────────────────────────────┐
      ↓                                  ↓
┌──────────────────┐          ┌──────────────────────┐
│ Pinecone         │          │ OpenRouter LLM       │
│ (Vector DB)      │          │ - Embeddings         │
│ - Similarity     │          │ - Chat Completions   │
│   Search         │          │ - ~50+ Models        │
└──────────────────┘          └──────────────────────┘
```

## 📁 File Structure

```
project-root/
├── src/
│   ├── App.jsx (Updated - imports ChatBot)
│   ├── ChatBot.jsx (New - chat UI component)
│   ├── ChatBot.css (New - chat styles)
│   └── ...
├── server/
│   ├── server.js (Updated - registers /api/ai)
│   ├── routes/
│   │   ├── ai/
│   │   │   └── chatRoute.js (New - chat endpoint)
│   │   ├── patients/
│   │   ├── nurses/
│   │   └── sos/
│   ├── ai-components/
│   │   ├── scripts/
│   │   │   ├── extract.js (Existing)
│   │   │   └── uploadPDF.js (Existing)
│   │   └── data/
│   │       └── chunks.json (Generated)
│   ├── package.json (Updated - added dependencies)
│   ├── .env (Config)
│   └── ...
├── RAG_CHATBOT_SETUP.md (Documentation)
└── QUICKSTART.md (This file)
```

## 🔄 Data Flow Example

### User asks: "How do I treat a burn?"

1. **Frontend** sends POST to `/api/ai/chat`
   ```json
   {"query": "How do I treat a burn?"}
   ```

2. **Backend** generates embedding of query using OpenRouter

3. **Backend** queries Pinecone for similar chunks (~50ms)
   ```
   Retrieved: [
     "Apply cool water to the burn for 10-20 minutes...",
     "Cover burn with clean, non-adhesive bandage...",
     "Take pain relief medication if needed..."
   ]
   ```

4. **Backend** sends to OpenRouter LLM with context (~1-2s)
   ```
   System: "You are a helpful medical information assistant..."
   User: "Based on [retrieved chunks] answer: How do I treat a burn?"
   ```

5. **Backend** returns response (~200-500 tokens)
   ```json
   {
     "response": "For treating a burn: 1. Cool it with water... 2. Clean gently... 3. Apply antibiotic ointment...",
     "context": ["Apply cool water...", "Cover burn..."],
     "sourceCount": 3
   }
   ```

6. **Frontend** displays response with expandable sources

## 💡 Tips & Best Practices

### For Better Responses
- Ask specific questions (avoid vague queries)
- Reference medical conditions by name
- Use clear language

### For Better Performance
- Increase topK from 5 to 10 for broader context
- Use `neural-chat-7b-v3-1` for faster responses
- Cache frequently asked questions

### For Better Privacy
- Don't store query history in localStorage
- Run backend on secure HTTPS in production
- Encrypt sensitive medical information

## 🐛 Debug Mode

Enable detailed logging in `chatRoute.js`:
```javascript
// Uncomment this line at the top:
const DEBUG = true;

// Then it will log:
console.log(`[AI Chat] Processing query: "${sanitizedQuery}"`)
console.log(`[AI Chat] Found ${contextChunks.length} relevant documents`)
```

Check server logs:
```bash
npm start  # Will show all [AI Chat] log messages
```

## 🚪 Next Steps

1. **Customize** the system prompt in chatRoute.js
2. **Add** more PDFs to the knowledge base
3. **Implement** conversation history/sessions
4. **Deploy** to production with HTTPS
5. **Monitor** query patterns and improve LLM parameters
6. **Add** analytics/feedback mechanism

## 🤝 Support

For issues or questions:
1. Check `/memories/session/rag-chatbot-implementation.md`
2. Review `RAG_CHATBOT_SETUP.md`
3. Check troubleshooting section above
4. Review server logs: `npm start` shows all errors

---

**Last Updated**: April 2026
**Status**: ✅ Ready for Testing
