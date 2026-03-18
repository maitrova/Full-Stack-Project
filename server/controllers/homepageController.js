// controllers/homepageController.js
import { Design } from "../models/Design.js";
import ReadymadeProduct from "../models/readymadeproducts.js";
import mongoose from "mongoose";
import HomepageSelection from "../models/HomepageSelection.js";
import { attachReadymadePricing } from "../utils/readymadePricing.js";

const normalizeDesignHomepageItem = (design) => {
  const viewPreviewImages = Array.isArray(design.views)
    ? design.views.map((view) => view?.previewImage).filter(Boolean)
    : [];

  return {
    type: "design",
    _id: design._id,
    title: design.title || design.productName || "",
    previewImage: design.previewImage || viewPreviewImages[0] || null,
    previewImages: viewPreviewImages,
    price:
      (design.salePrice > 0
        ? design.salePrice
        : design.calculatedPrice > 0
          ? design.calculatedPrice
          : design.basePrice) ?? 0,
    createdAt: design.createdAt,
  };
};

const normalizeReadymadeHomepageItem = (product) => {
  const pricedProduct = attachReadymadePricing({ ...product });
  const images = Array.isArray(pricedProduct.images)
    ? pricedProduct.images
        .map((img) =>
          typeof img === "string"
            ? img
            : img?.url
              ? {
                  url: img.url,
                  altText: img.altText || pricedProduct.title || "Product image",
                }
              : null
        )
        .filter(Boolean)
    : [];

  const previewImage =
    pricedProduct.thumbnail ||
    (typeof images[0] === "string" ? images[0] : images[0]?.url) ||
    null;

  const previewImages = previewImage
    ? [
        previewImage,
        ...images.filter((img) => {
          const imageUrl = typeof img === "string" ? img : img?.url;
          return imageUrl && imageUrl !== previewImage;
        }),
      ]
    : images;

  return {
    type: "readymade",
    _id: pricedProduct._id,
    title: pricedProduct.title,
    previewImage,
    previewImages,
    price: pricedProduct.effectivePrice ?? pricedProduct.price ?? 0,
    mrp: pricedProduct.mrp ?? pricedProduct.price ?? 0,
    originalPrice: pricedProduct.originalPrice ?? pricedProduct.price ?? 0,
    offerPrice: pricedProduct.offerPrice ?? null,
    saleActive: Boolean(pricedProduct.saleActive),
    offerActive: Boolean(pricedProduct.offerActive),
    saveAmount: pricedProduct.saveAmount ?? 0,
    discountPercent: pricedProduct.discountPercent ?? 0,
    currency: pricedProduct.currency || "INR",
    createdAt: pricedProduct.createdAt,
  };
};

