# Home Care MCP Server

MCP (Model Context Protocol) server for the Home Care system. Exposes patient data, doctor information, appointments, and medical resources to AI models.

## Setup

### 1. Install Dependencies

```bash
cd server/mcp-server
npm install
```

### 2. Environment Variables

Ensure your `server/.env` file includes MongoDB connection string:

```
MONGO_URI=mongodb://localhost:27017/homecare
```

### 3. Run the Server

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

## Resources

The MCP server exposes these resources:

- `patient://health-records` - Patient health records
- `doctor://profiles` - Doctor information
- `appointments://active` - Active appointments
- `medical://reference` - Medical reference data

## Tools

Available tools that the AI can call:

1. **get_patient_health_record** - Retrieve patient health history
2. **search_patient_by_name** - Search for patients
3. **get_doctor_info** - Get doctor details
4. **search_available_doctors** - Find available doctors by specialty
5. **get_patient_appointments** - Get patient appointments
6. **create_appointment** - Create new appointment
7. **add_health_note** - Add clinical notes to health record

## Integration with AI Chatbot

The MCP server is designed to be used with your AI chat system. Update `server/routes/ai/chatRoute.js` to use the MCP client to give your chatbot access to real-time data.

See `../routes/ai/chatRoute.js` for integration details.

## Architecture

```
┌─────────────────────┐
│   AI Chatbot        │
│  (Chat Route)       │
└──────────┬──────────┘
           │
           │ MCP Client
           │
     ┌─────▼─────┐
     │ MCP Server │  (this server)
     └─────┬─────┘
           │
           │ Mongoose
           │
     ┌─────▼──────┐
     │  MongoDB   │
     └────────────┘
```

## Debugging

Check server logs for errors:
```bash
npm run dev 2>&1 | grep "\[MCP\]"
```

## Next Steps

1. ✅ MCP Server foundation (DONE)
2. ⏳ Integrate MCP client into chat route
3. ⏳ Test with real patient/doctor queries
4. ⏳ Add more tools as needed
