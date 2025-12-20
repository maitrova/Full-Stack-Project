import ReadymadeProduct from "../models/readymadeproducts.js";
import fs from "fs/promises";
import path from "path";


export const getReadymadeProducts = async (req, res) => {
  try {
    const products = await ReadymadeProduct.find().sort({ createdAt: -1 });
    return res.status(200).json({ products });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getReadymadeProductById = async (req, res) => {
  try {
    const product = await ReadymadeProduct.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    return res.status(200).json({ product });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};




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

/* CREATE PRODUCT */
export const createReadymadeProduct = async (req, res) => {
  try {
    // const userId = req.user?.id || req.user?._id;
    // if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { title, description, price, currency, category, brand, stock, isActive } =
      req.body;

    if (!title || !description || price === undefined) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    const images =
      req.files?.images?.map((f) => f.path.replace(/\\/g, "/")) || [];
    const video = req.files?.video?.[0]?.path.replace(/\\/g, "/") || null;

    if (images.length > 4) {
      return res.status(400).json({ message: "Max 4 images allowed" });
    }

    const product = await ReadymadeProduct.create({
      title,
      description,
      price,
      currency,
      category,
      brand,
      stock,
      isActive,
      images,
      video,
    //   createdBy: userId,
    });

    res.status(201).json({ message: "Product created", product });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* DELETE PRODUCT + DELETE FILES */
export const deleteReadymadeProduct = async (req, res) => {
  try {
    const product = await ReadymadeProduct.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // delete images
    await Promise.all(
      (product.images || []).map((img) => safeDeleteFile(img))
    );

    // delete video
    await safeDeleteFile(product.video);

    // delete db record
    await ReadymadeProduct.findByIdAndDelete(req.params.id);

    res.status(200).json({
      message: "Product and media files deleted successfully",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateReadymadeProduct = async (req, res) => {
  try {
    const product = await ReadymadeProduct.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    // ------- 1) Update normal fields if provided -------
    const updatableFields = [
      "title",
      "description",
      "price",
      "currency",
      "category",
      "brand",
      "stock",
      "isActive",
    ];

    for (const key of updatableFields) {
      if (req.body[key] !== undefined) {
        if (key === "price" || key === "stock") product[key] = Number(req.body[key]);
        else if (key === "isActive") product[key] = String(req.body[key]) === "true";
        else product[key] = req.body[key];
      }
    }

    // ------- 2) Remove selected images (by path) -------
    let removeImages = [];
    if (req.body.removeImages) {
      try {
        removeImages = JSON.parse(req.body.removeImages);
        if (!Array.isArray(removeImages)) removeImages = [];
      } catch {
        return res.status(400).json({ message: "removeImages must be valid JSON array" });
      }
    }

    if (removeImages.length) {
      // delete from disk
      await Promise.all(removeImages.map((p) => safeDeleteFile(p)));

      // remove from db list
      product.images = (product.images || []).filter((p) => !removeImages.includes(p));
    }

    // ------- 3) Remove video if requested -------
    const removeVideo = String(req.body.removeVideo) === "true";
    if (removeVideo && product.video) {
      await safeDeleteFile(product.video);
      product.video = null;
    }

    // ------- 4) Handle new uploads -------
    const newImages = (req.files?.images || []).map((f) => f.path.replace(/\\/g, "/"));
    const newVideo = req.files?.video?.[0]?.path
      ? req.files.video[0].path.replace(/\\/g, "/")
      : null;

    // If replaceImages=true, delete all existing images and set new ones
    const replaceImages = String(req.body.replaceImages) === "true";

    if (newImages.length) {
      if (replaceImages) {
        // delete old images
        await Promise.all((product.images || []).map((p) => safeDeleteFile(p)));
        product.images = [];
      }

      // append new images
      const merged = [...(product.images || []), ...newImages];

      if (merged.length > 4) {
        // if exceeded, delete the newly uploaded images to keep disk clean
        await Promise.all(newImages.map((p) => safeDeleteFile(p)));
        return res.status(400).json({ message: "Max 4 images allowed total" });
      }

      product.images = merged;
    }

    // If a new video uploaded, replace old video (delete old file)
    if (newVideo) {
      if (product.video) await safeDeleteFile(product.video);
      product.video = newVideo;
    }

    await product.save();

    return res.status(200).json({
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};