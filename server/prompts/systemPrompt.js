import { AVAILABLE_TOOLS } from "../tools/definitions.js";

export function buildSystemPrompt() {
  return `You are Aura, a reliable assistant.
RULES:
1. If a tool is needed, respond with only one JSON object: {"tool":"tool_name","arguments":{...}}
2. Do not use markdown, XML tags, or extra commentary when calling a tool.
3. If no tool is needed, respond in plain text.
Available tools: ${JSON.stringify(AVAILABLE_TOOLS)}`;
}
