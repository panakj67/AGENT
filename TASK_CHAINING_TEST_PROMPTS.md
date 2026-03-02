# Task Chaining Test Prompts

## Overview
These prompts are designed to test the agent's ability to chain multiple tools together in sequence.

---

## ✅ TEST 1: Simple Task Chaining (2 Steps)
**Complexity:** ⭐ Easy  
**Expected Tools:** get_crypto_price → save_task

### Prompt
```
"Check the price of Bitcoin and remind me to review it tomorrow at 10am"
```

### Expected Flow
```
Step 1: get_crypto_price("bitcoin")
   └─ Returns: { coin: "bitcoin", price: XXXX, currency: "usd" }

Step 2: save_task({
   title: "Review Bitcoin price",
   description: "Price was $XXXX when checked",
   due_at: "tomorrow 10am"
})
   └─ Returns: { success: true, task_id: "xxx" }

Final Response: Confirmation with price and reminder saved
```

### Test Verification
- ✅ Agent calls get_crypto_price
- ✅ Agent parses price from result
- ✅ Agent calls save_task with context (userId)
- ✅ Task appears in database with correct price info
- ✅ No errors in chain

---

## ✅ TEST 2: Multi-Step Research (3 Steps)
**Complexity:** ⭐⭐ Medium  
**Expected Tools:** search_web → scrape_website → save_task

### Prompt
```
"Search for the latest developments in quantum computing, get the full article from the top result, and save it as a task to read later"
```

### Expected Flow
```
Step 1: search_web("latest quantum computing developments")
   └─ Returns: [article1, article2, article3]

Step 2: scrape_website(url_from_article1)
   └─ Returns: Full article content (trimmed)

Step 3: save_task({
   title: "Read: Quantum Computing Article",
   description: "[Scraped content summary]",
   due_at: null
})
   └─ Returns: Task saved successfully

Final Response: Article summary + confirmation task created
```

### Test Verification
- ✅ Web search executes correctly
- ✅ Website scraping extracts content
- ✅ Content is retrieved and saved
- ✅ Task references the content
- ✅ 3-step chain completes without errors

---

## ✅ TEST 3: Task Management Chain (3 Steps)
**Complexity:** ⭐⭐ Medium  
**Expected Tools:** save_task → save_task → get_tasks

### Prompt
```
"Create three daily reminders for me: exercise at 7am, team meeting at 10am, and review work at 6pm. Then show me all my tasks"
```

### Expected Flow
```
Step 1: save_task({
   title: "Exercise",
   due_at: "daily 07:00",
   recurring: "daily"
})

Step 2: save_task({
   title: "Team Meeting",
   due_at: "daily 10:00",
   recurring: "daily"
})

Step 3: save_task({
   title: "Review Work",
   due_at: "daily 18:00",
   recurring: "daily"
})

Step 4: get_tasks()
   └─ Returns: [all tasks including the 3 just created]

Final Response: Task list with all 3 new reminders
```

### Test Verification
- ✅ Multiple consecutive save_task calls work
- ✅ Context (userId) preserved across all calls
- ✅ get_tasks returns all user's tasks
- ✅ Recurring settings applied correctly
- ✅ Browser shows all tasks in sidebar

---

## ✅ TEST 4: Complex Information Gathering (3+ Steps)
**Complexity:** ⭐⭐ Medium  
**Expected Tools:** get_weather → search_web → save_task

### Prompt
```
"What's the weather in London, find out what outdoor activities are popular there, and create a task to plan a visit"
```

### Expected Flow
```
Step 1: get_weather("London")
   └─ Returns: Temperature, conditions, etc.

Step 2: search_web("popular outdoor activities London")
   └─ Returns: Top activities and attractions

Step 3: save_task({
   title: "Plan London Visit",
   description: "Current weather: [weather]. Top activities: [list]"
})

Final Response: Weather + recommendations + task created
```

### Test Verification
- ✅ Weather API call succeeds
- ✅ Web search returns activities
- ✅ Context integrated into task
- ✅ All 3 steps complete seamlessly

---

## ✅ TEST 5: Long Chain (4+ Steps)
**Complexity:** ⭐⭐⭐ Hard  
**Expected Tools:** search_web → search_web → scrape_website → save_task → get_tasks

### Prompt
```
"Search for Python learning resources, search for JavaScript tutorials, find details about the best Python course, save both as tasks, then show me all my learning tasks"
```

### Expected Flow
```
Step 1: search_web("Python learning resources")
Step 2: search_web("JavaScript tutorials")
Step 3: scrape_website(best_python_course_url)
Step 4: save_task("Learn Python") + save_task("Learn JavaScript")
Step 5: get_tasks()

Final Response: Learning resources + task list
```

