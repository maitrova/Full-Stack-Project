import Dropproduct from "../models/dropproduct.model.js";
import fs from "fs";
import path from "path";

const BASE_IMAGE_PATH = "/outputs/dropimages/";

/* =================================
   Helper: safe file delete
================================= */
const safeUnlink = (filePath) => {
  if (!filePath) return;
  try {
    const abs = path.join(process.cwd(), filePath.replace(/^\//, ""));
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch {}
};



/* =========================================================
   CREATE DROP PRODUCT  (WITH THUMBNAIL SUPPORT)
========================================================= */
export const createDropproduct = async (req, res) => {
  try {
    const uploadedImages = req.files?.images || [];
    const uploadedThumbnail = req.files?.thumbnail?.[0] || null;

    // images validation
    if (uploadedImages.length < 1) {
      return res.status(400).json({ message: "At least 1 image is required" });
    }
    if (uploadedImages.length > 6) {
      return res.status(400).json({ message: "Maximum 6 images allowed" });
    }

    const images = uploadedImages.map((f) => BASE_IMAGE_PATH + f.filename);

    // ✅ thumbnail (same path)
    const thumbnail = uploadedThumbnail
      ? BASE_IMAGE_PATH + uploadedThumbnail.filename
      : images[0]; // fallback



    /* =========================
       CATEGORY VALIDATION
    ========================= */
    const category = String(req.body.category || "").trim();
    const subCategory = String(req.body.subCategory || "").trim();

    if (!category) {
      return res.status(400).json({ message: "Category is required" });
    }
    if (!subCategory) {
      return res.status(400).json({ message: "Sub-category is required" });
    }



    /* =========================
       VARIANTS PARSE + VALIDATE
    ========================= */
    let variants = req.body.variants;

    if (typeof variants === "string") {
      try {
        variants = JSON.parse(variants);
      } catch {
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

    const normalized = variants.map((v) => ({
      size: String(v.size || "").trim(),
      price: Number(v.price),
      stock: Number(v.stock),
      sku: v.sku ? String(v.sku).trim() : "",
    }));

    for (const v of normalized) {
      if (!v.size) return res.status(400).json({ message: "Variant size is required" });
      if (!Number.isFinite(v.price) || v.price < 0)
        return res.status(400).json({ message: `Invalid price for size ${v.size}` });
      if (!Number.isFinite(v.stock) || v.stock < 0)
        return res.status(400).json({ message: `Invalid stock for size ${v.size}` });
    }

    const sizes = normalized.map((x) => x.size.toUpperCase());
    if (new Set(sizes).size !== sizes.length) {
      return res.status(400).json({ message: "Duplicate sizes are not allowed" });
    }



    /* =========================
       CREATE
    ========================= */
    const product = await Dropproduct.create({
      name: req.body.name,
      description: req.body.description,
      category,
      subCategory,
      isActive: req.body.isActive ?? true,
      images,
      thumbnail, // ✅ NEW
      variants: normalized,
    });

    return res.status(201).json(product);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};





/* =========================================================
   UPDATE DROP PRODUCT  (WITH THUMBNAIL SUPPORT)
========================================================= */
export const updateDropproduct = async (req, res) => {
  try {
    const product = await Dropproduct.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const uploadedImages = req.files?.images || [];
    const uploadedThumbnail = req.files?.thumbnail?.[0] || null;

    let images = product.images;
    let thumbnail = product.thumbnail;



    /* =========================
       IMAGES (replace if new)
    ========================= */
    if (uploadedImages.length > 0) {
      if (uploadedImages.length > 6) {
        return res.status(400).json({ message: "Maximum 6 images allowed" });
      }

      // delete old images
      product.images.forEach(safeUnlink);

      images = uploadedImages.map((f) => BASE_IMAGE_PATH + f.filename);

      // if thumbnail pointed to old image → reset
      if (thumbnail && !images.includes(thumbnail)) {
        thumbnail = images[0];
      }
    }



    /* =========================
       THUMBNAIL (replace if new)
    ========================= */
    if (uploadedThumbnail) {
      if (thumbnail) safeUnlink(thumbnail);
      thumbnail = BASE_IMAGE_PATH + uploadedThumbnail.filename;
    }



    /* =========================
       REMOVE THUMBNAIL FLAG
    ========================= */
    if (String(req.body.removeThumbnail) === "true") {
      safeUnlink(thumbnail);
      thumbnail = images[0] || null;
    }



    /* =========================
       VARIANTS (optional)
    ========================= */
    let variants;

    if (req.body.variants !== undefined) {
      variants = req.body.variants;

      if (typeof variants === "string") {
        variants = JSON.parse(variants);
      }

      const normalized = variants.map((v) => ({
        size: String(v.size || "").trim(),
        price: Number(v.price),
        stock: Number(v.stock),
        sku: v.sku ? String(v.sku).trim() : "",
      }));

      variants = normalized;
    }



    /* =========================
       UPDATE
    ========================= */
    const updateData = {
      name: req.body.name ?? product.name,
      description: req.body.description ?? product.description,
      category: req.body.category ?? product.category,
      subCategory: req.body.subCategory ?? product.subCategory,
      isActive: req.body.isActive ?? product.isActive,
      images,
      thumbnail, // ✅ NEW
      ...(variants ? { variants } : {}),
    };

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

