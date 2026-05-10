import express from "express";
import { getProductPrice } from "../controllers/designsizeselection.js";

const designsizeselection = express.Router();

// Route to get product price based on size
designsizeselection.get("/product/:designId/price/:selectedSize", getProductPrice);

export default designsizeselection;
