# 🚀 QUICK COPY-PASTE TEST PROMPTS

## Test Level 1: Single Tool (Baseline)
Copy and paste these to test a single tool first:

### Test 1.1
```
What is the price of Bitcoin?
```
**Expected:** Crypto price only, no task created

### Test 1.2
```
Remind me to call my mom tomorrow at 3pm
```
**Expected:** Task saved, confirmation message

### Test 1.3
```
What's the weather in New York?
```
**Expected:** Current weather info (needs WEATHER_API_KEY)

---

## Test Level 2: Task Chaining - 2 Steps
These require the agent to call 2 different tools:

### Test 2.1 ✅ (START HERE)
```
Check the price of Bitcoin and remind me to review it tomorrow at 10am
```
**Tools Used:** get_crypto_price → save_task  
**Expected Time:** 5-10 seconds  
**Success:** Bitcoin price shown + task appears in database

### Test 2.2
```
What's the current price of Ethereum? Save it as a task to review later
```
**Tools Used:** get_crypto_price → save_task  
**Expected Time:** 5-10 seconds

### Test 2.3
```
Tell me the weather in London and remind me to pack an umbrella if it rains
```
**Tools Used:** get_weather → save_task  
**Expected Time:** 8-12 seconds  
**Note:** Requires WEATHER_API_KEY

### Test 2.4
```
Remind me to check Bitcoin and Ethereum prices tomorrow at noon
```
**Tools Used:** save_task  
**How to make it 2 steps:** Ask agent to "first get their current prices then save reminder"

---

## Test Level 3: Task Chaining - 3+ Steps
More complex chains:

### Test 3.1 ⭐ (BEST TEXT)
```
Search for the latest AI news, save the top article title as a task to read, then show me all my tasks
```
**Tools Used:** search_web → save_task → get_tasks  
**Expected Time:** 12-20 seconds  
**Success Indicators:**
- [ ] Search executed
- [ ] Article title mentioned in response
- [ ] Task created with article info
- [ ] Task list shown at end
- [ ] All 3 steps visible in server logs

### Test 3.2
```
Get the weather in Tokyo, search for things to do there, and save it as a travel planning task
```
**Tools Used:** get_weather → search_web → save_task  
**Expected Time:** 15-25 seconds

### Test 3.3
```
Check Bitcoin price, get Ethereum price, compare them, and save a task to monitor both daily
```
**Tools Used:** get_crypto_price (x2) → save_task  
**Expected Time:** 10-15 seconds

### Test 3.4
```
Create three reminders for me: morning exercise, lunch break, and evening review. Then list all my tasks
```
**Tools Used:** save_task (x3) → get_tasks  
**Expected Time:** 15-20 seconds  
**Success:** 3 tasks created + complete list shown

---

## Test Level 4: Complex Chaining (4+ Steps)

### Test 4.1
```
Search for Python tutorials, search for JavaScript tutorials, then create tasks for both to study next week
```
**Tools Used:** search_web → search_web → save_task → save_task  
**Expected Time:** 20-30 seconds

### Test 4.2
```
Get Bitcoin and Ethereum prices, search for crypto news, save the prices as a reminder, and show all my financial tasks
```
**Tools Used:** get_crypto_price (x2) → search_web → save_task → get_tasks  
**Expected Time:** 25-35 seconds

---

## Test Level 5: Edge Cases (Testing Error Handling)

### Test 5.1 (Missing API Key)
```
What's the weather in Paris and the news about it?
```
**Expected Behavior:**
- If WEATHER_API_KEY missing: Clear error message (not 500)
- If NEWS_API_KEY missing: Clear error message
- Agent should handle gracefully

### Test 5.2 (Long Content)
```
Search for a comprehensive guide on machine learning, get the full article, and save the entire content as a task
```
**Expected:** Content sanitized and saved (truncated if needed)

---

## ⚡ INSTANT VERIFICATION

