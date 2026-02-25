// agent/agent.js
import Groq from "groq-sdk";
import { AVAILABLE_TOOLS } from "./tools/definitions.js";
import { executeTool } from "./tools/executor.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export const runAgent = async (incomingMessages) => {
  const MAX_STEPS = 8;
  
  // Ensure we have an array and a system prompt
  let messages = Array.isArray(incomingMessages) ? incomingMessages : [];
  
  if (messages.length === 0 || messages[0].role !== "system") {
    messages.unshift({
      role: "system",
      content: `You are Aura. 
      RULES:
      1. Respond ONLY with ONE JSON object at a time: {"tool": "name", "arguments": {...}}
      2. Stop immediately after the JSON.
      3. Do not assume tool results. Wait for the 'Observation'.
      Available Tools: ${JSON.stringify(AVAILABLE_TOOLS)}`
    });
  }

  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature: 0,
      stop: ["}"] // THIS STOPS THE MODEL FROM CHAINING TOOLS ILLEGALLY
    });

    let content = response.choices[0].message.content.trim();
    if (content.startsWith('{') && !content.endsWith('}')) content += "}";

    const match = content.match(/\{[\s\S]*?\}/);
    if (!match) return content; // Final plain text answer

    try {
      const toolCall = JSON.parse(match[0]);
      console.log(`[Aura] Step ${step + 1}: Executing ${toolCall.tool}`);

      // Execute the tool
      const result = await executeTool({
        function: {
          name: toolCall.tool,
          arguments: JSON.stringify(toolCall.arguments)
        }
      });

      // Update history and CONTINUE the loop
      messages.push({ role: "assistant", content: JSON.stringify(toolCall) });
      messages.push({ role: "user", content: `Observation: ${JSON.stringify(result)}` });

    } catch (e) {
      return `Error in execution: ${e.message}`;
    }
  }
};