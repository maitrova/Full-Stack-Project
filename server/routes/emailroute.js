import express from "express";
import { updateOrderStatus } from "../controllers/orderemailController.js";
import { protect, requireAdmin } from "../middleware/authMiddleware.js";


const emailrouter = express.Router();

emailrouter.put("/orders/status", protect, requireAdmin, updateOrderStatus);

export default emailrouter;
