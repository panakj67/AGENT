import Groq from "groq-sdk";
import { buildSystemPrompt } from "./prompts/systemPrompt.js";
import { executeTool } from "./tools/executor.js";
import { formatFinalResponse } from "./utils/formatFinalResponse.js";
import { parseToolCall } from "./utils/parseToolCall.js";

const MAX_STEPS = 6;
let groqClient;

function getGroqClient() {
  if (groqClient) return groqClient;

  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  groqClient = new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });

  return groqClient;
}

function ensureSystemMessage(messages) {
  const safeMessages = Array.isArray(messages) ? [...messages] : [];

  if (safeMessages.length === 0 || safeMessages[0].role !== "system") {
    safeMessages.unshift({
      role: "system",
      content: buildSystemPrompt(),
    });
  }

  return safeMessages;
}

function sanitizeMessagesForGroq(messages) {
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
}

export async function runAgent(incomingMessages = [], context = {}) {
  const groq = getGroqClient();
  const messages = ensureSystemMessage(incomingMessages);
  console.log(`[AGENT START] Step limit: ${MAX_STEPS}, Context: userId=${context.userId}`);

  let lastToolCall = null;
  let toolCallRepeatCount = 0;

  for (let step = 0; step < MAX_STEPS; step += 1) {
    console.log(`[AGENT STEP ${step}] Messages history length: ${messages.length}`);
    
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: sanitizeMessagesForGroq(messages),
      temperature: 0,
    });

    const content = response.choices?.[0]?.message?.content?.trim() ?? "";
    console.log(`[AGENT RESPONSE ${step}] Length: ${content.length}, Content preview: ${content.substring(0, 150)}`);
    
    if (!content) continue;

    const toolCall = parseToolCall(content);
    console.log(`[AGENT TOOL PARSE ${step}] Tool found: ${toolCall?.tool || "NONE"}`);

    // Prevent infinite loops - if same tool called twice with same args, break
    const currentToolKey = toolCall ? `${toolCall.tool}:${JSON.stringify(toolCall.arguments)}` : null;
    if (currentToolKey === lastToolCall) {
      toolCallRepeatCount++;
      console.log(`[AGENT LOOP DETECTION] Same tool called ${toolCallRepeatCount} times, breaking loop`);
      if (toolCallRepeatCount >= 2) {
        console.log(`[AGENT FORCED BREAK] Infinite loop detected, returning text response`);
        return formatFinalResponse(content);
      }
    } else {
      toolCallRepeatCount = 0;
      lastToolCall = currentToolKey;
    }

    if (!toolCall) {
      console.log(`[AGENT FINAL] No tool call - returning text response`);
      const finalResponse = formatFinalResponse(content);
      console.log(`[AGENT RESPONSE CLEANED] Final length: ${finalResponse.length}, Preview: ${finalResponse.substring(0, 150)}`);
      return finalResponse;
    }

    console.log(`[AGENT EXECUTING] Tool: ${toolCall.tool}, Args: ${JSON.stringify(toolCall.arguments)}`);
    
    const result = await executeTool({
      function: {
        name: toolCall.tool,
        arguments: JSON.stringify(toolCall.arguments),
      },
    }, context);

    console.log(`[AGENT TOOL RESULT] Tool: ${toolCall.tool}, Result preview: ${JSON.stringify(result).substring(0, 150)}`);

    // Check if tool succeeded
    const isSuccess = !result.error && (result.success || result.count !== undefined || result.message);
    
    // Save assistant action
    messages.push({ role: "assistant", content });

    // Save environment observation with explicit success/failure indication
    if (isSuccess) {
      const resultSummary = typeof result === 'object' 
        ? (result.message || (result.count !== undefined ? `Found ${result.count} items` : JSON.stringify(result).substring(0, 200)))
        : String(result);
      
      messages.push({
        role: "system",
        content: `Tool executed successfully. Result: ${resultSummary}. You have completed this task. Now provide a final response to the user in plain text.`,
      });
    } else {
      messages.push({
        role: "system",
        content: `Tool execution error: ${result.error || result.details || "Unknown error"}. Please try a different approach.`,
      });
    }
  }

  console.log(`[AGENT DONE] Reached step limit of ${MAX_STEPS}`);
  return formatFinalResponse("I could not complete this request within the step limit.");
}
