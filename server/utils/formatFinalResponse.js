function decodeEscapedNewlines(text) {
  return text.replace(/\\n/g, "\n").replace(/\\t/g, "\t");
}

function splitIntoPoints(text) {
  const normalized = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");

  if (!normalized) {
    return [];
  }

  const sentenceCandidates = normalized
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (sentenceCandidates.length > 1) {
    return sentenceCandidates;
  }

  return normalized
    .split("\n")
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter(Boolean);
}

export function formatFinalResponse(rawContent) {
  const cleaned = decodeEscapedNewlines(String(rawContent ?? "")).trim();

  if (!cleaned) {
    return "### Answer\n- I do not have a response yet.";
  }

  const points = splitIntoPoints(cleaned);
  if (points.length === 0) {
    return "### Answer\n- I do not have a response yet.";
  }

  const markdownList = points.map((point) => `- ${point}`).join("\n");
  return `### Answer\n${markdownList}`;
}
