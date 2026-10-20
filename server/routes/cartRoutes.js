import express from "express";
import {
  addToCart,
  clearCart,
  convertToCombo,
  getCart,
  getCartOffers,
  getComboSuggestions,
  updateCartItemQty,
  removeCartItem,
  undoCombo,
} from "../controllers/cartController.js";
import { optionalProtect } from "../middleware/authMiddleware.js";

const cartrouter = express.Router();

// Cart
cartrouter.get("/", optionalProtect, getCart);
cartrouter.get("/offers", optionalProtect, getCartOffers);
cartrouter.get("/combo-suggestions", optionalProtect, getComboSuggestions);
cartrouter.post("/add", optionalProtect, addToCart);
cartrouter.post("/convert-to-combo", optionalProtect, convertToCombo);
cartrouter.delete("/clear", optionalProtect, clearCart);

// Cart items
cartrouter.patch("/item/:itemId", optionalProtect, updateCartItemQty);
cartrouter.delete("/item/:itemId", optionalProtect, removeCartItem);
cartrouter.post("/item/:itemId/undo-combo", optionalProtect, undoCombo);

export default cartrouter;
