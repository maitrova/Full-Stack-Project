import express from "express";
import upload from "../middleware/uploadThumbnail.js";
import { createCategory, createSubCategory, deleteCategory, deleteSubCategory, getCategories, getSubCategories, updateCategory, updateSubCategory } from "../controllers/adminCategoryController.js";


const admincategory = express.Router();

/* CATEGORY ROUTES */
admincategory.post("/category", upload.single("thumbnail"), createCategory);
admincategory.get("/category", getCategories);
admincategory.delete("/category/:id", deleteCategory);
admincategory.put("/category/:id", upload.single("thumbnail"), updateCategory);
/* SUBCATEGORY ROUTES */
admincategory.post("/subcategory", upload.single("thumbnail"), createSubCategory);
admincategory.get("/subcategory", getSubCategories);
admincategory.delete("/subcategory/:id", deleteSubCategory);
admincategory.put("/subcategory/:id", upload.single("thumbnail"), updateSubCategory);

export default admincategory;
