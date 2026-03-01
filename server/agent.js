import Groq from "groq-sdk";
import { buildSystemPrompt } from "./prompts/systemPrompt.js";
import { AVAILABLE_TOOLS } from "./tools/definitions.js";
import { executeTool } from "./tools/executor.js";
import { formatFinalResponse } from "./utils/formatFinalResponse.js";
import { parseToolCall } from "./utils/parseToolCall.js";

const MAX_STEPS = 10;
const KNOWN_TOOL_NAMES = new Set(AVAILABLE_TOOLS.map((tool) => tool.function.name));
const DEFAULT_MODEL = "llama-3.3-70b-versatile";
let groqClient;

function containsToolPayloadHeuristic(content = "") {
  if (typeof content !== "string" || !content.trim()) return false;
  return (
    /"tool"\s*:/.test(content)
    || /"type"\s*:\s*"function"/.test(content)
    || /<function\s*=/.test(content)
  );
}

function claimsEmailSent(content = "") {
  if (typeof content !== "string" || !content.trim()) return false;
  return /(email|mail)[\s\S]{0,120}(sent|delivered)|\bhas been sent\b/i.test(content);
}

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

function getModelName() {
  return process.env.GROQ_MODEL || DEFAULT_MODEL;
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
  let sendEmailSucceeded = false;

  for (let step = 0; step < MAX_STEPS; step += 1) {
    const response = await groq.chat.completions.create({
      model: getModelName(),
      messages,
      temperature: 0,
    });

    const content = response.choices?.[0]?.message?.content?.trim() ?? "";
    const toolCall = parseToolCall(content);

    if (!toolCall) {
      if (containsToolPayloadHeuristic(content)) {
        messages.push({ role: "assistant", content });
        messages.push({
          role: "user",
          content:
            "Observation: You exposed a raw or malformed tool call. Never show tool JSON to users. If a tool is needed, output ONLY valid tool JSON; otherwise output only final user-facing text.",
        });
        continue;
      }

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
        // Not a direct JSON tool call.
      }

      if (claimsEmailSent(content) && !sendEmailSucceeded) {
        messages.push({ role: "assistant", content });
        messages.push({
          role: "user",
          content:
            "Observation: You claimed an email was sent, but send_email has not succeeded yet. If email is required, call send_email first and only then confirm delivery.",
        });
        continue;
      }

      return formatFinalResponse(content);
    }

    const toolResult = await executeTool({
      function: {
        name: toolCall.tool,
        arguments: JSON.stringify(toolCall.arguments),
      },
    }, context);

    if (toolCall.tool === "send_email") {
      sendEmailSucceeded = Boolean(toolResult?.success);
    }

    messages.push({ role: "assistant", content: JSON.stringify(toolCall) });
    messages.push({ role: "user", content: `Observation: ${JSON.stringify(toolResult)}` });
  }

  return formatFinalResponse("I could not complete this request within the step limit.");
}

export async function runAgentStream(incomingMessages = [], context = {}, handlers = {}) {
  const onToken = typeof handlers === "function" ? handlers : (handlers.onToken ?? (async () => {}));
  const groq = getGroqClient();
  const messages = ensureSystemMessage(incomingMessages);
  let sendEmailSucceeded = false;

  for (let step = 0; step < MAX_STEPS; step += 1) {
    const stream = await groq.chat.completions.create({
      model: getModelName(),
      messages,
      temperature: 0,
      stream: true,
    });

    let content = "";
    let tokenBuffer = [];
    let streamMode = "pending";

    for await (const chunk of stream) {
      const delta = chunk?.choices?.[0]?.delta?.content ?? "";
      if (!delta) continue;
      content += delta;
      tokenBuffer.push(delta);

      if (streamMode === "pending") {
        const trimmed = content.trimStart();
        if (!trimmed) continue;
        if (trimmed.startsWith("{") || trimmed.startsWith("```")) {
          streamMode = "tool";
        } else {
          streamMode = "text";
        }
      }
    }

    const finalContent = formatFinalResponse(content);
    const toolCall = parseToolCall(finalContent);

    if (toolCall) {
      const result = await executeTool({
        function: {
          name: toolCall.tool,
          arguments: JSON.stringify(toolCall.arguments),
        },
      }, context);

      if (toolCall.tool === "send_email") {
        sendEmailSucceeded = Boolean(result?.success);
      }

      messages.push({ role: "assistant", content: JSON.stringify(toolCall) });
      messages.push({ role: "user", content: `Observation: ${JSON.stringify(result)}` });
      continue;
    }

    if (containsToolPayloadHeuristic(finalContent)) {
      messages.push({ role: "assistant", content: finalContent });
      messages.push({
        role: "user",
        content:
          "Observation: You exposed a raw or malformed tool call. Never show tool JSON to users. If a tool is needed, output ONLY valid tool JSON; otherwise output only final user-facing text.",
      });
      continue;
    }

    if (streamMode === "text") {
      for (const bufferedToken of tokenBuffer) {
        await onToken(bufferedToken);
      }
    } else if (finalContent) {
      await onToken(finalContent);
    }

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
      // Not a direct JSON tool call.
    }

    if (claimsEmailSent(finalContent) && !sendEmailSucceeded) {
      messages.push({ role: "assistant", content: finalContent });
      messages.push({
        role: "user",
        content:
          "Observation: You claimed an email was sent, but send_email has not succeeded yet. If email is required, call send_email first and only then confirm delivery.",
      });
      continue;
    }

    return finalContent;
  }

  const fallback = formatFinalResponse("I could not complete this request within the step limit.");
  await onToken(fallback);
  return fallback;
}
