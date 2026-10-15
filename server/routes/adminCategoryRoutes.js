import express from "express";
import upload from "../middleware/uploadThumbnail.js";
import { createCategory, createSubCategory, deleteCategory, deleteSubCategory, getCategories, getSubCategories, updateCategory, updateSubCategory } from "../controllers/adminCategoryController.js";
import { protect, requireAdmin } from "../middleware/authMiddleware.js";


const admincategory = express.Router();

/* CATEGORY ROUTES */
admincategory.post("/category", protect, requireAdmin, upload.single("thumbnail"), createCategory);
admincategory.get("/category", getCategories);
admincategory.delete("/category/:id", protect, requireAdmin, deleteCategory);
admincategory.put("/category/:id", protect, requireAdmin, upload.single("thumbnail"), updateCategory);
/* SUBCATEGORY ROUTES */
admincategory.post("/subcategory", protect, requireAdmin, upload.single("thumbnail"), createSubCategory);
admincategory.get("/subcategory", getSubCategories);
admincategory.delete("/subcategory/:id", protect, requireAdmin, deleteSubCategory);
admincategory.put("/subcategory/:id", protect, requireAdmin, upload.single("thumbnail"), updateSubCategory);

export default admincategory;
