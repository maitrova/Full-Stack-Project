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
// Get distinct categories and subcategories (category-mapped)
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
export const createReadymadeProduct = async (req, res) => {
  try {
    const { 
      title, description, price, currency, category, subCategory, 
      brand, stock, isActive, bestSeller, newArrival 
    } = req.body;

    if (!title || !description || price === undefined) {
      return res.status(400).json({ 
        success: false,
        message: "Title, description, and price are required" 
      });
    }

    const images = req.files?.images?.map((f) => f.path.replace(/\\/g, "/")) || [];
    const video = req.files?.video?.[0]?.path.replace(/\\/g, "/") || null;

    if (images.length > 4) {
      return res.status(400).json({ 
        success: false,
        message: "Maximum 4 images allowed" 
      });
    }

    const product = await ReadymadeProduct.create({
      title,
      description,
      price: Number(price),
      currency: currency || "INR",
      category: category || "",
      subCategory: subCategory || "",
      brand: brand || "",
      stock: Number(stock || 0),
      isActive: isActive !== undefined ? String(isActive).toLowerCase() === 'true' : true,
      bestSeller: bestSeller !== undefined ? String(bestSeller).toLowerCase() === 'true' : false,
      newArrival: newArrival !== undefined ? String(newArrival).toLowerCase() === 'true' : false,
      images,
      video,
    });

    res.status(201).json({ 
      success: true,
      message: "Product created successfully",
      data: product 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

// Update product
export const updateReadymadeProduct = async (req, res) => {
  try {
    const product = await ReadymadeProduct.findById(req.params.id);
    if (!product) return res.status(404).json({ 
      success: false,
      message: "Product not found" 
    });

    // Update normal fields
    const updatableFields = [
      "title", "description", "price", "currency", "category", 
      "subCategory", "brand", "stock", "isActive", "bestSeller", "newArrival"
    ];

    for (const key of updatableFields) {
      if (req.body[key] !== undefined) {
        if (key === "price" || key === "stock") {
          product[key] = Number(req.body[key]);
        } else if (key === "isActive" || key === "bestSeller" || key === "newArrival") {
          product[key] = String(req.body[key]).toLowerCase() === "true";
        } else {
          product[key] = req.body[key];
        }
      }
    }

    // Remove selected images
    let removeImages = [];
    if (req.body.removeImages) {
      try {
        removeImages = JSON.parse(req.body.removeImages);
        if (!Array.isArray(removeImages)) removeImages = [];
      } catch {
        return res.status(400).json({ 
          success: false,
          message: "removeImages must be valid JSON array" 
        });
      }
    }

    if (removeImages.length) {
      await Promise.all(removeImages.map((p) => safeDeleteFile(p)));
      product.images = (product.images || []).filter((p) => !removeImages.includes(p));
    }

    // Remove video if requested
    const removeVideo = String(req.body.removeVideo) === "true";
    if (removeVideo && product.video) {
      await safeDeleteFile(product.video);
      product.video = null;
    }

    // Handle new uploads
    const newImages = (req.files?.images || []).map((f) => f.path.replace(/\\/g, "/"));
    const newVideo = req.files?.video?.[0]?.path
      ? req.files.video[0].path.replace(/\\/g, "/")
      : null;

    const replaceImages = String(req.body.replaceImages) === "true";

    if (newImages.length) {
      if (replaceImages) {
        await Promise.all((product.images || []).map((p) => safeDeleteFile(p)));
        product.images = [];
      }

      const merged = [...(product.images || []), ...newImages];

      if (merged.length > 4) {
        await Promise.all(newImages.map((p) => safeDeleteFile(p)));
        return res.status(400).json({ 
          success: false,
          message: "Maximum 4 images allowed total" 
        });
      }

      product.images = merged;
    }

    if (newVideo) {
      if (product.video) await safeDeleteFile(product.video);
      product.video = newVideo;
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
      message: error.message 
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