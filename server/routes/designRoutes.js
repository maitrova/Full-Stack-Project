import express from "express";
import { saveDesign, getDesign, listDesigns, updateDesign, deleteDesign, listCatalogueDesigns, publishDesign } from "../controllers/designController.js";
import { protect } from "../middleware/authMiddleware.js";

const designrouter = express.Router();

 
designrouter.get("/catalogue", listCatalogueDesigns);   
designrouter.patch("/:id/publish", protect, publishDesign); 

designrouter.post("/", protect, saveDesign);
designrouter.get("/", protect,listDesigns);
designrouter.get("/:id", getDesign);

designrouter.put("/:id", updateDesign); 
designrouter.delete("/:id", deleteDesign);


      // ✅ public

export default designrouter;
