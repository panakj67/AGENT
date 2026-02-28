import Groq from "groq-sdk";
import { buildSystemPrompt } from "./prompts/systemPrompt.js";
import { AVAILABLE_TOOLS } from "./tools/definitions.js";
import { executeTool } from "./tools/executor.js";
import { formatFinalResponse } from "./utils/formatFinalResponse.js";
import { parseToolCall } from "./utils/parseToolCall.js";

const MAX_STEPS = 10;
const KNOWN_TOOL_NAMES = new Set(AVAILABLE_TOOLS.map((tool) => tool.function.name));
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
  const safeMessages = Array.isArray(messages)
    ? messages
      .filter((message) => message && typeof message.role === "string")
      .map((message) => ({
        role: message.role,
        content: typeof message.content === "string" ? message.content : String(message.content ?? ""),
      }))
    : [];

  if (safeMessages.length === 0 || safeMessages[0].role !== "system") {
    safeMessages.unshift({
      role: "system",
      content: buildSystemPrompt(),
    });
  }

  return safeMessages;
}

export async function runAgent(incomingMessages = [], context = {}) {
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
      // Recover when the model tries to call a non-existent tool (e.g. install_dependency).
      try {
        const parsed = JSON.parse(content);
        const requestedTool = typeof parsed?.tool === "string" ? parsed.tool.trim() : "";
        if (requestedTool && !KNOWN_TOOL_NAMES.has(requestedTool)) {
          messages.push({ role: "assistant", content });
          messages.push({
            role: "user",
            content: `Observation: Unknown tool "${requestedTool}". Use only these tools: ${[...KNOWN_TOOL_NAMES].join(", ")}.`,
          });
          continue;
        }
      } catch {
        // Not a direct JSON tool call, proceed as normal response.
      }
      return formatFinalResponse(content);
    }

    const result = await executeTool({
      function: {
        name: toolCall.tool,
        arguments: JSON.stringify(toolCall.arguments),
      },
    }, context);   // ← pass context here

    messages.push({ role: "assistant", content: JSON.stringify(toolCall) });
    messages.push({ role: "user", content: `Observation: ${JSON.stringify(result)}` });
  }

  return formatFinalResponse("I could not complete this request within the step limit.");
}

export async function runAgentStream(incomingMessages = [], context = {}, onToken = async () => {}) {
  const groq = getGroqClient();
  const messages = ensureSystemMessage(incomingMessages);

  for (let step = 0; step < MAX_STEPS; step += 1) {
    const stream = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature: 0,
      stream: true,
    });

    let content = "";
    let streamMode = "pending";

    for await (const chunk of stream) {
      const delta = chunk?.choices?.[0]?.delta?.content ?? "";
      if (!delta) continue;

      content += delta;

      if (streamMode === "pending") {
        const trimmedStart = content.trimStart();
        if (!trimmedStart) continue;

        // Hold potential JSON/markdown tool-call wrappers until we can parse safely.
        if (trimmedStart.startsWith("{") || trimmedStart.startsWith("```")) {
          streamMode = "hold";
          continue;
        }

        streamMode = "emit";
        await onToken(content);
        continue;
      }

      if (streamMode === "emit") {
        await onToken(delta);
      }
    }

    const finalContent = formatFinalResponse(content);
    const toolCall = parseToolCall(finalContent);

    if (!toolCall) {
      try {
        const parsed = JSON.parse(finalContent);
        const requestedTool = typeof parsed?.tool === "string" ? parsed.tool.trim() : "";
        if (requestedTool && !KNOWN_TOOL_NAMES.has(requestedTool)) {
          messages.push({ role: "assistant", content: finalContent });
          messages.push({
            role: "user",
            content: `Observation: Unknown tool "${requestedTool}". Use only these tools: ${[...KNOWN_TOOL_NAMES].join(", ")}.`,
          });
          continue;
        }
      } catch {
        // Not a direct JSON tool call, proceed as final response.
      }

      if (streamMode !== "emit" && finalContent) {
        await onToken(finalContent);
      }

      return finalContent;
    }

    const result = await executeTool({
      function: {
        name: toolCall.tool,
        arguments: JSON.stringify(toolCall.arguments),
      },
    }, context);

    messages.push({ role: "assistant", content: JSON.stringify(toolCall) });
    messages.push({ role: "user", content: `Observation: ${JSON.stringify(result)}` });
  }

  const fallback = formatFinalResponse("I could not complete this request within the step limit.");
  await onToken(fallback);
  return fallback;
}
