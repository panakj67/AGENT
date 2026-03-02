export function formatFinalResponse(rawContent) {
  if (!rawContent) return "No response";
  
  let text = String(rawContent)
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .trim();

  // Remove any raw JSON objects that might have been included
  // Pattern: {anything with multiple fields that looks like a database object}
  text = text.replace(/\{\s*"(?:_?id|userId|userEmail|dueAt|createdAt|updatedAt|__v|completed|notified)"/g, (match) => {
    // Only remove if it looks like a database object with multiple fields
    return '';
  });

  // Clean up any remaining malformed JSON fragments
  text = text.replace(/\{\s*\n\s*(?:id|userId|userEmail|dueAt|createdAt)\s*\n/g, '');
  
  // Remove MongoDB object ID patterns if they appear standalone
  text = text.replace(/\b[a-f0-9]{24}\b(?=\s*\n|$)/gm, '').trim();

  // Clean up excessive whitespace and newlines
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  return text || "No response";
}