import express from "express";
import {
  clearChatHistory,
  getChatHistory,
  saveChatTurn,
} from "../controllers/aiChatController.js";
import { optionalProtect } from "../middleware/authMiddleware.js";

const aiChatRouter = express.Router();

aiChatRouter.post("/chat-turns", optionalProtect, saveChatTurn);
aiChatRouter.get("/chat-history/:sessionId", optionalProtect, getChatHistory);
aiChatRouter.delete("/chat-history/:sessionId", optionalProtect, clearChatHistory);

export default aiChatRouter;
