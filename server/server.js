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
import { verifyMailTransport } from "./utils/mailer.js";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: Number(process.env.RATE_LIMIT_MAX) || 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, slow down." },
})

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
}));
app.use(express.json({ limit: "256kb" }));
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
  .finally(async () => {
    await verifyMailTransport({ tag: "startup" });
    startReminderJob()   // ← add this
    app.listen(PORT, () => {
      console.log(`Aura server listening on port ${PORT}`);
    });
  });
