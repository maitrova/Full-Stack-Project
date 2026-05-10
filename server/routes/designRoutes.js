import express from "express";
import { saveDesign, getDesign, listDesigns, updateDesign, deleteDesign, listCatalogueDesigns, publishDesign, updatedesigndetails, getDesignMeta } from "../controllers/designController.js";
import { protect } from "../middleware/authMiddleware.js";
import { getCommonSavedData } from "../controllers/commoncontroller.js";

const designrouter = express.Router();

 
designrouter.get("/catalogue", listCatalogueDesigns);   
designrouter.get("/common", getCommonSavedData);
designrouter.get("/design-meta", getDesignMeta);
designrouter.patch("/:id/publish", protect, publishDesign); 

designrouter.post("/", protect, saveDesign);
designrouter.get("/", protect,listDesigns);
designrouter.get("/:id", getDesign);

designrouter.put("/:id", updateDesign); 
designrouter.delete("/:id", deleteDesign);

designrouter.put("/designdetails/:id", protect, updatedesigndetails);

// designrouter.put("/products/:id/pricing", protect,updateProductPricingControls);
export default designrouter;
