import { runAgent } from "../agent.js";
import { Conversation } from "../models/conversation.model.js";
import mongoose from "mongoose";

const inMemoryConversations = new Map();
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;
const ALLOWED_MESSAGE_ROLES = new Set(["system", "user", "assistant"]);

function normalizeMessages(body) {
  const payload = body ?? {};

  if (Array.isArray(payload.messages)) return payload;

  if (typeof payload.prompt === "string" && payload.prompt.trim()) {
    return { conversationId: payload.conversationId, messages: [{ role: "user", content: payload.prompt.trim() }] };
  }

  if (typeof payload.message === "string" && payload.message.trim()) {
    return { conversationId: payload.conversationId, messages: [{ role: "user", content: payload.message.trim() }] };
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

function toPublicConversationSummary(doc) {
  return {
    id: String(doc._id ?? doc.id),
    title: doc.title,
    updatedAt: doc.updatedAt ?? new Date(),
    createdAt: doc.createdAt ?? new Date(),
  };
}

function parseListLimit(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIST_LIMIT;
  return Math.min(parsed, MAX_LIST_LIMIT);
}

function parseBeforeDate(value) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function isMongoReady() {
  return Conversation.db?.readyState === 1;
}

function isValidObjectId(id) {
  return typeof id === "string" && mongoose.isValidObjectId(id);
}

function getInMemoryConversation(userId, id) {
  if (!id) return null;
  const conversation = inMemoryConversations.get(id) ?? null;
  if (!conversation || conversation.userId !== userId) return null;
  return conversation;
}

function sanitizeHistoryMessages(messages) {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter((message) => message && ALLOWED_MESSAGE_ROLES.has(message.role))
    .map((message) => ({
      role: message.role,
      content: typeof message.content === "string" ? message.content : String(message.content ?? ""),
    }))
    .filter((message) => message.content.trim().length > 0);
}

export function buildAgentMessages(historyMessages, latestUserMessage) {
  const history = sanitizeHistoryMessages(historyMessages);

  if (!latestUserMessage || latestUserMessage.role !== "user") {
    return history;
  }

  return [
    ...history,
    {
      role: "user",
      content: typeof latestUserMessage.content === "string"
        ? latestUserMessage.content
        : String(latestUserMessage.content ?? ""),
    },
  ];
}

async function loadConversationHistoryMessages(userId, conversationId) {
  if (!conversationId) return [];

  if (isMongoReady() && isValidObjectId(conversationId)) {
    const conversation = await Conversation.findOne(
      { _id: conversationId, userId },
      { messages: 1 }
    ).lean();
    return sanitizeHistoryMessages(conversation?.messages ?? []);
  }

  const inMemoryConversation = getInMemoryConversation(userId, conversationId);
  return sanitizeHistoryMessages(inMemoryConversation?.messages ?? []);
}

async function saveConversation(userId, conversationId, userMessage, assistantMessage) {
  if (isMongoReady()) {
    const now = new Date();
    const messagesToAppend = [userMessage, assistantMessage];

    if (conversationId && isValidObjectId(conversationId)) {
      const updated = await Conversation.findOneAndUpdate(
        { _id: conversationId, userId },
        { $push: { messages: { $each: messagesToAppend } }, $set: { updatedAt: now } },
        { returnDocument: "after", lean: true }
      );

      if (updated) {
        if (updated.title === "New conversation") {
          const nextTitle = normalizeTitle(updated.messages);
          if (nextTitle !== "New conversation") {
            await Conversation.updateOne(
              { _id: updated._id, userId, title: "New conversation" },
              { $set: { title: nextTitle } }
            );
            updated.title = nextTitle;
          }
        }
        return toPublicConversation(updated);
      }
    }

    const created = await Conversation.create({
      userId,
      title: normalizeTitle([userMessage]),
      messages: messagesToAppend,
    });
    return toPublicConversation(created.toObject());
  }

  const id = conversationId && inMemoryConversations.has(conversationId)
    ? conversationId
    : `mem_${Date.now()}`;

  const existing = inMemoryConversations.get(id) ?? {
    id,
    userId,
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
  return "AI provider is not configured on the server yet. Please set `GROQ_API_KEY` to enable live assistant responses.";
}

// ─── Chat handler ─────────────────────────────────────────────────────────────

export async function chat(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

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

    const messageTime = new Date();
    const latestUserMessage = {
      role: "user",
      content: String(userMessage.content),
      createdAt: messageTime,
    };

    let reply;
    try {
      const historyMessages = await loadConversationHistoryMessages(userId, normalized.conversationId);
      const agentMessages = buildAgentMessages(historyMessages, latestUserMessage);

      reply = await runAgent(agentMessages, {
        userId,
        userEmail: req.user?.email,
      });
    } catch (error) {
      if (error.message === "GROQ_API_KEY is not configured") {
        reply = fallbackReplyForMissingProvider();
      } else {
        throw error;
      }
    }

    const assistantMessage = {
      role: "assistant",
      content: reply,
      createdAt: new Date(),
    };
    const conversation = await saveConversation(
      userId,
      normalized.conversationId,
      latestUserMessage,
      assistantMessage
    );

    return res.json({ reply, conversationId: conversation.id, conversation });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to process chat request",
      details: error.message,
    });
  }
}

// ─── Conversation CRUD ─────────────────────────────────────────────────────────

export async function listConversations(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const limit = parseListLimit(req.query?.limit);
    const before = parseBeforeDate(req.query?.before);
    const mongoFilter = before ? { userId, updatedAt: { $lt: before } } : { userId };

    if (isMongoReady()) {
      const conversations = await Conversation.find(mongoFilter)
        .sort({ updatedAt: -1 })
        .limit(limit)
        .select({ _id: 1, title: 1, updatedAt: 1, createdAt: 1 })
        .lean();
      return res.json(conversations.map(toPublicConversationSummary));
    }

    let conversations = [...inMemoryConversations.values()]
      .filter((c) => c.userId === userId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    if (before) {
      conversations = conversations.filter((c) => new Date(c.updatedAt) < before);
    }
    return res.json(conversations.slice(0, limit).map(toPublicConversationSummary));
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch conversations", details: error.message });
  }
}

export async function getConversation(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;

    if (isMongoReady()) {
      if (!isValidObjectId(id)) return res.status(404).json({ error: "Conversation not found" });
      const conversation = await Conversation.findOne({ _id: id, userId }).lean();
      if (!conversation) return res.status(404).json({ error: "Conversation not found" });
      return res.json(toPublicConversation(conversation));
    }

    const conversation = getInMemoryConversation(userId, id);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });
    return res.json(conversation);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch conversation", details: error.message });
  }
}

export async function deleteConversation(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;

    if (isMongoReady()) {
      if (!isValidObjectId(id)) return res.status(404).json({ error: "Conversation not found" });
      const deleted = await Conversation.deleteOne({ _id: id, userId });
      if (!deleted?.deletedCount) return res.status(404).json({ error: "Conversation not found" });
      return res.json({ success: true, id });
    }

    const conversation = getInMemoryConversation(userId, id);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });
    inMemoryConversations.delete(id);
    return res.json({ success: true, id });
  } catch (error) {
    return res.status(500).json({ error: "Failed to delete conversation", details: error.message });
  }
}