export const getEligibleNewArrivals = async (req, res) => {
  try {
    const [designs, readymades] = await Promise.all([
      Design.find({ newArrivals: true })
        .select("_id title productName previewImage views salePrice calculatedPrice basePrice newArrivals createdAt")
        .sort({ createdAt: -1 })
        .lean(),
      ReadymadeProduct.find({ newArrival: true })
        .select(
          "_id title images thumbnail price salePrice saleStartAt saleEndAt variants currency newArrival createdAt"
        )
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    return res.json({
      success: true,
      eligible: [
        ...designs.map(normalizeDesignHomepageItem),
        ...readymades.map(normalizeReadymadeHomepageItem),
      ],
    });
  } catch (err) {
    console.error("getEligibleNewArrivals error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const setHomepageNewArrivals = async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length < 2) {
      return res.status(400).json({ success: false, message: "Select at least 2 items" });
    }

    for (const item of items) {
      if (!item?.itemType || !["design", "readymade"].includes(item.itemType)) {
        return res.status(400).json({ success: false, message: "Invalid itemType" });
      }
      if (!item?.itemId || !mongoose.Types.ObjectId.isValid(item.itemId)) {
        return res.status(400).json({ success: false, message: `Invalid itemId: ${item.itemId}` });
      }
    }

    const designIds = items.filter((item) => item.itemType === "design").map((item) => item.itemId);
    const readymadeIds = items.filter((item) => item.itemType === "readymade").map((item) => item.itemId);

    const [designCount, readymadeCount] = await Promise.all([
      Design.countDocuments({ _id: { $in: designIds }, newArrivals: true }),
      ReadymadeProduct.countDocuments({ _id: { $in: readymadeIds }, newArrival: true }),
    ]);

    if (designCount !== designIds.length || readymadeCount !== readymadeIds.length) {
      return res.status(400).json({ success: false, message: "Some selected items are not eligible" });
    }

    const updatedSelection = await HomepageSelection.findOneAndUpdate(
      { key: "new_arrivals" },
      { $set: { items } },
      { upsert: true, new: true }
    );

    return res.json({ success: true, data: updatedSelection });
  } catch (err) {
    console.error("setHomepageNewArrivals error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getHomepageNewArrivals = async (req, res) => {
  try {
    const selection = await HomepageSelection.findOne({ key: "new_arrivals" }).lean();

    if (!selection || !selection.items?.length) {
      return res.json({ success: true, items: [] });
    }

    const designIds = selection.items
      .filter((item) => item.itemType === "design")
      .map((item) => item.itemId);
    const readymadeIds = selection.items
      .filter((item) => item.itemType === "readymade")
      .map((item) => item.itemId);

    const [designs, readymades] = await Promise.all([
      designIds.length ? Design.find({ _id: { $in: designIds } }).lean() : [],
      readymadeIds.length ? ReadymadeProduct.find({ _id: { $in: readymadeIds } }).lean() : [],
    ]);

    return res.json({
      success: true,
      items: [
        ...designs.map(normalizeDesignHomepageItem),
        ...readymades.map(normalizeReadymadeHomepageItem),
      ],
    });
  } catch (err) {
    console.error("getHomepageNewArrivals error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getEligibleBestSellers = async (req, res) => {
  try {
    const [designs, readymades] = await Promise.all([
      Design.find({ bestSeller: true })
        .select("_id title productName previewImage views salePrice calculatedPrice basePrice bestSeller createdAt")
        .sort({ createdAt: -1 })
        .lean(),
      ReadymadeProduct.find({ bestSeller: true })
        .select(
          "_id title images thumbnail price salePrice saleStartAt saleEndAt variants currency bestSeller createdAt"
        )
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    return res.json({
      success: true,
      eligible: [
        ...designs.map(normalizeDesignHomepageItem),
        ...readymades.map(normalizeReadymadeHomepageItem),
      ],
    });
  } catch (err) {
    console.error("getEligibleBestSellers error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const setHomepageBestSellers = async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length < 2) {
      return res.status(400).json({ success: false, message: "Select at least 2 items" });
    }

    for (const item of items) {
      if (!item?.itemType || !["design", "readymade"].includes(item.itemType)) {
        return res.status(400).json({ success: false, message: "Invalid itemType" });
      }
      if (!item?.itemId || !mongoose.Types.ObjectId.isValid(item.itemId)) {
        return res.status(400).json({ success: false, message: `Invalid itemId: ${item.itemId}` });
      }
    }

    const designIds = items.filter((item) => item.itemType === "design").map((item) => item.itemId);
    const readymadeIds = items.filter((item) => item.itemType === "readymade").map((item) => item.itemId);

    const [designCount, readymadeCount] = await Promise.all([
      Design.countDocuments({ _id: { $in: designIds }, bestSeller: true }),
      ReadymadeProduct.countDocuments({ _id: { $in: readymadeIds }, bestSeller: true }),
    ]);

    if (designCount !== designIds.length || readymadeCount !== readymadeIds.length) {
      return res.status(400).json({ success: false, message: "Some selected items are not eligible" });
    }

    const updatedSelection = await HomepageSelection.findOneAndUpdate(
      { key: "best_sellers" },
      { $set: { items } },
      { upsert: true, new: true }
    );

    return res.json({ success: true, data: updatedSelection });
  } catch (err) {
    console.error("setHomepageBestSellers error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getHomepageBestSellers = async (req, res) => {
  try {
    const selection = await HomepageSelection.findOne({ key: "best_sellers" }).lean();

    if (!selection || !selection.items?.length) {
      return res.json({ success: true, items: [] });
    }

    const designIds = selection.items
      .filter((item) => item.itemType === "design")
      .map((item) => item.itemId);
    const readymadeIds = selection.items
      .filter((item) => item.itemType === "readymade")
      .map((item) => item.itemId);

    const [designs, readymades] = await Promise.all([
      designIds.length ? Design.find({ _id: { $in: designIds } }).lean() : [],
      readymadeIds.length ? ReadymadeProduct.find({ _id: { $in: readymadeIds } }).lean() : [],
    ]);

    return res.json({
      success: true,
      items: [
        ...designs.map(normalizeDesignHomepageItem),
        ...readymades.map(normalizeReadymadeHomepageItem),
      ],
    });
  } catch (err) {
    console.error("getHomepageBestSellers error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
