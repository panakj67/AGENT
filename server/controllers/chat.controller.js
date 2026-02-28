import { runAgent, runAgentStream } from "../agent.js";
import { Conversation } from "../models/conversation.model.js";

const inMemoryConversations = new Map();
const MAX_CONTEXT_TOKENS = 2000;
const MAX_CONTEXT_MESSAGES = 3;

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

function getInMemoryConversation(userId, id) {
  if (!id) return null;
  const conversation = inMemoryConversations.get(id) ?? null;
  if (!conversation || conversation.userId !== userId) {
    return null;
  }
  return conversation;
}

async function getConversationById(userId, id) {
  if (!id) return null;

  if (Conversation.db?.readyState === 1) {
    return Conversation.findOne({ _id: id, userId });
  }

  return getInMemoryConversation(userId, id);
}

function getConversationMessages(conversation) {
  if (!conversation || !Array.isArray(conversation.messages)) {
    return [];
  }

  return conversation.messages
    .filter((message) => message && typeof message.role === "string" && typeof message.content === "string")
    .map((message) => ({
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
    }));
}

function estimateTokensFromText(text) {
  if (!text) return 0;
  return Math.ceil(String(text).length / 4);
}

function trimMessagesByTokenBudget(messages, maxTokens) {
  const trimmed = Array.isArray(messages) ? [...messages] : [];
  while (trimmed.length > 0) {
    const totalTokens = trimmed.reduce((sum, message) => sum + estimateTokensFromText(message.content), 0);
    if (totalTokens <= maxTokens) break;
    if (trimmed.length === 1) break;
    trimmed.shift();
  }
  return trimmed;
}

function trimMessagesForContext(messages) {
  const base = Array.isArray(messages) ? messages.filter(Boolean) : [];
  const lastMessages = base.slice(-MAX_CONTEXT_MESSAGES);
  return trimMessagesByTokenBudget(lastMessages, MAX_CONTEXT_TOKENS);
}

async function saveConversation(userId, conversationId, userMessage, assistantMessage) {
  if (Conversation.db?.readyState === 1) {
    const current = conversationId ? await Conversation.findOne({ _id: conversationId, userId }) : null;

    if (!current) {
      const created = await Conversation.create({
        userId,
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
  return "### Answer\n- AI provider is not configured on the server yet.\n- Please set `GROQ_API_KEY` to enable live assistant responses.";
}

function wantsStreamingResponse(req) {
  if (req.query?.stream === "1") return true;
  const accept = req.headers?.accept ?? "";
  return typeof accept === "string" && accept.includes("text/event-stream");
}

function initializeSse(res) {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }
}

function writeSseEvent(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export async function chat(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

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

    const existingConversation = await getConversationById(userId, normalized.conversationId);
    const historyMessages = getConversationMessages(existingConversation);

    const messageTime = new Date();
    const latestUserMessage = {
      role: "user",
      content: String(userMessage.content),
      createdAt: messageTime,
    };
    const agentMessages = [latestUserMessage];

    if (wantsStreamingResponse(req)) {
      initializeSse(res);

      let streamedReply = "";
      try {
        streamedReply = await runAgentStream(agentMessages, {
          userId,
          userEmail: req.user?.email,
        }, async (token) => {
          if (!token) return;
          writeSseEvent(res, { type: "token", token });
        });
      } catch (error) {
        if (error.message === "GROQ_API_KEY is not configured") {
          streamedReply = fallbackReplyForMissingProvider();
          writeSseEvent(res, { type: "token", token: streamedReply });
        } else {
          writeSseEvent(res, {
            type: "error",
            error: "Failed to process chat request",
            details: error.message,
          });
          return res.end();
        }
      }

      const assistantMessage = {
        role: "assistant",
        content: streamedReply,
        createdAt: new Date(),
      };
      const conversation = await saveConversation(
        userId,
        normalized.conversationId,
        latestUserMessage,
        assistantMessage,
      );

      writeSseEvent(res, {
        type: "done",
        reply: streamedReply,
        conversationId: conversation.id,
        conversation,
      });
      return res.end();
    }

    let reply;
    try {
      reply = await runAgent(agentMessages, {
        userId: userId,
        userEmail: req.user?.email
      })
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
    const conversation = await saveConversation(userId, normalized.conversationId, latestUserMessage, assistantMessage);

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

export async function listConversations(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (Conversation.db?.readyState === 1) {
      const conversations = await Conversation.find({ userId }).sort({ updatedAt: -1 }).limit(50);
      return res.json(conversations.map(toPublicConversation));
    }

    const conversations = [...inMemoryConversations.values()]
      .filter((conversation) => conversation.userId === userId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    
    return res.json(conversations);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch conversations", details: error.message });
  }
}

export async function getConversation(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;

    if (Conversation.db?.readyState === 1) {
      const conversation = await Conversation.findOne({ _id: id, userId });
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      return res.json(toPublicConversation(conversation));
    }

    const conversation = getInMemoryConversation(userId, id);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    return res.json(conversation);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch conversation", details: error.message });
  }
}

export async function deleteConversation(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;

    if (Conversation.db?.readyState === 1) {
      const deleted = await Conversation.findOneAndDelete({ _id: id, userId });
      if (!deleted) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      return res.json({ success: true, id });
    }

    const conversation = getInMemoryConversation(userId, id);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    inMemoryConversations.delete(id);
    return res.json({ success: true, id });
  } catch (error) {
    return res.status(500).json({ error: "Failed to delete conversation", details: error.message });
  }
}
