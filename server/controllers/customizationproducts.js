// backend/controllers/productController.js
import { Product } from "../models/Product.js";

// Controller to get all products (for listing page)
export const getAllProducts = async (req, res) => {
  try {
    // Get category and subCategory from query parameters
    const { category, subCategory } = req.query;

    // Build the filter object based on query parameters
    let filter = {};
    if (category && category !== 'all') {
      filter.category = category;
    }
    if (subCategory && subCategory !== 'all') {
      filter.subCategory = subCategory;
    }

    // Find products based on the filter object
    const products = await Product.find(filter, "name slug basePrice category subCategory image").lean();
    console.log("Products fetched from DB:", products);
    if (!products.length) {
      return res.status(404).json({ error: "No products found" });
    }

    res.json(products);
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({ error: "Failed to fetch products", details: err.message });
  }
};

// NEW: Get unique categories and subcategories from database
export const getProductCategories = async (req, res) => {
  try {
    // Get all distinct categories that are not null/empty
    const categories = await Product.distinct("category", { category: { $ne: null, $ne: "" } });
    
    // For each category, get its distinct subcategories
    const categoriesWithSubs = await Promise.all(
      categories.map(async (category) => {
        const subCategories = await Product.distinct("subCategory", { 
          category: category,
          subCategory: { $ne: null, $ne: "" }
        });
        return {
          category,
          subCategories: subCategories.filter(sub => sub) // Remove null/undefined
        };
      })
    );

    // Also get all subcategories for the "All Subcategories" option
    const allSubCategories = await Product.distinct("subCategory", { 
      subCategory: { $ne: null, $ne: "" }
    });

    res.json({
      categories: categoriesWithSubs,
      allSubCategories: allSubCategories.filter(sub => sub)
    });
  } catch (err) {
    console.error("Error fetching categories:", err);
    res.status(500).json({ error: "Failed to fetch categories", details: err.message });
  }
};

export const getProductBySlug = async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug }).lean();

    if (!product) return res.status(404).json({ error: "Product not found" });

    res.json(product);
  } catch (err) {
    console.error("Error fetching product:", err);
    res.status(500).json({ error: "Failed to fetch product", details: err.message });
  }
};