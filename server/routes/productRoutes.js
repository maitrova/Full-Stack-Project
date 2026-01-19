// server/routes/productRoutes.js
import express from "express";
import { getAllProducts, getHomeProductCategories, getProductBySlug, getProductCategories } from "../controllers/customizationproducts.js";

const router = express.Router();

router.get('/categories', getProductCategories);
router.get('/categorylist', getHomeProductCategories);
// GET all products (for listing page)
router.get("/", getAllProducts);

// GET single product by slug (for customization page)
router.get("/:slug", getProductBySlug);

export default router;
