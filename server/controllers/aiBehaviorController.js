import mongoose from "mongoose";
import UserBehaviorEvent from "../models/UserBehaviorEvent.js";
import { rebuildUserPreferenceProfile } from "./aiPreferenceController.js";

const safeString = (value) => String(value || "").trim().slice(0, 240);

const increment = (map, key, amount = 1) => {
  const normalizedKey = safeString(key);
  if (!normalizedKey) return;
  map.set(normalizedKey, (map.get(normalizedKey) || 0) + amount);
};

const topKeys = (map, limit = 6) =>
  [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => key);

export const trackBehaviorEvent = async (req, res) => {
  try {
    const body = req.body || {};
    const eventType = safeString(body.eventType).toUpperCase();
    const guestId = safeString(req.headers["x-ai-session-id"] || body.sessionId);
    const productId = safeString(body.productId);

    if (!eventType) {
      return res.status(400).json({ message: "eventType is required" });
    }

    if (!req.user?._id && !guestId) {
      return res.status(400).json({ message: "A user token or AI session id is required" });
    }

    const event = await UserBehaviorEvent.create({
      user: req.user?._id || null,
      guestId,
      eventType,
      path: safeString(body.path),
      pageType: safeString(body.pageType),
      productId: mongoose.Types.ObjectId.isValid(productId) ? productId : null,
      productName: safeString(body.productName),
      category: safeString(body.category),
      subCategory: safeString(body.subCategory),
      dwellMs: Math.max(Number(body.dwellMs || 0), 0),
      metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
    });

    if (req.user?._id) {
      rebuildUserPreferenceProfile(req.user._id).catch((error) => {
        console.warn("Preference profile background refresh failed:", error.message);
      });
    }

    return res.status(201).json({ success: true, data: { id: event._id } });
  } catch (error) {
    console.error("trackBehaviorEvent error:", error);
    return res.status(500).json({ message: "Failed to track behavior event" });
  }
};

export const getBehaviorSummary = async (req, res) => {
  try {
    const guestId = safeString(req.headers["x-ai-session-id"] || req.query.sessionId);
    const query = req.user?._id ? { user: req.user._id } : { guestId };

    if (!query.user && !query.guestId) {
      return res.status(400).json({ message: "A user token or AI session id is required" });
    }

    const events = await UserBehaviorEvent.find(query)
      .sort({ createdAt: -1 })
      .limit(120)
      .lean();

    const categories = new Map();
    const subCategories = new Map();
    const productNames = new Map();
    const longViewedProducts = new Map();

    events.forEach((event) => {
      const weight = event.eventType === "PRODUCT_DWELL"
        ? Math.max(Math.round(Number(event.dwellMs || 0) / 10000), 1)
        : 1;

      increment(categories, event.category, weight);
      increment(subCategories, event.subCategory, weight);
      increment(productNames, event.productName, weight);

      if (event.eventType === "PRODUCT_DWELL" && Number(event.dwellMs || 0) >= 12000) {
        increment(longViewedProducts, event.productName, weight);
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        viewed_categories: topKeys(categories),
        viewed_subcategories: topKeys(subCategories),
        viewed_product_names: topKeys(productNames),
        long_viewed_products: topKeys(longViewedProducts),
        event_count: events.length,
      },
    });
  } catch (error) {
    console.error("getBehaviorSummary error:", error);
    return res.status(500).json({ message: "Failed to build behavior summary" });
  }
};
