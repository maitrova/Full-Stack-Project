import express from "express";
import { createBrand, deleteBrand, getBrands, getBrandsBySubCategory, updateBrand } from "../controllers/brandcontroller.js";
import { protect, requireAdmin } from "../middleware/authMiddleware.js";



const brandroute = express.Router();

brandroute.post("/brand", protect, requireAdmin, createBrand);
brandroute.get("/brand", getBrands);
brandroute.get("/brand/subcategory/:subCategoryId", getBrandsBySubCategory);
brandroute.put("/brand/:id", protect, requireAdmin, updateBrand);
brandroute.delete("/brand/:id", protect, requireAdmin, deleteBrand);

export default brandroute;  


