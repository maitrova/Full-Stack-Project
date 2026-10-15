import express from "express";
import { exportOrdersToExcel } from "../controllers/exportController.js";
import { protect, requireAdmin } from "../middleware/authMiddleware.js";

const exportrouter = express.Router();

exportrouter.post("/export-orders", protect, requireAdmin, exportOrdersToExcel);

export default exportrouter;
