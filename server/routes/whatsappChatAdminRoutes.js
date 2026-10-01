import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getWhatsAppChat,
  getWhatsAppChatMedia,
  listWhatsAppChats,
  updateWhatsAppChat,
} from "../controllers/whatsappChatAdminController.js";

const router = express.Router();

router.get("/", protect, listWhatsAppChats);
router.get("/:id", protect, getWhatsAppChat);
router.get("/:id/media/:messageId", protect, getWhatsAppChatMedia);
router.patch("/:id", protect, updateWhatsAppChat);

export default router;
