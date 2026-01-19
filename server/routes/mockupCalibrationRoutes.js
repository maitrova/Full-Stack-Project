import express from "express";
import { getMockupCalibration, upsertMockupCalibration } from "../controllers/mockupCalibrationController.js";
// import { protect } from "../middleware/authMiddleware.js"; // if you have auth

const caliberateroutes = express.Router();

caliberateroutes.get("/", /*protect,*/ getMockupCalibration);
caliberateroutes.post("/", /*protect,*/ upsertMockupCalibration);

export default caliberateroutes;