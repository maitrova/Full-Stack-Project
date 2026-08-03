import express from "express";
import {
  createReadymadeProduct,
  getAllReadymadeProducts,
  getReadymadeProductById,
  updateReadymadeProduct,
  deleteReadymadeProduct,
  toggleProductStatus,
  getBestSellerProducts,
  getNewArrivalProducts,
  getProductsByCategory,
  getProductsBySubCategory,
  getFilteredProducts,
  searchProducts,
  getProductFilters,
  updateProductList,
  getAllReadymadeProductsPublic,
  getReadymadeProductByPath,
  getHomeCategoryTiles,
  getHomeSubCategoryTiles,
  
} from "../controllers/readymadeProduct.controller.js";
import upload from "../middleware/readymadeProductUpload.middleware.js";

const readymadeproducts = express.Router();

const productUpload = upload.fields([
  { name: "images", maxCount: 6 },
  { name: "video", maxCount: 1 },
  { name: "thumbnail", maxCount: 1 },
  { name: "sizeChart", maxCount: 1 },
]);

// ==================== PUBLIC ROUTES ====================
// These routes are accessible to all users

// Product listing and details
readymadeproducts.get("/categorylist", getHomeCategoryTiles);
readymadeproducts.get("/subcategorylist", getHomeSubCategoryTiles);
readymadeproducts.get("/public", getAllReadymadeProductsPublic);
readymadeproducts.get("/path/:category/:subCategory/:productSlug", getReadymadeProductByPath);
readymadeproducts.get("/", getAllReadymadeProducts); // Get all products with pagination
readymadeproducts.get("/search", searchProducts); // Search products

// Special collections
readymadeproducts.get("/collections/best-sellers", getBestSellerProducts);
readymadeproducts.get("/collections/new-arrivals", getNewArrivalProducts);

// Category based filtering
readymadeproducts.get("/categories/:category", getProductsByCategory);
readymadeproducts.get("/categories/:category/:subCategory", getProductsBySubCategory);

// Get filters
readymadeproducts.get("/filters/available", getProductFilters);

// ==================== ADMIN ROUTES ====================
// These routes should be protected with admin authentication

// Product management
readymadeproducts.post("/admin/create", productUpload, createReadymadeProduct);
readymadeproducts.put("/admin/update/:id", productUpload, updateReadymadeProduct);
readymadeproducts.delete("/admin/delete/:id", deleteReadymadeProduct);

// Product list management (for admin panel)
readymadeproducts.get("/admin/all", getAllReadymadeProducts); // Get all products for admin
readymadeproducts.get("/admin/filtered", getFilteredProducts); // Filter products for admin

// Bulk operations
readymadeproducts.patch("/admin/bulk/update-flags", updateProductList); // Bulk update flags
readymadeproducts.patch("/admin/toggle-status/:id", toggleProductStatus); // Toggle status

readymadeproducts.get("/:id", getReadymadeProductById); // Get single product

export default readymadeproducts;
