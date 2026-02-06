import ReadymadeProduct from "../models/readymadeproducts.js";
import fs from "fs/promises";
import path from "path";

/* 🔐 Safe file delete */
const safeDeleteFile = async (filePath) => {
  if (!filePath) return;

  const normalized = filePath.replace(/\\/g, "/");
  const absolutePath = path.resolve(normalized);
  const outputsRoot = path.resolve("outputs");

  // safety: only delete files inside outputs/
  if (!absolutePath.startsWith(outputsRoot)) return;

  try {
    await fs.unlink(absolutePath);
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
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
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v');
    
    const total = await ReadymadeProduct.countDocuments(query);
    
    res.status(200).json({
      success: true,
      data: products,
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
    
    let query = { isActive: true };
    
    if (category) query.category = category;
    if (subCategory) query.subCategory = subCategory;
    
    const skip = (page - 1) * limit;
    
    const products = await ReadymadeProduct.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v');
    
    const total = await ReadymadeProduct.countDocuments(query);
    
    res.status(200).json({
      success: true,
      data: products,
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
// Get product by ID
export const getReadymadeProductById = async (req, res) => {
  try {
    const product = await ReadymadeProduct.findById(req.params.id).select('-__v');
    if (!product) return res.status(404).json({ 
      success: false, 
      message: "Product not found" 
    });
    return res.status(200).json({ 
      success: true,
      data: product 
    });
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Get best seller products
export const getBestSellerProducts = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    
    const products = await ReadymadeProduct.find({ 
      bestSeller: true, 
      isActive: true 
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .select('-__v');
    
    const total = await ReadymadeProduct.countDocuments({ 
      bestSeller: true, 
      isActive: true 
    });
    
    res.status(200).json({
      success: true,
      data: products,
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

// Get new arrival products
export const getNewArrivalProducts = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    
    const products = await ReadymadeProduct.find({ 
      newArrival: true, 
      isActive: true 
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .select('-__v');
    
    const total = await ReadymadeProduct.countDocuments({ 
      newArrival: true, 
      isActive: true 
    });
    
    res.status(200).json({
      success: true,
      data: products,
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
      data: products,
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
      data: products,
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
      data: products,
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
    }
    
    // Apply category filters
    if (category) query.category = category;
    if (subCategory) query.subCategory = subCategory;
    
    // Search functionality
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    const skip = (page - 1) * limit;
    
    const products = await ReadymadeProduct.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v');
    
    const total = await ReadymadeProduct.countDocuments(query);
    
    res.status(200).json({
      success: true,
      data: products,
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
    const categories = await ReadymadeProduct.distinct("category");

    // Build "Category:SubCategory" pairs
    const pairs = await ReadymadeProduct.aggregate([
      { $match: { category: { $ne: "" }, subCategory: { $ne: "" } } },
      {
        $group: {
          _id: {
            category: { $trim: { input: "$category" } },
            subCategory: { $trim: { input: "$subCategory" } },
          },
        },
      },
      {
        $project: {
          _id: 0,
          pair: { $concat: ["$_id.category", ":", "$_id.subCategory"] },
        },
      },
    ]);

    const subCategories = pairs.map((p) => p.pair);

    res.status(200).json({
      success: true,
      data: {
        categories: categories.filter(Boolean).map((c) => c.trim()),
        subCategories: subCategories.filter(Boolean),
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
      variants, // <-- NEW (array or JSON string)

      // OPTIONAL: allow passing thumbnail URL as text too
      thumbnail: thumbnailFromBody,
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: "Title and description are required",
      });
    }

    // images/video/thumbnail
    const images =
      req.files?.images?.map((f) => f.path.replace(/\\/g, "/")) || [];

    const video = req.files?.video?.[0]?.path.replace(/\\/g, "/") || null;

    // ✅ NEW: thumbnail file (multipart)
    const thumbnailFromFile =
      req.files?.thumbnail?.[0]?.path.replace(/\\/g, "/") || null;

    if (images.length > 4) {
      return res.status(400).json({
        success: false,
        message: "Maximum 4 images allowed",
      });
    }

    // ✅ Decide thumbnail priority:
    // 1) uploaded thumbnail file
    // 2) thumbnail url from body
    // 3) fallback to first image (if exists)
    const thumbnail =
      thumbnailFromFile || thumbnailFromBody || images[0] || null;

    // Parse variants (because multipart/form-data sends it as string usually)
    let parsedVariants = variants;

    if (!parsedVariants) {
      return res.status(400).json({
        success: false,
        message: "Variants are required (size-wise price & stock).",
      });
    }

    if (typeof parsedVariants === "string") {
      try {
        parsedVariants = JSON.parse(parsedVariants);
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: "Invalid variants JSON format",
        });
      }
    }

    if (!Array.isArray(parsedVariants) || parsedVariants.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one variant is required",
      });
    }

    const ALLOWED_SIZES = new Set(["XS", "S", "M", "L", "XL", "XXL"]);

    // Normalize + validate variants
    const normalizedVariants = parsedVariants.map((v) => {
      const size = String(v.size || "").toUpperCase().trim();
      const price = Number(v.price);
      const stock = Number(v.stock ?? 0);

      if (!ALLOWED_SIZES.has(size)) {
        throw new Error(`Invalid size: ${v.size}`);
      }
      if (!Number.isFinite(price) || price < 0) {
        throw new Error(`Invalid price for size ${size}`);
      }
      if (!Number.isFinite(stock) || stock < 0) {
        throw new Error(`Invalid stock for size ${size}`);
      }

      return {
        size,
        price,
        stock,
        sku: v.sku ? String(v.sku).trim() : "",
      };
    });

    // No duplicate sizes
    const sizeSet = new Set();
    for (const v of normalizedVariants) {
      if (sizeSet.has(v.size)) {
        return res.status(400).json({
          success: false,
          message: `Duplicate size found: ${v.size}`,
        });
      }
      sizeSet.add(v.size);
    }

    // Optional: calculate total stock / default price (use smallest size price as base)
    const totalStock = normalizedVariants.reduce((sum, v) => sum + v.stock, 0);
    const basePrice = Math.min(...normalizedVariants.map((v) => v.price));

    const product = await ReadymadeProduct.create({
      title,
      description,

      // Keep these for compatibility (optional but useful)
      price: basePrice,
      stock: totalStock,

      currency: currency || "INR",
      category: category || "",
      subCategory: subCategory || "",
      brand: brand || "",

      variants: normalizedVariants,

      isActive:
        isActive !== undefined ? String(isActive).toLowerCase() === "true" : true,
      bestSeller:
        bestSeller !== undefined
          ? String(bestSeller).toLowerCase() === "true"
          : false,
      newArrival:
        newArrival !== undefined
          ? String(newArrival).toLowerCase() === "true"
          : false,

      images,
      thumbnail, // ✅ NEW FIELD
      video,
    });

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};



// Update product
export const updateReadymadeProduct = async (req, res) => {
  try {
    const product = await ReadymadeProduct.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // ---------- helpers ----------
    const toBool = (v) => {
      if (v === undefined || v === null) return undefined;
      if (typeof v === "boolean") return v;
      if (typeof v === "string") return v.toLowerCase() === "true";
      return Boolean(v);
    };

    // ---------- update normal fields ----------
    // NOTE: price/stock will be auto-calculated from variants if variants is provided
    const updatableFields = [
      "title",
      "description",
      "currency",
      "category",
      "subCategory",
      "brand",
      "isActive",
      "bestSeller",
      "newArrival",
      // OPTIONAL: allow thumbnail url update via body
      "thumbnail",
    ];

    for (const key of updatableFields) {
      if (req.body[key] !== undefined) {
        if (key === "isActive" || key === "bestSeller" || key === "newArrival") {
          const b = toBool(req.body[key]);
          if (b !== undefined) product[key] = b;
        } else {
          product[key] = req.body[key];
        }
      }
    }

    // ---------- update variants (NEW) ----------
    // Frontend can send variants as:
    // 1) JSON array (application/json)
    // 2) stringified JSON (multipart/form-data)
    if (req.body.variants !== undefined) {
      let parsedVariants = req.body.variants;

      if (typeof parsedVariants === "string") {
        try {
          parsedVariants = JSON.parse(parsedVariants);
        } catch {
          return res.status(400).json({
            success: false,
            message: "variants must be valid JSON array",
          });
        }
      }

      if (!Array.isArray(parsedVariants) || parsedVariants.length === 0) {
        return res.status(400).json({
          success: false,
          message: "At least one variant is required",
        });
      }

      const ALLOWED_SIZES = new Set(["XS", "S", "M", "L", "XL", "XXL"]);

      const normalizedVariants = parsedVariants.map((v) => {
        const size = String(v.size || "").toUpperCase().trim();
        const price = Number(v.price);
        const stock = Number(v.stock ?? 0);

        if (!ALLOWED_SIZES.has(size)) {
          throw new Error(`Invalid size: ${v.size}`);
        }
        if (!Number.isFinite(price) || price < 0) {
          throw new Error(`Invalid price for size ${size}`);
        }
        if (!Number.isFinite(stock) || stock < 0) {
          throw new Error(`Invalid stock for size ${size}`);
        }

        return {
          size,
          price,
          stock,
          sku: v.sku ? String(v.sku).trim() : "",
        };
      });

      // prevent duplicate sizes
      const sizeSet = new Set();
      for (const v of normalizedVariants) {
        if (sizeSet.has(v.size)) {
          return res.status(400).json({
            success: false,
            message: `Duplicate size found: ${v.size}`,
          });
        }
        sizeSet.add(v.size);
      }

      product.variants = normalizedVariants;

      // keep compatibility fields updated automatically
      product.stock = normalizedVariants.reduce((sum, v) => sum + v.stock, 0);
      product.price = Math.min(...normalizedVariants.map((v) => v.price));
    } else {
      // If variants NOT provided, allow legacy updates for price/stock (optional)
      if (req.body.price !== undefined) product.price = Number(req.body.price);
      if (req.body.stock !== undefined) product.stock = Number(req.body.stock);
    }

    // ---------- Remove selected images ----------
    let removeImages = [];
    if (req.body.removeImages) {
      try {
        removeImages = JSON.parse(req.body.removeImages);
        if (!Array.isArray(removeImages)) removeImages = [];
      } catch {
        return res.status(400).json({
          success: false,
          message: "removeImages must be valid JSON array",
        });
      }
    }

    if (removeImages.length) {
      await Promise.all(removeImages.map((p) => safeDeleteFile(p)));
      product.images = (product.images || []).filter((p) => !removeImages.includes(p));

      // ✅ If thumbnail was one of the removed images, clear it
      if (product.thumbnail && removeImages.includes(product.thumbnail)) {
        product.thumbnail = null;
      }
    }

    // ---------- Remove thumbnail if requested ----------
    const removeThumbnail = String(req.body.removeThumbnail) === "true";
    if (removeThumbnail && product.thumbnail) {
      await safeDeleteFile(product.thumbnail);
      product.thumbnail = null;
    }

    // ---------- Remove video if requested ----------
    const removeVideo = String(req.body.removeVideo) === "true";
    if (removeVideo && product.video) {
      await safeDeleteFile(product.video);
      product.video = null;
    }

    // ---------- Handle new uploads ----------
    const newImages = (req.files?.images || []).map((f) => f.path.replace(/\\/g, "/"));
    const newVideo = req.files?.video?.[0]?.path
      ? req.files.video[0].path.replace(/\\/g, "/")
      : null;

    // ✅ NEW: thumbnail file upload
    const newThumbnail = req.files?.thumbnail?.[0]?.path
      ? req.files.thumbnail[0].path.replace(/\\/g, "/")
      : null;

    const replaceImages = String(req.body.replaceImages) === "true";

    if (newImages.length) {
      if (replaceImages) {
        // if thumbnail is pointing to an existing image that is about to be deleted, clear it first
        if (product.thumbnail && (product.images || []).includes(product.thumbnail)) {
          product.thumbnail = null;
        }

        await Promise.all((product.images || []).map((p) => safeDeleteFile(p)));
        product.images = [];
      }

      const merged = [...(product.images || []), ...newImages];

      if (merged.length > 4) {
        await Promise.all(newImages.map((p) => safeDeleteFile(p)));
        return res.status(400).json({
          success: false,
          message: "Maximum 4 images allowed total",
        });
      }

      product.images = merged;
    }

    if (newVideo) {
      if (product.video) await safeDeleteFile(product.video);
      product.video = newVideo;
    }

    // ✅ If a new thumbnail uploaded, replace old thumbnail file
    if (newThumbnail) {
      if (product.thumbnail) await safeDeleteFile(product.thumbnail);
      product.thumbnail = newThumbnail;
    }

    // ✅ Final fallback: if thumbnail is empty but images exist, set first image
    if (!product.thumbnail && product.images && product.images.length > 0) {
      product.thumbnail = product.images[0];
    }

    await product.save();

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: product,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};



// Update multiple products for newArrival/bestSeller
export const updateProductList = async (req, res) => {
  try {
    const { productIds, action, value } = req.body;
    
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
    } else if (action === 'removeNewArrival') {
      updateField = 'newArrival';
      updateValue = false;
    } else if (action === 'removeBestSeller') {
      updateField = 'bestSeller';
      updateValue = false;
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
        message: "Product not found" 
      });
    }

    await Promise.all((product.images || []).map((img) => safeDeleteFile(img)));
    await safeDeleteFile(product.video);

    await ReadymadeProduct.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Product and media files deleted successfully",
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: err.message 
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

      // Group by category and take one product as representative
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          sample: { $first: "$$ROOT" }, // first after sort = latest product
        },
      },

      // ✅ Include thumbnail (prefer sample.thumbnail, fallback to first image)
      {
        $project: {
          _id: 0,
          category: "$_id",
          count: 1,

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

      // Remove empty category names
      { $match: { category: { $ne: null, $ne: "" } } },

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
