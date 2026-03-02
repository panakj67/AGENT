# 🚀 Quick Start Testing Guide

## Prerequisites
```bash
# Ensure environment variables are set
# .env file should contain:
GROQ_API_KEY=gsk_xxxx...
MONGODB_URI=MongoDB connection string
JWT_SECRET=your_secret_key
```

## 1. Start Backend Server
```bash
cd server
npm start
# Should print: Server running on http://localhost:5000
```

## 2. Start Frontend Client
```bash
cd client
npm run dev
# Should print: VITE v... ready in XXX ms
```

## 3. Test Basic Chat Flow

### Login
```bash
# Navigate to http://localhost:5173
# Login with test credentials
```

### Simple Message Test
```
User: "What is the capital of France?"
Expected: "Paris" or similar response
Flow: 
  1. User sends message
  2. Frontend (/api/chat POST)
  3. Backend processes via runAgent()
  4. No tools needed - direct response
  5. Frontend displays response
```

### With Task Creation
```
User: "Remind me to call mom tomorrow at 3pm"
Expected: Task saved confirmation
Flow:
  1. Agent detects task requirement
  2. Calls save_task with userId context
  3. Returns confirmation with task ID
  4. Task stored in MongoDB
```

---

## 4. Test Task Chaining (2-3 Steps)

### Test Case 1: Search + Summarize
```
User: "Get the price of Bitcoin"
Expected: Current BTC price
Flow:
  Step 1: Agent calls get_crypto_price("bitcoin")
  Step 2: Returns result (no further tools needed)
  Step 3: Returns response
```

### Test Case 2: Task Management Workflow
```
User: "Show me all my tasks"
Expected: List of all incomplete tasks
Flow:
  Step 1: Agent calls get_tasks()
  Step 2: Returns list with context (userId passed)
  Step 3: Formats and returns to user
```

### Test Case 3: Multi-Step (Requires API Keys)
```
User: "Search for Python tutorials and save it as a task"
Flow:
  Step 1: search_web("Python tutorials") → TAVILY_API_KEY
  Step 2: Process results
  Step 3: save_task() → Saves as reminder
  Step 4: Return confirmation
```

---

## 5. Verify Agent Loop (MAX_STEPS=6)

The agent supports up to 6 consecutive tool calls:

```
Request → Step 1 (Tool A) → Result → Step 2 (Tool B) → ... → Step 6 → Response
```

### Test Long Chain:
```
User: "Find AI news, get full article, save as task"
Flow:
  Step 1: search_web("AI news")
  Step 2: scrape_website(top_result)
  Step 3: save_task("Read AI article")
  Step 4: get_tasks() to confirm
  Step 5: Format response
  Step 6: Return
```

---

## 6. Frontend-Backend Sync Tests

### Test Conversation Persistence
```
1. Send message in chat
2. Refresh browser (F5)
3. Check: Conversation still appears in sidebar
4. Check: All messages loaded correctly
5. Check: Can continue conversation
```

### Test Conversation Switching
```
1. Create conversation A
2. Create conversation B
3. Click on A in sidebar
4. Check: Messages from A appear, not B
5. Click on B
6. Check: Messages from B appear
```

### Test Conversation Deletion
```
1. Create conversation
2. Click delete icon
3. Confirm deletion
4. Check: Conversation removed from sidebar list
5. Check: Messages no longer accessible
```

---

## 7. Error Handling Tests

### Missing API Key
```
User: "What's the weather in New York?"
Expected: Error message about missing WEATHER_API_KEY
Response: Graceful error handling
```

### Invalid Context
```
Scenario: Call task function without userId
Expected: Error message
Check: No 500 error, clear feedback
```

### Tool Execution Failure
```
Scenario: Network error during API call
Expected: Retry logic or error message
Check: Frontend shows error, not crash
```

---

## 8. Configuration Checklist

Required for Full Testing:

### ✅ Already Configured
- [ ] GROQ_API_KEY (LLM)
- [ ] MONGODB_URI (Database)
- [ ] JWT_SECRET (Auth)

### ⚠️ Optional (for additional tools)
- [ ] TAVILY_API_KEY (Web search)
- [ ] WEATHER_API_KEY (Weather)
- [ ] NEWS_API_KEY (News headlines)
- [ ] EMAIL_USER (Gmail)
- [ ] EMAIL_PASS (Gmail app password)

### Commands to Get Keys:
```bash
# Tavily API (Web Search)
# https://tavily.com → Sign up → Get API key

# OpenWeather API (Weather)
# https://openweathermap.org/api → Sign up → API keys

# NewsAPI (News)
# https://newsapi.org → Sign up → Get API key

# Gmail Setup
# 1. Enable Gmail API in Google Cloud
# 2. Create App Password (not regular password)
# 3. Set EMAIL_USER and EMAIL_PASS
```

---

## 9. Testing Script Examples

### cURL Examples
```bash
# Test Chat (needs valid token)
TOKEN="your_jwt_token_here"

curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "message": "What is 2+2?",
    "conversationId": null
  }'

# Get Conversations
curl -X GET http://localhost:5000/api/conversations \
  -H "Authorization: Bearer $TOKEN"

# Get Specific Conversation
curl -X GET http://localhost:5000/api/conversations/{id} \
  -H "Authorization: Bearer $TOKEN"

# Delete Conversation
curl -X DELETE http://localhost:5000/api/conversations/{id} \
  -H "Authorization: Bearer $TOKEN"
```

### Browser Console Tests
```javascript
// Test API directly from browser console
const token = localStorage.getItem('auth_token');
const API = 'http://localhost:5000/api';

// Send message
fetch(API + '/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    message: 'Hello world',
    conversationId: null
  })
}).then(r => r.json()).then(console.log);

// Get conversations
fetch(API + '/conversations', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json()).then(console.log);
```

---

## 10. Debugging Tips

### Enable Server Logs
```bash
# Server logs show:
# - Tool execution: [TOOL EXECUTION] Running: tool_name
# - Tool success: [TOOL SUCCESS] tool_name completed
# - Tool errors: [TOOL EXECUTION ERROR] tool_name: error message
# - Agent steps: Each iteration of agent loop
```

### Check Browser Console
```
Frontend logs show:
- API requests/responses
- Conversation loading
- Message rendering
- Error handling
```

### MongoDB Inspection
```bash
# View conversations
db.conversations.find({})

# View tasks
db.tasks.find({})

# View users
db.users.find({})
```

---

## 11. Performance Expectations

| Operation | Expected Time |
|-----------|---------------|
| Send simple message | 2-5 seconds |
| Tool execution | 5-15 seconds |
| Multi-step chain | 15-30 seconds |
| Page load | 1-2 seconds |
| Conversation list | <1 second |

---

## ✅ Success Criteria

- [ ] Login works
- [ ] Send message → Get response < 10 seconds
- [ ] Message saved in conversation
- [ ] Conversation appears in sidebar
- [ ] Can switch between conversations
- [ ] Can delete conversation
- [ ] Task saves with userId context
- [ ] Task chaining works (2+ steps)
- [ ] Error messages are clear

---

**System Ready for Testing! 🚀**
