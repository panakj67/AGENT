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

function getLatestUserMessage(messages = []) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const msg = messages[index];
    if (msg?.role === "user" && typeof msg.content === "string" && msg.content.trim()) {
      return msg.content.trim();
    }
  }
  return "";
}

function inferRequiredToolsFromPrompt(prompt = "") {
  const text = String(prompt).toLowerCase();
  const required = new Set();

  const wantsWeather = /\b(weather|temperature|forecast|humidity|rain)\b/.test(text);
  if (wantsWeather) {
    required.add("get_weather");
  }

  const wantsSendEmail =
    /\b(send|draft|write|compose)\b[\s\S]{0,40}\b(email|mail)\b/.test(text)
    || /\b(email|mail)\s+to\b/.test(text);
  if (wantsSendEmail) {
    required.add("send_email");
  }

  const wantsReadEmail =
    /\b(gmail|inbox)\b/.test(text)
    || (/\b(email|emails|mail)\b/.test(text) && /\b(read|check|find|search|show|list)\b/.test(text))
    || /\bgmail\s+to\b/.test(text);
  if (wantsReadEmail) {
    required.add("read_gmail");
  }

  const wantsNews = /\b(news|article|latest|breaking)\b/.test(text);
  if (wantsNews) {
    required.add("get_news");
  }

  return [...required].filter((toolName) => KNOWN_TOOL_NAMES.has(toolName));
}

function getToolCallSignature(toolCall) {
  if (!toolCall || typeof toolCall.tool !== "string") return "";
  const args = toolCall.arguments && typeof toolCall.arguments === "object"
    ? toolCall.arguments
    : {};
  return `${toolCall.tool}:${JSON.stringify(args)}`;
}

function getAllowedToolsFromPrompt(prompt = "") {
  // ONE TOOL PER PURPOSE - strict exclusive logic
  const text = String(prompt).toLowerCase();
  const allowed = new Set();

  // Priority order: check specific intents and add ONLY the tool needed for each

  // WEATHER - exclusive
  if (/\b(weather|temperature|forecast|humidity|rain|wind|sunny|cloudy)\b/.test(text)) {
    return new Set(["get_weather"]);
  }

  // NEWS - exclusive (takes priority over general search)
  if (/\b(news|article|latest|breaking|headlines)\b/.test(text)) {
    return new Set(["get_news"]);
  }

  // READ EMAIL - exclusive
  if (/\b(read|check|view|show|list|fetch|see|what.*in)\b[\s\S]{0,50}\b(email|mail|inbox|gmail)\b|\b(email|mail|inbox|gmail)[\s\S]{0,50}\b(read|check|view|show|list|fetch)\b/i.test(text)) {
    return new Set(["read_gmail"]);
  }

  // SEND EMAIL - exclusive
  if (/\b(send|draft|write|compose|email)\b[\s\S]{0,60}\b(to|recipient)\b|\b(send|mail|write)\b[\s\S]{0,40}@/i.test(text)) {
    return new Set(["send_email"]);
  }

  // GENERAL SEARCH - only if no other purpose matched
  if (/\b(search|find|look|information|info|how|what|where|when|who)\b/.test(text)) {
    return new Set(["search_web"]);
  }

  // CRYPTO - exclusive
  if (/\b(crypto|bitcoin|ethereum|price|btc|eth)\b/.test(text)) {
    return new Set(["get_crypto_price"]);
  }

  // TASKS - exclusive
  if (/\b(task|todo|remember|save|create|add|note|reminder|list.*task)\b/.test(text)) {
    return new Set(["save_task", "get_tasks", "delete_task"]);
  }

  // WEB SCRAPING - exclusive
  if (/\b(scrape|website|web.*page|browse|visit|extract|content)\b/.test(text)) {
    return new Set(["scrape_website"]);
  }

  // SCREENSHOT - exclusive
  if (/\b(screenshot|screen.*capture|take.*snap|capture.*screen)\b/.test(text)) {
    return new Set(["take_screenshot"]);
  }

  // FORM FILLING - exclusive
  if (/\b(form|submit|fill.*form|enter.*data|input.*field)\b/.test(text)) {
    return new Set(["fill_form"]);
  }

  // Default: no tools allowed
  return allowed;
}

