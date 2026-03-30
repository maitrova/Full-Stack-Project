// server/routes/productRoutes.js
import express from "express";
import {
  getAllProducts,
  getAllProductsAdmin,
  getHomeProductCategories,
  getProductAdminById,
  getProductBySlug,
  getProductCategories,
  updateProductAdmin,
} from "../controllers/customizationproducts.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/admin/list", protect, getAllProductsAdmin);
router.get("/admin/:id", protect, getProductAdminById);
router.put("/admin/:id", protect, updateProductAdmin);
router.get('/categories', getProductCategories);
router.get('/categorylist', getHomeProductCategories);
// GET all products (for listing page)
router.get("/", getAllProducts);

// GET single product by slug (for customization page)
router.get("/:slug", getProductBySlug);

export default router;
