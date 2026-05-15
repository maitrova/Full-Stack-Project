import Dropproduct from "../models/dropproduct.model.js";
import {
  deleteOptimizedImageSet,
  normalizeStoredPath,
  optimizeUploadedImage,
} from "../utils/imageOptimization.js";

const normalizeDropproductPaths = (product) => {
  if (!product) return product;

  const normalized = product.toObject ? product.toObject() : { ...product };
  return {
    ...normalized,
    images: Array.isArray(normalized.images)
      ? normalized.images
          .map((image) => {
            if (typeof image === "string") {
              return { url: normalizeStoredPath(image), altText: "" };
            }

            if (image && typeof image === "object") {
              return {
                ...image,
                url: normalizeStoredPath(image.url),
                altText: String(image.altText || "").trim(),
              };
            }

            return null;
          })
          .filter(Boolean)
      : [],
    sizeChart: normalizeStoredPath(normalized.sizeChart),
    video: normalizeStoredPath(normalized.video),
  };
};

const slugifyDropProductName = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

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

const getDropImageUrl = (image) => {
  if (!image) return null;
  if (typeof image === "string") return image;
  if (typeof image === "object") return image.url || null;
  return null;
};

const normalizeDropImageAltTexts = (value) => {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(parsed)) {
    throw new Error("imageAltTexts must be a JSON array");
  }

  return parsed.map((item) => String(item || "").trim());
};

const normalizeExistingDropImages = (value, currentImages = []) => {
  if (value === undefined || value === null || value === "") {
    return currentImages.map((image) =>
      typeof image === "string"
        ? { url: image, altText: "" }
        : { url: image?.url || "", altText: String(image?.altText || "").trim() }
    );
  }

  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(parsed)) {
    throw new Error("existingImages must be a JSON array");
  }

  const currentImageMap = new Map(
    currentImages.map((image) => {
      const imageUrl = getDropImageUrl(image);
      return [
        imageUrl,
        {
          url: imageUrl,
          altText:
            typeof image === "object" ? String(image.altText || "").trim() : "",
        },
      ];
    })
  );

  return parsed.map((image) => {
    const url = String(image?.url || image).trim();
    const currentImage = currentImageMap.get(url);

    if (!url || !currentImage) {
      throw new Error("Invalid existing image reference");
    }

    return {
      url,
      altText: String(image?.altText ?? currentImage.altText ?? "").trim(),
    };
  });
};

const buildDropImageObjects = async (uploadedFiles = [], altTexts = []) => {
  const urls = await Promise.all(uploadedFiles.map((file) => optimizeDropImage(file)));
  return urls.map((url, index) => ({
    url,
    altText: String(altTexts[index] || "").trim(),
  }));
};

const optimizeDropSizeChart = async (file) => {
  if (!file?.path) return null;

  if (!String(file.mimetype || "").startsWith("image/")) {
    return normalizeStoredPath(file.path);
  }

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
    const uploadedSizeChart = req.files?.sizeChart?.[0] || null;
    const uploadedVideo = req.files?.video?.[0] || null;

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
    const imageAltTexts = normalizeDropImageAltTexts(req.body.imageAltTexts);
    const images = await buildDropImageObjects(uploadedImages, imageAltTexts);

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
      sizeChart: await optimizeDropSizeChart(uploadedSizeChart),
      video: normalizeStoredPath(uploadedVideo?.path),
      variants,
    });

    return res.status(201).json(normalizeDropproductPaths(product));
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
    const uploadedSizeChart = req.files?.sizeChart?.[0] || null;
    const uploadedVideo = req.files?.video?.[0] || null;

    const imageAltTexts = normalizeDropImageAltTexts(req.body.imageAltTexts);
    let images = normalizeExistingDropImages(req.body.existingImages, product.images || []);
    let sizeChart = product.sizeChart;
    let video = product.video;

    if (uploadedImages.length > 0) {
      images = [...images, ...(await buildDropImageObjects(uploadedImages, imageAltTexts))];
    }

    if (images.length > 6) {
      return res.status(400).json({ message: "Maximum 6 images allowed" });
    }

    if (images.length < 1) {
      return res.status(400).json({ message: "At least 1 image is required" });
    }

    const nextImageUrlSet = new Set(images.map((image) => getDropImageUrl(image)).filter(Boolean));
    const removedImageUrls = (product.images || [])
      .map((image) => getDropImageUrl(image))
      .filter((url) => url && !nextImageUrlSet.has(url));

    if (removedImageUrls.length > 0) {
      await Promise.all(removedImageUrls.map((imagePath) => safeUnlink(imagePath)));
    }

    if (uploadedSizeChart) {
      await safeUnlink(sizeChart);
      sizeChart = await optimizeDropSizeChart(uploadedSizeChart);
    } else if (String(req.body.removeSizeChart) === "true") {
      await safeUnlink(sizeChart);
      sizeChart = null;
    }

    if (uploadedVideo) {
      await safeUnlink(video);
      video = normalizeStoredPath(uploadedVideo.path);
    } else if (String(req.body.removeVideo) === "true") {
      await safeUnlink(video);
      video = null;
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
      sizeChart,
      video,
      ...(variants ? { variants } : {}),
    };

    Object.assign(product, updateData);
    await product.save();

    return res.json(normalizeDropproductPaths(product));
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

    return res.status(200).json(products.map(normalizeDropproductPaths));
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

    return res.status(200).json(normalizeDropproductPaths(product));
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch product",
      error: error.message,
    });
  }
};

export const getDropproductBySlug = async (req, res) => {
  try {
    const targetSlug = slugifyDropProductName(req.params.slug);
    const products = await Dropproduct.find({ isActive: true }).sort({ createdAt: -1 });

    const product = products.find((item) => slugifyDropProductName(item.name) === targetSlug);

    if (!product) {
      return res.status(404).json({ message: "Dropproduct not found" });
    }

    return res.status(200).json(normalizeDropproductPaths(product));
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
    await safeUnlink(product.sizeChart);
    await safeUnlink(product.video);

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
