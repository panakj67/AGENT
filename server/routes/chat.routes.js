import { Router } from "express";
import {
  chat,
  chatStream,
  deleteConversation,
  getConversation,
  listConversations,
} from "../controllers/chat.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

// Single /chat endpoint — streams if ?stream=1, otherwise JSON
router.post("/chat", requireAuth, (req, res) => {
  if (req.query.stream === "1") {
    return chatStream(req, res);
  }
  return chat(req, res);
});

router.get("/conversations", requireAuth, listConversations);
router.get("/conversations/:id", requireAuth, getConversation);
router.delete("/conversations/:id", requireAuth, deleteConversation);

export default router;