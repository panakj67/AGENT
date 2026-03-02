# 🔗 Task Chaining Architecture & Flow

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                          USER BROWSER                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Home.jsx: Sends message → Receives full conversation     │ │
│  └────────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    HTTP POST /api/chat
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        BACKEND SERVER                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  chat.controller.js                                        │ │
│  │  ├─ Auth check (requireAuth middleware)                   │ │
│  │  ├─ Parse message                                         │ │
│  │  └─ Call: runAgent(messages, { userId, userEmail })      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                             │                                    │
│                             ▼                                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  agent.js: Main Loop (MAX_STEPS = 6)                      │ │
│  │                                                             │ │
│  │  for step = 0 to 5:                                        │ │
│  │    1. Send messages to LLM (Groq)                          │ │
│  │    2. Get response                                         │ │
│  │    3. Parse for tool call JSON                            │ │
│  │       ├─ If tool call found → Step 4                       │ │
│  │       └─ If no tool → Return formatted response            │ │
│  │    4. Execute tool with context                           │ │
│  │    5. Feed result back to LLM                             │ │
│  │    6. Add to message history                              │ │
│  │    7. Loop continues                                       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                             │                                    │
│                             ▼                                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  executor.js: Tool Handler                                │ │
│  │  ├─ Receives: { function: { name, arguments }, context }  │ │
│  │  ├─ Context: { userId, userEmail }                        │ │
│  │  ├─ Routes to appropriate tool handler                    │ │
│  │  └─ Returns: { success, data } or { error, details }      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                             │                                    │
│         ┌───────────────────┼───────────────────┐               │
│         │                   │                   │               │
│         ▼                   ▼                   ▼               │
│    Web Tools          Email Tools          Task Tools          │
│    ├─ search_web     ├─ read_gmail        ├─ save_task        │
│    ├─ scrape_website ├─ read_email_body   ├─ get_tasks        │
│    ├─ click_scrape   └─ send_email        └─ delete_task      │
│    ├─ fill_form                                                │
│    ├─ take_screenshot                                          │
│    ├─ get_weather                                              │
│    ├─ get_news                                                 │
│    └─ get_crypto_price                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                             │
                    Response + Full Conversation
                             │
                             ▼
         ┌──────────────────────────────────────┐
         │  Frontend Updates State              │
         │  ├─ Saves all messages               │
         │  ├─ Updates sidebar history          │
         │  └─ Renders in chat UI               │
         └──────────────────────────────────────┘
```

---

## Agent Loop - Detailed State Machine

```
START
  │
  ├─ Load System Message (if not present)
  │
  ├─ Initialize message history
  │
  └─ STEP LOOP (0 to MAX_STEPS-1)
     │
     ├─ Call LLM with message history
     │  │
     │  └─ Groq: llama-3.3-70b-versatile
     │     temperature: 0 (deterministic)
     │
     ├─ Get response content
     │  │
     │  └─ Check for tool call pattern
     │
     ├─ DECISION: Tool call detected?
     │  │
     │  ├─ YES → Proceed to tool execution
     │  │  │
     │  │  ├─ Parse JSON tool call
     │  │  │  {"tool": "...", "arguments": {...}}
     │  │  │
     │  │  ├─ Execute tool
     │  │  │  executeTool(toolCall, { userId, userEmail })
     │  │  │
     │  │  ├─ Get tool result
     │  │  │
     │  │  ├─ Add to message history:
     │  │  │  ├─ { role: "assistant", content: toolCall_json }
     │  │  │  └─ { role: "system", content: result }
     │  │  │
     │  │  └─ Continue loop
     │  │
     │  └─ NO → Format & return response
     │     │
     │     └─ EXIT LOOP (success)
     │
     └─ MAX_STEPS reached
        └─ Return error message


RESPONSE RETURNED TO CONTROLLER
  │
  ├─ Save conversation to MongoDB
  │  ├─ User message
  │  └─ Assistant response
  │
  └─ Return to frontend
     { reply, conversationId, conversation }
