import { Design } from "../models/Design.js";
import ReadymadeProduct from "../models/readymadeproducts.js";
import { attachReadymadePricing } from "../utils/readymadePricing.js";

/**
 * GET /api/catalog
 *
 * Query params:
 *  - type: "design" | "readymade" | "all" (default: "all")
 *  - search
 *  - minPrice, maxPrice
 *  - newArrival (readymade)
 *  - bestSeller (readymade)
 *  - newArrivals (design)
 *  - bestSellers (design)
 *  - inStock
 *  - page (default 1)
 *  - limit (default 12)
 *  - sort: "newest" | "price_low" | "price_high"
 */

// controllers/commonController.js


export const getCommonSavedData = async (req, res) => {
  try {
    const hasLimit =
      req.query.limit !== undefined &&
      req.query.limit !== null &&
      `${req.query.limit}`.trim() !== "";

    const parsedPage = parseInt(req.query.page || "1", 10);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

    const parsedLimit = hasLimit ? parseInt(req.query.limit, 10) : null;
    const limit =
      hasLimit && Number.isFinite(parsedLimit) && parsedLimit > 0
        ? parsedLimit
        : null;
    const skip = limit ? (page - 1) * limit : 0;

    // Fetch data
    const [designs, readymades] = await Promise.all([
      Design.find({ isPublished: true })
        .sort({ createdAt: -1 })
        .lean(),

      ReadymadeProduct.find({})
        .populate("category", "name thumbnail")
        .populate("subCategory", "name thumbnail")
        .populate("brand", "name") // POPULATE BRAND NAME ONLY
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    // Normalize designs
    const normalizedDesigns = designs.map((d) => ({
      type: "design",
      _id: d._id,
      title: d.title || d.productName || "",
      description: d.description || "",
      previewImage: d.previewImage || null,
      category: d.category || "",
      subCategory: d.subCategory || "",
      stock: d.stock ?? 0,
      price:
        (typeof d.salePrice === "number" && d.salePrice > 0
          ? d.salePrice
          : typeof d.calculatedPrice === "number" && d.calculatedPrice > 0
          ? d.calculatedPrice
          : d.basePrice) ?? 0,
      createdAt: d.createdAt,
      raw: d,
    }));

    // Normalize readymade products
    const normalizedReadymades = readymades.map((p) => {
      const pricedProduct = attachReadymadePricing({ ...p });
      const category =
        typeof pricedProduct.category === "string"
          ? pricedProduct.category
          : pricedProduct.category?.name || "";

      const categoryThumbnail =
        typeof pricedProduct.category === "object"
          ? pricedProduct.category?.thumbnail || null
          : null;

      const subCategory =
        typeof pricedProduct.subCategory === "string"
          ? pricedProduct.subCategory
          : pricedProduct.subCategory?.name || "";

      const subCategoryThumbnail =
        typeof pricedProduct.subCategory === "object"
          ? pricedProduct.subCategory?.thumbnail || null
          : null;

      const brand =
        typeof pricedProduct.brand === "string"
          ? pricedProduct.brand
          : p.brand?.name || "";

      return {
        type: "readymade",
        _id: pricedProduct._id,
        title: pricedProduct.title || "",
        description: pricedProduct.description || "",
        previewImage: pricedProduct.thumbnail || pricedProduct.images?.[0] || null,
        thumbnail: pricedProduct.thumbnail || pricedProduct.images?.[0] || null,

        category,
        categoryThumbnail,
        subCategory,
        subCategoryThumbnail,
        brand, // Clean brand name

        stock: pricedProduct.stock ?? 0,
        price: pricedProduct.effectivePrice ?? pricedProduct.price ?? 0,
        currency: pricedProduct.currency || "INR",
        createdAt: pricedProduct.createdAt,
        raw: pricedProduct,
      };
    });

    // Merge and sort newest first
    const merged = [...normalizedDesigns, ...normalizedReadymades].sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime()
    );

    // Apply pagination only when a limit is explicitly requested.
    const total = merged.length;
    const items = limit ? merged.slice(skip, skip + limit) : merged;

    return res.json({
      success: true,
      page,
      limit: limit ?? total,
      total,
      returned: items.length,
      items,
    });
  } catch (err) {
    console.error("getCommonSavedData error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
