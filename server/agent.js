import Groq from "groq-sdk";
import { buildSystemPrompt } from "./prompts/systemPrompt.js";
import { parseToolCall } from "./utils/parseToolCall.js";
import { executeTool } from "./tools/executor.js";

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

export async function runAgent(incomingMessages = []) {
  const groq = getGroqClient();
  const messages = ensureSystemMessage(incomingMessages);

  for (let step = 0; step < MAX_STEPS; step += 1) {
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature: 0,
    });

    const content = response.choices?.[0]?.message?.content?.trim() ?? "";
    const toolCall = parseToolCall(content);

    if (!toolCall) {
      return content;
    }

    const result = await executeTool({
      function: {
        name: toolCall.tool,
        arguments: JSON.stringify(toolCall.arguments),
      },
    });

    messages.push({ role: "assistant", content: JSON.stringify(toolCall) });
    messages.push({ role: "user", content: `Observation: ${JSON.stringify(result)}` });
  }

  return "I could not complete this request within the step limit.";
}
