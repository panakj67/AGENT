import axios from "axios";
import nodemailer from "nodemailer";
import "dotenv/config";

function parseArguments(rawArgs) {
  if (!rawArgs) return {};
  if (typeof rawArgs === "object") return rawArgs;

  try {
    return JSON.parse(rawArgs);
  } catch {
    return {};
  }
}

async function searchWeb({ query }) {
  const response = await axios.post("https://api.tavily.com/search", {
    api_key: process.env.TAVILY_API_KEY,
    query,
    max_results: 5,
  });

  const results = Array.isArray(response.data?.results) ? response.data.results : [];
  return results.map((item) => `${item.title}: ${item.content}`).join("\n");
}

async function sendEmail({ to, subject, body }) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    text: body,
  });

  return { success: true, message: `Email sent to ${to}` };
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

const TOOL_HANDLERS = {
  search_web: searchWeb,
  send_email: sendEmail,
  get_weather: getWeather,
  read_gmail: readGmailInbox,
};

export async function executeTool(toolCall) {
  const name = toolCall?.function?.name;
  const params = parseArguments(toolCall?.function?.arguments);

  const handler = TOOL_HANDLERS[name];
  if (!handler) {
    return { error: `Unknown tool: ${name}` };
  }

  try {
    return await handler(params);
  } catch (error) {
    const status = error?.response?.status;
    const apiMessage = error?.response?.data?.message;
    const details = status
      ? `${error.message}${apiMessage ? ` - ${apiMessage}` : ""}`
      : error.message;

    return {
      error: `Tool execution failed for ${name}`,
      details,
      status,
    };
  }
}
