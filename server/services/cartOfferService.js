import mongoose from "mongoose";
import CartOfferRule from "../models/CartOfferRule.js";
import ReadymadeProduct from "../models/readymadeproducts.js";
import { getReadymadePricing } from "../utils/readymadePricing.js";

const refId = (value) => {
  const id = value?._id || value;
  return id ? String(id) : "";
};

const formatRupees = (value) => `Rs.${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;

// Flattens a cart item (populated or not) into what the offer rules look at.
export const toOfferLine = (item) => {
  const product = item?.readymadeProduct || item?.dropproduct || null;
  return {
    kind: item?.kind || "",
    productId: refId(product),
    categoryId: refId(product?.category),
    lineTotal: Number(item?.unitPrice || 0) * Number(item?.qty || 0),
    saleActive: Boolean(item?.priceDetails?.saleActive),
  };
};

const isLineEligible = (line, rule) => {
  if (line.kind === "COMBO" && !rule.includeComboPacks) return false;
  if (line.saleActive && !rule.includeSaleItems) return false;

  const excluded = (rule.excludedProducts || []).map(String);
  if (line.productId && excluded.includes(line.productId)) return false;

  const allowedCategories = (rule.allowedCategories || []).map(refId);
  if (allowedCategories.length && !allowedCategories.includes(line.categoryId)) return false;

  return true;
};

// Whole rupees, rounded down, never more than the eligible amount.
export const getTierDiscount = (tier, eligibleAmount) => {
  const amount = Math.max(0, Number(eligibleAmount || 0));
  let discount =
    tier.discountType === "PERCENTAGE"
      ? (amount * Number(tier.discountValue || 0)) / 100
      : Number(tier.discountValue || 0);

  const cap = Number(tier.maximumDiscountAmount || 0);
  if (cap > 0) discount = Math.min(discount, cap);

  return Math.floor(Math.min(discount, amount));
};

export const getTierBenefitText = (tier) => {
  if (tier.discountType === "PERCENTAGE") {
    const cap = Number(tier.maximumDiscountAmount || 0);
    return `${Number(tier.discountValue || 0)}% off${cap > 0 ? ` (up to ${formatRupees(cap)})` : ""}`;
  }
  return `${formatRupees(tier.discountValue)} off`;
};

const sortTiers = (tiers = []) =>
  [...tiers].sort((a, b) => Number(a.minCartAmount || 0) - Number(b.minCartAmount || 0));

export const findActiveCartOfferRules = (now = new Date()) =>
  CartOfferRule.find({
    status: "ACTIVE",
    $and: [
      { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
      { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
    ],
  })
    .sort({ priority: -1, createdAt: 1 })
    .lean();

/**
 * Works out which cart value offer applies and what the customer should be
 * nudged towards next. Rules that do not stack with coupons are skipped when
 * a coupon is used, so the customer keeps the coupon they chose.
 */
export const evaluateCartOffers = async ({ lines = [], couponApplied = false, rules = null, now = new Date() }) => {
  const activeRules = rules || (await findActiveCartOfferRules(now));
  const subtotal = lines.reduce((sum, line) => sum + Number(line.lineTotal || 0), 0);

  const evaluated = activeRules.map((rule) => {
    const tiers = sortTiers(rule.tiers);
    const eligibleAmount = lines
      .filter((line) => isLineEligible(line, rule))
      .reduce((sum, line) => sum + Number(line.lineTotal || 0), 0);
    const currentTier = [...tiers].reverse().find((tier) => eligibleAmount >= tier.minCartAmount) || null;
    const nextTier = tiers.find((tier) => eligibleAmount < tier.minCartAmount) || null;
    const blockedByCoupon = couponApplied && !rule.stackWithCoupons;
    const discount = currentTier && !blockedByCoupon ? getTierDiscount(currentTier, eligibleAmount) : 0;

    return { rule, tiers, eligibleAmount, currentTier, nextTier, blockedByCoupon, discount };
  });

  // Rules arrive sorted by priority, so a strict ">" keeps the higher priority on ties.
  const best = evaluated.reduce((top, entry) => (entry.discount > (top?.discount || 0) ? entry : top), null);
  const appliedDiscount = best?.discount || 0;

  const nextCandidates = evaluated
    .filter((entry) => entry.nextTier && !entry.blockedByCoupon)
    .map((entry) => ({
      entry,
      gapAmount: Math.ceil(entry.nextTier.minCartAmount - entry.eligibleAmount),
      estimatedDiscount: getTierDiscount(entry.nextTier, entry.nextTier.minCartAmount),
    }))
    .filter((candidate) => candidate.estimatedDiscount > appliedDiscount)
    .sort((a, b) => a.gapAmount - b.gapAmount);
  const next = nextCandidates[0] || null;

  return {
    subtotal,
    discount: appliedDiscount,
    applied: best
      ? {
          ruleId: String(best.rule._id),
          name: best.rule.name,
          description: best.rule.description || "",
          minCartAmount: best.currentTier.minCartAmount,
          discountType: best.currentTier.discountType,
          discountValue: best.currentTier.discountValue,
          maximumDiscountAmount: best.currentTier.maximumDiscountAmount ?? null,
          benefitText: getTierBenefitText(best.currentTier),
          eligibleAmount: best.eligibleAmount,
          discountApplied: appliedDiscount,
        }
      : null,
    nextUnlock: next
      ? {
          ruleId: String(next.entry.rule._id),
          name: next.entry.rule.name,
          gapAmount: next.gapAmount,
          currentAmount: next.entry.eligibleAmount,
          targetAmount: next.entry.nextTier.minCartAmount,
          progressPercent: Math.min(
            100,
            Math.round((next.entry.eligibleAmount / next.entry.nextTier.minCartAmount) * 100)
          ),
          benefitText: getTierBenefitText(next.entry.nextTier),
          estimatedDiscount: next.estimatedDiscount,
        }
      : null,
    offers: evaluated.map((entry) => ({
      ruleId: String(entry.rule._id),
      name: entry.rule.name,
      description: entry.rule.description || "",
      stackWithCoupons: entry.rule.stackWithCoupons !== false,
      includeComboPacks: Boolean(entry.rule.includeComboPacks),
      hasCategoryLimit: (entry.rule.allowedCategories || []).length > 0,
      blockedByCoupon: entry.blockedByCoupon,
      isApplied: Boolean(best && best.discount > 0 && best === entry),
      eligibleAmount: entry.eligibleAmount,
      tiers: entry.tiers.map((tier) => ({
        minCartAmount: tier.minCartAmount,
        benefitText: getTierBenefitText(tier),
        unlocked: entry.eligibleAmount >= tier.minCartAmount,
      })),
    })),
  };
};

const getProductImage = (product) =>
  product?.thumbnail || product?.images?.[0]?.url || product?.images?.[0] || null;

/**
 * In-stock readymade products that count towards the given rule, ranked so
 * the cheapest product that closes the gap comes first.
 */
export const getGapRecommendations = async ({ gapAmount, ruleId, excludeProductIds = [], limit = 8 }) => {
  if (!(gapAmount > 0)) return [];

  const rule = ruleId && mongoose.isValidObjectId(ruleId) ? await CartOfferRule.findById(ruleId).lean() : null;
  const excluded = [...excludeProductIds, ...(rule?.excludedProducts || []).map(String)]
    .filter((id) => mongoose.isValidObjectId(id));

  const query = { isActive: { $ne: false } };
  if (excluded.length) query._id = { $nin: excluded };
  if (rule?.allowedCategories?.length) query.category = { $in: rule.allowedCategories };

  const products = await ReadymadeProduct.find(query)
    .select("title price salePrice saleStartAt saleEndAt minPrice variants stock images thumbnail category subCategory currency bestSeller")
    .populate("category", "name")
    .populate("subCategory", "name")
    .sort({ bestSeller: -1, topOrder: -1, createdAt: -1 })
    .limit(150)
    .lean();

  const toSizeOption = (product, variant = null) => {
    const pricing = getReadymadePricing(product, { variant });
    return {
      size: variant?.size || null,
      price: pricing.effectivePrice,
      mrp: pricing.mrp,
      saleActive: pricing.saleActive,
    };
  };

  const candidates = [];
  for (const product of products) {
    const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
    let sizes = [];
    if (hasVariants) {
      sizes = product.variants
        .filter((variant) => Number(variant.stock || 0) > 0)
        .map((variant) => toSizeOption(product, variant));
    } else if (Number(product.stock || 0) > 0) {
      sizes = [toSizeOption(product)];
    }

    if (!sizes.length) continue;
    if (rule && !rule.includeSaleItems && sizes.some((entry) => entry.saleActive)) continue;

    const price = Math.min(...sizes.map((entry) => entry.price));
    const cheapest = sizes.find((entry) => entry.price === price);
    candidates.push({
      _id: String(product._id),
      title: product.title,
      image: getProductImage(product),
      category: product.category?.name || "",
      subCategory: product.subCategory?.name || "",
      currency: product.currency || "INR",
      price,
      mrp: cheapest?.mrp || price,
      sizes: sizes.map(({ size, price: sizePrice }) => ({ size, price: sizePrice })),
      closesGap: price >= gapAmount,
    });
  }

  const closing = candidates.filter((item) => item.closesGap).sort((a, b) => a.price - b.price);
  const partial = candidates.filter((item) => !item.closesGap).sort((a, b) => b.price - a.price);
  return [...closing, ...partial].slice(0, limit);
};
