import { runAgent } from "../agent.js";
import { Conversation } from "../models/conversation.model.js";

const inMemoryConversations = new Map();

function normalizeMessages(body) {
  const payload = body ?? {};

  if (Array.isArray(payload.messages)) {
    return payload;
  }

  if (typeof payload.prompt === "string" && payload.prompt.trim()) {
    return {
      conversationId: payload.conversationId,
      messages: [{ role: "user", content: payload.prompt.trim() }],
    };
  }

  if (typeof payload.message === "string" && payload.message.trim()) {
    return {
      conversationId: payload.conversationId,
      messages: [{ role: "user", content: payload.message.trim() }],
    };
  }

  return null;
}

function normalizeTitle(messages) {
  const firstUser = messages.find((m) => m.role === "user" && typeof m.content === "string");
  if (!firstUser) return "New conversation";
  return firstUser.content.slice(0, 60) || "New conversation";
}

function toPublicConversation(doc) {
  return {
    id: String(doc._id ?? doc.id),
    title: doc.title,
    messages: doc.messages,
    updatedAt: doc.updatedAt ?? new Date(),
    createdAt: doc.createdAt ?? new Date(),
  };
}

function getInMemoryConversation(id) {
  if (!id) return null;
  return inMemoryConversations.get(id) ?? null;
}

async function getConversationById(id) {
  if (!id) return null;

  if (Conversation.db?.readyState === 1) {
    return Conversation.findById(id);
  }

  return getInMemoryConversation(id);
}

function getConversationMessages(conversation) {
  if (!conversation || !Array.isArray(conversation.messages)) {
    return [];
  }

  return conversation.messages
    .filter((message) => message && typeof message.role === "string" && typeof message.content === "string")
    .map((message) => ({ role: message.role, content: message.content }));
}

async function saveConversation(conversationId, userMessage, assistantMessage) {
  if (Conversation.db?.readyState === 1) {
    const current = conversationId ? await Conversation.findById(conversationId) : null;

    if (!current) {
      const created = await Conversation.create({
        title: normalizeTitle([userMessage]),
        messages: [userMessage, assistantMessage],
      });
      return toPublicConversation(created);
    }

    current.messages.push(userMessage, assistantMessage);
    if (current.title === "New conversation") {
      current.title = normalizeTitle(current.messages);
    }
    await current.save();
    return toPublicConversation(current);
  }

  const id = conversationId && inMemoryConversations.has(conversationId)
    ? conversationId
    : `mem_${Date.now()}`;

  const existing = inMemoryConversations.get(id) ?? {
    id,
    title: normalizeTitle([userMessage]),
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  existing.messages.push(userMessage, assistantMessage);
  if (existing.title === "New conversation") {
    existing.title = normalizeTitle(existing.messages);
  }
  existing.updatedAt = new Date();
  inMemoryConversations.set(id, existing);
  return existing;
}

function fallbackReplyForMissingProvider() {
  return "### Answer\n- AI provider is not configured on the server yet.\n- Please set `GROQ_API_KEY` to enable live assistant responses.";
}

export async function chat(req, res) {
  try {
    const normalized = normalizeMessages(req.body);

    if (!normalized) {
      return res.status(400).json({
        error: "Request body must include either 'messages' (array) or 'prompt' (string)",
      });
    }

    const incomingMessages = normalized.messages;
    const userMessage = incomingMessages[incomingMessages.length - 1];
    if (!userMessage || userMessage.role !== "user") {
      return res.status(400).json({ error: "Last message must be a user message" });
    }

    const existingConversation = await getConversationById(normalized.conversationId);
    const historyMessages = getConversationMessages(existingConversation);

    const latestUserMessage = { role: "user", content: String(userMessage.content) };
    const agentMessages = historyMessages.length > 0
      ? [...historyMessages, latestUserMessage]
      : incomingMessages;

    let reply;
    try {
      reply = await runAgent(agentMessages);
    } catch (error) {
      if (error.message === "GROQ_API_KEY is not configured") {
        reply = fallbackReplyForMissingProvider();
      } else {
        throw error;
      }
    }

    const assistantMessage = { role: "assistant", content: reply };
    const conversation = await saveConversation(normalized.conversationId, latestUserMessage, assistantMessage);

    return res.json({
      reply,
      conversationId: conversation.id,
      conversation,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to process chat request",
      details: error.message,
    });
  }
}

export async function listConversations(_req, res) {
  try {
    if (Conversation.db?.readyState === 1) {
      const conversations = await Conversation.find().sort({ updatedAt: -1 }).limit(50);
      return res.json(conversations.map(toPublicConversation));
    }

    const conversations = [...inMemoryConversations.values()].sort((a, b) => b.updatedAt - a.updatedAt);
    return res.json(conversations);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch conversations", details: error.message });
  }
}

export async function getConversation(req, res) {
  try {
    const { id } = req.params;

    if (Conversation.db?.readyState === 1) {
      const conversation = await Conversation.findById(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      return res.json(toPublicConversation(conversation));
    }

    const conversation = inMemoryConversations.get(id);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    return res.json(conversation);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch conversation", details: error.message });
  }
}
