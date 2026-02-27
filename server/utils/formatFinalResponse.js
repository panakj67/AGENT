export function formatFinalResponse(rawContent) {
  if (!rawContent) return "No response";
  return String(rawContent)
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .trim();
}