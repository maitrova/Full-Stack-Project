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
  let saleItemCount = 0;
  const items = [];

  for (const item of cart?.items || []) {
    let effectiveUnitPrice = Number(item.unitPrice || 0);
    let saleActive = false;

    const sourceProduct =
      item.kind === "READYMADE" ? item.dropproduct || item.readymadeProduct : null;

    if (sourceProduct) {
      const selectedSize = String(item.size || "").trim().toUpperCase();
      const variant = Array.isArray(sourceProduct.variants)
        ? sourceProduct.variants.find(
            (entry) => String(entry.size).toUpperCase() === selectedSize
          )
        : null;
      const pricing = getReadymadePricing(sourceProduct, { variant });
      effectiveUnitPrice = pricing.effectivePrice;
      saleActive = Boolean(pricing.saleActive);
      if (saleActive) {
        saleItemCount += Number(item.qty || 0);
      }
    }

    const quantity = Number(item.qty || 0);
    const lineSubtotal = effectiveUnitPrice * quantity;
    subtotal += lineSubtotal;

    const categoryIds = getItemCategoryIds(item);
    const subCategoryIds = getItemSubCategoryIds(item);
    const productIds = getItemProductIds(item);

    items.push({
      categoryIds,
      subCategoryIds,
      productIds,
      quantity,
      lineSubtotal,
      saleActive,
    });
  }

  return {
    subtotal,
    saleItemCount,
    itemCount: cart?.items?.length || 0,
    items,
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
  const allowedCategoryIds = new Set((coupon.allowedCategories || []).map((id) => String(id)));
  const allowedSubCategoryIds = new Set(
    (coupon.allowedSubCategories || []).map((id) => String(id))
  );
  const allowedProductIds = new Set((coupon.allowedProducts || []).map((id) => String(id)));
  const excludedProducts = new Set((coupon.excludedProducts || []).map((id) => String(id)));

  let eligibleItems = context.items.filter((item) => {
    if (!coupon.allowOnSaleProducts && item.saleActive) {
      return false;
    }

    if (item.productIds.some((id) => excludedProducts.has(id))) {
      return false;
    }

    const hasProductRule = allowedProductIds.size > 0;
    const hasCategoryRule = allowedCategoryIds.size > 0 || allowedSubCategoryIds.size > 0;

    if (!hasProductRule && !hasCategoryRule) {
      return true;
    }

    const matchesProduct = item.productIds.some((id) => allowedProductIds.has(id));
    const matchesCategory = item.categoryIds.some((id) => allowedCategoryIds.has(id));
    const matchesSubCategory = item.subCategoryIds.some((id) => allowedSubCategoryIds.has(id));

    return matchesProduct || matchesCategory || matchesSubCategory;
  });

  const eligibleSubtotal = eligibleItems.reduce(
    (sum, item) => sum + Number(item.lineSubtotal || 0),
    0
  );

  if (eligibleItems.length === 0 || eligibleSubtotal <= 0) {
    if (!coupon.allowOnSaleProducts && context.saleItemCount > 0) {
      return { valid: false, reason: "Coupon is not applicable to sale items" };
    }
    return { valid: false, reason: "Coupon is not applicable to these cart items" };
  }

  if (eligibleSubtotal < Number(coupon.minimumCartAmount || 0)) {
    return {
      valid: false,
      reason: `Minimum cart amount is ${coupon.minimumCartAmount}`,
    };
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
    discount = (eligibleSubtotal * coupon.discountValue) / 100;
    if (coupon.maximumDiscountAmount !== null && coupon.maximumDiscountAmount !== undefined) {
      discount = Math.min(discount, coupon.maximumDiscountAmount);
    }
  } else {
    discount = coupon.discountValue;
  }

  discount = Math.min(eligibleSubtotal, Math.max(0, Math.round(discount * 100) / 100));

  if (discount <= 0) {
    return { valid: false, reason: "Coupon does not apply any discount" };
  }

  return {
    valid: true,
    coupon,
    discount,
    cartSubtotal: context.subtotal,
    eligibleSubtotal,
    couponSnapshot: {
      couponId: coupon._id,
      code: coupon.code,
      description: coupon.description || "",
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      maximumDiscountAmount: coupon.maximumDiscountAmount,
      discountApplied: discount,
      eligibleSubtotal,
      campaignTag: coupon.campaignTag || "",
      allowOnSaleProducts: Boolean(coupon.allowOnSaleProducts),
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
