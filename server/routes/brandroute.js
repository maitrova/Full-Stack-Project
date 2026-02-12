import express from "express";
import { createBrand, deleteBrand, getBrands, getBrandsBySubCategory, updateBrand } from "../controllers/brandcontroller.js";



const brandroute = express.Router();

brandroute.post("/brand", createBrand);
brandroute.get("/brand", getBrands);
brandroute.get("/brand/subcategory/:subCategoryId", getBrandsBySubCategory);
brandroute.put("/brand/:id", updateBrand);
brandroute.delete("/brand/:id", deleteBrand);

export default brandroute;  


