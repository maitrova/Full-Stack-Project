import express from "express";
import {
  createColor,
  getAllColors,
  updateColor,
  deleteColor,
  getActiveColors,
} from "../controllers/adminColorController.js";
import { protect, requireAdmin } from "../middleware/authMiddleware.js";

const colorselection = express.Router();

// You can add adminAuth middleware here
colorselection.post("/", protect, requireAdmin, createColor);
colorselection.get("/", getAllColors);
colorselection.put("/:colorId", protect, requireAdmin, updateColor);
colorselection.delete("/:colorId", protect, requireAdmin, deleteColor);
colorselection.get("/active", getActiveColors);

export default colorselection;
