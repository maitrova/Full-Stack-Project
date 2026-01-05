// controllers/homepageController.js
import { Design } from "../models/Design.js";
import ReadymadeProduct from "../models/readymadeproducts.js";
import mongoose from "mongoose";
import HomepageSelection from "../models/HomepageSelection.js";
export const getEligibleNewArrivals = async (req, res) => {
  try {
    const [designs, readymades] = await Promise.all([
      Design.find({ newArrivals: true })
        .select("_id title productName previewImage salePrice calculatedPrice basePrice newArrivals createdAt")
        .sort({ createdAt: -1 })
        .lean(),

      ReadymadeProduct.find({ newArrival: true })
        .select("_id title images price currency newArrival createdAt")
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const d = designs.map((x) => ({
      type: "design",
      _id: x._id,
      title: x.title || x.productName || "",
      previewImage: x.previewImage || null,
      price:
        (x.salePrice > 0 ? x.salePrice : x.calculatedPrice > 0 ? x.calculatedPrice : x.basePrice) ?? 0,
      createdAt: x.createdAt,
    }));

    const r = readymades.map((x) => ({
      type: "readymade",
      _id: x._id,
      title: x.title,
      previewImage: Array.isArray(x.images) && x.images[0] ? x.images[0] : null,
      price: x.price,
      currency: x.currency || "INR",
      createdAt: x.createdAt,
    }));

    return res.json({ success: true, eligible: [...d, ...r] });
  } catch (err) {
    console.error("getEligibleNewArrivals error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


export const setHomepageNewArrivals = async (req, res) => {
  try {
    const { items } = req.body;
    
    if (!Array.isArray(items) || items.length < 2 || items.length > 6) {
      return res.status(400).json({ success: false, message: "Select minimum 2 and maximum 6 items" });
    }

    // Validate each item
    for (const item of items) {
      if (!item?.itemType || !["design", "readymade"].includes(item.itemType)) {
        return res.status(400).json({ success: false, message: "Invalid itemType" });
      }
      if (!item?.itemId || !mongoose.Types.ObjectId.isValid(item.itemId)) {
        return res.status(400).json({ success: false, message: `Invalid itemId: ${item.itemId}` });
      }
    }

    // Check if the selected items exist and are eligible
    const designIds = items.filter(i => i.itemType === "design").map(i => i.itemId);
    const readymadeIds = items.filter(i => i.itemType === "readymade").map(i => i.itemId);

    const [designCount, readymadeCount] = await Promise.all([
      Design.countDocuments({ _id: { $in: designIds }, newArrivals: true }),
      ReadymadeProduct.countDocuments({ _id: { $in: readymadeIds }, newArrival: true })
    ]);

    if (designCount !== designIds.length || readymadeCount !== readymadeIds.length) {
      return res.status(400).json({ success: false, message: "Some selected items are not eligible" });
    }

    // Save selected items into HomepageSelection model
    const updatedSelection = await HomepageSelection.findOneAndUpdate(
      { key: "new_arrivals" },
      { $set: { items: items } },
      { upsert: true, new: true }
    );

    return res.json({ success: true, data: updatedSelection });
  } catch (err) {
    console.error("setHomepageNewArrivals error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


// Fetch the selected homepage new arrivals for frontend display
export const getHomepageNewArrivals = async (req, res) => {
  try {
    const selection = await HomepageSelection.findOne({ key: "new_arrivals" }).lean();

    if (!selection || !selection.items?.length) {
      return res.json({ success: true, items: [] });
    }

    const designIds = selection.items
      .filter((i) => i.itemType === "design")
      .map((i) => i.itemId);

    const readymadeIds = selection.items
      .filter((i) => i.itemType === "readymade")
      .map((i) => i.itemId);

    const [designs, readymades] = await Promise.all([
      designIds.length ? Design.find({ _id: { $in: designIds } }).lean() : [],
      readymadeIds.length ? ReadymadeProduct.find({ _id: { $in: readymadeIds } }).lean() : [],
    ]);

    const items = [
      ...designs.map((d) => {
        // ✅ collect all view preview images (max 4 if you want)
        const viewPreviewImages = Array.isArray(d.views)
          ? d.views
              .map((v) => v?.previewImage)
              .filter(Boolean) // removes null/undefined/""
          : [];

        return {
          type: "design",
          _id: d._id,
          title: d.title || d.productName || "",
          // keep single (optional)
          previewImage: d.previewImage || viewPreviewImages[0] || null,
          // ✅ new array
          previewImages: viewPreviewImages, // <-- all view preview images
          price: d.salePrice || d.calculatedPrice || d.basePrice || 0,
          createdAt: d.createdAt,
        };
      }),

      ...readymades.map((p) => {
        const imgs = Array.isArray(p.images) ? p.images.filter(Boolean) : [];

        return {
          type: "readymade",
          _id: p._id,
          title: p.title,
          // keep single (optional)
          previewImage: imgs[0] || null,
          // ✅ new array (all up to 4)
          previewImages: imgs, // <-- all images
          price: p.price ?? 0,
          currency: p.currency || "INR",
          createdAt: p.createdAt,
        };
      }),
    ];

    return res.json({ success: true, items });
  } catch (err) {
    console.error("getHomepageNewArrivals error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ================================
// BEST SELLERS (same as New Arrivals)
// ================================

export const getEligibleBestSellers = async (req, res) => {
  try {
    const [designs, readymades] = await Promise.all([
      Design.find({ bestSeller: true })
        .select("_id title productName previewImage salePrice calculatedPrice basePrice bestSeller createdAt")
        .sort({ createdAt: -1 })
        .lean(),

      ReadymadeProduct.find({ bestSeller: true })
        .select("_id title images price currency bestSeller createdAt")
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const d = designs.map((x) => ({
      type: "design",
      _id: x._id,
      title: x.title || x.productName || "",
      previewImage: x.previewImage || null,
      price:
        (x.salePrice > 0 ? x.salePrice : x.calculatedPrice > 0 ? x.calculatedPrice : x.basePrice) ?? 0,
      createdAt: x.createdAt,
    }));

    const r = readymades.map((x) => ({
      type: "readymade",
      _id: x._id,
      title: x.title,
      previewImage: Array.isArray(x.images) && x.images[0] ? x.images[0] : null,
      price: x.price,
      currency: x.currency || "INR",
      createdAt: x.createdAt,
    }));

    return res.json({ success: true, eligible: [...d, ...r] });
  } catch (err) {
    console.error("getEligibleBestSellers error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const setHomepageBestSellers = async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length < 2 || items.length > 6) {
      return res.status(400).json({ success: false, message: "Select minimum 2 and maximum 6 items" });
    }

    for (const item of items) {
      if (!item?.itemType || !["design", "readymade"].includes(item.itemType)) {
        return res.status(400).json({ success: false, message: "Invalid itemType" });
      }
      if (!item?.itemId || !mongoose.Types.ObjectId.isValid(item.itemId)) {
        return res.status(400).json({ success: false, message: `Invalid itemId: ${item.itemId}` });
      }
    }

    const designIds = items.filter((i) => i.itemType === "design").map((i) => i.itemId);
    const readymadeIds = items.filter((i) => i.itemType === "readymade").map((i) => i.itemId);

    const [designCount, readymadeCount] = await Promise.all([
      Design.countDocuments({ _id: { $in: designIds }, bestSeller: true }),
      ReadymadeProduct.countDocuments({ _id: { $in: readymadeIds }, bestSeller: true }),
    ]);

    if (designCount !== designIds.length || readymadeCount !== readymadeIds.length) {
      return res.status(400).json({ success: false, message: "Some selected items are not eligible" });
    }

    const updatedSelection = await HomepageSelection.findOneAndUpdate(
      { key: "best_sellers" },
      { $set: { items: items } },
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
      .filter((i) => i.itemType === "design")
      .map((i) => i.itemId);

    const readymadeIds = selection.items
      .filter((i) => i.itemType === "readymade")
      .map((i) => i.itemId);

    const [designs, readymades] = await Promise.all([
      designIds.length ? Design.find({ _id: { $in: designIds } }).lean() : [],
      readymadeIds.length ? ReadymadeProduct.find({ _id: { $in: readymadeIds } }).lean() : [],
    ]);

    const items = [
      ...designs.map((d) => {
        const viewPreviewImages = Array.isArray(d.views)
          ? d.views.map((v) => v?.previewImage).filter(Boolean)
          : [];

        return {
          type: "design",
          _id: d._id,
          title: d.title || d.productName || "",
          previewImage: d.previewImage || viewPreviewImages[0] || null,
          previewImages: viewPreviewImages,
          price: d.salePrice || d.calculatedPrice || d.basePrice || 0,
          createdAt: d.createdAt,
        };
      }),

      ...readymades.map((p) => {
        const imgs = Array.isArray(p.images) ? p.images.filter(Boolean) : [];

        return {
          type: "readymade",
          _id: p._id,
          title: p.title,
          previewImage: imgs[0] || null,
          previewImages: imgs,
          price: p.price ?? 0,
          currency: p.currency || "INR",
          createdAt: p.createdAt,
        };
      }),
    ];

    return res.json({ success: true, items });
  } catch (err) {
    console.error("getHomepageBestSellers error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
