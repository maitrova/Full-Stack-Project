import Coupon from "../models/Coupon.js";
import CouponRedemption from "../models/CouponRedemption.js";
import Order from "../models/Order.js";
import { getReadymadePricing } from "../utils/readymadePricing.js";

const normalizeCode = (value) => String(value || "").trim().toUpperCase();

const startOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const getItemProductIds = (item) => {
  const ids = [];
  for (const candidate of [item.readymadeProduct, item.dropproduct, item.product]) {
    const value = candidate?._id || candidate;
    if (value) ids.push(String(value));
  }
  return ids;
};

const getItemCategoryIds = (item) => {
  const ids = [];
  const candidates = [
    item.readymadeProduct?.category?._id,
    item.readymadeProduct?.category,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    ids.push(String(candidate));
  }

  return ids;
};

const getItemSubCategoryIds = (item) => {
  const ids = [];
  const candidates = [
    item.readymadeProduct?.subCategory?._id,
    item.readymadeProduct?.subCategory,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    ids.push(String(candidate));
  }

  return ids;
};

export const buildCartPricingContext = (cart) => {
  let subtotal = 0;

  const categoryIdSet = new Set();
  const subCategoryIdSet = new Set();
  const productIdSet = new Set();
  let saleItemCount = 0;

  for (const item of cart?.items || []) {
    let effectiveUnitPrice = Number(item.unitPrice || 0);

    if (item.kind === "READYMADE" && item.readymadeProduct) {
      const selectedSize = String(item.size || "").trim().toUpperCase();
      const variant = Array.isArray(item.readymadeProduct.variants)
        ? item.readymadeProduct.variants.find(
            (entry) => String(entry.size).toUpperCase() === selectedSize
          )
        : null;
      const pricing = getReadymadePricing(item.readymadeProduct, { variant });
      effectiveUnitPrice = pricing.effectivePrice;
      if (pricing.saleActive) {
        saleItemCount += Number(item.qty || 0);
      }
    }

    subtotal += effectiveUnitPrice * Number(item.qty || 0);

    for (const categoryId of getItemCategoryIds(item)) {
      categoryIdSet.add(categoryId);
    }
    for (const subCategoryId of getItemSubCategoryIds(item)) {
      subCategoryIdSet.add(subCategoryId);
    }
    for (const productId of getItemProductIds(item)) {
      productIdSet.add(productId);
    }
  }

  return {
    subtotal,
    categoryIdSet,
    subCategoryIdSet,
    productIdSet,
    saleItemCount,
    itemCount: cart?.items?.length || 0,
  };
};

const getPaidOrderCountForUser = async (userId) => {
  return Order.countDocuments({ user: userId, status: "PAID" });
};

const getUsageStats = async ({ couponId, userId, now }) => {
  const [totalUsedCount, perUserUsedCount, dailyUsedCount] = await Promise.all([
    CouponRedemption.countDocuments({ coupon: couponId }),
    CouponRedemption.countDocuments({ coupon: couponId, user: userId }),
    CouponRedemption.countDocuments({
      coupon: couponId,
      createdAt: { $gte: startOfDay(now), $lte: endOfDay(now) },
    }),
  ]);

  return { totalUsedCount, perUserUsedCount, dailyUsedCount };
};