```

---

## Example: 2-Step Task Chain

### Scenario: "Save my favorite color and remind me tomorrow"

```
STEP 1: LLM Analyzes
┌─────────────────────────────────────┐
│ Input: "Save my favorite color and  │
│ remind me tomorrow"                 │
│                                     │
│ LLM determines: save_task needed    │
│ Returns: {                          │
│   "tool": "save_task",              │
│   "arguments": {                    │
│     "title": "Remember color",      │
│     "description": "Blue is my...",  │
│     "due_at": "2026-03-03T08:00:00Z"│
│   }                                 │
│ }                                   │
└─────────────────────────────────────┘
            │
            ▼
STEP 2: Execute Tool
┌─────────────────────────────────────┐
│ Tool: save_task                     │
│ Context: { userId: "user_123" }    │
│                                     │
│ Task created:                       │
│ {                                   │
│   "id": "task_456",                │
│   "userId": "user_123",             │
│   "title": "Remember color",        │
│   "dueAt": "2026-03-03T08:00:00Z"   │
│ }                                   │
│                                     │
│ Returns: {                          │
│   "success": true,                  │
│   "task_id": "task_456",            │
│   "message": "Task saved: Remember  │
│   color — reminder at 3/3/26.."     │
│ }                                   │
└─────────────────────────────────────┘
            │
            ▼
STEP 3: Continue Loop (No more tools needed)
┌─────────────────────────────────────┐
│ LLM receives tool result            │
│ Formats natural language response:  │
│                                     │
│ "Done! I've saved a reminder about  │
│  your favorite color (blue) for     │
│  tomorrow at 8am."                  │
│                                     │
│ No more tools needed → EXIT LOOP    │
└─────────────────────────────────────┘
            │
            ▼
FINAL: Response Sent to Frontend
- Full conversation saved in MongoDB
- All messages displayed to user
- Task visible when user checks reminders
```

---

## Complex Example: 3-Step Research Chain

### Scenario: "What's happening with Bitcoin today?"

```
REQUEST
User: "What's happening with Bitcoin today?"

───────────────────────────────────────────────────────────

STEP 1: Agent wants current data
┌────────────────────────┐
│ Tool: get_crypto_price │
│ Args: { coin: "bitcoin" }
└────────────────────────┘
         │
         ▼
RESULT: { coin: "bitcoin", price: 42500, currency: "usd" }

───────────────────────────────────────────────────────────

STEP 2: Agent needs news context
┌────────────────────────┐
│ Tool: get_news         │
│ Args: { topic: "Bitcoin" }
└────────────────────────┘
         │
         ▼
RESULT: {
  articles: [
    {
      title: "Bitcoin Hits New All-Time High",
      source: "CoinDesk",
      url: "..."
    },
    { ... more articles ... }
  ]
}

───────────────────────────────────────────────────────────

STEP 3: Agent synthesizes response
┌────────────────────────────┐
│ Combining all data:        │
│ - Current price: $42,500   │
│ - Recent news: [articles]  │
│                            │
│ No more tools needed       │
│ Format human response      │
└────────────────────────────┘
         │
         ▼

FINAL RESPONSE:
"Bitcoin is trading at $42,500 USD. Here's what's happening:

1. BTC has reached new all-time highs
2. Major adoption news from [source]
3. Market sentiment is [analysis]

Check the full articles for more details."

───────────────────────────────────────────────────────────

