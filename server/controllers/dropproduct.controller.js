import Dropproduct from '../models/dropproduct.model.js';
import fs from 'fs';
import path from 'path';

const BASE_IMAGE_PATH = '/outputs/dropimages/';

export const createDropproduct = async (req, res) => {
  try {
    // 1) images validation
    if (!req.files || req.files.length < 1) {
      return res.status(400).json({ message: "At least 1 image is required" });
    }
    if (req.files.length > 6) {
      return res.status(400).json({ message: "Maximum 6 images allowed" });
    }

    const images = req.files.map((file) => BASE_IMAGE_PATH + file.filename);

    // ✅ category + subCategory validation
    const category = String(req.body.category || "").trim();
    const subCategory = String(req.body.subCategory || "").trim();

    if (!category) {
      return res.status(400).json({ message: "Category is required" });
    }
    if (!subCategory) {
      return res.status(400).json({ message: "Sub-category is required" });
    }

    // 2) variants parsing + validation
    // variants can be sent as JSON string in multipart form-data
    let variants = req.body.variants;

    if (typeof variants === "string") {
      try {
        variants = JSON.parse(variants);
      } catch (e) {
        return res.status(400).json({
          message: "Invalid variants JSON. Send proper JSON array.",
        });
      }
    }

    if (!Array.isArray(variants) || variants.length < 1) {
      return res.status(400).json({
        message: "At least 1 size variant is required",
      });
    }

    // normalize + validate each variant
    const normalized = variants.map((v) => ({
      size: String(v.size || "").trim(),
      price: Number(v.price),
      stock: Number(v.stock),
      sku: v.sku ? String(v.sku).trim() : "",
    }));

    // basic checks
    for (const v of normalized) {
      if (!v.size) {
        return res.status(400).json({ message: "Variant size is required" });
      }
      if (!Number.isFinite(v.price) || v.price < 0) {
        return res
          .status(400)
          .json({ message: `Invalid price for size ${v.size}` });
      }
      if (!Number.isFinite(v.stock) || v.stock < 0) {
        return res
          .status(400)
          .json({ message: `Invalid stock for size ${v.size}` });
      }
    }

    // duplicate size check
    const sizes = normalized.map((x) => x.size.toUpperCase());
    if (new Set(sizes).size !== sizes.length) {
      return res.status(400).json({ message: "Duplicate sizes are not allowed" });
    }

    // 3) create
    const product = await Dropproduct.create({
      name: req.body.name,
      description: req.body.description,
      category,        // ✅ added
      subCategory,     // ✅ added
      isActive: req.body.isActive ?? true,
      images,
      variants: normalized,
    });

    return res.status(201).json(product);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};




export const updateDropproduct = async (req, res) => {
  try {
    const product = await Dropproduct.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    /* =========================
       1) IMAGES (replace if new)
       ========================= */
    let images = product.images;

    if (req.files && req.files.length > 0) {
      if (req.files.length > 6) {
        return res.status(400).json({ message: "Maximum 6 images allowed" });
      }

      // delete old images
      product.images.forEach((img) => {
        const imagePath = path.join(process.cwd(), img.replace(/^\//, ""));
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
      });

      // set new images
      images = req.files.map((file) => BASE_IMAGE_PATH + file.filename);
    }

    /* =========================
       2) VARIANTS (optional)
       ========================= */
    let variants = undefined;

    if (req.body.variants !== undefined) {
      variants = req.body.variants;

      // variants can arrive as JSON string in multipart/form-data
      if (typeof variants === "string") {
        try {
          variants = JSON.parse(variants);
        } catch (e) {
          return res.status(400).json({
            message: "Invalid variants JSON. Send proper JSON array.",
          });
        }
      }

      if (!Array.isArray(variants) || variants.length < 1) {
        return res.status(400).json({
          message: "At least 1 size variant is required",
        });
      }

      // normalize + validate
      const normalized = variants.map((v) => ({
        size: String(v.size || "").trim(),
        price: Number(v.price),
        stock: Number(v.stock),
        sku: v.sku ? String(v.sku).trim() : "",
      }));

      for (const v of normalized) {
        if (!v.size) {
          return res.status(400).json({ message: "Variant size is required" });
        }
        if (!Number.isFinite(v.price) || v.price < 0) {
          return res
            .status(400)
            .json({ message: `Invalid price for size ${v.size}` });
        }
        if (!Number.isFinite(v.stock) || v.stock < 0) {
          return res
            .status(400)
            .json({ message: `Invalid stock for size ${v.size}` });
        }
      }

      const sizes = normalized.map((x) => x.size);
      if (new Set(sizes).size !== sizes.length) {
        return res.status(400).json({ message: "Duplicate sizes are not allowed" });
      }

      variants = normalized;
    }

    /* =========================
       3) BUILD UPDATE PAYLOAD
       ========================= */
    const updateData = {
      // safe fields
      name: req.body.name ?? product.name,
      description: req.body.description ?? product.description,
      isActive: req.body.isActive ?? product.isActive,
      images,
      // variants only if provided
      ...(variants !== undefined ? { variants } : {}),
    };

    // ✅ Use findByIdAndUpdate but also run validators
    const updatedProduct = await Dropproduct.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    return res.json(updatedProduct);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};



// ✅ GET ALL (supports isActive filter + optional search)
export const getAllDropproducts = async (req, res) => {
  try {
    const { isActive, q, sortBy } = req.query;

    const filter = {};

    // optional filter: isActive=true/false
    if (isActive !== undefined) {
      filter.isActive = String(isActive).toLowerCase() === "true";
    }

    // optional search by name
    if (q && String(q).trim()) {
      filter.name = { $regex: String(q).trim(), $options: "i" };
    }

    // sorting
    const sort =
      sortBy === "oldest"
        ? { createdAt: 1 }
        : sortBy === "name"
        ? { name: 1 }
        : { createdAt: -1 }; // default newest

    const products = await Dropproduct.find(filter).sort(sort);

    return res.status(200).json(products);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch products",
      error: error.message,
    });
  }
};

// ✅ GET BY ID
export const getDropproductById = async (req, res) => {
  try {
    const product = await Dropproduct.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Dropproduct not found" });
    }

    return res.status(200).json(product);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch product",
      error: error.message,
    });
  }
};

// ✅ DELETE (removes images + product)
export const deleteDropproduct = async (req, res) => {
  try {
    const product = await Dropproduct.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Dropproduct not found" });
    }

    // delete images from disk
    (product.images || []).forEach((img) => {
      try {
        const imagePath = path.join(process.cwd(), img.replace(/^\//, ""));
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
      } catch (e) {
        // don't fail delete if one file missing
        console.error("Image delete failed:", img, e.message);
      }
    });

    await product.deleteOne();

    return res.status(200).json({
      message: "Dropproduct deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to delete product",
      error: error.message,
    });
  }
};

