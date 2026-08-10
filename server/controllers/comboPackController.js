import mongoose from "mongoose";
import ComboPack from "../models/ComboPack.js";
import ReadymadeProduct from "../models/readymadeproducts.js";
import {
  deleteOptimizedImageSet,
  normalizeStoredPath,
  optimizeUploadedImage,
} from "../utils/imageOptimization.js";
import { attachReadymadePricing, getReadymadePricing } from "../utils/readymadePricing.js";

const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const slugify = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return ["true", "1", "yes", "on"].includes(String(value).trim().toLowerCase());
};

const parseOptionalNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error("Invalid price value");
  }
  return number;
};

const parseArrayField = (value, fallback = []) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    if (trimmed.startsWith("[")) return JSON.parse(trimmed);
    return trimmed.split(",").map((entry) => entry.trim()).filter(Boolean);
  }
  return fallback;
};

const normalizeProductItems = (rawItems, allowDuplicates) => {
  const items = parseArrayField(rawItems);
  const normalized = items.map((entry, index) => {
    const productId = typeof entry === "object" ? entry.product || entry._id || entry.id : entry;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new Error("Every combo product reference must be a valid product id");
    }
    return {
      product: productId,
      sortOrder: Number.isFinite(Number(entry?.sortOrder)) ? Number(entry.sortOrder) : index,
    };
  });

  if (normalized.length < 2) {
    throw new Error("Select at least two products for a combo pack");
  }

  if (!allowDuplicates) {
    const ids = normalized.map((item) => String(item.product));
    if (new Set(ids).size !== ids.length) {
      throw new Error("Duplicate products are not allowed unless explicitly enabled");
    }
  }

  return normalized.sort((a, b) => a.sortOrder - b.sortOrder);
};

const normalizeSelectionGroups = (rawGroups, allowDuplicates) => {
  const groups = parseArrayField(rawGroups);
  const normalized = groups.map((entry, index) => {
    const categoryId = entry?.category || entry?.categoryId;
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      throw new Error("Every combo category must be a valid category id");
    }

    const eligibleProducts = parseArrayField(entry?.eligibleProducts || entry?.products)
      .map((product) => (typeof product === "object" ? product._id || product.id || product.product : product))
      .filter(Boolean);

    if (!eligibleProducts.length) {
      throw new Error("Each combo category must include at least one eligible product");
    }

    for (const productId of eligibleProducts) {
      if (!mongoose.Types.ObjectId.isValid(productId)) {
        throw new Error("Every eligible product reference must be a valid product id");
      }
    }

    return {
      category: categoryId,
      label: entry?.label || "",
      eligibleProducts: [...new Set(eligibleProducts.map(String))],
      sortOrder: Number.isFinite(Number(entry?.sortOrder)) ? Number(entry.sortOrder) : index,
    };
  });

  if (normalized.length < 2) {
    throw new Error("Select at least two combo categories");
  }

  if (!allowDuplicates) {
    for (const group of normalized) {
      if (new Set(group.eligibleProducts).size !== group.eligibleProducts.length) {
        throw new Error("Duplicate eligible products are not allowed unless explicitly enabled");
      }
    }
  }

  return normalized.sort((a, b) => a.sortOrder - b.sortOrder);
};

const parseDiscountPercentage = (value, fallback = 0) => {
  const number = value === undefined || value === null || value === "" ? Number(fallback || 0) : Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100) {
    throw new Error("Discount percentage must be between 0 and 100");
  }
  return number;
};

const getProductOriginalPrice = (product) => {
  const pricing = getReadymadePricing(product);
  const variantPrices = Array.isArray(product?.variants)
    ? product.variants.map((variant) => Number(variant.price || 0)).filter((price) => price > 0)
    : [];
  return Number(pricing?.mrp || 0) || Number(product?.price || 0) || (variantPrices.length ? Math.min(...variantPrices) : 0);
};

