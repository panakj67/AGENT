import { buildSystemPrompt } from "./prompts/systemPrompt.js";
import { executeTool } from "./tools/executor.js";
import { formatFinalResponse } from "./utils/formatFinalResponse.js";
import { parseToolCall } from "./utils/parseToolCall.js";
import { AVAILABLE_TOOLS } from "./tools/definitions.js";

const MAX_STEPS = 10;
const TOOL_NAMES = AVAILABLE_TOOLS.map((tool) => tool.function?.name).filter(Boolean);

// OpenRouter Configuration
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "google/gemini-2.5-flash-lite-preview-09-2025";
const OPENROUTER_MAX_TOKENS = Number(process.env.OPENROUTER_MAX_TOKENS) || 1200;

function parseSearchWebResults(raw) {
  if (!raw) return [];
  const blocks = String(raw).split("\n\n---\n\n").map((b) => b.trim()).filter(Boolean);
  return blocks.map((block) => {
    const titleMatch = block.match(/^Title:\s*(.+)$/m);
    const urlMatch = block.match(/^URL:\s*(.+)$/m);
    const contentMatch = block.match(/Content:\s*([\s\S]+)$/m);
    return {
      title: titleMatch ? titleMatch[1].trim() : "Untitled",
      url: urlMatch ? urlMatch[1].trim() : "",
      content: contentMatch ? contentMatch[1].trim() : "",
    };
  });
}

function buildSearchWebFallback(raw, query) {
  const items = parseSearchWebResults(raw);
  if (!items.length) return null;

  const rows = items.map((item) => {
    const text = String(item.content || "").replace(/\s+/g, " ").trim();
    const detail = text.length > 240 ? `${text.slice(0, 237)}...` : text || "No summary available.";
    let source = "";
    try {
      source = item.url ? new URL(item.url).hostname : "";
    } catch {
      source = "";
    }
    const safeTitle = item.title.length > 80 ? `${item.title.slice(0, 77)}...` : item.title;
    return { title: safeTitle, source, detail, url: item.url };
  });

  const lines = [];
  if (query) {
    lines.push(`Here are the results for: ${query}`);
  }
  lines.push("Summary:");
  for (const row of rows) {
    lines.push(`- ${row.title}: ${row.detail}`);
  }
  lines.push("");
  lines.push("| Title | Source | Key detail |");
  lines.push("| --- | --- | --- |");
  for (const row of rows) {
    const titleCell = row.url ? `[${row.title}](${row.url})` : row.title;
    const sourceCell = row.source || "n/a";
    lines.push(`| ${titleCell} | ${sourceCell} | ${row.detail} |`);
  }

  return lines.join("\n");
}

function getOpenRouterHeaders() {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  return {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "HTTP-Referer": process.env.FRONTEND_URL || "http://localhost:5173",
    "X-Title": "Aura Agent",
    "Content-Type": "application/json",
  };
}

function ensureSystemMessage(messages) {
  const safeMessages = Array.isArray(messages) ? [...messages] : [];

  if (safeMessages.length === 0 || safeMessages[0].role !== "system") {
    safeMessages.unshift({
      role: "system",
      content: buildSystemPrompt(),
    });
  }

  return safeMessages;
}

