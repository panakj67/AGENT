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
      description:
        "Read Gmail inbox messages with optional filters. Use this for dynamic email queries.",
      parameters: {
        type: "object",
        properties: {
          folder: {
            type: "string",
            description: "Mailbox folder name, default INBOX",
          },
          since: {
            type: "string",
            description:
              "ISO date/time lower bound, e.g. 2026-02-27 or 2026-02-27T00:00:00Z",
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
            description:
              "If false, promotional emails are excluded from returned list",
          },
          max_results: {
            type: "number",
            description:
              "Maximum emails to return after filtering (default 10, max 50)",
          },
        },
      },
    },
  },

  // tools/definitions.js — add this tool:
  {
    type: "function",
    function: {
      name: "read_email_body",
      description: "Read the full body of a specific email by UID",
      parameters: {
        type: "object",
        properties: {
          uid: {
            type: "number",
            description: "Email UID from read_gmail results",
          },
          folder: {
            type: "string",
            description: "Mailbox folder, default INBOX",
          },
        },
        required: ["uid"],
      },
    },
  },

  {
    type: "function",
    function: {
      name: "scrape_website",
      description:
        "Open a URL in browser and extract its text content. Use when you need to read a webpage that has no API.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "Full URL to open including https://",
          },
          extract_text: {
            type: "boolean",
            description:
              "If true returns plain text, false returns HTML. Default true.",
          },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "click_and_scrape",
      description:
        "Open a URL, click a specific element, then extract the resulting page content.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "Full URL to open" },
          selector: {
            type: "string",
            description: "CSS selector of element to click",
          },
          extract_text: {
            type: "boolean",
            description: "Return plain text if true",
          },
        },
        required: ["url", "selector"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fill_form",
      description:
        "Open a URL, fill in form fields using CSS selectors, then optionally submit.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "Full URL of the page with the form",
          },
          fields: {
            type: "object",
            description:
              "Key-value pairs of CSS selector to value e.g. {'#name': 'John'}",
          },
          submit_selector: {
            type: "string",
            description: "CSS selector of the submit button",
          },
        },
        required: ["url", "fields"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "take_screenshot",
      description: "Take a screenshot of a webpage and return it as base64.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "Full URL to screenshot" },
        },
        required: ["url"],
      },
    },
  },

  {
    type: "function",
    function: {
      name: "get_news",
      description: "Get latest news headlines on a topic",
      parameters: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            description: "Topic to search news for",
          },
          count: {
            type: "number",
            description: "Number of headlines to return. Default 5",
          },
        },
        required: ["topic"],
      },
    },
  },

  {
    type: "function",
    function: {
      name: "get_crypto_price",
      description: "Get current price of a cryptocurrency",
      parameters: {
        type: "object",
        properties: {
          coin: {
            type: "string",
            description: "Coin id e.g. bitcoin, ethereum, solana",
          },
          currency: {
            type: "string",
            description: "Currency code e.g. usd, inr. Default usd",
          },
        },
        required: ["coin"],
      },
    },
  },

  {
    type: "function",
    function: {
      name: "save_task",
      description:
        "Save a task or reminder for the user. Use this when user says remind me, set a reminder, alert me, follow up, or schedule something.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Short title of the task",
          },
          description: {
            type: "string",
            description: "More details about the task",
          },
          due_at: {
            type: "string",
            description:
              "ISO datetime when to remind e.g. 2026-03-01T09:00:00Z",
          },
          recurring: {
            type: "string",
            enum: ["none", "daily", "weekly", "monthly"],
            description: "How often to repeat. Default none",
          },
          recurring_time: {
            type: "string",
            description: "Time for recurring task e.g. 08:00 for 8am daily",
          },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_tasks",
      description: "Get user's saved tasks and reminders",
      parameters: {
        type: "object",
        properties: {
          include_completed: {
            type: "boolean",
            description: "Include completed tasks. Default false",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_task",
      description: "Delete or cancel a saved task or reminder",
      parameters: {
        type: "object",
        properties: {
          task_id: {
            type: "string",
            description: "Task ID to delete",
          },
        },
        required: ["task_id"],
      },
    },
  },
];