const getSelectionGroups = (combo) =>
  Array.isArray(combo?.selectionGroups) && combo.selectionGroups.length
    ? [...combo.selectionGroups].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
    : [];

const getGroupProducts = (group) =>
  (group?.eligibleProducts || [])
    .filter(Boolean)
    .filter((product) => typeof product === "object");

const getGroupPreviewProduct = (group) => {
  const products = getGroupProducts(group);
  if (!products.length) return null;
  return products.reduce((lowest, product) =>
    getProductOriginalPrice(product) < getProductOriginalPrice(lowest) ? product : lowest
  );
};

const buildComboPricing = (combo) => {
  const selectionGroups = getSelectionGroups(combo);
  if (selectionGroups.length) {
    const totalOriginalPrice = selectionGroups.reduce((sum, group) => {
      const product = getGroupPreviewProduct(group);
      return sum + (product ? getProductOriginalPrice(product) : 0);
    }, 0);
    const originalPrice = Number(combo.originalPriceOverride || 0) > 0
      ? Number(combo.originalPriceOverride)
      : totalOriginalPrice;
    const discountPercentage = Number(combo.discountPercentage || 0);
    const comboPrice = Math.max(Math.round(originalPrice * (1 - discountPercentage / 100)), 0);
    const savingsAmount = Math.max(originalPrice - comboPrice, 0);

    return {
      totalOriginalPrice,
      originalPrice,
      comboPrice,
      savingsAmount,
      discountPercentage,
    };
  }

  const productsById = new Map(
    (combo.items || [])
      .map((item) => item.product)
      .filter(Boolean)
      .map((product) => [String(product._id || product), product])
  );

  const totalOriginalPrice = (combo.items || []).reduce((sum, item) => {
    const product = productsById.get(String(item.product?._id || item.product));
    return sum + (product && typeof product === "object" ? getProductOriginalPrice(product) : 0);
  }, 0);

  const originalPrice = Number(combo.originalPriceOverride || 0) > 0
    ? Number(combo.originalPriceOverride)
    : totalOriginalPrice;
  const comboPrice = Number(combo.comboPrice || 0);
  const savingsAmount = Math.max(originalPrice - comboPrice, 0);
  const discountPercentage = originalPrice > 0 ? Math.round((savingsAmount / originalPrice) * 100) : 0;

  return {
    totalOriginalPrice,
    originalPrice,
    comboPrice,
    savingsAmount,
    discountPercentage: Number(combo.discountPercentage || 0) || discountPercentage,
  };
};

const getProductImages = (product) => {
  const images = [];

  if (product?.thumbnail) {
    images.push(product.thumbnail);
  }

  for (const image of product?.images || []) {
    const imageUrl = typeof image === "string" ? image : image?.url;
    if (imageUrl) images.push(imageUrl);
  }

  return [...new Set(images)];
};

const getReviewIssues = (combo) => {
  const issues = [];
  for (const group of getSelectionGroups(combo)) {
    if (!group.category || typeof group.category !== "object") {
      issues.push("One or more selected combo categories are missing");
    }
    const products = getGroupProducts(group);
    if (!products.length) {
      issues.push(`${group.label || group.category?.name || "A combo category"} has no eligible products`);
    }
    for (const product of products) {
      if (product.isActive === false) {
        issues.push(`${product.title || "A selected product"} is inactive`);
      }
    }
  }
  for (const item of combo.items || []) {
    const product = item.product;
    if (!product || typeof product !== "object") {
      issues.push("One or more selected products are missing");
      continue;
    }
    if (product.isActive === false) {
      issues.push(`${product.title || "A selected product"} is inactive`);
    }
  }
  return [...new Set(issues)];
};