function isToolAllowed(toolName, allowedTools) {
  return allowedTools.has(toolName);
}

const getMissingRequiredTools = (requiredTools, executedTools) => {
  if (!Array.isArray(requiredTools) || requiredTools.length === 0) return [];
  return requiredTools.filter((toolName) => !executedTools.has(toolName));
};

function isUnauthorizedToolCall(toolName, allowedTools) {
  // Check if the tool being called wasn't in the original request
  return !isToolAllowed(toolName, allowedTools);
}

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

function claimsHasReadEmails(content = "") {
  if (typeof content !== "string" || !content.trim()) return false;
  return (
    /\b(inbox|emails?|gmail)\b[\s\S]{0,200}\b(from|subject|received|unread)\b/i.test(content)
    || /\b(here are|here is|found|showing).*\b(emails?|inbox|messages)\b/i.test(content)
    || /\(subject:|received at:|from:|unread:\)/i.test(content)
    || /\[.*?subject.*?\]/i.test(content)
  );
}

function claimsWeatherInfo(content = "") {
  if (typeof content !== "string" || !content.trim()) return false;
  return (
    /\b(temperature|weather|humidity|forecast|wind speed|pressure|celsius|fahrenheit|°[cf])\b[\s\S]{0,200}\b(bhopal|delhi|mumbai|bangalore|weather in|today's?|currently|right now)\b/i.test(content)
    || /\bthe weather[\s\S]{0,100}\b(is|shows|indicates)\b/i.test(content)
    || /\binformation about.*weather/i.test(content)
    || /\b(currently|right now)[\s\S]{0,80}(temperature|°c|°f|degrees)/i.test(content)
  );
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
  const executedTools = new Set();
  const repeatedToolCallCounts = new Map();
  const userPrompt = getLatestUserMessage(messages);
  const requiredTools = inferRequiredToolsFromPrompt(userPrompt);
  const allowedTools = getAllowedToolsFromPrompt(userPrompt);

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

      const missingRequiredTools = getMissingRequiredTools(requiredTools, executedTools);
      if (missingRequiredTools.length > 0) {
        messages.push({ role: "assistant", content });
        messages.push({
          role: "user",
          content: `Observation: The user's request requires these tool calls before finalizing: ${missingRequiredTools.join(", ")}. Call the next missing tool now using strict tool JSON only.`,
        });
        continue;
      }

      return formatFinalResponse(content);
    }

    // Check if the tool being called is authorized by the user's request
    if (isUnauthorizedToolCall(toolCall.tool, allowedTools)) {
      console.log(`\n[UNAUTHORIZED TOOL CALL] Step ${step + 1}: ${toolCall.tool} (not requested)`);
      messages.push({ role: "assistant", content: JSON.stringify(toolCall) });
      messages.push({
        role: "user",
        content: `Observation: You tried to call tool "${toolCall.tool}" which was not part of the user's request. Stick to the original task: ${userPrompt}. Only use these tools if needed: ${[...allowedTools].join(", ")}.`,
      });
      continue;
    }

    const toolCallSignature = getToolCallSignature(toolCall);
    const repetitionCount = (repeatedToolCallCounts.get(toolCallSignature) ?? 0) + 1;
    repeatedToolCallCounts.set(toolCallSignature, repetitionCount);
    if (repetitionCount > 1) {
      messages.push({ role: "assistant", content: JSON.stringify(toolCall) });
      messages.push({
        role: "user",
        content: `Observation: You repeated the same tool call (${toolCall.tool}) with identical arguments. Do not repeat tool calls. Use the existing observation result and provide the final answer now.`,
      });
      continue;
    }

    console.log(`\n[TOOL CALL] Step ${step + 1}: ${toolCall.tool}`);
    console.log(`  Arguments: ${JSON.stringify(toolCall.arguments, null, 2)}`);

    const toolResult = await executeTool({
      function: {
        name: toolCall.tool,
        arguments: JSON.stringify(toolCall.arguments),
      },
    }, context);

    console.log(`  Result: ${JSON.stringify(toolResult, null, 2)}\n`);

    if (toolCall.tool === "send_email") {
      sendEmailSucceeded = Boolean(toolResult?.success);
    }
    executedTools.add(toolCall.tool);

    messages.push({ role: "assistant", content: JSON.stringify(toolCall) });
    messages.push({ role: "user", content: `Observation: ${JSON.stringify(toolResult)}` });

    // Check if all required tools have been executed - if so, ask for final response
    const missingAfterExecution = getMissingRequiredTools(requiredTools, executedTools);
    if (missingAfterExecution.length === 0 && requiredTools.length > 0) {
      console.log(`\n[MISSION COMPLETE] All required tools executed. Requesting final response...`);
      messages.push({
        role: "user",
        content: "All requested information has been gathered. Provide a final response based on the results above. Do not call any more tools.",
      });
    }
  }

  return formatFinalResponse("I could not complete this request within the step limit.");
}