export async function runAgent(incomingMessages = [], context = {}) {
  const messages = ensureSystemMessage(incomingMessages);
  console.log(`[AGENT START] Step limit: ${MAX_STEPS}, Context: userId=${context.userId}`);

  let lastToolCall = null;
  let toolCallRepeatCount = 0;
  let toolFormatErrorCount = 0;
  let sendEmailPlaceholderRetries = 0;
  let emptyResponseCount = 0;
  const lastToolResults = new Map();
  const lastUserMessage = [...messages].reverse().find((msg) => msg.role === "user");
  const userText = String(lastUserMessage?.content || "").toLowerCase();
  const isEmailTasksRequest =
    (userText.includes("email") || userText.includes("mail")) &&
    userText.includes("task");
  let taskEmailStage = isEmailTasksRequest ? "need_tasks" : "none";
  const isCryptoNewsEmailRequest =
    (userText.includes("email") || userText.includes("mail")) &&
    userText.includes("crypto") &&
    (userText.includes("news") || userText.includes("headline")) &&
    userText.includes("price");
  let cryptoEmailStage = isCryptoNewsEmailRequest ? "need_news" : "none";
  const isCryptoPerformanceRequest =
    (userText.includes("24h") || userText.includes("24 hours") || userText.includes("last 24")) &&
    (userText.includes("bitcoin") || userText.includes("btc")) &&
    (userText.includes("ethereum") || userText.includes("eth")) &&
    (userText.includes("solana") || userText.includes("sol")) &&
    (userText.includes("cardano") || userText.includes("ada"));
  let cryptoMarketsStage = isCryptoPerformanceRequest ? "need_markets" : "none";

  for (let step = 0; step < MAX_STEPS; step += 1) {
    console.log(`[AGENT STEP ${step}] Messages history length: ${messages.length}`);
    
    try {
      // Make API request to OpenRouter
      const requestBody = {
        model: OPENROUTER_MODEL,
        messages: messages,
        tools: AVAILABLE_TOOLS,
        tool_choice: "auto",
        temperature: 0,
        max_tokens: OPENROUTER_MAX_TOKENS,
      };

      console.log(`[AGENT REQUEST ${step}] Sending to OpenRouter with ${messages.length} messages and ${AVAILABLE_TOOLS.length} tools`);

      const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: getOpenRouterHeaders(),
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenRouter API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`OpenRouter API returned error: ${JSON.stringify(data.error)}`);
      }

      const content = data.choices?.[0]?.message?.content?.trim() ?? "";
      const messageData = data.choices?.[0]?.message ?? {};
      
      console.log(`[AGENT RESPONSE ${step}]`);
      if (content) console.log(`Content: ${content}`);
      if (messageData.tool_calls) console.log(`Tool calls: ${JSON.stringify(messageData.tool_calls, null, 2)}`);
      
      // Handle OpenRouter's native tool_calls format
      let toolCall = null;
      let nativeToolCalls = [];
      
      if (messageData.tool_calls && messageData.tool_calls.length > 0) {
        nativeToolCalls = messageData.tool_calls;
        console.log(`[AGENT TOOL CALLS] Found ${nativeToolCalls.length} native tool calls from OpenRouter`);
      } else if (content) {
        // Fall back to custom JSON parsing for backward compatibility
        toolCall = parseToolCall(content);
        console.log(`[AGENT TOOL PARSE ${step}] Custom JSON tool found: ${toolCall?.tool || "NONE"}`);
      } else {
        console.log(`[AGENT RESPONSE ${step}] Empty response, no tool calls or content`);
        emptyResponseCount += 1;
        const webResult = lastToolResults.get("search_web");
        if (webResult && typeof webResult === "string") {
          const fallback = buildSearchWebFallback(webResult, lastUserMessage?.content);
          if (fallback) {
            const formattedFallback = formatFinalResponse(fallback);
            console.log(`[AGENT FINAL] Empty model response; using search_web fallback`);
            return formattedFallback;
          }
        }
        if (emptyResponseCount >= 2) {
          console.log(`[AGENT FINAL] Empty model response repeated; returning safe fallback`);
          return formatFinalResponse("I could not produce a response from the model. Please try again.");
        }
        continue;
      }

      // Prevent infinite loops - if same tool called twice with same args, break
      const currentToolKey = toolCall 
        ? `${toolCall.tool}:${JSON.stringify(toolCall.arguments)}` 
        : (nativeToolCalls.length > 0 
            ? `${nativeToolCalls[0].function.name}:${nativeToolCalls[0].function.arguments}` 
            : null);
    if (currentToolKey === lastToolCall) {
      toolCallRepeatCount++;
      console.log(`[AGENT LOOP DETECTION] Same tool called ${toolCallRepeatCount} times, breaking loop`);
      if (toolCallRepeatCount >= 2) {
        console.log(`[AGENT FORCED BREAK] Infinite loop detected, returning text response`);
        return formatFinalResponse(content || "Could not complete this request.");
      }
    } else {
      toolCallRepeatCount = 0;
      lastToolCall = currentToolKey;
    }

    // Handle native OpenRouter tool calls
    if (nativeToolCalls.length > 0) {
      console.log(`[AGENT NATIVE TOOL CALLS] Processing ${nativeToolCalls.length} tool calls from OpenRouter`);
      
      // Add the assistant message with tool_calls to history
      const assistantMessage = {
        role: "assistant",
        content: content || null,
        tool_calls: nativeToolCalls.map(tc => ({
          id: tc.id,
          type: tc.type,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          }
        }))
      };
      messages.push(assistantMessage);

      // Process each tool call
      for (const toolCallObj of nativeToolCalls) {
        const functionName = toolCallObj.function.name;
        const functionArgs = (() => {
          try {
            return typeof toolCallObj.function.arguments === 'string' 
              ? JSON.parse(toolCallObj.function.arguments)
              : toolCallObj.function.arguments;
          } catch {
            console.error(`[AGENT PARSE ERROR] Failed to parse arguments for ${functionName}`);
            return {};
          }
        })();

        console.log(`[AGENT EXECUTING] Native Tool: ${functionName}`);
        console.log(`[TOOL ARGS]`, JSON.stringify(functionArgs, null, 2));

        const result = await executeTool({
          function: {
            name: functionName,
            arguments: JSON.stringify(functionArgs),
          },
        }, context);

        console.log(`[AGENT TOOL RESULT] Tool: ${functionName}`);
        console.log(`[RESULT DATA]`, JSON.stringify(result, null, 2));

        // Check if tool succeeded
        // String results (like search_web) are successful if they're non-empty
        // Object results check for specific success indicators
        const isSuccess = !result.error && (
          typeof result === 'string' ? result.length > 0 :
          result.success || result.count !== undefined || result.message || result.price !== undefined
        );

        if (isSuccess) {
          lastToolResults.set(functionName, result);
        }

        // Add tool result to message history
        // Handle both string results (from search_web) and object results
        const toolContent = typeof result === 'string' 
          ? result 
          : JSON.stringify(result);
        
        messages.push({
          role: "tool",
          tool_call_id: toolCallObj.id,
          name: functionName,
          content: toolContent,
        });
      }

      // Continue to next step for AI to process results
      continue;
    }

    if (!toolCall) {
      if (isCryptoPerformanceRequest && cryptoMarketsStage !== "done") {
        messages.push({ role: "assistant", content });
        messages.push({
          role: "system",
          content:
            "Crypto performance requested. You MUST call get_crypto_markets with coins [bitcoin, ethereum, solana, cardano] and currency usd. Do not provide a final response yet.",
        });
        continue;
      }

      const lower = content.toLowerCase();
      const looksLikeToolJson =
        /^\s*\{/.test(content) ||
        /"tool"\s*:/.test(content) ||
        /\btool\s*:\s*[a-z_]/i.test(content);
      const mentionsTool =
        looksLikeToolJson ||
        lower.includes("wait for the result") ||
        TOOL_NAMES.some((name) => lower.includes(name));

      if (mentionsTool && toolFormatErrorCount < 2) {
        toolFormatErrorCount += 1;
        console.log(`[AGENT TOOL FORMAT] Invalid tool call format. Retry ${toolFormatErrorCount}`);
        messages.push({ role: "assistant", content });
        messages.push({
          role: "system",
          content:
            "Tool call format error. You must respond ONLY with valid JSON: {\"tool\":\"tool_name\",\"arguments\":{...}}. Do not add any text.",
        });
        continue;
      }

      console.log(`[AGENT FINAL] No tool call - returning text response`);
      const finalResponse = formatFinalResponse(content);
      const webResult = lastToolResults.get("search_web");
      if (webResult && typeof webResult === "string") {
        const isTooShort = finalResponse.length < 160;
        const fallback = isTooShort ? buildSearchWebFallback(webResult, lastUserMessage?.content) : null;
        if (fallback) {
          const formattedFallback = formatFinalResponse(fallback);
          console.log(`[AGENT FINAL] Using search_web fallback response`);
          return formattedFallback;
        }
      }
      console.log(`[FINAL RESPONSE]`, finalResponse);
      return finalResponse;
    }

    if (toolCall.tool === "send_email") {
      const body = String(toolCall.arguments?.body || "");
      const hasPlaceholder =
        /\[insert/i.test(body) ||
        /<insert/i.test(body) ||
        /tbd/i.test(body) ||
        /to be added/i.test(body) ||
        /fill in/i.test(body) ||
        /\{[^}]*\}/i.test(body);

      if (hasPlaceholder && sendEmailPlaceholderRetries < 2) {
        sendEmailPlaceholderRetries += 1;
        const cryptoResult = lastToolResults.get("get_crypto_price");
        const newsResult = lastToolResults.get("get_news");
        const webResult = lastToolResults.get("search_web");
        const resultHints = [
          cryptoResult ? `get_crypto_price result: ${JSON.stringify(cryptoResult, null, 2)}` : null,
          newsResult ? `get_news result: ${JSON.stringify(newsResult, null, 2)}` : null,
          webResult ? `search_web result: ${JSON.stringify(webResult, null, 2)}` : null,
        ].filter(Boolean).join("\n");

        messages.push({ role: "assistant", content });
        messages.push({
          role: "system",
          content:
            `Email body contains placeholders. You MUST use actual tool results and remove placeholders. ${resultHints ? `Available data: ${resultHints}` : "Use the latest tool results."} Respond ONLY with a corrected send_email tool call JSON.`,
        });
        continue;
      }
    }

    if (isEmailTasksRequest) {
      if (taskEmailStage === "need_tasks" && toolCall.tool !== "get_tasks") {
        messages.push({ role: "assistant", content });
        messages.push({
          role: "system",
          content:
            "User asked to email pending tasks. You MUST call get_tasks with include_completed: false first. Do not call any other tool.",
        });
        continue;
      }
      if (taskEmailStage === "need_email" && toolCall.tool !== "send_email") {
        messages.push({ role: "assistant", content });
        messages.push({
          role: "system",
          content:
            "You already have the task list. Now you MUST call send_email to deliver the pending tasks. Do not call other tools.",
        });
        continue;
      }
      if (toolCall.tool === "get_tasks") {
        taskEmailStage = "need_email";
      }
      if (toolCall.tool === "send_email") {
        taskEmailStage = "done";
      }
    }

    if (isCryptoPerformanceRequest) {
      if (cryptoMarketsStage === "need_markets" && toolCall.tool !== "get_crypto_markets") {
        messages.push({ role: "assistant", content });
        messages.push({
          role: "system",
          content:
            "Crypto performance requested. Call get_crypto_markets once with coins [bitcoin, ethereum, solana, cardano] and currency usd. Do not call other tools.",
        });
        continue;
      }

      if (cryptoMarketsStage === "done") {
        messages.push({ role: "assistant", content });
        messages.push({
          role: "system",
          content:
            "You already have market data. Do not call any more tools. Provide the final response using the 24h change data.",
        });
        continue;
      }

      if (toolCall.tool === "get_crypto_markets") {
        const coins = Array.isArray(toolCall.arguments?.coins) ? toolCall.arguments.coins : [];
        const hasAll =
          coins.includes("bitcoin") &&
          coins.includes("ethereum") &&
          coins.includes("solana") &&
          coins.includes("cardano");
        if (!hasAll) {
          messages.push({ role: "assistant", content });
          messages.push({
            role: "system",
            content:
              "get_crypto_markets must include coins [bitcoin, ethereum, solana, cardano]. Respond ONLY with corrected get_crypto_markets tool call.",
          });
          continue;
        }
      }
    }

    if (isCryptoNewsEmailRequest) {
      const allowedByStage =
        (cryptoEmailStage === "need_news" && toolCall.tool === "get_news") ||
        (cryptoEmailStage === "need_price" && toolCall.tool === "get_crypto_price") ||
        (cryptoEmailStage === "need_email" && toolCall.tool === "send_email");

      if (!allowedByStage) {
        messages.push({ role: "assistant", content });
        messages.push({
          role: "system",
          content:
            "User asked for crypto news + price + email. You MUST call get_news first, then get_crypto_price, then send_email with both results. Do not call other tools.",
        });
        continue;
      }

      if (toolCall.tool === "get_news") {
        cryptoEmailStage = "need_price";
      }
      if (toolCall.tool === "get_crypto_price") {
        cryptoEmailStage = "need_email";
      }
      if (toolCall.tool === "send_email") {
        cryptoEmailStage = "done";
      }
    }

    console.log(`[AGENT EXECUTING] Tool: ${toolCall.tool}`);
    console.log(`[TOOL ARGS]`, JSON.stringify(toolCall.arguments, null, 2));
    
    const result = await executeTool({
      function: {
        name: toolCall.tool,
        arguments: JSON.stringify(toolCall.arguments),
      },
    }, context);

    console.log(`[AGENT TOOL RESULT] Tool: ${toolCall.tool}`);
    console.log(`[RESULT DATA]`, JSON.stringify(result, null, 2));

    // Check if tool succeeded
    // String results (like search_web) are successful if they're non-empty
    // Object results check for specific success indicators
    const isSuccess = !result.error && (
      typeof result === 'string' ? result.length > 0 :
      result.success || result.count !== undefined || result.message || result.price !== undefined
    );

    if (isSuccess) {
      lastToolResults.set(toolCall.tool, result);
    }

    if (isCryptoPerformanceRequest && toolCall.tool === "get_crypto_markets" && isSuccess) {
      cryptoMarketsStage = "done";

      const markets = Array.isArray(result?.markets) ? result.markets : [];
      const currency = String(result?.currency || "usd").toUpperCase();
      if (markets.length > 0) {
        const withChange = markets.filter(
          (m) => Number.isFinite(Number(m.price_change_percentage_24h))
        );
        const sorted = withChange.sort(
          (a, b) => Number(b.price_change_percentage_24h) - Number(a.price_change_percentage_24h)
        );
        const best = sorted[0];
        const worst = sorted[sorted.length - 1];
        const diff =
          best && worst
            ? Number(best.price_change_percentage_24h) - Number(worst.price_change_percentage_24h)
            : null;

        const lines = [
          "Current prices and 24h change:",
          ...markets.map((m) => {
            const price = Number(m.price);
            const change = Number(m.price_change_percentage_24h);
            const priceText = Number.isFinite(price) ? `${price}` : "n/a";
            const changeText = Number.isFinite(change) ? `${change.toFixed(2)}%` : "n/a";
            return `- ${m.name}: ${currency} ${priceText} (${changeText} 24h)`;
          }),
        ];

        if (best && worst && Number.isFinite(diff)) {
          lines.push(
            `Best 24h performer: ${best.name} (${Number(best.price_change_percentage_24h).toFixed(2)}%).`,
            `Worst 24h performer: ${worst.name} (${Number(worst.price_change_percentage_24h).toFixed(2)}%).`,
            `Difference between best and worst: ${diff.toFixed(2)} percentage points.`
          );
        } else {
          lines.push("Not enough 24h change data to compute best vs worst performer.");
        }

        const finalResponse = formatFinalResponse(lines.join("\n"));
        console.log(`[AGENT FINAL] Computed crypto performance response`);
        return finalResponse;
      }
    }
    
    // Save assistant action
    messages.push({ role: "assistant", content });

    // Save environment observation with explicit success/failure indication
    if (isSuccess) {
      const fullResult =
        typeof result === "object"
          ? JSON.stringify(result, null, 2)
          : String(result);
      
      // Build a clear summary with important numeric/data values highlighted
      let resultSummary = "";
      if (result.message) {
        resultSummary = result.message;
      } else if (result.price !== undefined) {
        resultSummary = `Price: ${result.price} ${result.currency || "USD"}`;
      } else if (result.count !== undefined) {
        resultSummary = `Found ${result.count} items`;
      } else if (result.temperature !== undefined) {
        resultSummary = `Temperature: ${result.temperature}°${result.temp_unit || "C"}`;
      } else {
        resultSummary = "Result attached.";
      }

      messages.push({
        role: "system",
        content: `Tool executed successfully. Summary: ${resultSummary}. Full result: ${fullResult}. If more tools are needed, call the next tool. Otherwise provide a final response to the user in plain text.`,
      });
    } else {
      messages.push({
        role: "system",
        content: `Tool execution error: ${result.error || result.details || "Unknown error"}. Please try a different approach.`,
      });
    }
    } catch (error) {
      console.error(`[AGENT ERROR] Step ${step}: ${error.message}`);
      messages.push({
        role: "system",
        content: `An error occurred: ${error.message}. Please try again.`,
      });
    }
  }

  console.log(`[AGENT DONE] Reached step limit of ${MAX_STEPS}`);
  return formatFinalResponse("I could not complete this request within the step limit.");
}
