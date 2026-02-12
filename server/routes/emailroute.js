import express from "express";
import { updateOrderStatus } from "../controllers/orderemailController.js";


const emailrouter = express.Router();

emailrouter.put("/orders/status", updateOrderStatus);

export default emailrouter;