### Test Verification
- ✅ Multiple search_web calls in sequence
- ✅ Scraping integrates with other results
- ✅ Multiple task saves in one chain
- ✅ 5-step chain within MAX_STEPS limit
- ✅ All results properly formatted

---

## ⚡ TEST 6: Error Recovery (Test Error Handling)
**Complexity:** ⭐⭐ Medium  
**Expected Behavior:** Handles missing/invalid data gracefully

### Prompt
```
"Get weather for London, then save it as a task, then get all my tasks"
```

### Expected Flow (With Resilience)
```
Step 1: get_weather("London")
   └─ May need WEATHER_API_KEY - should return error if missing
   
If success:
Step 2: save_task with weather data
Step 3: get_tasks()

Expected: Clear error message if API key missing, not 500 error
```

### Test Verification
- ✅ Error messages are clear
- ✅ Agent doesn't crash on tool error
- ✅ Subsequent steps don't execute if previous fails
- ✅ User gets helpful feedback

---

## 🎯 QUICK TEST (Start Here)
**Best for quick verification:**

### Prompt 1 (Simplest)
```
"Tell me what Bitcoin costs and remind me to check it tomorrow"
```
- Tools needed: get_crypto_price, save_task
- Should complete in 5-10 seconds
- Easy to verify: Bitcoin price shown + task appears in list

### Prompt 2 (Simple)
```
"Get Bitcoin price, Ethereum price, and save both as a reminder to compare them"
```
- Tools needed: get_crypto_price (x2), save_task
- 3-step chain
- Verify both prices retrieved and task created

### Prompt 3 (Medium)
```
"Plan a trip to Tokyo: check the weather there, search for popular attractions, and create a task to book a flight"
```
- Tools needed: get_weather, search_web, save_task
- 3-step chain  
- Verify weather + attractions + task all created

---

## 📊 TESTING CHECKLIST

For EACH test prompt, verify:

- [ ] Message sent successfully
- [ ] Agent identifies need for tools
- [ ] First tool executes correctly
- [ ] Result is fed back to agent
- [ ] Agent calls next tool
- [ ] Chain continues without errors
- [ ] Final response is coherent
- [ ] All tool results are incorporated
- [ ] Task(s) saved with correct userId
- [ ] Completion time is reasonable (< 30 sec)

---

## 🔍 HOW TO TEST

### Method 1: Browser Chat
1. Open http://localhost:5173
2. Login
3. Copy a test prompt
4. Send message
5. Observe response and check MongoDB

### Method 2: Database Verification
```javascript
// Check tasks were saved correctly
db.tasks.find({ userId: "your_user_id" })

// Should show:
// - Task title matching conversation
// - userId field
// - createdAt timestamp
// - due_at if applicable
```

### Method 3: Console Logging
Check server logs for:
```
[TOOL EXECUTION] Running: get_crypto_price
[TOOL SUCCESS] get_crypto_price completed
[TOOL EXECUTION] Running: save_task
[TOOL SUCCESS] save_task completed
```

---

## ✅ SUCCESS CRITERIA

A test passes if:
- ✅ No 400/500 errors
- ✅ Multiple tools execute in sequence
- ✅ Results from tool 1 inform tool 2
- ✅ Database shows saved data
- ✅ Response is conversation-like (not JSON)
- ✅ User context (userId) is preserved
- ✅ Frontend displays all information

---

## 📝 SAMPLE TEST OUTPUT

### Prompt
```
"What's Bitcoin's price and remind me to check it tomorrow?"
```

### Expected Console Output
```
[TOOL EXECUTION] Running: get_crypto_price
[TOOL SUCCESS] get_crypto_price completed
Result: { coin: "bitcoin", price: 42500, currency: "usd" }

[TOOL EXECUTION] Running: save_task  
[TOOL SUCCESS] save_task completed
Result: { success: true, task_id: "507f1f77bcf86cd799439011" }
```

### Expected Response
```
Bitcoin is currently trading at $42,500 USD. I've created a reminder 
for you to check the price tomorrow. The task has been saved and you'll 
see it in your task list.
```

### Database Verification
```javascript
db.tasks.findOne({ title: /Bitcoin|check.*price/i })
// Returns:
{
  _id: ObjectId("507f1f77bcf86cd799439011"),
  userId: ObjectId("..."),
  title: "Check Bitcoin price",
  description: "Bitcoin is at $42,500 USD",
  dueAt: ISODate("2026-03-03T09:00:00Z"),
  recurring: "none"
}
```

---

## 🚀 START TESTING

Begin with **QUICK TEST - Prompt 1** above, then progress to more complex chains.

All tests should pass with the bug fix applied! ✅
