import { AVAILABLE_TOOLS } from "../tools/definitions.js";

const KNOWN_TOOL_NAMES = new Set(AVAILABLE_TOOLS.map((tool) => tool.function.name));

function normalizeToolCall(candidate) {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const tool = typeof candidate.tool === "string" ? candidate.tool.trim() : "";
  if (!tool || !KNOWN_TOOL_NAMES.has(tool)) {
    return null;
  }

  const args = candidate.arguments;
  const argumentsObject = args && typeof args === "object" && !Array.isArray(args) ? args : {};

  return { tool, arguments: argumentsObject };
}

function findBalancedJsonObjects(text) {
  const blocks = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      if (depth === 0) {
        start = index;
      }
      depth += 1;
      continue;
    }

    if (char === "}") {
      if (depth === 0) {
        continue;
      }

      depth -= 1;
      if (depth === 0 && start !== -1) {
        blocks.push(text.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return blocks;
}

function parseFunctionTag(content) {
  const match = content.match(/<function\s*=\s*([a-zA-Z0-9_]+)\s*>([\s\S]*?)<\/function>/i);
  if (!match) {
    return null;
  }

  const tool = match[1];
  const jsonBlocks = findBalancedJsonObjects(match[2]);
  const args = jsonBlocks.length > 0 ? JSON.parse(jsonBlocks[0]) : {};
  return normalizeToolCall({ tool, arguments: args });
}

export function parseToolCall(content) {
  if (typeof content !== "string" || content.trim().length === 0) {
    return null;
  }

  const trimmed = content.trim();

  try {
    const direct = JSON.parse(trimmed);
    const normalizedDirect = normalizeToolCall(direct);
    if (normalizedDirect) {
      return normalizedDirect;
    }
  } catch {
    // Ignore and continue to tolerant parsing strategies.
  }

  try {
    const repairedFunctionTag = parseFunctionTag(trimmed);
    if (repairedFunctionTag) {
      return repairedFunctionTag;
    }
  } catch {
    // Ignore malformed function tags.
  }

  const jsonBlocks = findBalancedJsonObjects(trimmed);
  for (const jsonBlock of jsonBlocks) {
    try {
      const parsed = JSON.parse(jsonBlock);
      const normalized = normalizeToolCall(parsed);
      if (normalized) {
        return normalized;
      }
    } catch {
      // Keep trying other JSON blocks found in the message.
    }
  }

  return null;
}
