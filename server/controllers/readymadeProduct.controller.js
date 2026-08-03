import ReadymadeProduct from "../models/readymadeproducts.js";
import Category from "../models/Category.js";
import SubCategory from "../models/SubCategory.js";
import { attachReadymadePricing } from "../utils/readymadePricing.js";
import { markAffectedCombosForReview } from "./comboPackController.js";
import {
  createReadymadeThumbnail,
  deleteOptimizedImageSet,
  normalizeStoredPath,
  optimizeUploadedImage,
} from "../utils/imageOptimization.js";

/* 🔐 Safe file delete */
const safeDeleteFile = async (filePath) => {
  await deleteOptimizedImageSet(filePath);
};

const parseOptionalNumber = (value) => {
  if (Array.isArray(value)) {
    value = value[0];
  }
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (
      normalized === "" ||
      normalized === "null" ||
      normalized === "undefined" ||
      normalized === "nan"
    ) {
      return null;
    }
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error("Invalid numeric value");
  }
  return numeric;
};

const parseOptionalDate = (value) => {
  if (Array.isArray(value)) {
    value = value[0];
  }
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (
      normalized === "" ||
      normalized === "null" ||
      normalized === "undefined" ||
      normalized === "nan"
    ) {
      return null;
    }
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date value");
  }
  return date;
};

const normalizePaymentOptions = (value, fallback = ["COD", "ONLINE"]) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  let options = value;
  if (typeof options === "string") {
    const trimmed = options.trim();
    if (!trimmed) return fallback;
    options = trimmed.startsWith("[") ? JSON.parse(trimmed) : trimmed.split(",");
  }

  if (!Array.isArray(options)) {
    throw new Error("paymentOptions must be an array");
  }

  const normalized = [
    ...new Set(options.map((option) => String(option || "").trim().toUpperCase())),
  ].filter(Boolean);

  const allowed = new Set(["COD", "ONLINE"]);
  if (!normalized.length || normalized.some((option) => !allowed.has(option))) {
    throw new Error("Select COD, online, or both payment options");
  }

  return normalized;
};

const normalizeRouteSegment = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const normalizeUploadedPath = (file) => normalizeStoredPath(file?.path);

const optimizeSizeChartUpload = async (file) => {
  if (!file?.path) return null;

  const optimizedChart = await optimizeUploadedImage(normalizeUploadedPath(file), {
    cleanupSource: true,
    outputDir: "outputs/readymade-products/size-chart",
    baseName: `${Date.now()}-${file.originalname || "size-chart"}`,
    widths: {
      small: 600,
      medium: 1200,
      blur: 24,
    },
    qualities: {
      small: 74,
      medium: 82,
      blur: 40,
    },
  });

  return optimizedChart.url;
};

const mapUploadedImages = async (files, altTexts = []) =>
  Promise.all(
    (files || []).map(async (file, index) => {
      const optimizedImage = await optimizeUploadedImage(normalizeUploadedPath(file), {
        cleanupSource: true,
      });

      return {
        url: optimizedImage.url,
        altText: altTexts[index] || "",
      };
    })
  );

const generateThumbnailForProduct = async ({
  uploadedThumbnailPath,
  thumbnailFromBody,
  firstImagePath,
}) => {
  if (uploadedThumbnailPath) {
    return (
      (await createReadymadeThumbnail(uploadedThumbnailPath, {
        cleanupSource: true,
      })) || uploadedThumbnailPath
    );
  }

  if (thumbnailFromBody) {
    return thumbnailFromBody;
  }

  if (firstImagePath) {
    if (/-md\.webp$/i.test(firstImagePath)) {
      return firstImagePath;
    }
    return (await createReadymadeThumbnail(firstImagePath)) || firstImagePath;
  }

  return null;
};

/* ==================== PUBLIC CONTROLLERS ==================== */

