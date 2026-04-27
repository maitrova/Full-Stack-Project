import express from "express";
import {
  addToCart,
  clearCart,
  getCart,
  updateCartItemQty,
  removeCartItem,
} from "../controllers/cartController.js";
import { optionalProtect } from "../middleware/authMiddleware.js";

const cartrouter = express.Router();

// Cart
cartrouter.get("/", optionalProtect, getCart);
cartrouter.post("/add", optionalProtect, addToCart);
cartrouter.delete("/clear", optionalProtect, clearCart);

// Cart items
cartrouter.patch("/item/:itemId", optionalProtect, updateCartItemQty);
cartrouter.delete("/item/:itemId", optionalProtect, removeCartItem);

export default cartrouter;