const serializeCombo = (comboDoc) => {
  const combo = typeof comboDoc?.toObject === "function" ? comboDoc.toObject() : comboDoc;
  const issues = getReviewIssues(combo);
  const pricing = buildComboPricing(combo);

  const selectedProductImages = (combo.items || [])
    .flatMap((item) => getProductImages(item.product))
    .filter(Boolean);
  const groupProductImages = getSelectionGroups(combo)
    .flatMap((group) => getGroupProducts(group))
    .flatMap((product) => getProductImages(product))
    .filter(Boolean);

  return {
    ...combo,
    comboPrice: pricing.comboPrice ?? combo.comboPrice,
    includedProductsCount: getSelectionGroups(combo).length || combo.items?.length || 0,
    productImages: groupProductImages.length ? groupProductImages : selectedProductImages,
    displayImage:
      combo.imageMode === "CUSTOM_IMAGES"
        ? combo.featuredImage || combo.galleryImages?.[0]?.url || combo.bannerImage || groupProductImages[0] || selectedProductImages[0] || null
        : groupProductImages[0] || selectedProductImages[0] || combo.featuredImage || null,
    pricing,
    reviewIssues: issues.length ? issues : combo.reviewIssues || [],
    needsReview: issues.length > 0 || combo.status === "REVIEW",
  };
};

const populateComboQuery = (query) =>
  query
    .populate({
      path: "items.product",
      select:
        "title description price salePrice saleStartAt saleEndAt currency category subCategory brand stock variants images thumbnail isActive",
      populate: [
        { path: "category", select: "name" },
        { path: "subCategory", select: "name" },
        { path: "brand", select: "name" },
      ],
    })
    .populate({ path: "selectionGroups.category", select: "name thumbnail altText isActive" })
    .populate({
      path: "selectionGroups.eligibleProducts",
      select:
        "title description price salePrice saleStartAt saleEndAt currency category subCategory brand stock variants images thumbnail isActive",
      populate: [
        { path: "category", select: "name" },
        { path: "subCategory", select: "name" },
        { path: "brand", select: "name" },
      ],
    });

const optimizeComboImage = async (file, outputDir) => {
  if (!file?.path) return null;
  const optimizedImage = await optimizeUploadedImage(normalizeStoredPath(file.path), {
    cleanupSource: true,
    outputDir,
    baseName: `${Date.now()}-${file.originalname || "combo-image"}`,
  });
  return optimizedImage.url;
};

const applyUploadedImages = async (combo, files = {}) => {
  if (files.featuredImage?.[0]) {
    if (combo.featuredImage) await deleteOptimizedImageSet(combo.featuredImage);
    combo.featuredImage = await optimizeComboImage(files.featuredImage[0], "outputs/combo-packs/featured");
  }

  if (files.bannerImage?.[0]) {
    if (combo.bannerImage) await deleteOptimizedImageSet(combo.bannerImage);
    combo.bannerImage = await optimizeComboImage(files.bannerImage[0], "outputs/combo-packs/banner");
  }

  if (files.galleryImages?.length) {
    await Promise.all((combo.galleryImages || []).map((image) => deleteOptimizedImageSet(image.url)));
    combo.galleryImages = await Promise.all(
      files.galleryImages.map(async (file) => ({
        url: await optimizeComboImage(file, "outputs/combo-packs/gallery"),
        altText: combo.name,
      }))
    );
  }
};

