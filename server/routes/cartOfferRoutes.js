import express from "express";
import {
  createCartOfferRule,
  deleteCartOfferRule,
  listActiveCartOffers,
  listCartOfferRules,
  updateCartOfferRule,
} from "../controllers/cartOfferController.js";
import { protect, requireAdmin } from "../middleware/authMiddleware.js";

const cartOfferRouter = express.Router();

cartOfferRouter.get("/active", listActiveCartOffers);

cartOfferRouter.get("/admin", protect, requireAdmin, listCartOfferRules);
cartOfferRouter.post("/admin", protect, requireAdmin, createCartOfferRule);
cartOfferRouter.put("/admin/:id", protect, requireAdmin, updateCartOfferRule);
cartOfferRouter.delete("/admin/:id", protect, requireAdmin, deleteCartOfferRule);

export default cartOfferRouter;
