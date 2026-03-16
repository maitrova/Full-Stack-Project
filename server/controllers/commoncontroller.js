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
        .populate("category", "name thumbnail")
        .populate("subCategory", "name thumbnail")
        .select(
          "_id title productName description previewImage category subCategory stock salePrice calculatedPrice basePrice createdAt newArrivals bestSellers views product"
        )
        .sort({ createdAt: -1 })
        .lean(),

      ReadymadeProduct.find({})
        .populate("category", "name thumbnail")
        .populate("subCategory", "name thumbnail")
        .populate("brand", "name") // POPULATE BRAND NAME ONLY
        .select(
          "_id title description price salePrice saleStartAt saleEndAt currency category subCategory brand stock variants bestSeller newArrival images thumbnail createdAt"
        )
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    // Normalize designs
    const normalizedDesigns = designs.map((d) => {
      const category =
        typeof d.category === "string" ? d.category : d.category?.name || "";
      const subCategory =
        typeof d.subCategory === "string"
          ? d.subCategory
          : d.subCategory?.name || "";
      const categoryThumbnail =
        typeof d.category === "object" ? d.category?.thumbnail || null : null;
      const subCategoryThumbnail =
        typeof d.subCategory === "object"
          ? d.subCategory?.thumbnail || null
          : null;

      return {
        type: "design",
        _id: d._id,
        title: d.title || d.productName || "",
        description: d.description || "",
        previewImage: d.previewImage || null,
        category,
        categoryThumbnail,
        subCategory,
        subCategoryThumbnail,
        stock: d.stock ?? 0,
        price:
          (typeof d.salePrice === "number" && d.salePrice > 0
            ? d.salePrice
            : typeof d.calculatedPrice === "number" && d.calculatedPrice > 0
            ? d.calculatedPrice
            : d.basePrice) ?? 0,
        createdAt: d.createdAt,
        newArrival: Boolean(d.newArrivals),
        bestSeller: Boolean(d.bestSellers),
        featured: Boolean(d.featured),
        trending: Boolean(d.trending),
        rating: Number(d.rating ?? 0),
        totalSales: Number(d.totalSales ?? 0),
        raw: {
          product: d.product ? { _id: d.product } : null,
          productId: d.product || null,
          productName: d.productName || "",
          salePrice: d.salePrice ?? 0,
          calculatedPrice: d.calculatedPrice ?? 0,
          basePrice: d.basePrice ?? 0,
          newArrivals: Boolean(d.newArrivals),
          bestSellers: Boolean(d.bestSellers),
          featured: Boolean(d.featured),
          trending: Boolean(d.trending),
          views: Array.isArray(d.views)
            ? d.views.map((view) => ({
                previewImage: view?.previewImage || null,
              }))
            : [],
        },
      };
    });

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
        previewImage:
          pricedProduct.thumbnail ||
          pricedProduct.images?.[0]?.url ||
          pricedProduct.images?.[0] ||
          null,
        thumbnail:
          pricedProduct.thumbnail ||
          pricedProduct.images?.[0]?.url ||
          pricedProduct.images?.[0] ||
          null,

        category,
        categoryThumbnail,
        subCategory,
        subCategoryThumbnail,
        brand, // Clean brand name

        stock: pricedProduct.stock ?? 0,
        price: pricedProduct.effectivePrice ?? pricedProduct.price ?? 0,
        effectivePrice: pricedProduct.effectivePrice ?? pricedProduct.price ?? 0,
        mrp: pricedProduct.mrp ?? pricedProduct.price ?? 0,
        currency: pricedProduct.currency || "INR",
        createdAt: pricedProduct.createdAt,
        newArrival: Boolean(pricedProduct.newArrival),
        bestSeller: Boolean(pricedProduct.bestSeller),
        featured: Boolean(pricedProduct.featured),
        trending: Boolean(pricedProduct.trending),
        rating: Number(pricedProduct.rating ?? 0),
        totalSales: Number(pricedProduct.totalSales ?? 0),
        raw: {
          images: Array.isArray(pricedProduct.images) ? pricedProduct.images : [],
          thumbnail: pricedProduct.thumbnail || null,
          effectivePrice: pricedProduct.effectivePrice ?? pricedProduct.price ?? 0,
          mrp: pricedProduct.mrp ?? pricedProduct.price ?? 0,
          originalPrice: pricedProduct.mrp ?? pricedProduct.price ?? 0,
          newArrival: Boolean(pricedProduct.newArrival),
          bestSeller: Boolean(pricedProduct.bestSeller),
          featured: Boolean(pricedProduct.featured),
          trending: Boolean(pricedProduct.trending),
          variants: Array.isArray(pricedProduct.variants)
            ? pricedProduct.variants.map((variant) => ({
                size: variant?.size || "",
              }))
            : [],
          sizes: Array.isArray(pricedProduct.variants)
            ? pricedProduct.variants
                .map((variant) => variant?.size)
                .filter(Boolean)
            : [],
        },
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
