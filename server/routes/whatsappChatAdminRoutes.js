import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  addWhatsAppChatNote,
  getWhatsAppChat,
  getWhatsAppChatMedia,
  getWhatsAppOverview,
  listWhatsAppAdmins,
  listWhatsAppChats,
  sendWhatsAppReply,
  updateWhatsAppChat,
} from "../controllers/whatsappChatAdminController.js";

const router = express.Router();

router.get("/", protect, listWhatsAppChats);
router.get("/overview", protect, getWhatsAppOverview);
router.get("/admins", protect, listWhatsAppAdmins);
router.get("/:id", protect, getWhatsAppChat);
router.get("/:id/media/:messageId", protect, getWhatsAppChatMedia);
router.patch("/:id", protect, updateWhatsAppChat);
router.post("/:id/notes", protect, addWhatsAppChatNote);
router.post("/:id/reply", protect, sendWhatsAppReply);

export default router;
