import axios from "axios";
import "dotenv/config";
import { createTransport } from "../utils/mailer.js";

import { 
  scrapeWebsite, 
  clickAndScrape, 
  fillAndSubmitForm, 
  takeScreenshot 
} from "./browser.js"

import { Task } from "../models/task.model.js"
import { parseIST, formatIST, parseRelativeIST } from "../utils/timezone.js"

function parseArguments(rawArgs) {
  if (!rawArgs) return {};
  if (typeof rawArgs === "object") return rawArgs;

  try {
    return JSON.parse(rawArgs);
  } catch {
    return {};
  }
}

// REPLACE normalizeEmailBody in server/tools/executor.js with this:

function normalizeEmailBody(rawBody) {
  if (!rawBody) return "";

  // Model writes \n as literal \\n inside JSON — decode them first
  const decoded = String(rawBody).replace(/\\n/g, "\n").replace(/\\t/g, "\t");

  // Normalize line endings
  const text = decoded.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Trim trailing whitespace per line, preserve blank lines (paragraph breaks)
  const lines = text.split("\n").map((l) => l.trimEnd());

  // Collapse 3+ blank lines into 2
  const out = [];
  let blanks = 0;
  for (const line of lines) {
    if (line === "") {
      if (++blanks <= 2) out.push("");
    } else {
      blanks = 0;
      out.push(line);
    }
  }

  // Strip leading/trailing blank lines
  while (out.length && out[0] === "") out.shift();
  while (out.length && out[out.length - 1] === "") out.pop();

  return out.join("\n");
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function blockToHtml(lines) {
  if (lines.length === 0) return "";
  const trimmed = lines.map((l) => l.trim());
  const isList = trimmed.every((l) => l.startsWith("- "));
  const isTable =
    trimmed.some((l) => /\|/.test(l)) &&
    trimmed.some((l) => /^\|?\s*:?-{3,}/.test(l));

  if (isTable) {
    return `<pre>${escapeHtml(lines.join("\n"))}</pre>`;
  }

  if (isList) {
    const items = trimmed.map((l) => `<li>${escapeHtml(l.slice(2))}</li>`).join("");
    return `<ul>${items}</ul>`;
  }

  const html = escapeHtml(lines.join("\n")).replace(/\n/g, "<br />");
  return `<p>${html}</p>`;
}

function toEmailHtml(normalizedBody) {
  const lines = normalizedBody.split("\n");
  const blocks = [];
  let current = [];

  for (const line of lines) {
    if (line.trim() === "") {
      if (current.length) {
        blocks.push(current);
        current = [];
      }
    } else {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current);

  const body = blocks.map(blockToHtml).filter(Boolean).join("");
  return `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5;">${body}</div>`;
}

async function searchWeb({ query }) {
  const response = await axios.post("https://api.tavily.com/search", {
    api_key: process.env.TAVILY_API_KEY,
    query,
    max_results: 5,
    include_answer: true,
  });

  const results = Array.isArray(response.data?.results) ? response.data.results : [];
  
  // Return full search results without truncation
  return results
    .map((item) => {
      // Keep content as-is, minimal cleaning
      let content = item.content || "";
      
      // Only remove markdown link syntax but keep content
      content = content.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
      
      return `Title: ${item.title}
URL: ${item.url}
Content:\n${content}`;
    })
    .filter((item) => item.length > 10)
    .join("\n\n---\n\n");
}

// In server/tools/executor.js
// REPLACE the sendEmail function's validation block (lines ~55-70) with this:

async function sendEmail({ to, subject, body }) {
  const normalizedBody = normalizeEmailBody(body).trim();

  // Block truly empty or unfilled template placeholders like {{name}}, {variable}, or [YOUR MESSAGE]
  const hasTemplatePlaceholder =
    /\{\{[\s\S]*?\}\}/.test(normalizedBody) ||  // {{...}}
    /\{[a-z][a-z0-9_\s]+\}/i.test(normalizedBody) ||  // {variable} or {bitcoin price} style
    /\[YOUR[^\]]*\]/i.test(normalizedBody) ||  // [YOUR...]
    /\b(news|price|details|summary)\s+will\s+be\s+added\s+here\b/i.test(normalizedBody) ||
    /\bwill\s+be\s+added\s+here\b/i.test(normalizedBody) ||
    /\bplaceholder\b/i.test(normalizedBody) ||
    /\[insert/i.test(normalizedBody) ||
    /<insert/i.test(normalizedBody);
  const isEffectivelyEmpty = !normalizedBody || normalizedBody.length < 5;
  // Block bodies that are ONLY ellipses with zero real words
  const isEllipsisOnly =
    normalizedBody.includes("...") &&
    !normalizedBody.includes("\n") &&
    normalizedBody.replace(/\./g, "").trim().length < 10;

  if (isEffectivelyEmpty || hasTemplatePlaceholder || isEllipsisOnly) {
    throw new Error(
      "Email body is empty or contains unfilled placeholders. Provide the actual message content.",
    );
  }

  const { transporter, missing } = createTransport();
  if (!transporter) {
    throw new Error(`Email transport not configured. Missing: ${missing.join(", ") || "SMTP_HOST/SMTP_USER/SMTP_PASS"}.`);
  }

  await transporter.verify();

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER || process.env.EMAIL_USER,
    to,
    subject: subject || "(no subject)",
    text: normalizedBody,
    html: toEmailHtml(normalizedBody),
  });

  const accepted = Array.isArray(info.accepted) ? info.accepted : [];
  const rejected = Array.isArray(info.rejected) ? info.rejected : [];

  if (accepted.length === 0 || rejected.length > 0) {
    throw new Error(`Email was not accepted by SMTP server. Accepted: ${accepted.length}, Rejected: ${rejected.length}.`);
  }

  return {
    success: true,
    message: `Email sent to ${to}`,
    messageId: info.messageId,
    accepted,
    rejected,
  };
}

