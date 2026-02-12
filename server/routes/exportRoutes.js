import express from "express";
import { exportOrdersToExcel } from "../controllers/exportController.js";

const exportrouter = express.Router();

exportrouter.post("/export-orders", exportOrdersToExcel);

export default exportrouter;
