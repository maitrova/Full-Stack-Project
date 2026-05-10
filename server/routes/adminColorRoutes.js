import express from "express";
import {
  createColor,
  getAllColors,
  updateColor,
  deleteColor,
  getActiveColors,
} from "../controllers/adminColorController.js";

const colorselection = express.Router();

// You can add adminAuth middleware here
colorselection.post("/", createColor);
colorselection.get("/", getAllColors);
colorselection.put("/:colorId", updateColor);
colorselection.delete("/:colorId", deleteColor);
colorselection.get("/active", getActiveColors);

export default colorselection;