const validateComboPayload = async ({ items = [], selectionGroups = [], comboPrice, originalPriceOverride, discountPercentage = 0 }) => {
  if (selectionGroups.length) {
    const productIds = [...new Set(selectionGroups.flatMap((group) => group.eligibleProducts).map(String))];
    const products = await ReadymadeProduct.find({ _id: { $in: productIds } }).lean();
    const activeProductsById = new Map(products.map((product) => [String(product._id), product]));

    for (const group of selectionGroups) {
      for (const productId of group.eligibleProducts) {
        const product = activeProductsById.get(String(productId));
        if (!product) throw new Error("One or more eligible products could not be found");
        if (product.isActive === false) throw new Error("Inactive products cannot be added to a combo pack");
        if (String(product.category) !== String(group.category)) {
          throw new Error("Eligible products must belong to their selected combo category");
        }
      }
    }

    const totalOriginalPrice = selectionGroups.reduce((sum, group) => {
      const groupPrices = group.eligibleProducts
        .map((productId) => activeProductsById.get(String(productId)))
        .filter(Boolean)
        .map(getProductOriginalPrice)
        .filter((price) => price > 0);
      return sum + (groupPrices.length ? Math.min(...groupPrices) : 0);
    }, 0);
    const effectiveOriginalPrice = Number(originalPriceOverride || 0) > 0
      ? Number(originalPriceOverride)
      : totalOriginalPrice;

    if (selectionGroups.length < 2) throw new Error("Select at least two combo categories");
    if (!(Number(discountPercentage) >= 0 && Number(discountPercentage) <= 100)) {
      throw new Error("Discount percentage must be between 0 and 100");
    }
    return { totalOriginalPrice };
  }

  const productIds = items.map((item) => item.product);
  const products = await ReadymadeProduct.find({ _id: { $in: productIds } }).lean();
  const activeProductsById = new Map(products.map((product) => [String(product._id), product]));

  for (const productId of productIds) {
    const product = activeProductsById.get(String(productId));
    if (!product) throw new Error("One or more selected products could not be found");
    if (product.isActive === false) throw new Error("Inactive products cannot be added to a combo pack");
  }

  const totalOriginalPrice = items.reduce((sum, item) => {
    const product = activeProductsById.get(String(item.product));
    return sum + getProductOriginalPrice(product);
  }, 0);
  const effectiveOriginalPrice = Number(originalPriceOverride || 0) > 0
    ? Number(originalPriceOverride)
    : totalOriginalPrice;

  if (!(Number(comboPrice) > 0)) {
    throw new Error("Combo price must be greater than 0");
  }
  if (Number(comboPrice) > effectiveOriginalPrice) {
    throw new Error("Combo price cannot exceed the total original price");
  }

  return { totalOriginalPrice };
};

