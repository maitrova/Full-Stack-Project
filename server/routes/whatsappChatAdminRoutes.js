import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getWhatsAppChat,
  getWhatsAppChatMedia,
  getWhatsAppOverview,
  listWhatsAppChats,
  updateWhatsAppChat,
} from "../controllers/whatsappChatAdminController.js";

const router = express.Router();

router.get("/", protect, listWhatsAppChats);
router.get("/overview", protect, getWhatsAppOverview);
router.get("/:id", protect, getWhatsAppChat);
router.get("/:id/media/:messageId", protect, getWhatsAppChatMedia);
router.patch("/:id", protect, updateWhatsAppChat);

export default router;
