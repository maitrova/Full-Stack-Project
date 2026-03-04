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

    const query = { isActive: true };
    if (category) query.category = category;
    if (subCategory) query.subCategory = subCategory;

    const pageNum = Math.max(parseInt(page, 10), 1);
    const limitNum = Math.min(parseInt(limit, 10), 200);
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
    const normalizedProducts = products.map((p) => ({
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
    const formattedProducts = products.map(product => ({
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
    const formattedProducts = products.map(product => ({
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
      .populate('category', 'name')       // ✅ populate category
      .populate('subCategory', 'name')    // ✅ populate subCategory
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v');

    const total = await ReadymadeProduct.countDocuments(query);

    // ✅ Transform response to keep fields unchanged
    const formattedProducts = products.map(product => {
      const obj = product.toObject();

      return {
        ...obj,
        category: obj.category?.name || obj.category,
        subCategory: obj.subCategory?.name || obj.subCategory,
      };
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
    const images =
      (req.files?.images || []).map((file, index) => ({
        url: file.path.replace(/\\/g, "/"),
        altText: parsedAltTexts[index] || "",
      })) || [];

    if (images.length > 4)
      return res.status(400).json({
        success: false,
        message: "Maximum 4 images allowed",
      });

    // video
    const video =
      req.files?.video?.[0]?.path.replace(/\\/g, "/") || null;

    // thumbnail
    const thumbnailFromFile =
      req.files?.thumbnail?.[0]?.path.replace(/\\/g, "/") || null;

    const thumbnail =
      thumbnailFromFile ||
      thumbnailFromBody ||
      images[0]?.url ||
      null;


    const sizeChart =
      req.files?.sizeChart?.[0]?.path.replace(/\\/g, "/") || null;
      
      

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

      isActive: isActive === "true",
      bestSeller: bestSeller === "true",
      newArrival: newArrival === "true",

      images, // ✅ correct format
      thumbnail,
      video,
      sizeChart,
    });

    res.status(201).json({
      success: true,
      data: product,
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
      const newImages = req.files.images.map((file, index) => ({
        url: file.path.replace(/\\/g, "/"),
        altText: parsedAltTexts[index] || "",
      }));

      if (newImages.length > 4) {
        return res.status(400).json({
          success: false,
          message: "Maximum 4 images allowed",
        });
      }

      product.images = newImages;
    }

    // ✅ Update video
    if (req.files?.video?.[0]) {
      product.video =
        req.files.video[0].path.replace(/\\/g, "/");
    }

    // ✅ Update thumbnail
    const thumbnailFromFile =
      req.files?.thumbnail?.[0]?.path.replace(/\\/g, "/");

    if (thumbnailFromFile) {
      product.thumbnail = thumbnailFromFile;
    } else if (thumbnailFromBody) {
      product.thumbnail = thumbnailFromBody;
    } else if (!product.thumbnail && product.images?.length > 0) {
      product.thumbnail = product.images[0].url;
    }

    // ✅ Update size chart
    if (req.files?.sizeChart?.[0]) {
      product.sizeChart =
        req.files.sizeChart[0].path.replace(/\\/g, "/");
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
      data: product,
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
