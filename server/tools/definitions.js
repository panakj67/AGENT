// tools/definitions.js
export const AVAILABLE_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_web",
      description: "Search the internet for current information",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "send_email",
      description: "Send an email to someone",
      parameters: {
        type: "object",
        properties: {
          to:      { type: "string" },
          subject: { type: "string" },
          body:    { type: "string" }
        },
        required: ["to", "subject", "body"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "read_emails",
      description: "Read recent emails from inbox",
      parameters: {
        type: "object",
        properties: {
          count: { type: "number", description: "How many emails to fetch" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get real weather for a city",
      parameters: {
        type: "object",
        properties: {
          city: { type: "string" }
        },
        required: ["city"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "save_to_database",
      description: "Save a task or note for the user",
      parameters: {
        type: "object",
        properties: {
          type:    { type: "string", enum: ["task", "note", "reminder"] },
          content: { type: "string" },
          due_date:{ type: "string" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "execute_code",
      description: "Run JavaScript code and return the result",
      parameters: {
        type: "object",
        properties: {
          code: { type: "string" }
        },
        required: ["code"]
      }
    }
  }
]