import express from "express";

import { createRazorpayOrderFromCart, verifyRazorpayPayment } from "../controllers/paymentController.js";
import { protect } from "../middleware/authMiddleware.js";

const paymentrouter = express.Router();

paymentrouter.post("/razorpay/create-from-cart", protect, createRazorpayOrderFromCart);
paymentrouter.post("/razorpay/verify", protect, verifyRazorpayPayment);

export default paymentrouter;