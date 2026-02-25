export function parseToolCall(content) {
  if (!content || typeof content !== "string") {
    return null;
  }

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (typeof parsed?.tool !== "string") {
      return null;
    }

    return {
      tool: parsed.tool,
      arguments: parsed.arguments && typeof parsed.arguments === "object" ? parsed.arguments : {},
    };
  } catch {
    return null;
  }
}
