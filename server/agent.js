// agent/agent.js
import Groq from "groq-sdk";
import { AVAILABLE_TOOLS } from "./tools/definitions.js";
import { executeTool } from "./tools/executor.js";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

export const runAgent = async (messages) => {
  const MAX_STEPS = 5;

  // Ensure the system prompt is the VERY FIRST message and is hyper-strict
  if (messages[0].role !== "system") {
    messages.unshift({
      role: "system",
      content: `You are Aura. 
      STRICT RULE: To use a tool, you MUST respond with a valid JSON object ONLY.
      JSON Format: {"tool": "tool_name", "arguments": {"param": "value"}}
      DO NOT use <function> tags. DO NOT use markdown.
      Available Tools: ${JSON.stringify(AVAILABLE_TOOLS)}`
    });
  }

  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await groq.chat.completions.create({
      // Switching to 8b specifically to bypass the 70b native-format bug
      model: "llama-3.1-8b-instant", 
      messages,
      temperature: 0,
      // WE DO NOT PASS 'tools' HERE. This is the only way to stop the 400 error.
    });

    const content = response.choices[0].message.content.trim();
    
    // Regex to find the JSON object
    const match = content.match(/\{[\s\S]*?\}/);

    if (!match) {
      // If no JSON is found, the agent is giving you the final answer
      return content;
    }

    try {
      const toolCall = JSON.parse(match[0]);
      console.log(`[Aura] Step ${step + 1}: Executing ${toolCall.tool}`);

      const result = await executeTool({
        function: {
          name: toolCall.tool,
          arguments: JSON.stringify(toolCall.arguments)
        }
      });

      // Update the conversation history
      messages.push({ role: "assistant", content: content });
      messages.push({ role: "user", content: `Observation: ${JSON.stringify(result)}` });

    } catch (e) {
      console.error("Manual Parse Error:", e);
      return content;
    }
  }
};