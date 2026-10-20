import mongoose from "mongoose";
import CartOfferRule from "../models/CartOfferRule.js";
import { findActiveCartOfferRules, getTierBenefitText } from "../services/cartOfferService.js";

const toOptionalNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : NaN;
};

const toOptionalDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "invalid" : date;
};

const toIdList = (values) =>
  (Array.isArray(values) ? values : [])
    .map((value) => String(value?._id || value || ""))
    .filter((id) => mongoose.isValidObjectId(id));

// Returns { data } on success or { error } with a message the admin can act on.
const buildRulePayload = (body = {}) => {
  const name = String(body.name || "").trim();
  if (!name) return { error: "Offer name is required" };

  const status = body.status === "PAUSED" ? "PAUSED" : "ACTIVE";
  const startDate = toOptionalDate(body.startDate);
  const endDate = toOptionalDate(body.endDate);
  if (startDate === "invalid" || endDate === "invalid") return { error: "Invalid start or end date" };
  if (startDate && endDate && endDate <= startDate) return { error: "End date must be after start date" };

  const rawTiers = Array.isArray(body.tiers) ? body.tiers : [];
  if (!rawTiers.length) return { error: "Add at least one cart value tier" };

  const tiers = [];
  for (const [index, raw] of rawTiers.entries()) {
    const label = `Tier ${index + 1}`;
    const minCartAmount = Number(raw?.minCartAmount);
    const discountType = raw?.discountType === "FIXED_AMOUNT" ? "FIXED_AMOUNT" : "PERCENTAGE";
    const discountValue = Number(raw?.discountValue);
    const maximumDiscountAmount = toOptionalNumber(raw?.maximumDiscountAmount);

    if (!(minCartAmount > 0)) return { error: `${label}: cart amount must be greater than 0` };
    if (!(discountValue > 0)) return { error: `${label}: discount must be greater than 0` };
    if (discountType === "PERCENTAGE" && discountValue > 90) {
      return { error: `${label}: percentage discount cannot exceed 90%` };
    }
    if (discountType === "FIXED_AMOUNT" && discountValue >= minCartAmount) {
      return { error: `${label}: flat discount must be less than the cart amount` };
    }
    if (Number.isNaN(maximumDiscountAmount) || (maximumDiscountAmount !== null && maximumDiscountAmount < 0)) {
      return { error: `${label}: maximum discount must be a positive number` };
    }

    tiers.push({
      minCartAmount,
      discountType,
      discountValue,
      maximumDiscountAmount: discountType === "PERCENTAGE" && maximumDiscountAmount ? maximumDiscountAmount : null,
    });
  }

  tiers.sort((a, b) => a.minCartAmount - b.minCartAmount);
  for (let i = 1; i < tiers.length; i += 1) {
    if (tiers[i].minCartAmount === tiers[i - 1].minCartAmount) {
      return { error: "Two tiers cannot have the same cart amount" };
    }
  }

  return {
    data: {
      name,
      description: String(body.description || "").trim(),
      status,
      startDate,
      endDate,
      priority: Number.isFinite(Number(body.priority)) ? Number(body.priority) : 0,
      tiers,
      allowedCategories: toIdList(body.allowedCategories),
      excludedProducts: toIdList(body.excludedProducts),
      includeComboPacks: Boolean(body.includeComboPacks),
      includeSaleItems: body.includeSaleItems !== false,
      stackWithCoupons: body.stackWithCoupons !== false,
    },
  };
};

export const listActiveCartOffers = async (_req, res) => {
  try {
    const rules = await findActiveCartOfferRules();
    return res.status(200).json({
      offers: rules.map((rule) => ({
        _id: rule._id,
        name: rule.name,
        description: rule.description,
        tiers: [...rule.tiers]
          .sort((a, b) => a.minCartAmount - b.minCartAmount)
          .map((tier) => ({ minCartAmount: tier.minCartAmount, benefitText: getTierBenefitText(tier) })),
      })),
    });
  } catch (error) {
    console.error("listActiveCartOffers error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const listCartOfferRules = async (_req, res) => {
  try {
    const rules = await CartOfferRule.find().sort({ createdAt: -1 }).lean();
    return res.status(200).json({ rules });
  } catch (error) {
    console.error("listCartOfferRules error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const createCartOfferRule = async (req, res) => {
  try {
    const { data, error } = buildRulePayload(req.body);
    if (error) return res.status(400).json({ message: error });

    const rule = await CartOfferRule.create(data);
    return res.status(201).json({ message: "Offer created", rule });
  } catch (error) {
    console.error("createCartOfferRule error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const updateCartOfferRule = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid offer id" });
    }

    const { data, error } = buildRulePayload(req.body);
    if (error) return res.status(400).json({ message: error });

    const rule = await CartOfferRule.findByIdAndUpdate(req.params.id, data, {
      new: true,
      runValidators: true,
    });
    if (!rule) return res.status(404).json({ message: "Offer not found" });

    return res.status(200).json({ message: "Offer updated", rule });
  } catch (error) {
    console.error("updateCartOfferRule error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const deleteCartOfferRule = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid offer id" });
    }

    const rule = await CartOfferRule.findByIdAndDelete(req.params.id);
    if (!rule) return res.status(404).json({ message: "Offer not found" });

    return res.status(200).json({ message: "Offer deleted" });
  } catch (error) {
    console.error("deleteCartOfferRule error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
