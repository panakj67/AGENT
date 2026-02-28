import "dotenv/config";
import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectDatabase } from "./config/database.js";
import chatRoutes from "./routes/chat.routes.js";
import authRoutes from "./routes/auth.routes.js";

import rateLimit from "express-rate-limit"
import { startReminderJob } from "./Jobs/reminder.job.js"

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,                   // 50 requests per window
  message: { error: "Too many requests, slow down." }
})

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/chat", limiter);


app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api", chatRoutes);
app.use("/", chatRoutes);

app.use((_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

connectDatabase()
  .catch((error) => {
    console.error("[db] Connection failed:", error.message);
  })
  .finally(() => {
    startReminderJob()   // ← add this
    app.listen(PORT, () => {
      console.log(`Aura server listening on port ${PORT}`);
    });
  });
