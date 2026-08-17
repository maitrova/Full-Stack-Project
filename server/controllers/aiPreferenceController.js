import Order from "../models/Order.js";
import { Cart } from "../models/Cart.js";
import UserBehaviorEvent from "../models/UserBehaviorEvent.js";
import UserPreferenceProfile from "../models/UserPreferenceProfile.js";

const increment = (map, key, amount = 1) => {
  const normalizedKey = String(key || "").trim();
  if (!normalizedKey) return;
  map.set(normalizedKey, (map.get(normalizedKey) || 0) + amount);
};

const topKeys = (map, limit = 5) =>
  [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => key);

const getReadymadeProduct = (item) => item.readymadeProduct || item.dropproduct || null;

const collectItemPreference = (item, maps) => {
  const product = getReadymadeProduct(item);
  const weight = Math.max(Number(item.qty || 1), 1);

  increment(maps.sizes, item.size, weight);

  if (product) {
    increment(maps.categories, product.category?.name || product.category, weight);
    increment(maps.subCategories, product.subCategory?.name || product.subCategory, weight);
    increment(maps.productNames, product.title, weight);

    const text = `${product.title || ""} ${product.description || ""}`.toLowerCase();
    ["black", "white", "blue", "red", "green", "yellow", "pink", "purple", "brown", "grey", "gray"].forEach((color) => {
      if (text.includes(color)) increment(maps.colors, color, weight);
    });
  }

  if (Number(item.unitPrice || 0) > 0) {
    maps.prices.push(Number(item.unitPrice));
  }
};

const buildPreferenceSummary = ({ orders = [], cart = null }) => {
  const maps = {
    sizes: new Map(),
    categories: new Map(),
    subCategories: new Map(),
    colors: new Map(),
    productNames: new Map(),
    prices: [],
  };

  orders.forEach((order) => {
    (order.items || []).forEach((item) => collectItemPreference(item, maps));
  });

  (cart?.items || []).forEach((item) => collectItemPreference(item, maps));

  const prices = maps.prices;
  const averagePrice = prices.length
    ? Math.round(prices.reduce((sum, price) => sum + price, 0) / prices.length)
    : null;

  return {
    preferred_sizes: topKeys(maps.sizes),
    preferred_categories: topKeys(maps.categories),
    preferred_subcategories: topKeys(maps.subCategories),
    preferred_colors: topKeys(maps.colors),
    liked_product_names: topKeys(maps.productNames),
    average_price: averagePrice,
    order_count: orders.length,
    cart_item_count: cart?.items?.length || 0,
  };
};

const buildBehaviorPreferenceSummary = (events = []) => {
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

  return {
    viewed_categories: topKeys(categories),
    viewed_subcategories: topKeys(subCategories),
    viewed_product_names: topKeys(productNames),
    long_viewed_products: topKeys(longViewedProducts),
    behavior_event_count: events.length,
  };
};

const mergeUnique = (...lists) => {
  const seen = new Set();
  const merged = [];

  lists.flat().forEach((value) => {
    const normalizedValue = String(value || "").trim();
    const key = normalizedValue.toLowerCase();
    if (!normalizedValue || seen.has(key)) return;
    seen.add(key);
    merged.push(normalizedValue);
  });

  return merged.slice(0, 8);
};

const serializeProfile = (profile) => ({
  preferred_sizes: profile.preferredSizes || [],
  preferred_categories: profile.preferredCategories || [],
  preferred_subcategories: profile.preferredSubCategories || [],
  preferred_colors: profile.preferredColors || [],
  liked_product_names: profile.likedProductNames || [],
  long_viewed_products: profile.longViewedProducts || [],
  average_price: profile.averagePrice,
  order_count: profile.orderCount || 0,
  cart_item_count: profile.cartItemCount || 0,
  behavior_event_count: profile.behaviorEventCount || 0,
  profile_updated_at: profile.lastComputedAt,
});

export const rebuildUserPreferenceProfile = async (userId) => {
  const orders = await Order.find({ user: userId, status: { $in: ["PAID", "PENDING_PAYMENT"] } })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate({
      path: "items.readymadeProduct",
      populate: [
        { path: "category", select: "name" },
        { path: "subCategory", select: "name" },
      ],
    })
    .populate({
      path: "items.dropproduct",
      populate: [
        { path: "category", select: "name" },
        { path: "subCategory", select: "name" },
      ],
    })
    .lean();

  const cart = await Cart.findOne({ user: userId, status: "ACTIVE" })
    .populate({
      path: "items.readymadeProduct",
      populate: [
        { path: "category", select: "name" },
        { path: "subCategory", select: "name" },
      ],
    })
    .populate({
      path: "items.dropproduct",
      populate: [
        { path: "category", select: "name" },
        { path: "subCategory", select: "name" },
      ],
    })
    .lean();

  const events = await UserBehaviorEvent.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(160)
    .lean();

  const purchaseSummary = buildPreferenceSummary({ orders, cart });
  const behaviorSummary = buildBehaviorPreferenceSummary(events);

  const profile = await UserPreferenceProfile.findOneAndUpdate(
    { user: userId },
    {
      $set: {
        preferredSizes: purchaseSummary.preferred_sizes,
        preferredCategories: mergeUnique(
          purchaseSummary.preferred_categories,
          behaviorSummary.viewed_categories
        ),
        preferredSubCategories: mergeUnique(
          purchaseSummary.preferred_subcategories,
          behaviorSummary.viewed_subcategories
        ),
        preferredColors: purchaseSummary.preferred_colors,
        likedProductNames: mergeUnique(
          purchaseSummary.liked_product_names,
          behaviorSummary.viewed_product_names
        ),
        longViewedProducts: behaviorSummary.long_viewed_products,
        averagePrice: purchaseSummary.average_price,
        orderCount: purchaseSummary.order_count,
        cartItemCount: purchaseSummary.cart_item_count,
        behaviorEventCount: behaviorSummary.behavior_event_count,
        lastComputedAt: new Date(),
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();

  return profile;
};

export const getUserPreferenceSummary = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const profile = await rebuildUserPreferenceProfile(userId);
    return res.status(200).json({
      success: true,
      data: serializeProfile(profile),
    });
  } catch (error) {
    console.error("getUserPreferenceSummary error:", error);
    return res.status(500).json({ message: "Failed to build user preferences" });
  }
};

export const refreshUserPreferenceProfile = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const profile = await rebuildUserPreferenceProfile(userId);
    return res.status(200).json({
      success: true,
      data: serializeProfile(profile),
    });
  } catch (error) {
    console.error("refreshUserPreferenceProfile error:", error);
    return res.status(500).json({ message: "Failed to refresh user preference profile" });
  }
};