export const listComboPacks = async (req, res) => {
  try {
    const { search, status, dateFrom, dateTo, page = 1, limit = 50 } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: escapeRegex(search), $options: "i" } },
        { slug: { $regex: escapeRegex(search), $options: "i" } },
      ];
    }
    if (status) query.status = String(status).toUpperCase();
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.min(Math.max(Number(limit) || 50, 1), 100);

    const combos = await populateComboQuery(
      ComboPack.find(query)
        .sort({ createdAt: -1 })
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber)
        .select("-__v")
    ).lean();

    const total = await ComboPack.countDocuments(query);

    res.status(200).json({
      success: true,
      data: combos.map(serializeCombo),
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        pages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const listPublicComboPacks = async (req, res) => {
  req.query.status = "ACTIVE";
  return listComboPacks(req, res);
};

export const getComboPackById = async (req, res) => {
  try {
    const combo = await populateComboQuery(ComboPack.findById(req.params.id).select("-__v")).lean();
    if (!combo) return res.status(404).json({ success: false, message: "Combo pack not found" });
    res.status(200).json({ success: true, data: serializeCombo(combo) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPublicComboPackBySlug = async (req, res) => {
  try {
    const combo = await populateComboQuery(
      ComboPack.findOne({ slug: req.params.slug, status: "ACTIVE" }).select("-__v")
    ).lean();
    if (!combo) return res.status(404).json({ success: false, message: "Combo pack not found" });
    res.status(200).json({ success: true, data: serializeCombo(combo) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const listPublicComboPacksByProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Invalid product id" });
    }

    const combos = await populateComboQuery(
      ComboPack.find({
        status: "ACTIVE",
        $or: [
          { "items.product": productId },
          { "selectionGroups.eligibleProducts": productId },
        ],
      })
        .sort({ createdAt: -1 })
        .limit(8)
        .select("-__v")
    ).lean();

    res.status(200).json({
      success: true,
      data: combos.map(serializeCombo),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const searchComboProducts = async (req, res) => {
  try {
    const { q, category, brand, limit = 30 } = req.query;
    const query = { isActive: true };

    if (q) {
      query.$or = [
        { title: { $regex: escapeRegex(q), $options: "i" } },
        { "variants.sku": { $regex: escapeRegex(q), $options: "i" } },
      ];
    }
    if (category && mongoose.Types.ObjectId.isValid(category)) query.category = category;
    if (brand && mongoose.Types.ObjectId.isValid(brand)) query.brand = brand;

    const products = await ReadymadeProduct.find(query)
      .populate("category", "name")
      .populate("brand", "name")
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit) || 30, 100))
      .lean();

    res.status(200).json({
      success: true,
      data: products.map((product) => attachReadymadePricing(product)),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createComboPack = async (req, res) => {
  try {
    const allowDuplicateProducts = parseBoolean(req.body.allowDuplicateProducts);
    const hasGroupsPayload = Boolean(req.body.selectionGroups || req.body.groups);
    const selectionGroups = hasGroupsPayload
      ? normalizeSelectionGroups(req.body.selectionGroups || req.body.groups, allowDuplicateProducts)
      : [];
    const items = hasGroupsPayload
      ? []
      : normalizeProductItems(req.body.items || req.body.productIds, allowDuplicateProducts);
    const discountPercentage = parseDiscountPercentage(req.body.discountPercentage);
    const comboPrice = hasGroupsPayload ? 0 : Number(req.body.comboPrice);
    const originalPriceOverride = parseOptionalNumber(req.body.originalPrice);

    const validation = await validateComboPayload({ items, selectionGroups, comboPrice, originalPriceOverride, discountPercentage });
    const computedComboPrice = hasGroupsPayload
      ? Math.max(Math.round((Number(originalPriceOverride || 0) > 0 ? Number(originalPriceOverride) : validation.totalOriginalPrice) * (1 - discountPercentage / 100)), 0)
      : comboPrice;

    const combo = new ComboPack({
      name: req.body.name,
      slug: slugify(req.body.slug || req.body.name),
      shortDescription: req.body.shortDescription || "",
      fullDescription: req.body.fullDescription || "",
      comboPrice: computedComboPrice,
      discountPercentage,
      originalPriceOverride,
      currency: req.body.currency || "INR",
      status: String(req.body.status || "INACTIVE").toUpperCase(),
      seoTitle: req.body.seoTitle || "",
      seoDescription: req.body.seoDescription || "",
      allowDuplicateProducts,
      imageMode: req.body.imageMode === "CUSTOM_IMAGES" ? "CUSTOM_IMAGES" : "PRODUCT_IMAGES",
      items,
      selectionGroups,
    });

    await applyUploadedImages(combo, req.files);
    await combo.save();

    const saved = await populateComboQuery(ComboPack.findById(combo._id).select("-__v")).lean();
    res.status(201).json({ success: true, data: serializeCombo(saved) });
  } catch (error) {
    const statusCode = error?.code === 11000 ? 409 : 400;
    res.status(statusCode).json({
      success: false,
      message: error?.code === 11000 ? "Combo slug already exists" : error.message,
    });
  }
};

export const updateComboPack = async (req, res) => {
  try {
    const combo = await ComboPack.findById(req.params.id);
    if (!combo) return res.status(404).json({ success: false, message: "Combo pack not found" });

    const allowDuplicateProducts = parseBoolean(
      req.body.allowDuplicateProducts,
      combo.allowDuplicateProducts
    );
    const hasGroupsPayload = Boolean(req.body.selectionGroups || req.body.groups);
    const hasItemsPayload = Boolean(req.body.items || req.body.productIds);
    const selectionGroups = hasGroupsPayload
      ? normalizeSelectionGroups(req.body.selectionGroups || req.body.groups, allowDuplicateProducts)
      : (combo.selectionGroups || []).map((group, index) => ({
          category: group.category,
          label: group.label || "",
          eligibleProducts: group.eligibleProducts,
          sortOrder: group.sortOrder ?? index,
        }));
    const items = hasGroupsPayload
      ? []
      : hasItemsPayload
      ? normalizeProductItems(req.body.items || req.body.productIds, allowDuplicateProducts)
      : combo.items.map((item, index) => ({ product: item.product, sortOrder: item.sortOrder ?? index }));
    const discountPercentage = parseDiscountPercentage(req.body.discountPercentage, combo.discountPercentage);
    const comboPrice = hasGroupsPayload || selectionGroups.length
      ? 0
      : req.body.comboPrice !== undefined ? Number(req.body.comboPrice) : combo.comboPrice;
    const originalPriceOverride = req.body.originalPrice !== undefined
      ? parseOptionalNumber(req.body.originalPrice)
      : combo.originalPriceOverride;

    const validation = await validateComboPayload({ items, selectionGroups, comboPrice, originalPriceOverride, discountPercentage });
    const computedComboPrice = selectionGroups.length
      ? Math.max(Math.round((Number(originalPriceOverride || 0) > 0 ? Number(originalPriceOverride) : validation.totalOriginalPrice) * (1 - discountPercentage / 100)), 0)
      : comboPrice;

    if (req.body.name !== undefined) combo.name = req.body.name;
    if (req.body.slug !== undefined || req.body.name !== undefined) {
      combo.slug = slugify(req.body.slug || req.body.name || combo.slug);
    }
    if (req.body.shortDescription !== undefined) combo.shortDescription = req.body.shortDescription;
    if (req.body.fullDescription !== undefined) combo.fullDescription = req.body.fullDescription;
    combo.comboPrice = computedComboPrice;
    combo.discountPercentage = discountPercentage;
    combo.originalPriceOverride = originalPriceOverride;
    combo.currency = req.body.currency || combo.currency || "INR";
    if (req.body.status !== undefined) combo.status = String(req.body.status).toUpperCase();
    if (req.body.seoTitle !== undefined) combo.seoTitle = req.body.seoTitle;
    if (req.body.seoDescription !== undefined) combo.seoDescription = req.body.seoDescription;
    combo.allowDuplicateProducts = allowDuplicateProducts;
    combo.imageMode = req.body.imageMode === "CUSTOM_IMAGES" ? "CUSTOM_IMAGES" : "PRODUCT_IMAGES";
    combo.items = items;
    combo.selectionGroups = selectionGroups;
    combo.reviewIssues = [];
    combo.reviewedAt = new Date();

    await applyUploadedImages(combo, req.files);
    await combo.save();

    const saved = await populateComboQuery(ComboPack.findById(combo._id).select("-__v")).lean();
    res.status(200).json({ success: true, data: serializeCombo(saved) });
  } catch (error) {
    const statusCode = error?.code === 11000 ? 409 : 400;
    res.status(statusCode).json({
      success: false,
      message: error?.code === 11000 ? "Combo slug already exists" : error.message,
    });
  }
};

export const deleteComboPack = async (req, res) => {
  try {
    const combo = await ComboPack.findById(req.params.id);
    if (!combo) return res.status(404).json({ success: false, message: "Combo pack not found" });

    await Promise.all([
      combo.featuredImage ? deleteOptimizedImageSet(combo.featuredImage) : null,
      combo.bannerImage ? deleteOptimizedImageSet(combo.bannerImage) : null,
      ...(combo.galleryImages || []).map((image) => deleteOptimizedImageSet(image.url)),
    ]);
    await ComboPack.deleteOne({ _id: combo._id });

    res.status(200).json({ success: true, message: "Combo pack deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markAffectedCombosForReview = async (productId, reason = "Selected product changed") => {
  if (!mongoose.Types.ObjectId.isValid(productId)) return null;
  return ComboPack.updateMany(
    {
      $or: [
        { "items.product": productId },
        { "selectionGroups.eligibleProducts": productId },
      ],
    },
    {
      $set: { status: "REVIEW", reviewedAt: null },
      $addToSet: { reviewIssues: reason },
    }
  );
};
