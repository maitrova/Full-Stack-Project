import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { getMyCart,addProductToCart,addDesignToCart } from "../controllers/addtocartcontroller.js";

const cartrouter = express.Router();

cartrouter.get("/", protect, getMyCart);
cartrouter.post("/items", protect, addProductToCart);
cartrouter.post("/designs", protect, addDesignToCart);

export default cartrouter;