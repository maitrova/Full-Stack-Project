import express from "express";

import {
  createRazorpayOrderFromCart,
  verifyRazorpayPayment,
  createCashOnDeliveryOrderFromCart,
} from "../controllers/paymentController.js";
import { protect } from "../middleware/authMiddleware.js";

const paymentrouter = express.Router();

paymentrouter.post("/razorpay/create-from-cart", protect, createRazorpayOrderFromCart);
paymentrouter.post("/razorpay/verify", protect, verifyRazorpayPayment);
paymentrouter.post("/cod/create-from-cart", protect, createCashOnDeliveryOrderFromCart);

export default paymentrouter;
