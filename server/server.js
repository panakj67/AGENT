import "dotenv/config";
import express from "express";
import cors from "cors";
import { runAgent } from "./agent.js";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/chat", async (req, res) => {
  try {
    const { messages } = req.body ?? {};

    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "'messages' must be an array" });
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
