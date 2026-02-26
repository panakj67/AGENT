import { Router } from "express";
import { chat, getConversation, listConversations } from "../controllers/chat.controller.js";

const router = Router();

router.post("/chat", chat);
router.get("/conversations", listConversations);
router.get("/conversations/:id", getConversation);

export default router;
