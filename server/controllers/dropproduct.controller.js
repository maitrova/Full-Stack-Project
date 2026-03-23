import Dropproduct from "../models/dropproduct.model.js";
import {
  createReadymadeThumbnail,
  deleteOptimizedImageSet,
  normalizeStoredPath,
  optimizeUploadedImage,
} from "../utils/imageOptimization.js";

const parseOptionalNumber = (value) => {
  if (Array.isArray(value)) value = value[0];
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
  if (Array.isArray(value)) value = value[0];
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

const optimizeDropImage = async (file) => {
  const optimized = await optimizeUploadedImage(normalizeStoredPath(file?.path), {
    cleanupSource: true,
  });

  return optimized.url;
};

const optimizeDropSizeChart = async (file) => {
  if (!file?.path) return null;

  const optimizedChart = await optimizeUploadedImage(normalizeStoredPath(file.path), {
    cleanupSource: true,
    outputDir: "outputs/drop-products/size-chart",
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

const safeUnlink = async (filePath) => {
  if (!filePath) return;
  await deleteOptimizedImageSet(filePath);
};

const normalizeVariants = (variants) => {
  if (typeof variants === "string") {
    variants = JSON.parse(variants);
  }

  if (!Array.isArray(variants) || variants.length < 1) {
    throw new Error("At least 1 size variant is required");
  }

  const normalized = variants.map((variant) => ({
    size: String(variant.size || "").trim().toUpperCase(),
    price: Number(variant.price),
    stock: Number(variant.stock),
    sku: variant.sku ? String(variant.sku).trim() : "",
  }));

  for (const variant of normalized) {
    if (!variant.size) {
      throw new Error("Variant size is required");
    }
    if (!Number.isFinite(variant.price) || variant.price <= 0) {
      throw new Error(`Invalid price for size ${variant.size}`);
    }
    if (!Number.isFinite(variant.stock) || variant.stock < 0) {
      throw new Error(`Invalid stock for size ${variant.size}`);
    }
  }

  const sizes = normalized.map((variant) => variant.size);
  if (new Set(sizes).size !== sizes.length) {
    throw new Error("Duplicate sizes are not allowed");
  }

  return normalized;
};

export const createDropproduct = async (req, res) => {
  try {
    const uploadedImages = req.files?.images || [];
    const uploadedThumbnail = req.files?.thumbnail?.[0] || null;
    const uploadedSizeChart = req.files?.sizeChart?.[0] || null;

    if (uploadedImages.length < 1) {
      return res.status(400).json({ message: "At least 1 image is required" });
    }
    if (uploadedImages.length > 6) {
      return res.status(400).json({ message: "Maximum 6 images allowed" });
    }

    const name = String(req.body.name || "").trim();
    const category = String(req.body.category || "").trim();
    const subCategory = String(req.body.subCategory || "").trim();

    if (!name) {
      return res.status(400).json({ message: "Product name is required" });
    }
    if (!category) {
      return res.status(400).json({ message: "Category is required" });
    }
    if (!subCategory) {
      return res.status(400).json({ message: "Sub-category is required" });
    }

    const variants = normalizeVariants(req.body.variants);
    const images = await Promise.all(uploadedImages.map((file) => optimizeDropImage(file)));
    const thumbnail = uploadedThumbnail
      ? await createReadymadeThumbnail(normalizeStoredPath(uploadedThumbnail.path), {
          cleanupSource: true,
        })
      : images[0];

    const product = await Dropproduct.create({
      name,
      description: req.body.description,
      category,
      subCategory,
      salePrice: parseOptionalNumber(req.body.salePrice),
      saleStartAt: parseOptionalDate(req.body.saleStartAt),
      saleEndAt: parseOptionalDate(req.body.saleEndAt),
      isActive: String(req.body.isActive ?? "true") === "true",
      bestSeller: String(req.body.bestSeller ?? "false") === "true",
      newArrival: String(req.body.newArrival ?? "false") === "true",
      images,
      thumbnail,
      sizeChart: await optimizeDropSizeChart(uploadedSizeChart),
      variants,
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

    const uploadedImages = req.files?.images || [];
    const uploadedThumbnail = req.files?.thumbnail?.[0] || null;
    const uploadedSizeChart = req.files?.sizeChart?.[0] || null;

    let images = product.images;
    let thumbnail = product.thumbnail;
    let sizeChart = product.sizeChart;

    if (uploadedImages.length > 0) {
      if (uploadedImages.length > 6) {
        return res.status(400).json({ message: "Maximum 6 images allowed" });
      }

      await Promise.all((product.images || []).map((imagePath) => safeUnlink(imagePath)));
      images = await Promise.all(uploadedImages.map((file) => optimizeDropImage(file)));

      if (thumbnail && !images.includes(thumbnail)) {
        thumbnail = images[0];
      }
    }

    if (uploadedThumbnail) {
      await safeUnlink(thumbnail);
      thumbnail = await createReadymadeThumbnail(
        normalizeStoredPath(uploadedThumbnail.path),
        { cleanupSource: true }
      );
    }

    if (String(req.body.removeThumbnail) === "true") {
      await safeUnlink(thumbnail);
      thumbnail = images[0] || null;
    }

    if (uploadedSizeChart) {
      await safeUnlink(sizeChart);
      sizeChart = await optimizeDropSizeChart(uploadedSizeChart);
    } else if (String(req.body.removeSizeChart) === "true") {
      await safeUnlink(sizeChart);
      sizeChart = null;
    }

    let variants;
    if (req.body.variants !== undefined) {
      variants = normalizeVariants(req.body.variants);
    }

    const updateData = {
      name: req.body.name ?? product.name,
      description: req.body.description ?? product.description,
      category: req.body.category ?? product.category,
      subCategory: req.body.subCategory ?? product.subCategory,
      salePrice:
        req.body.salePrice !== undefined
          ? parseOptionalNumber(req.body.salePrice)
          : product.salePrice,
      saleStartAt:
        req.body.saleStartAt !== undefined
          ? parseOptionalDate(req.body.saleStartAt)
          : product.saleStartAt,
      saleEndAt:
        req.body.saleEndAt !== undefined
          ? parseOptionalDate(req.body.saleEndAt)
          : product.saleEndAt,
      isActive:
        req.body.isActive !== undefined
          ? String(req.body.isActive) === "true"
          : product.isActive,
      bestSeller:
        req.body.bestSeller !== undefined
          ? String(req.body.bestSeller) === "true"
          : product.bestSeller,
      newArrival:
        req.body.newArrival !== undefined
          ? String(req.body.newArrival) === "true"
          : product.newArrival,
      images,
      thumbnail,
      sizeChart,
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

export const getAllDropproducts = async (req, res) => {
  try {
    const { isActive, q, sortBy } = req.query;
    const filter = {};

    if (isActive !== undefined) {
      filter.isActive = String(isActive).toLowerCase() === "true";
    }

    if (q && String(q).trim()) {
      filter.name = { $regex: String(q).trim(), $options: "i" };
    }

    const sort =
      sortBy === "oldest"
        ? { createdAt: 1 }
        : sortBy === "name"
        ? { name: 1 }
        : { createdAt: -1 };

    const products = await Dropproduct.find(filter).sort(sort);

    return res.status(200).json(products);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch products",
      error: error.message,
    });
  }
};

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

export const deleteDropproduct = async (req, res) => {
  try {
    const product = await Dropproduct.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Dropproduct not found" });
    }

    await Promise.all((product.images || []).map((img) => safeUnlink(img)));
    await safeUnlink(product.thumbnail);
    await safeUnlink(product.sizeChart);

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