export const validateCouponForCart = async ({ couponCode, cart, userId }) => {
  const code = normalizeCode(couponCode);
  if (!code) {
    return { valid: false, reason: "Coupon code is required" };
  }

  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
    return { valid: false, reason: "Cart is empty" };
  }

  const coupon = await Coupon.findOne({ code });
  if (!coupon) {
    return { valid: false, reason: "Coupon not found" };
  }

  if (coupon.status !== "ACTIVE") {
    return { valid: false, reason: "Coupon is not active" };
  }

  const now = new Date();
  if (coupon.startDate > now) {
    return { valid: false, reason: "Coupon is not active yet" };
  }
  if (coupon.endDate < now) {
    return { valid: false, reason: "Coupon has expired" };
  }

  const context = buildCartPricingContext(cart);

  if (context.saleItemCount > 0) {
    return { valid: false, reason: "Coupons cannot be applied to sale items" };
  }

  if (context.subtotal < Number(coupon.minimumCartAmount || 0)) {
    return {
      valid: false,
      reason: `Minimum cart amount is ${coupon.minimumCartAmount}`,
    };
  }

  const allowedCategoryIds = new Set((coupon.allowedCategories || []).map((id) => String(id)));
  const allowedSubCategoryIds = new Set(
    (coupon.allowedSubCategories || []).map((id) => String(id))
  );

  if (allowedCategoryIds.size > 0 || allowedSubCategoryIds.size > 0) {
    const hasAllowedCategory = [...context.categoryIdSet].some((id) =>
      allowedCategoryIds.has(id)
    );
    const hasAllowedSubCategory = [...context.subCategoryIdSet].some((id) =>
      allowedSubCategoryIds.has(id)
    );

    if (!hasAllowedCategory && !hasAllowedSubCategory) {
      return { valid: false, reason: "Coupon is not applicable to these categories" };
    }
  }

  const excludedProducts = new Set((coupon.excludedProducts || []).map((id) => String(id)));
  if ([...context.productIdSet].some((id) => excludedProducts.has(id))) {
    return { valid: false, reason: "Coupon is not applicable to one or more cart items" };
  }

  const [usageStats, paidOrderCount] = await Promise.all([
    getUsageStats({ couponId: coupon._id, userId, now }),
    getPaidOrderCountForUser(userId),
  ]);

  if (usageStats.totalUsedCount >= coupon.totalUsageLimit) {
    return { valid: false, reason: "Coupon usage limit reached" };
  }

  if (usageStats.perUserUsedCount >= coupon.perUserUsageLimit) {
    return { valid: false, reason: "Per-user coupon usage limit reached" };
  }

  if (coupon.dailyUsageLimit && usageStats.dailyUsedCount >= coupon.dailyUsageLimit) {
    return { valid: false, reason: "Daily coupon usage limit reached" };
  }

  if ((coupon.newCustomersOnly || coupon.firstOrderOnly) && paidOrderCount > 0) {
    return { valid: false, reason: "Coupon is only valid for first-time customers" };
  }

  let discount = 0;
  if (coupon.discountType === "PERCENTAGE") {
    discount = (context.subtotal * coupon.discountValue) / 100;
    if (coupon.maximumDiscountAmount !== null && coupon.maximumDiscountAmount !== undefined) {
      discount = Math.min(discount, coupon.maximumDiscountAmount);
    }
  } else {
    discount = coupon.discountValue;
  }

  discount = Math.min(context.subtotal, Math.max(0, Math.round(discount * 100) / 100));

  if (discount <= 0) {
    return { valid: false, reason: "Coupon does not apply any discount" };
  }

  return {
    valid: true,
    coupon,
    discount,
    cartSubtotal: context.subtotal,
    couponSnapshot: {
      couponId: coupon._id,
      code: coupon.code,
      description: coupon.description || "",
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      maximumDiscountAmount: coupon.maximumDiscountAmount,
      discountApplied: discount,
      campaignTag: coupon.campaignTag || "",
    },
  };
};

export const redeemCouponForOrder = async ({ couponSnapshot, userId, orderId }) => {
  if (!couponSnapshot?.couponId || !couponSnapshot?.code) {
    return null;
  }

  const existing = await CouponRedemption.findOne({ order: orderId });
  if (existing) {
    return existing;
  }

  const redemption = await CouponRedemption.create({
    coupon: couponSnapshot.couponId,
    user: userId,
    order: orderId,
    code: couponSnapshot.code,
    discountApplied: couponSnapshot.discountApplied || 0,
  });

  await Coupon.updateOne(
    { _id: couponSnapshot.couponId },
    { $inc: { totalUsedCount: 1 } }
  );

  return redemption;
};
