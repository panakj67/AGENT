export const AVAILABLE_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_web",
      description: "Search the web for current information",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_email",
      description: "Send an email",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string" },
          subject: { type: "string" },
          body: { type: "string" },
        },
        required: ["to", "subject", "body"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get live weather for a city",
      parameters: {
        type: "object",
        properties: {
          city: { type: "string" },
        },
        required: ["city"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_gmail",
      description: "Read Gmail inbox messages with optional filters. Use this for dynamic email queries.",
      parameters: {
        type: "object",
        properties: {
          folder: {
            type: "string",
            description: "Mailbox folder name, default INBOX",
          },
          since: {
            type: "string",
            description: "ISO date/time lower bound, e.g. 2026-02-27 or 2026-02-27T00:00:00Z",
          },
          before: {
            type: "string",
            description: "ISO date/time upper bound",
          },
          from: {
            type: "string",
            description: "Filter sender contains this text",
          },
          subject_contains: {
            type: "string",
            description: "Filter subject contains this text",
          },
          unread_only: {
            type: "boolean",
            description: "If true, only return unread emails",
          },
          include_promotions: {
            type: "boolean",
            description: "If false, promotional emails are excluded from returned list",
          },
          max_results: {
            type: "number",
            description: "Maximum emails to return after filtering (default 10, max 50)",
          },
        },
      },
    },
  },
];