export async function runAgentStream(incomingMessages = [], context = {}, handlers = {}) {
  const onToken = typeof handlers === "function" ? handlers : (handlers.onToken ?? (async () => {}));
  const groq = getGroqClient();
  const messages = ensureSystemMessage(incomingMessages);
  let sendEmailSucceeded = false;
  const executedTools = new Set();
  const repeatedToolCallCounts = new Map();
  const userPrompt = getLatestUserMessage(messages);
  const requiredTools = inferRequiredToolsFromPrompt(userPrompt);
  const allowedTools = getAllowedToolsFromPrompt(userPrompt);

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
      // Check if the tool being called is authorized by the user's request
      if (isUnauthorizedToolCall(toolCall.tool, allowedTools)) {
        console.log(`\n[UNAUTHORIZED TOOL CALL] Step ${step + 1}: ${toolCall.tool} (not requested)`);
        messages.push({ role: "assistant", content: JSON.stringify(toolCall) });
        messages.push({
          role: "user",
          content: `Observation: You tried to call tool "${toolCall.tool}" which was not part of the user's request. Stick to the original task: ${userPrompt}. Only use these tools if needed: ${[...allowedTools].join(", ")}.`,
        });
        continue;
      }

      const toolCallSignature = getToolCallSignature(toolCall);
      const repetitionCount = (repeatedToolCallCounts.get(toolCallSignature) ?? 0) + 1;
      repeatedToolCallCounts.set(toolCallSignature, repetitionCount);
      if (repetitionCount > 1) {
        messages.push({ role: "assistant", content: JSON.stringify(toolCall) });
        messages.push({
          role: "user",
          content: `Observation: You repeated the same tool call (${toolCall.tool}) with identical arguments. Do not repeat tool calls. Use the existing observation result and provide the final answer now.`,
        });
        continue;
      }

      console.log(`\n[TOOL CALL] Step ${step + 1}: ${toolCall.tool}`);
      console.log(`  Arguments: ${JSON.stringify(toolCall.arguments, null, 2)}`);

      const result = await executeTool({
        function: {
          name: toolCall.tool,
          arguments: JSON.stringify(toolCall.arguments),
        },
      }, context);

      console.log(`  Result: ${JSON.stringify(result, null, 2)}\n`);

      if (toolCall.tool === "send_email") {
        sendEmailSucceeded = Boolean(result?.success);
      }
      executedTools.add(toolCall.tool);

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

    const missingRequiredTools = getMissingRequiredTools(requiredTools, executedTools);
    if (missingRequiredTools.length > 0) {
      messages.push({ role: "assistant", content: finalContent });
      messages.push({
        role: "user",
        content: `Observation: The user's request requires these tool calls before finalizing: ${missingRequiredTools.join(", ")}. Call the next missing tool now using strict tool JSON only.`,
      });
      continue;
    }

    return finalContent;
  }

  const fallback = formatFinalResponse("I could not complete this request within the step limit.");
  await onToken(fallback);
  return fallback;
}
