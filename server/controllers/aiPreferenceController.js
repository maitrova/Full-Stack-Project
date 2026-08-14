import Order from "../models/Order.js";
import { Cart } from "../models/Cart.js";

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

export const getUserPreferenceSummary = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Not authorized" });
    }

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

    return res.status(200).json({
      success: true,
      data: buildPreferenceSummary({ orders, cart }),
    });
  } catch (error) {
    console.error("getUserPreferenceSummary error:", error);
    return res.status(500).json({ message: "Failed to build user preferences" });
  }
};
