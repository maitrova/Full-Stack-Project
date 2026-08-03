import express from "express";
import {
  createComboPack,
  deleteComboPack,
  getComboPackById,
  getPublicComboPackBySlug,
  listPublicComboPacksByProduct,
  listComboPacks,
  listPublicComboPacks,
  searchComboProducts,
  updateComboPack,
} from "../controllers/comboPackController.js";
import upload from "../middleware/readymadeProductUpload.middleware.js";

const comboPackRouter = express.Router();

const comboImageUpload = upload.fields([
  { name: "featuredImage", maxCount: 1 },
  { name: "galleryImages", maxCount: 8 },
  { name: "bannerImage", maxCount: 1 },
]);

comboPackRouter.get("/", listComboPacks);
comboPackRouter.get("/public", listPublicComboPacks);
comboPackRouter.get("/products/search", searchComboProducts);
comboPackRouter.get("/product/:productId", listPublicComboPacksByProduct);
comboPackRouter.get("/slug/:slug", getPublicComboPackBySlug);
comboPackRouter.get("/:id", getComboPackById);
comboPackRouter.post("/", comboImageUpload, createComboPack);
comboPackRouter.put("/:id", comboImageUpload, updateComboPack);
comboPackRouter.delete("/:id", deleteComboPack);

export default comboPackRouter;
