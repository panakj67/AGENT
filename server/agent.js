import Groq from "groq-sdk";
import { buildSystemPrompt } from "./prompts/systemPrompt.js";
import { AVAILABLE_TOOLS } from "./tools/definitions.js";
import { executeTool } from "./tools/executor.js";
import { formatFinalResponse } from "./utils/formatFinalResponse.js";
import { parseToolCall } from "./utils/parseToolCall.js";

const MAX_STEPS = 8;
const KNOWN_TOOL_NAMES = new Set(AVAILABLE_TOOLS.map((t) => t.function.name));
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

let groqClient;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGroqClient() {
  if (groqClient) return groqClient;
  if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY is not configured");
  groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return groqClient;
}

function getModelName() {
  return process.env.GROQ_MODEL || DEFAULT_MODEL;
}

function getLatestUserMessage(messages = []) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role === "user" && typeof m.content === "string" && m.content.trim()) {
      return m.content.trim();
    }
  }
  return "";
}

function ensureSystemMessage(messages) {
  const safe = Array.isArray(messages)
    ? messages
        .filter((m) => m && typeof m.role === "string")
        .map((m) => ({
          role: m.role,
          content: typeof m.content === "string" ? m.content : String(m.content ?? ""),
        }))
    : [];

  if (safe.length === 0 || safe[0].role !== "system") {
    safe.unshift({ role: "system", content: buildSystemPrompt() });
  }
  return safe;
}

function containsToolPayloadHeuristic(content = "") {
  if (typeof content !== "string" || !content.trim()) return false;
  return (
    /"tool"\s*:/.test(content) ||
    /"type"\s*:\s*"function"/.test(content) ||
    /<function\s*=/.test(content)
  );
}

function isLikelyToolCall(text = "") {
  const trimmed = text.trimStart();
  return trimmed.startsWith("{") || trimmed.startsWith("```");
}

// ─── Non-streaming agent ───────────────────────────────────────────────────────

export async function runAgent(incomingMessages = [], context = {}) {
  const groq = getGroqClient();
  const messages = ensureSystemMessage(incomingMessages);
  const executedTools = new Set();
  const seenSignatures = new Set();

  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await groq.chat.completions.create({
      model: getModelName(),
      messages,
      temperature: 0,
    });

    const raw = response.choices?.[0]?.message?.content?.trim() ?? "";
    const content = formatFinalResponse(raw);
    const toolCall = parseToolCall(content);

    // ── Tool call ──
    if (toolCall) {
      if (!KNOWN_TOOL_NAMES.has(toolCall.tool)) {
        messages.push({ role: "assistant", content });
        messages.push({
          role: "user",
          content: `Observation: Unknown tool "${toolCall.tool}". Available: ${[...KNOWN_TOOL_NAMES].join(", ")}. Provide a final answer now.`,
        });
        continue;
      }

      const sig = `${toolCall.tool}:${JSON.stringify(toolCall.arguments)}`;
      if (seenSignatures.has(sig)) {
        messages.push({ role: "assistant", content });
        messages.push({
          role: "user",
          content: `Observation: You already called ${toolCall.tool} with these arguments. Use the previous result and provide your final answer now.`,
        });
        continue;
      }

      if (executedTools.size >= 1) {
        // Already ran one tool — force final answer
        messages.push({ role: "assistant", content });
        messages.push({
          role: "user",
          content: `Observation: You have already used a tool this turn. Do NOT call another tool. Provide your final answer using the results above.`,
        });
        continue;
      }

      seenSignatures.add(sig);
      console.log(`\n[TOOL CALL] Step ${step + 1}: ${toolCall.tool}`);
      console.log(`  Args: ${JSON.stringify(toolCall.arguments, null, 2)}`);

      const result = await executeTool(
        { function: { name: toolCall.tool, arguments: JSON.stringify(toolCall.arguments) } },
        context
      );

      console.log(`  Result: ${JSON.stringify(result, null, 2)}\n`);
      executedTools.add(toolCall.tool);

      messages.push({ role: "assistant", content });
      messages.push({
        role: "user",
        content: `Observation: ${JSON.stringify(result)}\n\nProvide your final answer to the user now. Do NOT call any more tools.`,
      });
      continue;
    }

    // ── Leaked tool JSON in prose ──
    if (containsToolPayloadHeuristic(content)) {
      messages.push({ role: "assistant", content });
      messages.push({
        role: "user",
        content: `Observation: You exposed raw tool JSON. Never show tool calls to users. Provide a clean final answer.`,
      });
      continue;
    }

    // ── Final answer ──
    return content;
  }

  return formatFinalResponse("I could not complete this request within the step limit.");
}

