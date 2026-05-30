import mongoose from "mongoose";
import Coupon from "../models/Coupon.js";
import { Cart } from "../models/Cart.js";
import { validateCouponForCart } from "../services/couponService.js";

const ensureAdmin = (req, res) => {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ message: "Admin only" });
    return false;
  }
  return true;
};

const parseObjectIdArray = (values = []) =>
  values
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter((value) => mongoose.Types.ObjectId.isValid(value));

const buildCouponPayload = (body, { partial = false } = {}) => {
  const payload = {
    code: body.code,
    description: body.description,
    status: body.status,
    discountType: body.discountType,
    discountValue: body.discountValue,
    startDate: body.startDate,
    endDate: body.endDate,
    minimumCartAmount: body.minimumCartAmount,
    totalUsageLimit: body.totalUsageLimit,
    perUserUsageLimit: body.perUserUsageLimit,
    newCustomersOnly: body.newCustomersOnly,
    allowOnSaleProducts: body.allowOnSaleProducts,
    allowedCategories:
      body.allowedCategories !== undefined
        ? parseObjectIdArray(body.allowedCategories || [])
        : undefined,
    allowedSubCategories:
      body.allowedSubCategories !== undefined
        ? parseObjectIdArray(body.allowedSubCategories || [])
        : undefined,
    allowedProducts:
      body.allowedProducts !== undefined
        ? parseObjectIdArray(body.allowedProducts || [])
        : undefined,
    excludedProducts:
      body.excludedProducts !== undefined
        ? parseObjectIdArray(body.excludedProducts || [])
        : undefined,
    stackable: body.stackable,
    autoApply: body.autoApply,
    firstOrderOnly: body.firstOrderOnly,
    campaignTag: body.campaignTag,
  };

  if (body.maximumDiscountAmount !== undefined) {
    payload.maximumDiscountAmount =
      body.maximumDiscountAmount === "" ? null : body.maximumDiscountAmount;
  }

  if (body.dailyUsageLimit !== undefined) {
    payload.dailyUsageLimit = body.dailyUsageLimit === "" ? null : body.dailyUsageLimit;
  }

  if (!partial) return payload;

  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  );
};

const couponAdminProjection = {
  code: 1,
  description: 1,
  status: 1,
  discountType: 1,
  discountValue: 1,
  startDate: 1,
  endDate: 1,
  minimumCartAmount: 1,
  totalUsageLimit: 1,
  perUserUsageLimit: 1,
  maximumDiscountAmount: 1,
  newCustomersOnly: 1,
  allowOnSaleProducts: 1,
  allowedCategories: 1,
  allowedSubCategories: 1,
  allowedProducts: 1,
  excludedProducts: 1,
  stackable: 1,
  autoApply: 1,
  firstOrderOnly: 1,
  dailyUsageLimit: 1,
  campaignTag: 1,
  totalUsedCount: 1,
  createdAt: 1,
  updatedAt: 1,
};

const couponPublicProjection = {
  code: 1,
  description: 1,
  discountType: 1,
  discountValue: 1,
  minimumCartAmount: 1,
  maximumDiscountAmount: 1,
  newCustomersOnly: 1,
  allowOnSaleProducts: 1,
  firstOrderOnly: 1,
  autoApply: 1,
  campaignTag: 1,
  startDate: 1,
  endDate: 1,
};

export const createCoupon = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const coupon = await Coupon.create(buildCouponPayload(req.body));
    return res.status(201).json({ message: "Coupon created", coupon });
  } catch (error) {
    console.error("createCoupon error:", error);
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const listCoupons = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { status, code } = req.query;
    const query = {};
    if (status) query.status = status;
    if (code) query.code = String(code).trim().toUpperCase();

    const coupons = await Coupon.find(query, couponAdminProjection)
      .populate("allowedCategories", "name")
      .populate("allowedSubCategories", "name category")
      .sort({ createdAt: -1 });
    return res.status(200).json({ coupons });
  } catch (error) {
    console.error("listCoupons error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const listActiveCoupons = async (_req, res) => {
  try {
    const now = new Date();
    const coupons = await Coupon.find(
      {
        status: "ACTIVE",
        startDate: { $lte: now },
        endDate: { $gte: now },
      },
      couponPublicProjection
    )
      .sort({ autoApply: -1, discountValue: -1, createdAt: -1 })
      .lean();

    return res.status(200).json({ coupons });
  } catch (error) {
    console.error("listActiveCoupons error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const listEligibleCoupons = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const cart = await Cart.findOne({ user: userId, status: "ACTIVE" })
      .populate("items.readymadeProduct")
      .populate("items.dropproduct")
      .populate("items.product")
      .populate({
        path: "items.readymadeProduct",
        populate: [
          { path: "category", select: "name" },
          { path: "subCategory", select: "name category" },
        ],
      });

    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      return res.status(200).json({ coupons: [] });
    }

    const now = new Date();
    const activeCoupons = await Coupon.find(
      {
        status: "ACTIVE",
        startDate: { $lte: now },
        endDate: { $gte: now },
      },
      couponPublicProjection
    )
      .sort({ autoApply: -1, discountValue: -1, createdAt: -1 })
      .lean();

    const checkedCoupons = await Promise.all(
      activeCoupons.map(async (coupon) => {
        const result = await validateCouponForCart({
          couponCode: coupon.code,
          cart,
          userId,
        });

        if (!result.valid) return null;

        return {
          ...coupon,
          discountApplied: result.discount,
          eligibleSubtotal: result.eligibleSubtotal,
        };
      })
    );

    return res.status(200).json({
      coupons: checkedCoupons.filter(Boolean),
    });
  } catch (error) {
    console.error("listEligibleCoupons error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getCouponById = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const coupon = await Coupon.findById(req.params.id, couponAdminProjection)
      .populate("allowedCategories", "name")
      .populate("allowedSubCategories", "name category");
    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    return res.status(200).json({ coupon });
  } catch (error) {
    console.error("getCouponById error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const updateCoupon = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    Object.assign(coupon, buildCouponPayload(req.body, { partial: true }));
    await coupon.save();

    return res.status(200).json({ message: "Coupon updated", coupon });
  } catch (error) {
    console.error("updateCoupon error:", error);
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const deleteCoupon = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const coupon = await Coupon.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "DELETED" } },
      { new: true }
    );

    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    return res.status(200).json({ message: "Coupon deleted", coupon });
  } catch (error) {
    console.error("deleteCoupon error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const validateCoupon = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { couponCode } = req.body;
    const cart = await Cart.findOne({ user: userId, status: "ACTIVE" })
      .populate("items.readymadeProduct")
      .populate("items.dropproduct")
      .populate("items.product")
      .populate({
        path: "items.readymadeProduct",
        populate: [
          { path: "category", select: "name" },
          { path: "subCategory", select: "name category" },
        ],
      });

    const result = await validateCouponForCart({ couponCode, cart, userId });
    if (!result.valid) {
      return res.status(400).json({ valid: false, message: result.reason });
    }

    return res.status(200).json({
      valid: true,
      coupon: result.couponSnapshot,
      discount: result.discount,
      subtotal: result.cartSubtotal,
    });
  } catch (error) {
    console.error("validateCoupon error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
