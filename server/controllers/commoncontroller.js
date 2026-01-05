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
    // Optional pagination (keeps it safe)
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "50", 10), 1), 200);
    const skip = (page - 1) * limit;

    // ✅ Fetch EVERYTHING (no isPublished / isActive restriction)
    const [designs, readymades] = await Promise.all([
      Design.find({ isPublished: true })   // filter added here
        .sort({ createdAt: -1 })
        .lean(),
      ReadymadeProduct.find({})
        .sort({ createdAt: -1 })
        .lean(),
    ]);


    // Normalize into one common shape
    const normalizedDesigns = designs.map((d) => ({
      type: "design",
      _id: d._id,
      title: d.title || d.productName || "",
      description: d.description || "",
      previewImage: d.previewImage || null,
      category: d.category || "",
      subCategory: d.subCategory || "",
      stock: d.stock ?? 0,
      // best effort price for designs
      price:
        (typeof d.salePrice === "number" && d.salePrice > 0
          ? d.salePrice
          : typeof d.calculatedPrice === "number" && d.calculatedPrice > 0
          ? d.calculatedPrice
          : d.basePrice) ?? 0,
      createdAt: d.createdAt,
      raw: d,
    }));

    const normalizedReadymades = readymades.map((p) => ({
      type: "readymade",
      _id: p._id,
      title: p.title || "",
      description: p.description || "",
      previewImage: Array.isArray(p.images) && p.images.length ? p.images[0] : null,
      category: p.category || "",
      subCategory: p.subCategory || "",
      stock: p.stock ?? 0,
      price: p.price ?? 0,
      currency: p.currency || "INR",
      createdAt: p.createdAt,
      raw: p,
    }));

    // Merge + sort newest first
    const merged = [...normalizedDesigns, ...normalizedReadymades].sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );

    // Apply pagination AFTER merge (true common paging)
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
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