// ─── Streaming agent ──────────────────────────────────────────────────────────

export async function runAgentStream(incomingMessages = [], context = {}, handlers = {}) {
  const onToken = typeof handlers === "function" ? handlers : (handlers.onToken ?? (async () => {}));
  const groq = getGroqClient();
  const messages = ensureSystemMessage(incomingMessages);
  const executedTools = new Set();
  const seenSignatures = new Set();

  for (let step = 0; step < MAX_STEPS; step++) {
    const stream = await groq.chat.completions.create({
      model: getModelName(),
      messages,
      temperature: 0,
      stream: true,
    });

    // ── Collect full streamed content ──
    let content = "";
    let firstChunkSeen = false;
    let isToolCall = null; // null = unknown, true = tool, false = text

    for await (const chunk of stream) {
      const delta = chunk?.choices?.[0]?.delta?.content ?? "";
      if (!delta) continue;

      content += delta;

      // Determine mode on first non-whitespace content
      if (!firstChunkSeen && content.trimStart().length > 0) {
        firstChunkSeen = true;
        isToolCall = isLikelyToolCall(content);
      }

      // Stream tokens to UI only if this is clearly a text response
      if (isToolCall === false) {
        await onToken(delta);
      }
    }

    const finalContent = formatFinalResponse(content);
    const toolCall = parseToolCall(finalContent);

    // ── Tool call path ──
    if (toolCall) {
      if (!KNOWN_TOOL_NAMES.has(toolCall.tool)) {
        messages.push({ role: "assistant", content: finalContent });
        messages.push({
          role: "user",
          content: `Observation: Unknown tool "${toolCall.tool}". Available: ${[...KNOWN_TOOL_NAMES].join(", ")}. Provide a final answer now.`,
        });
        continue;
      }

      const sig = `${toolCall.tool}:${JSON.stringify(toolCall.arguments)}`;
      if (seenSignatures.has(sig)) {
        messages.push({ role: "assistant", content: finalContent });
        messages.push({
          role: "user",
          content: `Observation: You already called ${toolCall.tool} with these arguments. Use the previous result and provide your final answer now.`,
        });
        continue;
      }

      if (executedTools.size >= 1) {
        messages.push({ role: "assistant", content: finalContent });
        messages.push({
          role: "user",
          content: `Observation: You have already used a tool this turn. Do NOT call another tool. Provide your final answer using the results above.`,
        });
        continue;
      }

      seenSignatures.add(sig);
      console.log(`\n[TOOL CALL] Step ${step + 1}: ${toolCall.tool}`);
      console.log(`  Args: ${JSON.stringify(toolCall.arguments, null, 2)}`);

      const result = await executeTool(
        { function: { name: toolCall.tool, arguments: JSON.stringify(toolCall.arguments) } },
        context
      );

      console.log(`  Result: ${JSON.stringify(result, null, 2)}\n`);
      executedTools.add(toolCall.tool);

      messages.push({ role: "assistant", content: finalContent });
      messages.push({
        role: "user",
        content: `Observation: ${JSON.stringify(result)}\n\nProvide your final answer to the user now. Do NOT call any more tools.`,
      });
      continue;
    }

    // ── Leaked tool JSON in prose ──
    if (containsToolPayloadHeuristic(finalContent)) {
      messages.push({ role: "assistant", content: finalContent });
      messages.push({
        role: "user",
        content: `Observation: You exposed raw tool JSON. Never show tool calls to users. Provide a clean final answer.`,
      });
      continue;
    }

    // ── Final answer ──
    // If we streamed tokens already (isToolCall === false), they're already sent.
    // If the first response was ambiguous and we didn't stream, send now.
    if (isToolCall !== false) {
      await onToken(finalContent);
    }

    return finalContent;
  }

  const fallback = formatFinalResponse("I could not complete this request within the step limit.");
  await onToken(fallback);
  return fallback;
}