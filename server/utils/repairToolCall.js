export function repairToolCall(message) {
  if (!message?.content) return null;

  const text = message.content;

  // Detect broken function format
  const match = text.match(/<function=(\w+)(\{[\s\S]*\})><\/function>/);

  if (!match) return null;

  const toolName = match[1];
  let args = {};

  try {
    args = JSON.parse(match[2]);
  } catch (e) {
    console.warn("JSON parse failed in repair:", e);
  }

  return {
    id: "repaired_call_" + Date.now(),
    type: "function",
    function: {
      name: toolName,
      arguments: JSON.stringify(args),
    },
  };
}