async function getWeather({ city }) {
  const apiKey = process.env.WEATHER_API_KEY || process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    throw new Error("Weather API key is missing. Set WEATHER_API_KEY or OPENWEATHER_API_KEY.");
  }

  const response = await axios.get("https://api.openweathermap.org/data/2.5/weather", {
    params: {
      q: city,
      appid: apiKey,
      units: "metric",
    },
  });

  const temp = response.data?.main?.temp;
  const description = response.data?.weather?.[0]?.description;
  return `Weather in ${city}: ${temp}°C, ${description}`;
}

function isPromotionalEmail({ from, subject }) {
  const text = `${from || ""} ${subject || ""}`.toLowerCase();
  const promotionalSignals = [
    "sale",
    "offer",
    "discount",
    "deal",
    "promo",
    "newsletter",
    "marketing",
    "unsubscribe",
    "no-reply",
    "noreply",
  ];
  return promotionalSignals.some((signal) => text.includes(signal));
}

function parseDateOrNull(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

async function readGmailInbox({
  folder = "INBOX",
  since,
  before,
  from,
  subject_contains,
  unread_only = false,
  include_promotions = true,
  max_results,
} = {}) {
  const user = process.env.EMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS;
  const host = process.env.IMAP_HOST || "imap.gmail.com";
  const port = Number(process.env.IMAP_PORT || 993);
  const secure = String(process.env.IMAP_SECURE || "true").toLowerCase() !== "false";
  const maxResults = Number.isFinite(Number(max_results)) ? Math.max(1, Math.min(50, Number(max_results))) : 10;
  const sinceDate = parseDateOrNull(since);
  const beforeDate = parseDateOrNull(before);

  if (!user || !pass) {
    throw new Error("Email credentials missing. Set EMAIL_USER/EMAIL_PASS (or SMTP_USER/SMTP_PASS).");
  }

  let ImapFlow;
  try {
    ({ ImapFlow } = await import("imapflow"));
  } catch {
    throw new Error("Email reader is not available on this server because the IMAP module is missing.");
  }

  const client = new ImapFlow({
    host,
    port,
    secure,
    auth: { user, pass },
    logger: false,
  });

  const emails = [];
  try {
    await client.connect();
    await client.mailboxOpen(folder || "INBOX");

    const searchQuery = {};
    if (sinceDate) searchQuery.since = sinceDate;
    if (beforeDate) searchQuery.before = beforeDate;
    if (from) searchQuery.from = String(from);
    if (subject_contains) searchQuery.subject = String(subject_contains);
    if (unread_only) searchQuery.unseen = true;

    let uids = [];
    try {
      uids = await client.search(Object.keys(searchQuery).length > 0 ? searchQuery : { all: true });
    } catch {
      uids = await client.search({ all: true });
    }

    if (!Array.isArray(uids) || uids.length === 0) {
      return {
        totalMatched: 0,
        returned: [],
        promotionalCount: 0,
        includedPromotions: Boolean(include_promotions),
        appliedFilters: { folder, since: since || null, before: before || null, from: from || null, subject_contains: subject_contains || null, unread_only: Boolean(unread_only) },
      };
    }

    const sortedUids = [...uids].sort((a, b) => b - a);
    for await (const msg of client.fetch(sortedUids, {
      envelope: true,
      internalDate: true,
      flags: true,
    })) {
      const fromObj = msg.envelope?.from?.[0];
      const fromAddress = fromObj?.address || null;
      const fromName = fromObj?.name || fromObj?.address || "Unknown sender";
      const subject = msg.envelope?.subject || "(no subject)";
      const receivedAt = msg.internalDate || null;
      const isUnread = !Array.from(msg.flags || []).includes("\\Seen");

      emails.push({
        uid: msg.uid,
        from: fromName,
        fromAddress,
        subject,
        receivedAt,
        unread: isUnread,
      });
    }
  } finally {
    try {
      await client.logout();
    } catch {
      // Ignore logout errors.
    }
  }

  const filtered = emails.filter((email) => {
    const received = parseDateOrNull(email.receivedAt);
    if (sinceDate && received && received < sinceDate) return false;
    if (beforeDate && received && received >= beforeDate) return false;
    if (from && !String(email.from || "").toLowerCase().includes(String(from).toLowerCase())) return false;
    if (subject_contains && !String(email.subject || "").toLowerCase().includes(String(subject_contains).toLowerCase())) return false;
    if (unread_only && !email.unread) return false;
    return true;
  });

  const promotional = filtered.filter((email) => isPromotionalEmail(email));
  const nonPromotional = filtered.filter((email) => !isPromotionalEmail(email));
  const outputPool = include_promotions ? filtered : nonPromotional;
  const sortedOutputPool = [...outputPool].sort((a, b) => {
    const aTime = parseDateOrNull(a.receivedAt)?.getTime() || 0;
    const bTime = parseDateOrNull(b.receivedAt)?.getTime() || 0;
    return bTime - aTime;
  });

  return {
    totalMatched: filtered.length,
    returned: sortedOutputPool.slice(0, maxResults),
    promotionalCount: promotional.length,
    includedPromotions: Boolean(include_promotions),
    appliedFilters: {
      folder: folder || "INBOX",
      since: since || null,
      before: before || null,
      from: from || null,
      subject_contains: subject_contains || null,
      unread_only: Boolean(unread_only),
    },
  };
}

// tools/executor.js — add handler:
async function readEmailBody({ uid, folder = "INBOX" }) {
  const client = new ImapFlow({
    host: process.env.IMAP_HOST || "imap.gmail.com",
    port: 993,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  })

  await client.connect()
  await client.mailboxOpen(folder)

  let body = ""
  for await (const msg of client.fetch([uid], { bodyParts: ["TEXT"] })) {
    body = msg.bodyParts?.get("TEXT")?.toString() || ""
  }

  await client.logout()
  return { uid, body: body } // return full body without truncation
}

async function getNews({ topic, count = 5 }) {
  const apiKey = process.env.NEWS_API_KEY;
  
  if (!apiKey) {
    throw new Error(
      "News API key is missing. Get a free key from https://newsapi.org and set NEWS_API_KEY in .env"
    );
  }

  // Use "latest" as default if topic is empty
  const searchQuery = String(topic || "latest").trim();
  
  if (!searchQuery) {
    throw new Error("Topic is required for news search. Please specify what news you're looking for.");
  }

  try {
    const response = await axios.get(
      "https://newsapi.org/v2/everything",
      {
        params: {
          q: searchQuery,
          pageSize: Math.min(count || 5, 100),
          language: "en",
          sortBy: "publishedAt",
          apiKey: apiKey,
        },
        timeout: 5000, // 5 second timeout
      }
    );

    const articles = response.data?.articles || [];
    if (articles.length === 0) {
      return [];
    }

    return articles.slice(0, Math.max(1, Math.min(count || 5, 100))).map((a) => ({
      title: a.title,
      source: a.source?.name,
      publishedAt: a.publishedAt,
      url: a.url,
      description: a.description,
    }));
  } catch (error) {
    if (error.response?.status === 401) {
      throw new Error("News API key is invalid. Update NEWS_API_KEY in .env with a valid key from https://newsapi.org");
    } else if (error.response?.status === 429) {
      throw new Error("News API rate limit exceeded. Please try again later.");
    } else if (error.code === "ECONNABORTED") {
      throw new Error("News API request timeout. The service is slow, please try again.");
    }
    throw error;
  }
}

async function getCryptoPrice({ coin, currency = "usd" }) {
  const response = await axios.get(
    `https://api.coingecko.com/api/v3/simple/price`,
    { params: { ids: coin, vs_currencies: currency } }
  )
  const price = response.data?.[coin]?.[currency]
  if (!price) return { error: `Could not find price for ${coin}` }
  const currencySymbol = currency.toUpperCase() === "USD" ? "$" : currency.toUpperCase();
  return { 
    coin, 
    currency, 
    price,
    message: `The current price of ${coin} is ${currencySymbol}${price}`
  }
}

async function getCryptoMarkets({ coins, currency = "usd" }) {
  const ids = Array.isArray(coins) ? coins.filter(Boolean).join(",") : "";
  if (!ids) {
    return { error: "Coins list is required" };
  }

  const response = await axios.get(
    "https://api.coingecko.com/api/v3/coins/markets",
    {
      params: {
        vs_currency: currency,
        ids,
        order: "market_cap_desc",
        per_page: Math.min(250, Math.max(1, coins.length)),
        page: 1,
        sparkline: false,
        price_change_percentage: "24h",
      },
    }
  );

  const data = Array.isArray(response.data) ? response.data : [];
  if (data.length === 0) {
    return { error: "No market data returned for requested coins" };
  }

  return {
    currency,
    markets: data.map((item) => ({
      id: item.id,
      symbol: item.symbol,
      name: item.name,
      price: item.current_price,
      price_change_24h: item.price_change_24h,
      price_change_percentage_24h: item.price_change_percentage_24h,
      last_updated: item.last_updated,
    })),
  };
}

async function saveTask({ title, description, due_at, recurring = "none", recurring_time = null }, userId, userEmail) {
  // Handle IST date parsing
  let dueAtIST = null;
  if (due_at) {
    // Try parsing as relative time first (e.g., "tomorrow at 10am")
    dueAtIST = parseRelativeIST(due_at);
    // If not relative, parse as ISO string
    if (!dueAtIST) {
      dueAtIST = parseIST(due_at);
    }
  }

  const task = await Task.create({
    userId,
    userEmail,
    title,
    description: description || "",
    dueAt: dueAtIST,
    recurring,
    recurringTime: recurring_time
  })

  return { 
    success: true, 
    task_id: task._id,
    message: `Task saved: "${title}"${dueAtIST ? ` — reminder at ${formatIST(dueAtIST)}` : ""}`
  }
}

async function getTasks({ include_completed = false }, userId) {
  const query = { userId }
  if (!include_completed) query.completed = false

  const tasks = await Task.find(query).sort({ dueAt: 1 })

  if (tasks.length === 0) {
    return { message: "No tasks found", tasks: [] }
  }

  return {
    count: tasks.length,
    tasks: tasks.map(t => ({
      id: t._id,
      title: t.title,
      description: t.description,
      dueAt: t.dueAt,
      dueAtIST: formatIST(t.dueAt),
      recurring: t.recurring,
      completed: t.completed
    }))
  }
}

async function deleteTask({ task_id }, userId) {
  const task = await Task.findOneAndDelete({ 
    _id: task_id, 
    userId 
  })

  if (!task) {
    return { success: false, message: "Task not found" }
  }

  return { success: true, message: `Deleted: "${task.title}"` }
}

const TOOL_HANDLERS = {
  search_web: searchWeb,
  send_email: sendEmail,
  get_weather: getWeather,
  read_gmail: readGmailInbox,
  read_email_body: readEmailBody,
  scrape_website: scrapeWebsite,       
  click_and_scrape: clickAndScrape,    
  fill_form: fillAndSubmitForm,        
  take_screenshot: takeScreenshot,
  get_news: getNews,
  get_crypto_price: getCryptoPrice,
  get_crypto_markets: getCryptoMarkets,
  save_task: (params, context) => saveTask(params, context?.userId, context?.userEmail),
  get_tasks: (params, context) => getTasks(params, context?.userId),
  delete_task: (params, context) => deleteTask(params, context?.userId),     
};



export async function executeTool(toolCall, context = {}) {
  const name = toolCall?.function?.name
  const params = parseArguments(toolCall?.function?.arguments)

  const handler = TOOL_HANDLERS[name]
  if (!handler) {
    console.error(`[TOOL ERROR] Unknown tool: ${name}`);
    return { error: `Unknown tool: ${name}` }
  }

  try {
    console.log(`[TOOL EXECUTION] Running: ${name}`);
    const result = await handler(params, context);
    console.log(`[TOOL SUCCESS] ${name} completed`);
    return result;
  } catch (error) {
    console.error(`[TOOL EXECUTION ERROR] ${name}: ${error.message}`);
    return {
      error: `Tool execution failed for ${name}`,
      details: error.message
    }
  }
}
