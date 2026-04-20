// backend/controllers/productController.js
import { Product } from "../models/Product.js";

const DEFAULT_PRODUCT_COLORS = [
  { value: "#FFFFFF", label: "White" },
  { value: "#000000", label: "Black" },
  { value: "#FF6B6B", label: "Coral" },
  { value: "#4ECDC4", label: "Mint" },
  { value: "#45B7D1", label: "Sky" },
  { value: "#96CEB4", label: "Seafoam" },
];

const ensureAdmin = (req, res) => {
  if (!req.user || (req.user.role !== "admin" && req.user.role !== "superuser")) {
    res.status(403).json({ error: "Admin only" });
    return false;
  }
  return true;
};

const sanitizeColorValue = (value = "") => {
  const normalized = String(value || "").trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(normalized) ? normalized : "";
};

const sanitizeColors = (colors = []) => {
  const source = Array.isArray(colors) ? colors : [];
  const seen = new Set();
  const normalizedColors = source
    .map((entry) => {
      if (!entry) return null;
      const value = sanitizeColorValue(entry.value);
      const label = String(entry.label || "").trim();
      const rawStock = entry.stock;
      const hasStockValue =
        rawStock !== null &&
        rawStock !== undefined &&
        String(rawStock).trim() !== "";
      const stock = hasStockValue ? Number(rawStock) : null;
      if (!value || !label) return null;
      if (hasStockValue && (!Number.isFinite(stock) || stock < 0)) {
        throw new Error(`Invalid stock for color ${label || value}`);
      }
      const key = `${value}:${label.toLowerCase()}`;
      if (seen.has(key)) return null;
      seen.add(key);
      return { value, label, stock };
    })
    .filter(Boolean);

  return normalizedColors.length > 0 ? normalizedColors : DEFAULT_PRODUCT_COLORS;
};

const sanitizeSizePricing = (sizePricing = []) => {
  if (!Array.isArray(sizePricing) || sizePricing.length === 0) {
    throw new Error("At least one size pricing row is required");
  }

  const validSizes = new Set(["XS", "S", "M", "L", "XL", "XXL"]);
  const seenSizes = new Set();

  return sizePricing.map((entry) => {
    const size = String(entry?.size || "").trim().toUpperCase();
    const price = Number(entry?.price);
    const stock = Number(entry?.stock ?? 0);

    if (!validSizes.has(size)) {
      throw new Error(`Invalid size: ${entry?.size || ""}`);
    }
    if (seenSizes.has(size)) {
      throw new Error(`Duplicate size entry: ${size}`);
    }
    if (!Number.isFinite(price) || price < 0) {
      throw new Error(`Invalid price for size ${size}`);
    }
    if (!Number.isFinite(stock) || stock < 0) {
      throw new Error(`Invalid stock for size ${size}`);
    }

    seenSizes.add(size);
    return {
      size,
      price,
      stock,
    };
  });
};

const sanitizeViews = (views = []) => {
  if (!Array.isArray(views)) return [];
  return views
    .map((view) => ({
      code: String(view?.code || "").trim(),
      label: String(view?.label || "").trim(),
      mockupUrl: String(view?.mockupUrl || "").trim(),
      maskUrl: String(view?.maskUrl || "").trim(),
    }))
    .filter((view) => view.code && view.label);
};

const DEFAULT_IMAGE_PRICE_RULES = [
  { maxSideInches: 4, price: 40 },
  { maxSideInches: null, price: 100 },
];
const DEFAULT_TEXT_PRICE_RULES = [
  { maxSideInches: 4, price: 40 },
  { maxSideInches: null, price: 100 },
];

const sanitizeImagePriceRules = (rules = []) => {
  const source = Array.isArray(rules) ? rules : [];
  const normalized = source
    .map((entry) => {
      const rawMax = entry?.maxSideInches;
      const hasFiniteMax =
        rawMax !== null &&
        rawMax !== undefined &&
        String(rawMax).trim() !== "";
      const maxSideInches = hasFiniteMax ? Number(rawMax) : null;
      const price = Number(entry?.price);

      if (hasFiniteMax && (!Number.isFinite(maxSideInches) || maxSideInches < 0)) {
        throw new Error("Invalid image price rule max inches");
      }

      if (!Number.isFinite(price) || price < 0) {
        throw new Error("Invalid image price rule price");
      }

      return {
        maxSideInches,
        price,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.maxSideInches === null) return 1;
      if (b.maxSideInches === null) return -1;
      return a.maxSideInches - b.maxSideInches;
    });

  return normalized.length > 0 ? normalized : DEFAULT_IMAGE_PRICE_RULES;
};

