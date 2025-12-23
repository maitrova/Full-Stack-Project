import express from "express";
import {
  addToCart,
  getCart,
  updateCartItemQty,
  removeCartItem,
} from "../controllers/cartController.js";
import { protect } from "../middleware/authMiddleware.js";

const cartrouter = express.Router();

// Cart
cartrouter.get("/", protect, getCart);
cartrouter.post("/add", protect, addToCart);

// Cart items
cartrouter.patch("/item/:itemId", protect, updateCartItemQty);
cartrouter.delete("/item/:itemId", protect, removeCartItem);

export default cartrouter;