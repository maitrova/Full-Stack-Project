import express from "express";
import { saveDesign, getDesign, listDesigns, updateDesign, deleteDesign, listCatalogueDesigns, publishDesign, updatedesigndetails, getDesignMeta } from "../controllers/designController.js";
import mongoose from "mongoose";
import { protect } from "../middleware/authMiddleware.js";
import { Design } from "../models/Design.js";
import { getCommonSavedData } from "../controllers/commoncontroller.js";

const designrouter = express.Router();

// Only the shopper who saved a design (or store staff) may change or delete it.
const requireDesignOwner = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid design id" });
    }
    const design = await Design.findById(req.params.id).select("user").lean();
    if (!design) return res.status(404).json({ message: "Design not found" });
    const isStaff = ["admin", "superuser"].includes(req.user?.role);
    if (!isStaff && String(design.user) !== String(req.user?._id)) {
      return res.status(403).json({ message: "You can only change your own designs" });
    }
    next();
  } catch (error) {
    next(error);
  }
};

 
designrouter.get("/catalogue", listCatalogueDesigns);   
designrouter.get("/common", getCommonSavedData);
designrouter.get("/design-meta", getDesignMeta);
designrouter.patch("/:id/publish", protect, publishDesign); 

designrouter.post("/", protect, saveDesign);
designrouter.get("/", protect,listDesigns);
designrouter.get("/:id", getDesign);

designrouter.put("/:id", protect, requireDesignOwner, updateDesign);
designrouter.delete("/:id", protect, requireDesignOwner, deleteDesign);

designrouter.put("/designdetails/:id", protect, updatedesigndetails);

// designrouter.put("/products/:id/pricing", protect,updateProductPricingControls);
export default designrouter;