### The Fastest Test (< 5 seconds)
```
What's the price of Solana?
```
- No chaining needed
- Tests basic tool execution
- Verifies message sanitization fix

### The Shortest Chain (5-10 seconds)
```
What's Bitcoin's price? Remind me to check it tomorrow.
```
- 2-step chain
- get_crypto_price → save_task
- Perfect for quick verification

### Verification Steps:
1. Send prompt
2. Wait for response
3. Check: ✅ Response mentions prices and confirms task
4. Check Database: `db.tasks.findOne()` shows new task
5. Check: ✅ Task has correct `userId` field

---

## 📊 EXPECTED RESULTS TABLE

| Test # | Prompt | Tools | Steps | Time | Status |
|--------|--------|-------|-------|------|--------|
| 2.1 | Bitcoin price + reminder | 2 | 2 | 5-10s | ✅ Start |
| 3.1 | AI news search + save | 3 | 3 | 12-20s | ⭐ Best |
| 3.4 | 3 reminders + list | 4 | 4 | 15-20s | Good |
| 4.2 | Crypto prices + news | 5 | 5 | 25-35s | Hard |

---

## 🎯 RECOMMENDED TEST SEQUENCE

### Order for Best Results:

**Phase 1: Baseline (5 min)**
```
Test 1.1: Bitcoin price       ← Verify basic tool
Test 1.2: Create reminder     ← Verify task saving
```

**Phase 2: 2-Step Chain (10 min)**
```
Test 2.1: Price + Task        ← Verify chaining ✅ START HERE
Test 2.2: Ethereum + Task
```

**Phase 3: 3-Step Chain (15 min)**
```
Test 3.1: News + Article + Task  ← Most reliable 3-step
Test 3.4: Multiple tasks
```

**Phase 4: Advanced (20 min)**
```
Test 4.1: Double search + tasks
Test 4.2: Price comparison + news
```

**Phase 5: Error Handling (5 min)**
```
Test 5.1: Missing API key response
Test 5.2: Large content handling
```

---

## ✅ PASS CRITERIA FOR EACH TEST

### All Tests Must Have:
- [ ] No 400/500 errors
- [ ] Response completes in < 30 seconds
- [ ] Response is human-readable (not JSON)
- [ ] Tools executed in correct order
- [ ] Database saved expected data
- [ ] User context (userId) preserved

### All Chaining Tests Must Show:
- [ ] Step 1 tool executed
- [ ] Result fed back to LLM
- [ ] Step 2 tool executed
- [ ] Results combined in response

---

## 🔍 HOW TO VERIFY RESULTS

### In Browser Chat:
```
✅ See the AI response
✅ No error messages
✅ Multiple pieces of info mentioned
```

### In MongoDB:
```javascript
// After test 2.1, should exist:
db.tasks.find()
// Shows new task with:
{
  title: "...",
  userId: "...",
  dueAt: ISODate(...),
  createdAt: ISODate(...)
}
```

### In Server Console:
```
[TOOL EXECUTION] Running: get_crypto_price
[TOOL SUCCESS] get_crypto_price completed
[TOOL EXECUTION] Running: save_task
[TOOL SUCCESS] save_task completed
```

---

## 💡 TROUBLESHOOTING

| Problem | Check |
|---------|-------|
| 400 Error | Run Test 1.1 first (did bug fix work?) |
| Only 1 tool executes | Agent might not chain (MAX_STEPS=6?) |
| Task not saved | Check userId in DB |
| Slow response | External API timeout (weather/news) |
| Missing info | Agent didn't synthesize results |

---

## 🚀 START NOW!

**Copy this and try it in your chat:**
```
Check the price of Bitcoin and remind me to review it tomorrow at 10am
```

**Expected response (3-5 sentences mentioning):**
- Bitcoin's current price
- Confirmation task was created
- When you'll be reminded

**Duration:** 5-10 seconds

✅ If this works, task chaining is working! 🎉

---

**Happy Testing!** 🧪
