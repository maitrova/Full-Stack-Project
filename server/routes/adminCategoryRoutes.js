import express from "express";
import { uploadThumbnail } from "../middleware/uploadThumbnail.js";
import {
  adminCreateCategory,
  adminCreateSubCategory,
  adminListCategories,
  adminListSubCategories,
} from "../controllers/adminCategoryController.js";

const admincategory = express.Router();

// NOTE: add your admin auth middleware here if you have it:
// router.use(adminAuth);

admincategory.get("/categories", adminListCategories);
admincategory.post("/categories", uploadThumbnail, adminCreateCategory);

admincategory.get("/subcategories/:categoryId", adminListSubCategories);
admincategory.post("/subcategories", uploadThumbnail, adminCreateSubCategory);

export default admincategory;
