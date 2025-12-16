// server/routes/productRoutes.js
import express from "express";
import { Product } from "../models/Product.js";

const router = express.Router();

// GET all products (for listing page)
router.get("/", async (req, res) => {
  try {
    const products = await Product.find({}, "name slug basePrice category").lean();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// GET single product by slug (for customization page)
router.get("/:slug", async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug }).lean();

    if (!product) return res.status(404).json({ error: "Product not found" });

    res.json(product);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

export default router;