const sanitizeNormalPricing = (normalPricing = {}, current = {}) => {
  if (!normalPricing || typeof normalPricing !== "object") {
    return current;
  }

  const next = {
    ...current,
  };

  if (normalPricing.fixedSizeInches !== undefined) {
    next.fixedSizeInches = Number(normalPricing.fixedSizeInches || 0);
  }

  if (normalPricing.pricePerSqInch !== undefined) {
    next.pricePerSqInch = Number(normalPricing.pricePerSqInch || 0);
  }

  if (normalPricing.sleevePrice !== undefined) {
    next.sleevePrice = Number(normalPricing.sleevePrice || 0);
  }

  if (normalPricing.imagePriceRules !== undefined) {
    next.imagePriceRules = sanitizeImagePriceRules(normalPricing.imagePriceRules);
  }

  if (normalPricing.textPriceRules !== undefined) {
    next.textPriceRules = sanitizeImagePriceRules(normalPricing.textPriceRules);
  }

  if (
    normalPricing.imagePriceRules === undefined &&
    normalPricing.textPriceRules === undefined &&
    !Array.isArray(current?.textPriceRules)
  ) {
    next.textPriceRules = DEFAULT_TEXT_PRICE_RULES;
  }

  return next;
};

// Controller to get all products (for listing page)
export const getAllProducts = async (req, res) => {
  try {
    const { category, subCategory } = req.query;

    let filter = {};
    if (category && category !== "all") {
      filter.category = category;
    }
    if (subCategory && subCategory !== "all") {
      filter.subCategory = subCategory;
    }

    // Fetch required fields (include sizePricing)
    const products = await Product.find(
      filter,
      "name slug category subCategory basePrice sizePricing image"
    ).lean();

    if (!products.length) {
      return res.status(404).json({ error: "No products found" });
    }

    // 🔥 Compute displayPrice (min size price)
    const formattedProducts = products.map((product) => {
      let displayPrice = product.basePrice;

      if (product.sizePricing && product.sizePricing.length > 0) {
        displayPrice = Math.min(
          ...product.sizePricing.map((s) => s.price)
        );
      }

      return {
        ...product,
        displayPrice, // 👈 use this in product cards
      };
    });

    res.json(formattedProducts);
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({
      error: "Failed to fetch products",
      details: err.message,
    });
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

export const getAllProductsAdmin = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const products = await Product.find({})
      .sort({ category: 1, name: 1 })
      .lean();

    res.status(200).json({
      success: true,
      data: products,
    });
  } catch (err) {
    console.error("Error fetching admin customization products:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch products",
      details: err.message,
    });
  }
};

export const getProductAdminById = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const product = await Product.findById(req.params.id).lean();
    if (!product) {
      return res.status(404).json({ success: false, error: "Product not found" });
    }

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (err) {
    console.error("Error fetching customization product:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch product",
      details: err.message,
    });
  }
};

export const updateProductAdmin = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: "Product not found" });
    }

    const {
      name,
      slug,
      category,
      subCategory,
      basePrice,
      currency,
      pricingMode,
      colors,
      sizePricing,
      views,
      unlimitedPricing,
      normalPricing,
    } = req.body;

    if (typeof name === "string" && name.trim()) product.name = name.trim();
    if (typeof slug === "string" && slug.trim()) product.slug = slug.trim();
    if (typeof category === "string") product.category = category.trim();
    if (typeof subCategory === "string") product.subCategory = subCategory.trim();
    if (basePrice !== undefined) product.basePrice = Number(basePrice);
    if (typeof currency === "string" && currency.trim()) product.currency = currency.trim().toUpperCase();

    if (pricingMode !== undefined) {
      if (!["normal", "unlimited"].includes(pricingMode)) {
        return res.status(400).json({ success: false, error: "Invalid pricing mode" });
      }
      product.pricingMode = pricingMode;
    }

    if (colors !== undefined) {
      product.colors = sanitizeColors(colors);
    }

    if (sizePricing !== undefined) {
      product.sizePricing = sanitizeSizePricing(sizePricing);
    }

    if (views !== undefined) {
      product.views = sanitizeViews(views);
    }

    if (unlimitedPricing && typeof unlimitedPricing === "object") {
      product.unlimitedPricing = {
        ...product.unlimitedPricing,
        ...unlimitedPricing,
      };
    }

    if (normalPricing && typeof normalPricing === "object") {
      product.normalPricing = sanitizeNormalPricing(normalPricing, product.normalPricing);
    }

    const updatedProduct = await product.save();

    res.status(200).json({
      success: true,
      message: "Customization product updated successfully",
      data: updatedProduct,
    });
  } catch (err) {
    console.error("Error updating customization product:", err);

    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        error: "Slug already exists",
      });
    }

    if (err.name === "ValidationError" || err.message) {
      return res.status(400).json({
        success: false,
        error: err.message || "Validation failed",
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to update product",
      details: err.message,
    });
  }
};



export const getHomeProductCategories = async (req, res) => {
  try {
    const categories = await Product.aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          image: { $first: "$image" } // <-- use model field directly
        }
      },
      {
        $project: {
          _id: 0,
          category: "$_id",
          count: 1,
          image: 1
        }
      },
      {
        $sort: { category: 1 }
      }
    ]);

    res.status(200).json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ message: "Failed to fetch categories" });
  }
};

