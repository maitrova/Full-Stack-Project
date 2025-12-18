// server/routes/productPricingRoutes.js
import express from "express";
import { getProductPricing, toggleUnlimitedPricing, updateBasePrice, updateNormalPricing, updateProductPricing } from "../controllers/admincontroller.js";
import { protect } from "../middleware/authMiddleware.js";


const adminrouter = express.Router();

// All routes require admin privileges


// Get product pricing configuration
adminrouter.get("/:id", protect,getProductPricing);

// Update full pricing configuration
adminrouter.put("/:id", protect, updateProductPricing);

// Toggle unlimited pricing on/off
adminrouter.patch("/:id/unlimited-toggle",protect, toggleUnlimitedPricing);

// Update normal pricing parameters
adminrouter.patch("/:id/normal-pricing", protect,updateNormalPricing);

// Update base price only
adminrouter.patch("/:id/base-price",protect, updateBasePrice);

export default adminrouter;