import "dotenv/config";
import express from "express";
import cors from "cors";
import { runAgent } from "./agent.js";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

function buildMessagesFromRequest(body) {
  const payload = body ?? {};

  if (Array.isArray(payload.messages)) {
    return payload.messages;
  }

  if (typeof payload.prompt === "string" && payload.prompt.trim().length > 0) {
    return [{ role: "user", content: payload.prompt.trim() }];
  }

  if (typeof payload.message === "string" && payload.message.trim().length > 0) {
    return [{ role: "user", content: payload.message.trim() }];
  }

  return null;
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/chat", async (req, res) => {
  try {
    const messages = buildMessagesFromRequest(req.body);

    if (!messages) {
      return res.status(400).json({
        error: "Request body must include either 'messages' (array) or 'prompt' (string)",
      });
    }

    const reply = await runAgent(messages);
    return res.json({ reply });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to process chat request",
      details: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Aura server listening on port ${PORT}`);
});
