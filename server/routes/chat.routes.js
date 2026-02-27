import { Router } from "express";
import { chat, deleteConversation, getConversation, listConversations } from "../controllers/chat.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/chat", requireAuth, chat);
router.get("/conversations", requireAuth, listConversations);
router.get("/conversations/:id", requireAuth, getConversation);
router.delete("/conversations/:id", requireAuth, deleteConversation);

export default router;
