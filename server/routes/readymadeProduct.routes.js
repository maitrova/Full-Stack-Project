import express from "express";
import { createReadymadeProduct, deleteReadymadeProduct, getReadymadeProductById, getReadymadeProducts, updateReadymadeProduct } from "../controllers/readymadeProduct.controller.js";
import upload from "../middleware/readymadeProductUpload.middleware.js";



const readymadeproducts = express.Router();



readymadeproducts.post(
  "/",
  upload.fields([
    { name: "images", maxCount: 4 },
    { name: "video", maxCount: 1 },
  ]),
  createReadymadeProduct
);
readymadeproducts.put("/:id", upload.fields([
  { name: "images", maxCount: 4 },
  { name: "video", maxCount: 1 },
]), updateReadymadeProduct);
// GET ALL PRODUCTS
readymadeproducts.get("/", getReadymadeProducts);

// GET SINGLE PRODUCT
readymadeproducts.get("/:id", getReadymadeProductById);

// DELETE PRODUCT
readymadeproducts.delete("/:id", deleteReadymadeProduct);

export default readymadeproducts;