SAVED STATE:
{
  id: "conv_123",
  messages: [
    { role: "user", content: "What's happening..." },
    { role: "assistant", content: "Final response above" }
  ],
  updatedAt: "2026-03-02T14:30:00Z"
}
```

---

## Context Flow - Fixed in Bug Fix

### Context Object Structure
```javascript
{
  userId: "507f1f77bcf86cd799439011",  // MongoDB ObjectId
  userEmail: "user@example.com"         // User's email
}
```

### How Context Flows
```
chat.controller.js
  │
  └─ Extract userId from req.user
     │
     └─ Call runAgent(messages, { userId, userEmail })
        │
        └─ Path to executeTool
           │
           ├─ Task functions use userId:
           │  ├─ save_task: creates with userId
           │  ├─ get_tasks: filters by userId
           │  └─ delete_task: checks userId ownership
           │
           └─ Email functions use userEmail:
              ├─ send_email: from user's email
              └─ read_gmail: reads user's inbox
```

---

## Tool Dependency Graph

```
                    ┌─────────────┐
                    │   USER      │
                    └──────┬──────┘
                           │
                 ┌─────────▼───────────┐
                 │   AGENT LOOP        │
                 │   (6 steps max)     │
                 └─────────┬───────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
     ┌─────────┐      ┌──────────┐    ┌──────────┐
     │  WEB    │      │  EMAIL   │    │  TASK    │
     │ TOOLS   │      │ TOOLS    │    │ TOOLS    │
     └────┬────┘      └────┬─────┘    └────┬─────┘
          │                │              │
     ┌────┴────────────────┴──────────────┴────┐
     │  Independent, each returns a result    │
     │  Results fed back to LLM for synthesis │
     └───────────────────────────────────────┘
```

---

## Error Handling in Chain

```
Tool Execution Error Path:

Step N: ExecuteTool fails
  │
  ├─ Catches exception
  │
  ├─ Returns: { error: "Tool failed", details: "..." }
  │
  ├─ Adds result to message history
  │
  ├─ LLM continues with next step (or stops)
  │
  └─ User informed of partial results
```

---

## Performance Characteristics

### Single Tool
```
Request → Parse → Execute → Response
   │        0.1s    2-5s      ~0.5s
   └──────────────────────────────── ~3-6 seconds
```

### Multi-Step (2-3 Tools)
```
Request → Parse → Execute → LLM → Execute → LLM → Response
   │       0.1s    3-5s    0.5s   3-5s    0.5s    ~0.5s
   └────────────────────────────────────────────── ~8-15 seconds
```

### Maximum Chain (6 Tools)
```
Request → [Tool 1] → [Tool 2] → [Tool 3] → [Tool 4] → [Tool 5] → [Tool 6] → Response
             ↓                      ↓                      ↓
          LLM + Parse           LLM + Parse           LLM + Parse
  │                                                                              │
  └──────────────────────────────────────────────────────────────────── ~30-45 seconds
```

---

## State Persistence

### Database Schema
```
Conversation:
├─ id (ObjectId)
├─ userId (ObjectId) - for multi-user filtering
├─ title (String) - auto-generated from first message
├─ messages: [
│  ├─ role (string)
│  ├─ content (string)
│  └─ createdAt (Date)
│]
├─ createdAt (Date)
└─ updatedAt (Date)

Task:
├─ id (ObjectId)
├─ userId (ObjectId)
├─ title (String)
├─ description (String)
├─ dueAt (Date)
├─ recurring (enum: none, daily, weekly, monthly)
├─ recurring_time (String) - "08:00" format
├─ completed (Boolean)
├─ createdAt (Date)
└─ updatedAt (Date)
```

---

## Summary

✅ **Agent Chain Capabilities:**
- Automatic tool detection and execution
- Up to 6 consecutive tool calls per request
- Context (userId, userEmail) passed to all tools
- Results fed back to LLM for synthesis
- Errors handled gracefully
- State persisted to MongoDB

✅ **Tool Execution Features:**
- Parallel independent execution (could be parallelized)
- Full error context passed to user
- Timeout protection (15s default per tool)
- API key validation
- Rate limiting support

✅ **Frontend-Backend Alignment:**
- Single REST POST endpoint
- Full conversation returned
- Automatic UI updates
- Conversation persistence
- Multi-user support via userId

**System Ready for Complex Task Chaining! 🚀**