// Get all products (with optional filtering)
export const getAllReadymadeProducts = async (req, res) => {
  try {
    const { isActive, page = 1, limit = 20 } = req.query;
    
    let query = {};
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    const skip = (page - 1) * limit;
    
    const products = await ReadymadeProduct.find(query)
      .populate("category", "name")
      .populate("subCategory", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v');
    
    const total = await ReadymadeProduct.countDocuments(query);
    
    res.status(200).json({
      success: true,
      data: products.map((product) => attachReadymadePricing(product.toObject())),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Get all active products for public (no auth required)
export const getAllReadymadeProductsPublic = async (req, res) => {
  try {
    const { category, subCategory, page = 1, limit = 100 } = req.query;

    const query = { isActive: true };
    if (category) query.category = category;
    if (subCategory) query.subCategory = subCategory;

    const pageNum = Math.max(parseInt(page, 10), 1);
    const limitNum = Math.min(parseInt(limit, 10), 1000);
    const skip = (pageNum - 1) * limitNum;

    const products = await ReadymadeProduct.find(query)
      .populate("category", "name")       // used internally only
      .populate("subCategory", "name")    // used internally only
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .select("-__v")
      .lean();

    // ✅ FLATTEN → keep response unchanged
    const normalizedProducts = products.map((p) => attachReadymadePricing({
      ...p,
      category:
        typeof p.category === "string"
          ? p.category
          : p.category?.name || "",
      subCategory:
        typeof p.subCategory === "string"
          ? p.subCategory
          : p.subCategory?.name || "",
    }));

    const total = await ReadymadeProduct.countDocuments(query);

    res.status(200).json({
      success: true,
      data: normalizedProducts,   // 👈 unchanged shape
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("getAllReadymadeProductsPublic error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};



// Get product by ID
export const getReadymadeProductById = async (req, res) => {
  try {

    const product = await ReadymadeProduct.findById(req.params.id)
      .populate("category", "name")
      .populate("subCategory", "name")
      .populate("brand", "name")
      .select("-__v")
      .lean(); // important

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // ✅ Convert populated objects → only name
    product.category = product.category?.name || null;
    product.subCategory = product.subCategory?.name || null;
    product.brand = product.brand?.name || null;

    return res.status(200).json({
      success: true,
      data: attachReadymadePricing(product)
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getReadymadeProductByPath = async (req, res) => {
  try {
    const { category, subCategory, productSlug } = req.params;

    const products = await ReadymadeProduct.find({ isActive: true })
      .populate("category", "name")
      .populate("subCategory", "name")
      .populate("brand", "name")
      .select("-__v")
      .lean();

    const matchedProduct = products.find((product) => {
      const productCategory =
        typeof product.category === "string" ? product.category : product.category?.name || "";
      const productSubCategory =
        typeof product.subCategory === "string" ? product.subCategory : product.subCategory?.name || "";
      const productTitle = product.title || "";

      return (
        normalizeRouteSegment(productCategory) === normalizeRouteSegment(category) &&
        normalizeRouteSegment(productSubCategory) === normalizeRouteSegment(subCategory) &&
        normalizeRouteSegment(productTitle) === normalizeRouteSegment(productSlug)
      );
    });

    if (!matchedProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    matchedProduct.category =
      typeof matchedProduct.category === "string"
        ? matchedProduct.category
        : matchedProduct.category?.name || null;
    matchedProduct.subCategory =
      typeof matchedProduct.subCategory === "string"
        ? matchedProduct.subCategory
        : matchedProduct.subCategory?.name || null;
    matchedProduct.brand =
      typeof matchedProduct.brand === "string"
        ? matchedProduct.brand
        : matchedProduct.brand?.name || null;

    return res.status(200).json({
      success: true,
      data: attachReadymadePricing(matchedProduct),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// Get best seller products
export const getBestSellerProducts = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const products = await ReadymadeProduct.find({
      bestSeller: true,
      isActive: true
    })
      .populate('category', 'name')       // populate only name
      .populate('subCategory', 'name')    // populate only name
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber)
      .select('-__v')
      .lean();   // important for modifying response

    // 🔥 Keep fields unchanged (convert object → string)
    const formattedProducts = products.map(product => attachReadymadePricing({
      ...product,
      category: product.category?.name || null,
      subCategory: product.subCategory?.name || null,
    }));

    const total = await ReadymadeProduct.countDocuments({
      bestSeller: true,
      isActive: true
    });

    res.status(200).json({
      success: true,
      data: formattedProducts,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        pages: Math.ceil(total / limitNumber)
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// Get new arrival products
export const getNewArrivalProducts = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const products = await ReadymadeProduct.find({
      newArrival: true,
      isActive: true
    })
      .populate('category', 'name')
      .populate('subCategory', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber)
      .select('-__v')
      .lean();   // Important for modifying response

    // 🔥 Keep fields unchanged (convert populated object → string)
    const formattedProducts = products.map(product => attachReadymadePricing({
      ...product,
      category: product.category?.name || null,
      subCategory: product.subCategory?.name || null,
    }));

    const total = await ReadymadeProduct.countDocuments({
      newArrival: true,
      isActive: true
    });

    res.status(200).json({
      success: true,
      data: formattedProducts,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        pages: Math.ceil(total / limitNumber) // fixed
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// Get products by category
export const getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    
    const products = await ReadymadeProduct.find({ 
      category, 
      isActive: true 
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .select('-__v');
    
    const total = await ReadymadeProduct.countDocuments({ 
      category, 
      isActive: true 
    });
    
    res.status(200).json({
      success: true,
      data: products.map((product) => attachReadymadePricing(product.toObject())),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Get products by sub-category
export const getProductsBySubCategory = async (req, res) => {
  try {
    const { subCategory } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    
    const products = await ReadymadeProduct.find({ 
      subCategory, 
      isActive: true 
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .select('-__v');
    
    const total = await ReadymadeProduct.countDocuments({ 
      subCategory, 
      isActive: true 
    });
    
    res.status(200).json({
      success: true,
      data: products.map((product) => attachReadymadePricing(product.toObject())),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Search products
export const searchProducts = async (req, res) => {
  try {
    const { q: searchTerm, page = 1, limit = 20 } = req.query;
    
    if (!searchTerm) {
      return res.status(400).json({
        success: false,
        message: "Search term is required"
      });
    }
    
    const skip = (page - 1) * limit;
    
    const products = await ReadymadeProduct.find({
      $and: [
        { isActive: true },
        {
          $or: [
            { title: { $regex: searchTerm, $options: 'i' } },
            { description: { $regex: searchTerm, $options: 'i' } },
            { category: { $regex: searchTerm, $options: 'i' } },
            { subCategory: { $regex: searchTerm, $options: 'i' } },
            { brand: { $regex: searchTerm, $options: 'i' } }
          ]
        }
      ]
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .select('-__v');
    
    const total = await ReadymadeProduct.countDocuments({
      $and: [
        { isActive: true },
        {
          $or: [
            { title: { $regex: searchTerm, $options: 'i' } },
            { description: { $regex: searchTerm, $options: 'i' } },
            { category: { $regex: searchTerm, $options: 'i' } },
            { subCategory: { $regex: searchTerm, $options: 'i' } },
            { brand: { $regex: searchTerm, $options: 'i' } }
          ]
        }
      ]
    });
    
    res.status(200).json({
      success: true,
      data: products.map((product) => attachReadymadePricing(product.toObject())),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Get filtered products (admin panel)
export const getFilteredProducts = async (req, res) => {
  try {
    const { filter, category, subCategory, search, page = 1, limit = 20 } = req.query;

    let query = {};

    // Apply filter
    if (filter === 'newArrival') {
      query.newArrival = true;
    } else if (filter === 'bestSeller') {
      query.bestSeller = true;
    } else if (filter === 'topOrder') {
      query.topOrder = true;
    }

    // Apply category filters by display name or id.
    let categoryId = null;
    if (category) {
      const categoryValue = String(category).trim();
      const categoryDoc = await Category.findOne({
        $or: [
          { _id: categoryValue.match(/^[0-9a-fA-F]{24}$/) ? categoryValue : undefined },
          { name: { $regex: `^${categoryValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } },
        ].filter((condition) => condition._id !== undefined || condition.name),
      }).select("_id");

      if (!categoryDoc) {
        query._id = { $exists: false };
      } else {
        categoryId = categoryDoc._id;
        query.category = categoryId;
      }
    }

    if (subCategory) {
      const subCategoryValue = String(subCategory).trim();
      const subCategoryQuery = {
        $or: [
          { _id: subCategoryValue.match(/^[0-9a-fA-F]{24}$/) ? subCategoryValue : undefined },
          { name: { $regex: `^${subCategoryValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } },
        ].filter((condition) => condition._id !== undefined || condition.name),
      };

      if (categoryId) {
        subCategoryQuery.category = categoryId;
      }

      const subCategoryDoc = await SubCategory.findOne(subCategoryQuery).select("_id");
      if (!subCategoryDoc) {
        query._id = { $exists: false };
      } else {
        query.subCategory = subCategoryDoc._id;
      }
    }

    // Search functionality
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;

    const products = await ReadymadeProduct.find(query)
      .populate('category', 'name')       // ✅ populate category
      .populate('subCategory', 'name')    // ✅ populate subCategory
      .sort(filter === 'topOrder' ? { topOrderAt: -1, createdAt: -1 } : { createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v');

    const total = await ReadymadeProduct.countDocuments(query);

    // ✅ Transform response to keep fields unchanged
    const formattedProducts = products.map(product => {
      const obj = product.toObject();

      return attachReadymadePricing({
        ...obj,
        category: obj.category?.name || obj.category,
        subCategory: obj.subCategory?.name || obj.subCategory,
      });
    });

    res.status(200).json({
      success: true,
      data: formattedProducts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// Get distinct categories and subcategories
export const getProductFilters = async (req, res) => {
  try {
    const products = await ReadymadeProduct.find({})
      .select("category subCategory")
      .populate("category", "name")
      .populate("subCategory", "name")
      .lean();

    const categories = [];
    const subCategories = [];
    const categorySet = new Set();
    const subCategorySet = new Set();

    products.forEach((product) => {
      const categoryName = product.category?.name || "";
      const subCategoryName = product.subCategory?.name || "";

      if (categoryName && !categorySet.has(categoryName)) {
        categorySet.add(categoryName);
        categories.push(categoryName);
      }

      if (categoryName && subCategoryName) {
        const pair = `${categoryName}:${subCategoryName}`;
        if (!subCategorySet.has(pair)) {
          subCategorySet.add(pair);
          subCategories.push(pair);
        }
      }
    });

    res.status(200).json({
      success: true,
      data: {
        categories: categories.sort((a, b) => a.localeCompare(b)),
        subCategories: subCategories.sort((a, b) => a.localeCompare(b)),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


/* ==================== ADMIN CONTROLLERS ==================== */

// Create product
// controllers/readymadeProductController.js
// CREATE PRODUCT
export const createReadymadeProduct = async (req, res) => {
  try {
    const {
      title,
      description,
      currency,
      category,
      subCategory,
      brand,
      isActive,
      bestSeller,
      newArrival,
      variants,
      salePrice,
      saleStartAt,
      saleEndAt,
      paymentOptions,
      thumbnail: thumbnailFromBody,
      imageAltTexts, // ✅ correct field
    } = req.body;

    if (!title || !description)
      return res.status(400).json({
        success: false,
        message: "Title and description are required",
      });

    if (!category || !brand)
      return res.status(400).json({
        success: false,
        message: "Category and Brand are required",
      });

    // ✅ parse alt texts
    let parsedAltTexts = [];
    if (imageAltTexts) {
      try {
        parsedAltTexts = JSON.parse(imageAltTexts);
      } catch {
        return res.status(400).json({
          success: false,
          message: "imageAltTexts must be valid JSON array",
        });
      }
    }

    // ✅ create image objects
    const images = await mapUploadedImages(req.files?.images, parsedAltTexts);

    if (images.length > 6)
      return res.status(400).json({
        success: false,
        message: "Maximum 6 images allowed",
      });

    // video
    const video = normalizeUploadedPath(req.files?.video?.[0]);

    // thumbnail
    const thumbnail = await generateThumbnailForProduct({
      uploadedThumbnailPath: normalizeUploadedPath(req.files?.thumbnail?.[0]),
      thumbnailFromBody,
      firstImagePath: images[0]?.url || null,
    });
    const sizeChart = await optimizeSizeChartUpload(req.files?.sizeChart?.[0]);
      
      

    // variants
    let parsedVariants =
      typeof variants === "string" ? JSON.parse(variants) : variants;

    if (!Array.isArray(parsedVariants) || parsedVariants.length === 0)
      return res.status(400).json({
        success: false,
        message: "At least one variant required",
      });

    const ALLOWED_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

    const normalizedVariants = parsedVariants.map((v) => {
      const size = v.size.toUpperCase();
      if (!ALLOWED_SIZES.includes(size))
        throw new Error(`Invalid size ${size}`);

      return {
        size,
        price: Number(v.price),
        stock: Number(v.stock || 0),
        sku: v.sku || "",
      };
    });

    const totalStock = normalizedVariants.reduce(
      (sum, v) => sum + v.stock,
      0
    );

    const basePrice = Math.min(
      ...normalizedVariants.map((v) => v.price)
    );

    const parsedSalePrice = parseOptionalNumber(salePrice);
    const parsedSaleStartAt = parseOptionalDate(saleStartAt);
    const parsedSaleEndAt = parseOptionalDate(saleEndAt);

    const product = await ReadymadeProduct.create({
      title,
      description,
      price: basePrice,
      stock: totalStock,
      currency: currency || "INR",

      category,
      subCategory,
      brand,

      variants: normalizedVariants,
      salePrice: parsedSalePrice,
      saleStartAt: parsedSaleStartAt,
      saleEndAt: parsedSaleEndAt,

      isActive: isActive === "true",
      bestSeller: bestSeller === "true",
      newArrival: newArrival === "true",
      paymentOptions: normalizePaymentOptions(paymentOptions),

      images, // ✅ correct format
      thumbnail,
      video,
      sizeChart,
    });

    res.status(201).json({
      success: true,
      data: attachReadymadePricing(product.toObject()),
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};






// update product
export const updateReadymadeProduct = async (req, res) => {
  try {
    const product = await ReadymadeProduct.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const {
      title,
      description,
      currency,
      category,
      subCategory,
      brand,
      isActive,
      bestSeller,
      newArrival,
      variants,
      salePrice,
      saleStartAt,
      saleEndAt,
      paymentOptions,
      thumbnail: thumbnailFromBody,
      imageAltTexts,
    } = req.body;

    // ✅ Update basic fields only if provided
    if (title) product.title = title;
    if (description) product.description = description;
    if (currency) product.currency = currency;
    if (category) product.category = category;
    if (subCategory) product.subCategory = subCategory;
    if (brand) product.brand = brand;

    if (isActive !== undefined)
      product.isActive = isActive === "true";

    if (bestSeller !== undefined)
      product.bestSeller = bestSeller === "true";

    if (newArrival !== undefined)
      product.newArrival = newArrival === "true";

    if (paymentOptions !== undefined) {
      product.paymentOptions = normalizePaymentOptions(
        paymentOptions,
        product.paymentOptions
      );
    }

    if (salePrice !== undefined) {
      product.salePrice = parseOptionalNumber(salePrice);
    }

    if (saleStartAt !== undefined) {
      product.saleStartAt = parseOptionalDate(saleStartAt);
    }

    if (saleEndAt !== undefined) {
      product.saleEndAt = parseOptionalDate(saleEndAt);
    }

    // ✅ Parse alt texts
    let parsedAltTexts = [];
    if (imageAltTexts) {
      try {
        parsedAltTexts = JSON.parse(imageAltTexts);
      } catch {
        return res.status(400).json({
          success: false,
          message: "imageAltTexts must be valid JSON array",
        });
      }
    }

    // ✅ Update Images (if new ones uploaded)
    if (req.files?.images) {
      const newImages = await mapUploadedImages(req.files.images, parsedAltTexts);

      if (newImages.length > 6) {
        return res.status(400).json({
          success: false,
          message: "Maximum 6 images allowed",
        });
      }

      await Promise.all(
        (product.images || []).map((img) =>
          safeDeleteFile(typeof img === "string" ? img : img.url)
        )
      );

      product.images = newImages;
    }

    // ✅ Update video
    if (req.files?.video?.[0]) {
      if (product.video) {
        await safeDeleteFile(product.video);
      }
      product.video = normalizeUploadedPath(req.files.video[0]);
    }

    // ✅ Update thumbnail
    const currentThumbnail = product.thumbnail;
    const uploadedThumbnailPath = normalizeUploadedPath(req.files?.thumbnail?.[0]);
    const shouldRefreshThumbnail =
      Boolean(uploadedThumbnailPath) ||
      thumbnailFromBody !== undefined ||
      Boolean(req.files?.images);

    if (shouldRefreshThumbnail) {
      const nextThumbnail = await generateThumbnailForProduct({
        uploadedThumbnailPath,
        thumbnailFromBody,
        firstImagePath: product.images?.[0]?.url || null,
      });

      product.thumbnail = nextThumbnail;

      if (currentThumbnail && currentThumbnail !== nextThumbnail) {
        await safeDeleteFile(currentThumbnail);
      }
    }

    // ✅ Update size chart
    if (req.files?.sizeChart?.[0]) {
      if (product.sizeChart) {
        await safeDeleteFile(product.sizeChart);
      }
      product.sizeChart = await optimizeSizeChartUpload(req.files.sizeChart[0]);
    }

    // ✅ Update variants (if provided)
    if (variants) {
      let parsedVariants =
        typeof variants === "string"
          ? JSON.parse(variants)
          : variants;

      if (!Array.isArray(parsedVariants) || parsedVariants.length === 0) {
        return res.status(400).json({
          success: false,
          message: "At least one variant required",
        });
      }

      const ALLOWED_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

      const normalizedVariants = parsedVariants.map((v) => {
        const size = v.size.toUpperCase();

        if (!ALLOWED_SIZES.includes(size))
          throw new Error(`Invalid size ${size}`);

        return {
          size,
          price: Number(v.price),
          stock: Number(v.stock || 0),
          sku: v.sku || "",
        };
      });

      const totalStock = normalizedVariants.reduce(
        (sum, v) => sum + v.stock,
        0
      );

      const basePrice = Math.min(
        ...normalizedVariants.map((v) => v.price)
      );

      product.variants = normalizedVariants;
      product.stock = totalStock;
      product.price = basePrice;
    }

    await product.save();

    res.status(200).json({
      success: true,
      data: attachReadymadePricing(product.toObject()),
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};



// Update multiple products for newArrival/bestSeller
export const updateProductList = async (req, res) => {
  try {
    const { productIds, action, value, tag, tags } = req.body;
    
    if (!productIds || !action) {
      return res.status(400).json({
        success: false,
        message: 'productIds and action are required'
      });
    }
    
    let updateField;
    let updateValue;
    
    if (action === 'setNewArrival') {
      updateField = 'newArrival';
      updateValue = value !== undefined ? value : true;
    } else if (action === 'setBestSeller') {
      updateField = 'bestSeller';
      updateValue = value !== undefined ? value : true;
    } else if (action === 'setTopOrder') {
      const topOrderValue = value !== undefined ? Boolean(value) : true;
      let modifiedCount = 0;

      if (topOrderValue) {
        const defaultTag = "Most Popular";
        const tagByProductId = tags && typeof tags === "object" ? tags : {};
        const fallbackTag = typeof tag === "string" && tag.trim() ? tag.trim() : defaultTag;

        const results = await Promise.all(
          productIds.map((productId) => {
            const rawTag = tagByProductId[String(productId)];
            const productTag =
              typeof rawTag === "string" && rawTag.trim() ? rawTag.trim() : fallbackTag;

            return ReadymadeProduct.updateOne(
              { _id: productId },
              { topOrder: true, topOrderTag: productTag, topOrderAt: new Date() }
            );
          })
        );

        modifiedCount = results.reduce(
          (total, result) => total + (result.modifiedCount || 0),
          0
        );
      } else {
        const result = await ReadymadeProduct.updateMany(
          { _id: { $in: productIds } },
          { topOrder: false, topOrderTag: "", topOrderAt: null }
        );
        modifiedCount = result.modifiedCount;
      }

      return res.status(200).json({
        success: true,
        message: `Updated ${modifiedCount} products`,
        data: {
          modifiedCount
        }
      });
    } else if (action === 'removeNewArrival') {
      updateField = 'newArrival';
      updateValue = false;
    } else if (action === 'removeBestSeller') {
      updateField = 'bestSeller';
      updateValue = false;
    } else if (action === 'removeTopOrder') {
      const result = await ReadymadeProduct.updateMany(
        { _id: { $in: productIds } },
        { topOrder: false, topOrderTag: "", topOrderAt: null }
      );

      return res.status(200).json({
        success: true,
        message: `Updated ${result.modifiedCount} products`,
        data: {
          modifiedCount: result.modifiedCount
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid action'
      });
    }
    
    const result = await ReadymadeProduct.updateMany(
      { _id: { $in: productIds } },
      { [updateField]: updateValue }
    );
    
    res.status(200).json({
      success: true,
      message: `Updated ${result.modifiedCount} products`,
      data: {
        modifiedCount: result.modifiedCount
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Delete product
export const deleteReadymadeProduct = async (req, res) => {
  try {

    const product = await ReadymadeProduct.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // delete images safely
    await Promise.all(
      (product.images || []).map((img) =>
        safeDeleteFile(typeof img === "string" ? img : img.url)
      )
    );

    // delete thumbnail
    if (product.thumbnail) {
      await safeDeleteFile(product.thumbnail);
    }

    // delete video
    if (product.video) {
      await safeDeleteFile(product.video);
    }

    await ReadymadeProduct.findByIdAndDelete(req.params.id);
    await markAffectedCombosForReview(req.params.id, "A selected product was deleted");

    res.status(200).json({
      success: true,
      message: "Product and media files deleted successfully",
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      message: err.message,
    });

  }
};

// Toggle product status
export const toggleProductStatus = async (req, res) => {
  try {
    const product = await ReadymadeProduct.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ 
        success: false,
        message: "Product not found" 
      });
    }

    product.isActive = !product.isActive;
    await product.save();
    if (product.isActive === false) {
      await markAffectedCombosForReview(product._id, "A selected product was disabled");
    }

    res.status(200).json({
      success: true,
      message: `Product ${product.isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        isActive: product.isActive
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};



// Get home category tiles
export const getHomeCategoryTiles = async (req, res) => {
  try {
    const onlyActive = (req.query.onlyActive ?? "true") === "true";
    const limit = Math.min(parseInt(req.query.limit || "12", 10), 50);

    const match = {};
    if (onlyActive) match.isActive = true;

    const categories = await ReadymadeProduct.aggregate([
      { $match: match },
      { $sort: { createdAt: -1 } }, // latest products first

      // Group by category ObjectId
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          sample: { $first: "$$ROOT" },
        },
      },

      // 🔹 Lookup category details
      {
        $lookup: {
          from: "categories",          // collection name
          localField: "_id",
          foreignField: "_id",
          as: "categoryData",
        },
      },

      // Convert array → object
      {
        $unwind: {
          path: "$categoryData",
          preserveNullAndEmptyArrays: false,
        },
      },

      // ✅ Final projection (SAME response fields)
      {
        $project: {
          _id: 0,

          // SAME FIELD NAME, now populated
          category: "$categoryData.name",

          count: 1,

          // keep old image behavior
          image: {
            $cond: [
              { $gt: [{ $size: "$sample.images" }, 0] },
              { $arrayElemAt: ["$sample.images", 0] },
              null,
            ],
          },

          // category thumbnail (preferred)
          thumbnail: {
            $ifNull: [
              "$categoryData.thumbnail",
              {
                $cond: [
                  { $gt: [{ $size: "$sample.images" }, 0] },
                  { $arrayElemAt: ["$sample.images", 0] },
                  null,
                ],
              },
            ],
          },
        },
      },

      // Safety: remove empty names
      { $match: { category: { $ne: "", $ne: null } } },

      { $sort: { category: 1 } },
      { $limit: limit },
    ]);

    return res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error("getHomeCategoryTiles error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load home categories",
    });
  }
};



export const getHomeSubCategoryTiles = async (req, res) => {
  try {
    const onlyActive = (req.query.onlyActive ?? "true") === "true";
    const limit = Math.min(parseInt(req.query.limit || "12", 10), 50);

    // optional filter: get subcategories only for a category
    const categoryFilter = (req.query.category || "").trim();

    const match = {};
    if (onlyActive) match.isActive = true;
    if (categoryFilter) match.category = categoryFilter;

    const subCategories = await ReadymadeProduct.aggregate([
      { $match: match },
      { $sort: { createdAt: -1 } }, // latest products first

      // Group by subCategory and take one product as representative
      {
        $group: {
          _id: "$subCategory",
          count: { $sum: 1 },
          sample: { $first: "$$ROOT" }, // first after sort = latest product
        },
      },

      // ✅ Include thumbnail (prefer sample.thumbnail, fallback to first image)
      {
        $project: {
          _id: 0,
          subCategory: "$_id",
          count: 1,

          // optional: include category of sample for UI
          category: "$sample.category",

          // keep old field if you already use it in UI
          image: {
            $cond: [
              { $gt: [{ $size: "$sample.images" }, 0] },
              { $arrayElemAt: ["$sample.images", 0] },
              null,
            ],
          },

          // new field
          thumbnail: {
            $ifNull: [
              "$sample.thumbnail",
              {
                $cond: [
                  { $gt: [{ $size: "$sample.images" }, 0] },
                  { $arrayElemAt: ["$sample.images", 0] },
                  null,
                ],
              },
            ],
          },
        },
      },

      // Remove empty subCategory names
      { $match: { subCategory: { $ne: null, $ne: "" } } },

      { $sort: { subCategory: 1 } },
      { $limit: limit },
    ]);

    return res.status(200).json({
      success: true,
      data: subCategories,
    });
  } catch (error) {
    console.error("getHomeSubCategoryTiles error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load home sub categories",
    });
  }
};
