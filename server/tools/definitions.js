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
];
