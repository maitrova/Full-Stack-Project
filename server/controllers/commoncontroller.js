import { Design } from "../models/Design.js";
import ReadymadeProduct from "../models/readymadeproducts.js";

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
    // Safe pagination
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit || "50", 10), 1),
      200
    );
    const skip = (page - 1) * limit;

    // Fetch data
    const [designs, readymades] = await Promise.all([
      Design.find({ isPublished: true })
        .sort({ createdAt: -1 })
        .lean(),

      ReadymadeProduct.find({})
        .populate("category", "name thumbnail")
        .populate("subCategory", "name thumbnail")
        .populate("brand", "name") // ✅ POPULATE BRAND NAME ONLY
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
      const category =
        typeof p.category === "string"
          ? p.category
          : p.category?.name || "";

      const categoryThumbnail =
        typeof p.category === "object"
          ? p.category?.thumbnail || null
          : null;

      const subCategory =
        typeof p.subCategory === "string"
          ? p.subCategory
          : p.subCategory?.name || "";

      const subCategoryThumbnail =
        typeof p.subCategory === "object"
          ? p.subCategory?.thumbnail || null
          : null;

      const brand =
        typeof p.brand === "string"
          ? p.brand
          : p.brand?.name || ""; // ✅ BRAND NAME ONLY

      return {
        type: "readymade",
        _id: p._id,
        title: p.title || "",
        description: p.description || "",
        previewImage: p.images?.[0] || null,

        category,
        categoryThumbnail,
        subCategory,
        subCategoryThumbnail,
        brand, // ✅ Clean brand name

        stock: p.stock ?? 0,
        price: p.price ?? 0,
        currency: p.currency || "INR",
        createdAt: p.createdAt,
        raw: p,
      };
    });

    // Merge and sort newest first
    const merged = [...normalizedDesigns, ...normalizedReadymades].sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime()
    );

    // Apply pagination AFTER merge
    const total = merged.length;
    const paged = merged.slice(skip, skip + limit);

    return res.json({
      success: true,
      page,
      limit,
      total,
      returned: paged.length,
      items: paged,
    });
  } catch (err) {
    console.error("getCommonSavedData error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};



