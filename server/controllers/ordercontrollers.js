import mongoose from "mongoose";
import Order from "../models/Order.js";
import Review from "../models/Review.js";
import { Product } from "../models/Product.js";
import ReadymadeProduct from "../models/readymadeproducts.js";
import Dropproduct from "../models/dropproduct.model.js";
import {
  sendOrderCancelledEmail,
  sendOrderStatusEmail,
  sendReturnDecisionEmail,
  sendReturnRefundPaidEmail,
  sendReturnRequestSubmittedEmail,
} from "../services/orderEmailService.js";
import { rollbackInventoryForOrder } from "../services/inventoryService.js";
import { razorpay } from "../utils/razorpay.js";
import {
  buildReviewLookupKey,
  getReviewTargetFromOrderItem,
} from "../services/reviewService.js";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const PAYMENT_STATUSES = ["PENDING_PAYMENT", "PAID", "FAILED", "CANCELLED"];
const FULFILLMENT_STATUSES = ["PROCESSING", "READY", "SHIPPED", "DELIVERED"];
const RETURN_STATUSES = ["NONE", "PROCESSING", "APPROVED", "REJECTED"];
const RETURN_WINDOW_DAYS = 3;
const ABSOLUTE_URL_RE = /^(?:https?:)?\/\//i;
const SPECIAL_URL_RE = /^(?:data:|blob:)/i;
const REFUND_STATUSES = ["NOT_PAID", "PROCESSING", "PAID", "FAILED"];
const LOW_STOCK_LIMIT = 5;

const ensureAdmin = (req, res) => {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ message: "Admin only" });
    return false;
  }
  return true;
};

const getAssetBaseUrl = (req) =>
  String(
    process.env.API_URL ||
      process.env.BACKEND_URL ||
      `${req.protocol}://${req.get("host")}`
  )
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api$/i, "");

const resolveOrderAssetUrl = (req, value) => {
  const rawValue = String(value || "").trim();
  if (!rawValue) return rawValue;

  if (ABSOLUTE_URL_RE.test(rawValue) || SPECIAL_URL_RE.test(rawValue)) {
    return rawValue;
  }

  const normalizedPath = rawValue.replace(/\\/g, "/");

  let publicPath;
  if (normalizedPath.startsWith("/api/")) {
    publicPath = normalizedPath;
  } else if (normalizedPath.startsWith("api/")) {
    publicPath = `/${normalizedPath}`;
  } else if (normalizedPath.startsWith("/outputs/")) {
    publicPath = `/api${normalizedPath}`;
  } else if (normalizedPath.startsWith("outputs/")) {
    publicPath = `/api/${normalizedPath}`;
  } else {
    publicPath = normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`;
  }

  return `${getAssetBaseUrl(req)}${publicPath}`;
};

const pickExistingReview = (review) => {
  if (!review) return null;

  return {
    _id: review._id,
    rating: Number(review.rating || 0),
    title: review.title || "",
    comment: review.comment || "",
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const getReturnDeadline = (order) => {
  const deliveredAt =
    order?.deliveredAt ||
    (order?.orderStatus === "DELIVERED" ? order?.updatedAt : null);
  if (!deliveredAt) return null;
  return addDays(deliveredAt, RETURN_WINDOW_DAYS);
};

const toTrimmedString = (value) => String(value || "").trim();
const toPaise = (value) => Math.round(Number(value || 0) * 100);
const isPaidOrCodOrder = (order) =>
  order?.status === "PAID" || order?.payment?.method === "COD";

const getOrderItemDisplayName = (item) => {
  if (!item) return "Product";

  if (item.kind === "READYMADE" && item.readymadeProduct?.title) {
    return item.readymadeProduct.title;
  }

  if (item.kind === "DESIGN" && (item.design?.title || item.design?.productName)) {
    return item.design.title || item.design.productName;
  }

  if (item.kind === "DROPPRODUCT" && item.dropproduct?.name) {
    return item.dropproduct.name;
  }

  if (item.product?.name) {
    return item.product.name;
  }

  return "Product";
};

const parseSelectedItemIndexes = (value) => {
  if (value == null || value === "") return [];

  let rawValue = value;
  if (typeof rawValue === "string") {
    const trimmed = rawValue.trim();
    if (!trimmed) return [];

    try {
      rawValue = JSON.parse(trimmed);
    } catch {
      rawValue = trimmed.includes(",")
        ? trimmed.split(",").map((entry) => entry.trim())
        : [trimmed];
    }
  }

  const indexes = Array.isArray(rawValue) ? rawValue : [rawValue];
  return [...new Set(
    indexes
      .map((index) => Number.parseInt(index, 10))
      .filter((index) => Number.isInteger(index) && index >= 0)
  )].sort((a, b) => a - b);
};

const buildSelectedReturnItems = (order, selectedItemIndexes = []) => {
  const items = Array.isArray(order?.items) ? order.items : [];

  return selectedItemIndexes
    .map((index) => {
      const item = items[index];
      if (!item) return null;

      return {
        index,
        kind: item.kind || "",
        name: getOrderItemDisplayName(item),
        size: item.size || "",
        qty: Number(item.qty || 0),
        unitPrice: Number(item.unitPrice || 0),
        basePrice: Number(item.basePrice || 0),
        currency: item.currency || order.currency || "INR",
        previewImage: item.previewImage || "",
        signature: item.signature || "",
      };
    })
    .filter(Boolean);
};

const parsePositiveAmount = (value) => {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) return null;
  if (normalized <= 0) return null;
  return Math.round(normalized * 100) / 100;
};

const resolveRefundReference = (acquirerData = {}) =>
  acquirerData?.arn ||
  acquirerData?.rrn ||
  acquirerData?.utr ||
  acquirerData?.reference_number ||
  "";

const mapRazorpayRefundStatus = (status) => {
  switch (String(status || "").toLowerCase()) {
    case "processed":
      return "PAID";
    case "pending":
      return "PROCESSING";
    case "failed":
      return "FAILED";
    default:
      return "FAILED";
  }
};

const resetRefundTracking = (returnRequest) => {
  if (!returnRequest) return;
  returnRequest.refundPaidAt = null;
  returnRequest.refundInitiatedAt = null;
  returnRequest.refundAmount = 0;
  returnRequest.refundCurrency = "INR";
  returnRequest.refundId = "";
  returnRequest.refundReceipt = "";
  returnRequest.refundReference = "";
  returnRequest.refundFailureReason = "";
};

const normalizeBankDetails = (bankDetails = {}) => ({
  method: toTrimmedString(bankDetails.method).toUpperCase(),
  accountHolderName: toTrimmedString(bankDetails.accountHolderName),
  accountNumber: toTrimmedString(bankDetails.accountNumber),
  ifscCode: toTrimmedString(bankDetails.ifscCode).toUpperCase(),
  bankName: toTrimmedString(bankDetails.bankName),
  branchName: toTrimmedString(bankDetails.branchName),
  upiId: toTrimmedString(bankDetails.upiId),
});

const validateReturnBankDetails = (bankDetails = {}) => {
  const normalized = normalizeBankDetails(bankDetails);

  if (!["BANK", "UPI"].includes(normalized.method)) {
    return { error: "Refund method must be BANK or UPI", bankDetails: normalized };
  }

  if (normalized.method === "UPI") {
    if (!normalized.upiId) {
      return { error: "UPI ID is required", bankDetails: normalized };
    }
    return { error: null, bankDetails: normalized };
  }

  if (!normalized.accountHolderName) {
    return { error: "Account holder name is required", bankDetails: normalized };
  }
  if (!normalized.accountNumber) {
    return { error: "Account number is required", bankDetails: normalized };
  }
  if (!normalized.ifscCode) {
    return { error: "IFSC code is required", bankDetails: normalized };
  }
  if (!normalized.bankName) {
    return { error: "Bank name is required", bankDetails: normalized };
  }
  if (!normalized.branchName) {
    return { error: "Branch name is required", bankDetails: normalized };
  }

  return { error: null, bankDetails: normalized };
};

const startOfDay = (date = new Date()) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (date = new Date()) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const addDashboardDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const paidSalesQuery = (dateRange = {}) => ({
  $or: [{ status: "PAID" }, { "payment.method": "COD" }],
  status: { $ne: "CANCELLED" },
  ...dateRange,
});

const runSalesSummary = async (dateRange = {}) => {
  const [result] = await Order.aggregate([
    { $match: paidSalesQuery(dateRange) },
    {
      $project: {
        total: { $ifNull: ["$total", 0] },
        itemQty: {
          $sum: {
            $map: {
              input: { $ifNull: ["$items", []] },
              as: "item",
              in: { $ifNull: ["$$item.qty", 0] },
            },
          },
        },
      },
    },
    {
      $group: {
        _id: null,
        orders: { $sum: 1 },
        revenue: { $sum: "$total" },
        items: { $sum: "$itemQty" },
      },
    },
  ]);

  return {
    orders: result?.orders || 0,
    revenue: Math.round((result?.revenue || 0) * 100) / 100,
    items: result?.items || 0,
  };
};

const sumStock = (values = []) =>
  values.reduce((sum, value) => sum + Math.max(0, Number(value || 0)), 0);

const getReadymadeStock = (product = {}) => {
  const variantStock = sumStock((product.variants || []).map((variant) => variant.stock));
  return variantStock || Number(product.stock || 0);
};

const getCustomProductStock = (product = {}) => {
  const sizeStock = sumStock((product.sizePricing || []).map((size) => size.stock));
  const colorStock = sumStock(
    (product.colors || [])
      .map((color) => color.stock)
      .filter((stock) => stock !== null && stock !== undefined)
  );
  return sizeStock || colorStock;
};

const normalizeCategoryName = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.name || value.title || "";
};

const formatRecentTime = (date) => {
  const timestamp = new Date(date).getTime();
  if (!timestamp) return "";
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
};

const shapeReturnRequest = (req, returnRequest = {}) => {
  const status = RETURN_STATUSES.includes(returnRequest.status)
    ? returnRequest.status
    : "NONE";
  const refundStatus = REFUND_STATUSES.includes(returnRequest.refundStatus)
    ? returnRequest.refundStatus
    : "NOT_PAID";

  return {
    status,
    requestedAt: returnRequest.requestedAt || null,
    decidedAt: returnRequest.decidedAt || null,
    refundPaidAt: returnRequest.refundPaidAt || null,
    refundInitiatedAt: returnRequest.refundInitiatedAt || null,
    deadlineAt: returnRequest.deadlineAt || null,
    reason: returnRequest.reason || "",
    imageUrls: Array.isArray(returnRequest.imageUrls)
      ? returnRequest.imageUrls.map((url) => resolveOrderAssetUrl(req, url))
      : [],
    adminDecisionNote: returnRequest.adminDecisionNote || "",
    refundStatus,
    refundAmount: Number(returnRequest.refundAmount || 0),
    refundCurrency: returnRequest.refundCurrency || "INR",
    refundId: returnRequest.refundId || "",
    refundReceipt: returnRequest.refundReceipt || "",
    refundReference: returnRequest.refundReference || "",
    refundFailureReason: returnRequest.refundFailureReason || "",
    selectedItemIndexes: Array.isArray(returnRequest.selectedItemIndexes)
      ? returnRequest.selectedItemIndexes
          .map((index) => Number.parseInt(index, 10))
          .filter((index) => Number.isInteger(index) && index >= 0)
      : [],
    selectedItems: Array.isArray(returnRequest.selectedItems)
      ? returnRequest.selectedItems
      : [],
    bankDetails: {
      method: returnRequest.bankDetails?.method || "",
      accountHolderName: returnRequest.bankDetails?.accountHolderName || "",
      accountNumber: returnRequest.bankDetails?.accountNumber || "",
      ifscCode: returnRequest.bankDetails?.ifscCode || "",
      bankName: returnRequest.bankDetails?.bankName || "",
      branchName: returnRequest.bankDetails?.branchName || "",
      upiId: returnRequest.bankDetails?.upiId || "",
    },
  };
};

const attachReviewMetaToOrders = async (orders, userId) => {
  if (!Array.isArray(orders) || !orders.length || !userId) {
    return orders;
  }

  const readyMadeIds = new Set();
  const dropProductIds = new Set();

  for (const order of orders) {
    for (const item of order.items || []) {
      const target = getReviewTargetFromOrderItem(item);
      if (!target) continue;

      if (target.kind === "READYMADE") readyMadeIds.add(target.targetId);
      if (target.kind === "DROPPRODUCT") dropProductIds.add(target.targetId);
    }
  }

  const reviewFilter = {
    user: userId,
    status: "ACTIVE",
    $or: [],
  };

  if (readyMadeIds.size) {
    reviewFilter.$or.push({
      kind: "READYMADE",
      readymadeProduct: { $in: [...readyMadeIds] },
    });
  }

  if (dropProductIds.size) {
    reviewFilter.$or.push({
      kind: "DROPPRODUCT",
      dropproduct: { $in: [...dropProductIds] },
    });
  }

  const reviews = reviewFilter.$or.length
    ? await Review.find(reviewFilter).lean()
    : [];

  const reviewMap = new Map(
    reviews.map((review) => {
      const targetId =
        review.kind === "READYMADE" ? review.readymadeProduct : review.dropproduct;
      return [buildReviewLookupKey(review.kind, targetId), review];
    })
  );

  return orders.map((order) => ({
    ...order,
    items: (order.items || []).map((item) => {
      const target = getReviewTargetFromOrderItem(item);

      if (!target) {
        return {
          ...item,
          reviewMeta: {
            reviewable: false,
            existingReview: null,
          },
        };
      }

      return {
        ...item,
        reviewMeta: {
          reviewable: order.orderStatus === "DELIVERED",
          kind: target.kind,
          targetId: target.targetId,
          existingReview: pickExistingReview(
            reviewMap.get(buildReviewLookupKey(target.kind, target.targetId))
          ),
        },
      };
    }),
  }));
};

const attachReturnMetaToOrders = (req, orders) => {
  if (!Array.isArray(orders)) return [];

  return orders.map((order) => {
    const orderItems = Array.isArray(order.items) ? order.items : [];
    const hasCustomDesignItem = orderItems.some((item) => item?.kind === "DESIGN");
    const hasReturnableItem = orderItems.some((item) => item?.kind && item.kind !== "DESIGN");
    const deadlineAt =
      order.returnRequest?.deadlineAt ||
      getReturnDeadline(order);
    const returnStatus = order.returnRequest?.status || "NONE";
    const returnEligible =
      isPaidOrCodOrder(order) &&
      order.orderStatus === "DELIVERED" &&
      hasReturnableItem &&
      returnStatus === "NONE" &&
      deadlineAt &&
      new Date(deadlineAt).getTime() >= Date.now();

    return {
      ...order,
      returnRequest: shapeReturnRequest(req, {
        ...(order.returnRequest || {}),
        deadlineAt,
      }),
      returnEligible,
      returnDeadlineAt: deadlineAt || null,
      returnRestrictedReason: !hasReturnableItem && hasCustomDesignItem
        ? "Customized products are not eligible for return. Please contact the support team."
        : "",
    };
  });
};

/**
 * USER: Get my PAID orders
 * GET /api/orders/paid
 */
export const getMyPaidOrders = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const orders = await Order.find({
      user: userId,
      $or: [
        { status: { $in: ["PAID", "CANCELLED"] } },
        { "payment.method": "COD" },
      ],
    })
      .populate("deliveryAddress")
      .populate("billingAddress")
      .populate("items.readymadeProduct")
      .populate("items.dropproduct")
      .populate("items.design")
      .populate("items.product")
      .sort({ createdAt: -1 })
      .lean();

    const ordersWithReviews = await attachReviewMetaToOrders(orders, userId);
    const ordersWithReturnMeta = attachReturnMetaToOrders(req, ordersWithReviews);

    return res.status(200).json({ orders: ordersWithReturnMeta });
  } catch (err) {
    console.error("getMyPaidOrders error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * USER: Get my single PAID order
 * GET /api/orders/paid/:orderId
 */
export const getMyPaidOrderById = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { orderId } = req.params;
    if (!isValidObjectId(orderId)) {
      return res.status(400).json({ message: "Invalid orderId" });
    }

    const order = await Order.findOne({
      _id: orderId,
      user: userId,
      $or: [
        { status: { $in: ["PAID", "CANCELLED"] } },
        { "payment.method": "COD" },
      ],
    })
      .populate("deliveryAddress")
      .populate("billingAddress")
      .populate("items.readymadeProduct")
      .populate("items.dropproduct")
      .populate("items.design")
      .populate("items.product")
      .lean();

    if (!order) return res.status(404).json({ message: "Order not found" });

    const [orderWithReviews] = await attachReviewMetaToOrders([order], userId);
    const [orderWithReturnMeta] = attachReturnMetaToOrders(req, [orderWithReviews]);

    return res.status(200).json({ order: orderWithReturnMeta });
  } catch (err) {
    console.error("getMyPaidOrderById error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * USER: Cancel my paid order before it reaches READY
 * PATCH /api/orders/:orderId/cancel
 */
export const cancelMyOrder = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { orderId } = req.params;
    if (!isValidObjectId(orderId)) {
      return res.status(400).json({ message: "Invalid orderId" });
    }

    const order = await Order.findOne({ _id: orderId, user: userId })
      .populate("user")
      .populate("deliveryAddress")
      .populate("billingAddress")
      .populate("items.readymadeProduct")
      .populate("items.dropproduct")
      .populate("items.design")
      .populate("items.product");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.status === "CANCELLED") {
      return res.status(400).json({ message: "Order is already cancelled" });
    }

    if (order.status !== "PAID" && order.payment?.method !== "COD") {
      return res.status(400).json({ message: "Only paid or cash on delivery orders can be cancelled" });
    }

    if (order.orderStatus !== "PROCESSING") {
      return res.status(400).json({ message: "Order can only be cancelled before it is ready" });
    }

    if (order.inventoryAdjustedAt) {
      await rollbackInventoryForOrder(order);
    }

    order.status = "CANCELLED";
    order.payment = order.payment || {};
    order.payment.status = "CANCELLED";
    await order.save();

    try {
      await sendOrderCancelledEmail(order, order.user);
    } catch (emailError) {
      console.error("cancelMyOrder email error:", emailError.response?.body || emailError);
    }

    const [orderWithReviews] = await attachReviewMetaToOrders([order.toObject()], userId);
    const [orderWithReturnMeta] = attachReturnMetaToOrders(req, [orderWithReviews]);

    return res.status(200).json({
      message: "Order cancelled successfully",
      order: orderWithReturnMeta,
    });
  } catch (err) {
    console.error("cancelMyOrder error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * USER: Submit a return request for a delivered order within 3 days.
 * POST /api/orders/:orderId/return-request
 */
export const submitReturnRequest = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { orderId } = req.params;
    if (!isValidObjectId(orderId)) {
      return res.status(400).json({ message: "Invalid orderId" });
    }

    const order = await Order.findOne({ _id: orderId, user: userId })
      .populate("deliveryAddress")
      .populate("billingAddress")
      .populate("items.readymadeProduct")
      .populate("items.dropproduct")
      .populate("items.design")
      .populate("items.product");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (!isPaidOrCodOrder(order) || order.orderStatus !== "DELIVERED") {
      return res.status(400).json({
        message: "Only delivered paid or cash on delivery orders can be returned",
      });
    }

    const existingStatus = order.returnRequest?.status || "NONE";
    if (existingStatus !== "NONE") {
      return res.status(400).json({ message: "Return request already submitted for this order" });
    }

    const deadlineAt = getReturnDeadline(order);
    if (!deadlineAt) {
      return res.status(400).json({ message: "Return window is not available for this order" });
    }
    if (deadlineAt.getTime() < Date.now()) {
      return res.status(400).json({ message: "The 3-day return window has expired" });
    }

    const reason = toTrimmedString(req.body?.reason);
    if (!reason) {
      return res.status(400).json({ message: "Return reason is required" });
    }

    const selectedItemIndexes = parseSelectedItemIndexes(req.body?.selectedItemIndexes);
    if (!selectedItemIndexes.length) {
      return res.status(400).json({ message: "Select at least one product to return" });
    }

    const items = Array.isArray(order.items) ? order.items : [];
    if (selectedItemIndexes.some((index) => index >= items.length)) {
      return res.status(400).json({ message: "One or more selected products are invalid" });
    }

    const selectedItems = buildSelectedReturnItems(order, selectedItemIndexes);
    if (!selectedItems.length) {
      return res.status(400).json({ message: "Select at least one valid product to return" });
    }

    const hasCustomDesignSelection = selectedItems.some((item) => item.kind === "DESIGN");
    if (hasCustomDesignSelection) {
      return res.status(400).json({
        message: "Customized products are not eligible for return. Please exclude them from the selection.",
      });
    }

    const { error: bankDetailsError, bankDetails } = validateReturnBankDetails(req.body || {});
    if (bankDetailsError) {
      return res.status(400).json({ message: bankDetailsError });
    }

    const imageUrls = Array.isArray(req.files)
      ? req.files.map((file) => `outputs/returns/${file.filename}`)
      : [];

    if (!imageUrls.length) {
      return res.status(400).json({ message: "At least one return image is required" });
    }

    order.returnRequest = {
      status: "PROCESSING",
      requestedAt: new Date(),
      decidedAt: null,
      refundPaidAt: null,
      refundInitiatedAt: null,
      deadlineAt,
      reason,
      imageUrls,
      adminDecisionNote: "",
      refundStatus: "NOT_PAID",
      refundAmount: 0,
      refundCurrency: order.currency || "INR",
      refundId: "",
      refundReceipt: "",
      refundReference: "",
      refundFailureReason: "",
      selectedItemIndexes,
      selectedItems,
      bankDetails,
    };

    await order.save();

    try {
      await sendReturnRequestSubmittedEmail(order, req.user);
    } catch (emailError) {
      console.error("submitReturnRequest email error:", emailError.response?.body || emailError);
    }

    const [orderWithReviews] = await attachReviewMetaToOrders([order.toObject()], userId);
    const [orderWithReturnMeta] = attachReturnMetaToOrders(req, [orderWithReviews]);

    return res.status(200).json({
      message: "Return request submitted successfully",
      order: orderWithReturnMeta,
    });
  } catch (err) {
    console.error("submitReturnRequest error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * ADMIN: Get all orders (optional filters)
 * GET /api/admin/orders?paymentStatus=PAID&orderStatus=SHIPPED&userId=...&dateFrom=2026-04-01&dateTo=2026-04-06
 */







const DESIGN_SELECT =
  "previewImage views product productSlug productName productColor productColorName calculatedPrice priceBreakdown title description salePrice";

export const adminGetDashboardSummary = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const lastWeekStart = startOfDay(addDashboardDays(now, -6));
    const lastMonthStart = startOfDay(addDashboardDays(now, -29));
    const offerWindowEnd = endOfDay(addDashboardDays(now, 2));

    const [
      customProductCount,
      readymadeProductCount,
      dropProductCount,
      totalRevenue,
      todaySales,
      lastWeekSales,
      lastMonthSales,
      pendingOrders,
      todayReturns,
      readymadeProducts,
      dropProducts,
      customProducts,
      recentOrders,
      recentReturnOrders,
      offerReadymadeProducts,
      offerDropProducts,
    ] = await Promise.all([
      Product.countDocuments(),
      ReadymadeProduct.countDocuments(),
      Dropproduct.countDocuments(),
      runSalesSummary(),
      runSalesSummary({ createdAt: { $gte: todayStart, $lte: todayEnd } }),
      runSalesSummary({ createdAt: { $gte: lastWeekStart, $lte: todayEnd } }),
      runSalesSummary({ createdAt: { $gte: lastMonthStart, $lte: todayEnd } }),
      Order.countDocuments({
        orderStatus: "PROCESSING",
        status: { $ne: "CANCELLED" },
      }),
      Order.countDocuments({
        "returnRequest.requestedAt": { $gte: todayStart, $lte: todayEnd },
        "returnRequest.status": { $ne: "NONE" },
      }),
      ReadymadeProduct.find({})
        .select("title price salePrice saleEndAt stock variants category subCategory isActive updatedAt createdAt")
        .populate("category", "name")
        .populate("subCategory", "name")
        .lean(),
      Dropproduct.find({})
        .select("name salePrice saleEndAt totalStock minPrice maxPrice variants category subCategory isActive updatedAt createdAt")
        .lean(),
      Product.find({})
        .select("name basePrice category subCategory sizePricing colors updatedAt createdAt")
        .lean(),
      Order.find({})
        .select("total status payment orderStatus returnRequest createdAt")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      Order.find({
        "returnRequest.status": { $ne: "NONE" },
        "returnRequest.requestedAt": { $ne: null },
      })
        .select("returnRequest total createdAt")
        .sort({ "returnRequest.requestedAt": -1 })
        .limit(5)
        .lean(),
      ReadymadeProduct.find({
        salePrice: { $ne: null },
        saleEndAt: { $gte: now, $lte: offerWindowEnd },
      })
        .select("title price salePrice saleEndAt category subCategory")
        .populate("category", "name")
        .populate("subCategory", "name")
        .sort({ saleEndAt: 1 })
        .limit(10)
        .lean(),
      Dropproduct.find({
        salePrice: { $ne: null },
        saleEndAt: { $gte: now, $lte: offerWindowEnd },
      })
        .select("name salePrice saleEndAt minPrice maxPrice category subCategory")
        .sort({ saleEndAt: 1 })
        .limit(10)
        .lean(),
    ]);

    const lowStockProducts = [
      ...readymadeProducts.map((product) => ({
        id: product._id,
        type: "Ready-made",
        name: product.title,
        category: normalizeCategoryName(product.category),
        subCategory: normalizeCategoryName(product.subCategory),
        price: product.salePrice || product.price || 0,
        stock: getReadymadeStock(product),
        active: product.isActive !== false,
      })),
      ...dropProducts.map((product) => ({
        id: product._id,
        type: "Drop",
        name: product.name,
        category: product.category || "",
        subCategory: product.subCategory || "",
        price: product.salePrice || product.minPrice || 0,
        stock: Number(product.totalStock || sumStock((product.variants || []).map((variant) => variant.stock))),
        active: product.isActive !== false,
      })),
      ...customProducts.map((product) => ({
        id: product._id,
        type: "Custom",
        name: product.name,
        category: product.category || "",
        subCategory: product.subCategory || "",
        price: product.basePrice || 0,
        stock: getCustomProductStock(product),
        active: true,
      })),
    ]
      .filter((product) => product.stock <= LOW_STOCK_LIMIT)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 12);

    const recentActivity = [
      ...recentOrders.map((order) => ({
        id: order._id,
        type: "order",
        title:
          order.status === "PAID" || order.payment?.method === "COD"
            ? "Order placed"
            : "Order updated",
        detail: `${order.orderStatus || "PROCESSING"} - Rs. ${Number(order.total || 0).toLocaleString("en-IN")}`,
        at: order.createdAt,
        time: formatRecentTime(order.createdAt),
      })),
      ...recentReturnOrders.map((order) => ({
        id: `${order._id}-return`,
        type: "return",
        title: "Return requested",
        detail: `${order.returnRequest?.status || "PROCESSING"} - Rs. ${Number(order.total || 0).toLocaleString("en-IN")}`,
        at: order.returnRequest?.requestedAt || order.createdAt,
        time: formatRecentTime(order.returnRequest?.requestedAt || order.createdAt),
      })),
    ]
      .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))
      .slice(0, 6);

    const offerEndingProducts = [
      ...offerReadymadeProducts.map((product) => ({
        id: product._id,
        type: "Ready-made",
        name: product.title,
        category: normalizeCategoryName(product.category),
        subCategory: normalizeCategoryName(product.subCategory),
        price: product.price || 0,
        salePrice: product.salePrice || 0,
        saleEndAt: product.saleEndAt,
      })),
      ...offerDropProducts.map((product) => ({
        id: product._id,
        type: "Drop",
        name: product.name,
        category: product.category || "",
        subCategory: product.subCategory || "",
        price: product.minPrice || product.maxPrice || 0,
        salePrice: product.salePrice || 0,
        saleEndAt: product.saleEndAt,
      })),
    ].sort((a, b) => new Date(a.saleEndAt || 0) - new Date(b.saleEndAt || 0));

    return res.status(200).json({
      generatedAt: now,
      totals: {
        products: customProductCount + readymadeProductCount + dropProductCount,
        customProducts: customProductCount,
        readymadeProducts: readymadeProductCount,
        dropProducts: dropProductCount,
        revenue: totalRevenue.revenue,
      },
      sales: {
        today: todaySales,
        lastWeek: lastWeekSales,
        lastMonth: lastMonthSales,
      },
      pendingOrders,
      lowStockProducts,
      recentActivity,
      todayReturns: {
        count: todayReturns,
      },
      offerEndingProducts,
    });
  } catch (err) {
    console.error("adminGetDashboardSummary error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const adminGetAllOrders = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { paymentStatus, orderStatus, userId, dateFrom, dateTo } = req.query;

    const query = {};
    if (paymentStatus === "COD") {
      query["payment.method"] = "COD";
    } else if (paymentStatus === "PENDING_PAYMENT") {
      query.status = paymentStatus;
      query["payment.method"] = { $ne: "COD" };
    } else if (paymentStatus) {
      query.status = paymentStatus;
    }
    if (orderStatus) query.orderStatus = orderStatus;
    if (userId) query.user = userId;
    if (dateFrom || dateTo) {
      query.createdAt = {};

      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        if (Number.isNaN(fromDate.getTime())) {
          return res.status(400).json({ message: "Invalid dateFrom" });
        }
        query.createdAt.$gte = fromDate;
      }

      if (dateTo) {
        const toDate = new Date(dateTo);
        if (Number.isNaN(toDate.getTime())) {
          return res.status(400).json({ message: "Invalid dateTo" });
        }
        toDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = toDate;
      }
    }

    const orders = await Order.find(query)
      .populate("user", "name email")
      .populate("deliveryAddress")
      .populate("billingAddress")

      // ✅ DESIGN populate (unchanged)
      .populate({ path: "items.design", select: DESIGN_SELECT })

      // ✅ READYMADE populate with nested category/subCategory/brand
      .populate({
        path: "items.readymadeProduct",
        populate: [
          { path: "category", select: "name" },
          { path: "subCategory", select: "name" },
          { path: "brand", select: "name" },
        ],
      })

      .populate("items.dropproduct")
      .populate("items.product")
      .sort({ createdAt: -1 })
      .lean();

    // ==============================
    // Shape Response
    // ==============================
    const shaped = orders.map((o) => ({
      ...o,
      returnRequest: shapeReturnRequest(req, {
        ...(o.returnRequest || {}),
        deadlineAt: o.returnRequest?.deadlineAt || getReturnDeadline(o),
      }),
      returnEligible: false,
      returnDeadlineAt: o.returnRequest?.deadlineAt || getReturnDeadline(o) || null,
      items: (o.items || []).map((it) => {
        // ==========================
        // HANDLE DESIGN (UNCHANGED)
        // ==========================
        if (it.kind === "DESIGN" && it.design) {
          const d = it.design;

          return {
            ...it,
            design: {
              _id: d._id,
              previewImage: resolveOrderAssetUrl(req, d.previewImage),
              product: d.product,
              productSlug: d.productSlug,
              productName: d.productName,
              productColor: d.productColor,
              productColorName: d.productColorName,
              calculatedPrice: d.calculatedPrice,
              priceBreakdown: d.priceBreakdown,
              title: d.title,
              description: d.description,
              salePrice: d.salePrice,
              views: (d.views || []).map((v) => ({
                code: v.code,
                previewImage: resolveOrderAssetUrl(req, v.previewImage),
                textLayers: v.textLayers || [],
                designLayers: (v.designLayers || []).map((dl) => ({
                  id: dl.id,
                  imageUrl: resolveOrderAssetUrl(req, dl.imageUrl),
                  filename: dl.filename || "",
                  hasBgRemoved: dl.hasBgRemoved,
                  x: dl.x,
                  y: dl.y,
                  scale: dl.scale,
                  rotation: dl.rotation,
                  zone: dl.zone,
                  insideSafeArea: dl.insideSafeArea,
                  originalWidthPx: dl.originalWidthPx,
                  originalHeightPx: dl.originalHeightPx,
                  renderedWidthPx: dl.renderedWidthPx,
                  renderedHeightPx: dl.renderedHeightPx,
                  widthInches: dl.widthInches,
                  heightInches: dl.heightInches,
                  areaInches: dl.areaInches,
                  rawPrintWidthInches: dl.rawPrintWidthInches,
                  rawPrintHeightInches: dl.rawPrintHeightInches,
                  rawPrintAreaInches: dl.rawPrintAreaInches,
                })),
              })),
            },
          };
        }

        // ==========================
        // HANDLE READYMADE PRODUCT
        // Convert populated objects → string names
        // ==========================
        if (it.readymadeProduct) {
          const rp = it.readymadeProduct;

          return {
            ...it,
            readymadeProduct: {
              ...rp,
              category: rp.category?.name || "",
              subCategory: rp.subCategory?.name || "",
              brand: rp.brand?.name || "",
            },
          };
        }

        return it;
      }),
    }));

    return res.status(200).json({ orders: shaped });
  } catch (err) {
    console.error("adminGetAllOrders error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


/**
 * ADMIN: Get single order by id
 * GET /api/admin/orders/:orderId
 */
export const adminGetOrderById = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { orderId } = req.params;

    if (!isValidObjectId(orderId)) {
      return res.status(400).json({ message: "Invalid orderId" });
    }

    const order = await Order.findById(orderId)
      .populate("user", "name email")
      .populate("deliveryAddress")
      .populate("billingAddress")

      // ✅ READYMADE populate with nested fields
      .populate({
        path: "items.readymadeProduct",
        populate: [
          { path: "category", select: "name" },
          { path: "subCategory", select: "name" },
          { path: "brand", select: "name" },
        ],
      })

      .populate("items.dropproduct")

      // ✅ DESIGN populate (unchanged)
      .populate({ path: "items.design", select: DESIGN_SELECT })

      .populate("items.product")
      .lean();

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // ==============================
    // Shape Single Order
    // ==============================
    const shaped = {
      ...order,
      returnRequest: shapeReturnRequest(req, {
        ...(order.returnRequest || {}),
        deadlineAt: order.returnRequest?.deadlineAt || getReturnDeadline(order),
      }),
      returnEligible: false,
      returnDeadlineAt: order.returnRequest?.deadlineAt || getReturnDeadline(order) || null,
      items: (order.items || []).map((it) => {
        // ==========================
        // HANDLE DESIGN (UNCHANGED)
        // ==========================
        if (it.kind === "DESIGN" && it.design) {
          const d = it.design;

          return {
            ...it,
            design: {
              _id: d._id,
              previewImage: resolveOrderAssetUrl(req, d.previewImage),
              product: d.product,
              productSlug: d.productSlug,
              productName: d.productName,
              productColor: d.productColor,
              productColorName: d.productColorName,
              calculatedPrice: d.calculatedPrice,
              priceBreakdown: d.priceBreakdown,
              title: d.title,
              description: d.description,
              salePrice: d.salePrice,
              views: (d.views || []).map((v) => ({
                code: v.code,
                previewImage: resolveOrderAssetUrl(req, v.previewImage),
                textLayers: v.textLayers || [],
                designLayers: (v.designLayers || []).map((dl) => ({
                  id: dl.id,
                  imageUrl: resolveOrderAssetUrl(req, dl.imageUrl),
                  filename: dl.filename || "",
                  hasBgRemoved: dl.hasBgRemoved,
                  x: dl.x,
                  y: dl.y,
                  scale: dl.scale,
                  rotation: dl.rotation,
                  zone: dl.zone,
                  insideSafeArea: dl.insideSafeArea,
                  originalWidthPx: dl.originalWidthPx,
                  originalHeightPx: dl.originalHeightPx,
                  renderedWidthPx: dl.renderedWidthPx,
                  renderedHeightPx: dl.renderedHeightPx,
                  widthInches: dl.widthInches,
                  heightInches: dl.heightInches,
                  areaInches: dl.areaInches,
                  rawPrintWidthInches: dl.rawPrintWidthInches,
                  rawPrintHeightInches: dl.rawPrintHeightInches,
                  rawPrintAreaInches: dl.rawPrintAreaInches,
                })),
              })),
            },
          };
        }

        // ==========================
        // HANDLE READYMADE PRODUCT
        // Convert populated objects → string names
        // ==========================
        if (it.readymadeProduct) {
          const rp = it.readymadeProduct;

          return {
            ...it,
            readymadeProduct: {
              ...rp,
              category: rp.category?.name || "",
              subCategory: rp.subCategory?.name || "",
              brand: rp.brand?.name || "",
            },
          };
        }

        return it;
      }),
    };

    return res.status(200).json({ order: shaped });
  } catch (err) {
    console.error("adminGetOrderById error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};



/**
 * ADMIN: Update single order fulfillment status
 * PATCH /api/admin/orders/:orderId/order-status
 * body: { orderStatus: "READY" }
 */
export const adminUpdateOrderStatus = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { orderId } = req.params;
    if (!isValidObjectId(orderId)) {
      return res.status(400).json({ message: "Invalid orderId" });
    }

    const { orderStatus } = req.body;
    if (!FULFILLMENT_STATUSES.includes(orderStatus)) {
      return res.status(400).json({ message: "Invalid orderStatus" });
    }

    // Optional rule: Only allow fulfillment updates if payment is PAID
    const order = await Order.findById(orderId).populate("user");
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.status !== "PAID" && order.payment?.method !== "COD") {
      return res.status(400).json({ message: "Cannot update fulfillment status for unpaid order" });
    }
    if (order.orderStatus === orderStatus) {
      return res.status(200).json({ message: "Order status unchanged", order });
    }

    order.orderStatus = orderStatus;
    order.deliveredAt = orderStatus === "DELIVERED" ? new Date() : null;

    // Optional: track history
    order.statusHistory = order.statusHistory || [];
    order.statusHistory.push({ status: orderStatus, at: new Date() });

    await order.save();

    try {
      await sendOrderStatusEmail(order, order.user);
    } catch (emailError) {
      console.error("adminUpdateOrderStatus email error:", emailError.response?.body || emailError);
    }

    return res.status(200).json({ message: "Order status updated", order });
  } catch (err) {
    console.error("adminUpdateOrderStatus error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * ADMIN: Bulk update fulfillment status
 * PATCH /api/admin/orders/order-status/bulk
 * body: { orderIds: [...], orderStatus: "SHIPPED" }
 */
export const adminBulkUpdateOrderStatus = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { orderIds, orderStatus } = req.body;

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ message: "orderIds must be a non-empty array" });
    }
    if (!FULFILLMENT_STATUSES.includes(orderStatus)) {
      return res.status(400).json({ message: "Invalid orderStatus" });
    }

    const invalidId = orderIds.find((id) => !isValidObjectId(id));
    if (invalidId) return res.status(400).json({ message: `Invalid orderId: ${invalidId}` });

    const ordersToUpdate = await Order.find({
      _id: { $in: orderIds },
      $or: [{ status: "PAID" }, { "payment.method": "COD" }],
      orderStatus: { $ne: orderStatus },
    }).populate("user");

    if (!ordersToUpdate.length) {
      return res.status(200).json({
        message: "Bulk status updated",
        matched: 0,
        modified: 0,
        emailsTriggered: 0,
      });
    }

    // Optional: only update PAID orders
    const result = await Order.updateMany(
      {
        _id: { $in: ordersToUpdate.map((order) => order._id) },
        $or: [{ status: "PAID" }, { "payment.method": "COD" }],
      },
      {
        $set: {
          orderStatus,
          deliveredAt: orderStatus === "DELIVERED" ? new Date() : null,
        },
        $push: { statusHistory: { status: orderStatus, at: new Date() } },
      }
    );

    const emailResults = await Promise.allSettled(
      ordersToUpdate.map(async (order) => {
        order.orderStatus = orderStatus;
        order.deliveredAt = orderStatus === "DELIVERED" ? new Date() : null;
        await sendOrderStatusEmail(order, order.user);
      })
    );

    const emailsTriggered = emailResults.filter(
      (resultItem) => resultItem.status === "fulfilled"
    ).length;

    emailResults
      .filter((resultItem) => resultItem.status === "rejected")
      .forEach((resultItem) => {
        console.error(
          "adminBulkUpdateOrderStatus email error:",
          resultItem.reason?.response?.body || resultItem.reason
        );
      });

    return res.status(200).json({
      message: "Bulk status updated",
      matched: result.matchedCount ?? result.n,
      modified: result.modifiedCount ?? result.nModified,
      emailsTriggered,
    });
  } catch (err) {
    console.error("adminBulkUpdateOrderStatus error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * ADMIN: List submitted return requests
 * GET /api/orders/admin/returns
 */
export const adminGetReturnRequests = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const orders = await Order.find({
      "returnRequest.status": { $in: ["PROCESSING", "APPROVED", "REJECTED"] },
    })
      .populate("user", "name email")
      .populate("deliveryAddress")
      .populate("billingAddress")
      .populate({
        path: "items.readymadeProduct",
        populate: [
          { path: "category", select: "name" },
          { path: "subCategory", select: "name" },
          { path: "brand", select: "name" },
        ],
      })
      .populate("items.dropproduct")
      .populate({ path: "items.design", select: DESIGN_SELECT })
      .populate("items.product")
      .sort({
        "returnRequest.requestedAt": -1,
        createdAt: -1,
      })
      .lean();

    const shaped = orders.map((o) => ({
      ...o,
      returnRequest: shapeReturnRequest(req, {
        ...(o.returnRequest || {}),
        deadlineAt: o.returnRequest?.deadlineAt || getReturnDeadline(o),
      }),
      returnEligible: false,
      returnDeadlineAt: o.returnRequest?.deadlineAt || getReturnDeadline(o) || null,
    }));

    return res.status(200).json({ orders: shaped });
  } catch (err) {
    console.error("adminGetReturnRequests error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * ADMIN: Approve or reject a return request
 * PATCH /api/orders/admin/returns/:orderId
 */
export const adminUpdateReturnRequest = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { orderId } = req.params;
    if (!isValidObjectId(orderId)) {
      return res.status(400).json({ message: "Invalid orderId" });
    }

    const nextStatus = toTrimmedString(req.body?.status).toUpperCase();
    if (!["APPROVED", "REJECTED"].includes(nextStatus)) {
      return res.status(400).json({ message: "Return status must be APPROVED or REJECTED" });
    }

    const adminDecisionNote = toTrimmedString(req.body?.adminDecisionNote);

    const order = await Order.findById(orderId)
      .populate("user", "name email")
      .populate("deliveryAddress")
      .populate("billingAddress")
      .populate({
        path: "items.readymadeProduct",
        populate: [
          { path: "category", select: "name" },
          { path: "subCategory", select: "name" },
          { path: "brand", select: "name" },
        ],
      })
      .populate("items.dropproduct")
      .populate({ path: "items.design", select: DESIGN_SELECT })
      .populate("items.product");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (!["PROCESSING", "APPROVED", "REJECTED"].includes(order.returnRequest?.status || "NONE")) {
      return res.status(400).json({ message: "Return request is not available for status update" });
    }

    order.returnRequest.status = nextStatus;
    order.returnRequest.decidedAt = new Date();
    order.returnRequest.adminDecisionNote = adminDecisionNote;
    order.returnRequest.refundStatus = "NOT_PAID";
    resetRefundTracking(order.returnRequest);

    await order.save();

    try {
      await sendReturnDecisionEmail(order, order.user);
    } catch (emailError) {
      console.error("adminUpdateReturnRequest email error:", emailError.response?.body || emailError);
    }

    const shaped = {
      ...order.toObject(),
      returnRequest: shapeReturnRequest(req, {
        ...(order.returnRequest?.toObject?.() || order.returnRequest || {}),
        deadlineAt: order.returnRequest?.deadlineAt || getReturnDeadline(order),
      }),
      returnEligible: false,
      returnDeadlineAt: order.returnRequest?.deadlineAt || getReturnDeadline(order) || null,
    };

    return res.status(200).json({
      message: `Return request ${nextStatus.toLowerCase()}`,
      order: shaped,
    });
  } catch (err) {
    console.error("adminUpdateReturnRequest error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * ADMIN: Update refund payout status after return approval
 * PATCH /api/orders/admin/returns/:orderId/refund-status
 */
export const adminUpdateReturnRefundStatus = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { orderId } = req.params;
    if (!isValidObjectId(orderId)) {
      return res.status(400).json({ message: "Invalid orderId" });
    }

    const nextRefundStatus = toTrimmedString(req.body?.refundStatus).toUpperCase();
    if (!["NOT_PAID", "PROCESSING", "PAID"].includes(nextRefundStatus)) {
      return res.status(400).json({ message: "Refund status must be NOT_PAID, PROCESSING or PAID" });
    }

    const refundAmount = parsePositiveAmount(req.body?.refundAmount);
    const refundReference = toTrimmedString(req.body?.refundReference);

    const order = await Order.findById(orderId)
      .populate("user", "name email")
      .populate("deliveryAddress")
      .populate("billingAddress")
      .populate({
        path: "items.readymadeProduct",
        populate: [
          { path: "category", select: "name" },
          { path: "subCategory", select: "name" },
          { path: "brand", select: "name" },
        ],
      })
      .populate("items.dropproduct")
      .populate({ path: "items.design", select: DESIGN_SELECT })
      .populate("items.product");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if ((order.returnRequest?.status || "NONE") !== "APPROVED") {
      return res.status(400).json({ message: "Refund status can only be updated for approved returns" });
    }

    if (nextRefundStatus === "NOT_PAID") {
      if (
        order.payment?.method === "RAZORPAY" &&
        ["PROCESSING", "PAID"].includes(order.returnRequest?.refundStatus || "NOT_PAID")
      ) {
        return res.status(400).json({
          message: "Razorpay refund has already been initiated. It cannot be reset to NOT_PAID.",
        });
      }

      order.returnRequest.refundStatus = "NOT_PAID";
      resetRefundTracking(order.returnRequest);
      await order.save();
    } else if (order.payment?.method === "RAZORPAY") {
      if (!order.payment?.razorpayPaymentId) {
        return res.status(400).json({
          message: "Razorpay payment ID is missing for this order. Refund cannot be initiated.",
        });
      }

      if (!refundAmount) {
        return res.status(400).json({ message: "Refund amount is required" });
      }

      if (toPaise(refundAmount) > toPaise(order.total)) {
        return res.status(400).json({
          message: "Refund amount cannot be greater than the original payment amount",
        });
      }

      if (["PROCESSING", "PAID"].includes(order.returnRequest?.refundStatus || "NOT_PAID")) {
        return res.status(400).json({
          message: "Refund has already been initiated for this return request",
        });
      }

      const receipt = `return_${String(order._id)}_${Date.now()}`;
      let refund;

      try {
        refund = await razorpay.payments.refund(order.payment.razorpayPaymentId, {
          amount: toPaise(refundAmount),
          speed: "normal",
          receipt,
          notes: {
            orderId: String(order._id),
            returnStatus: order.returnRequest?.status || "APPROVED",
            refundMethod: order.returnRequest?.bankDetails?.method || "",
          },
        });
      } catch (refundError) {
        order.returnRequest.refundStatus = "FAILED";
        order.returnRequest.refundAmount = refundAmount;
        order.returnRequest.refundCurrency = order.currency || "INR";
        order.returnRequest.refundPaidAt = null;
        order.returnRequest.refundInitiatedAt = new Date();
        order.returnRequest.refundId = "";
        order.returnRequest.refundReceipt = receipt;
        order.returnRequest.refundReference = "";
        order.returnRequest.refundFailureReason =
          refundError?.error?.description ||
          refundError?.description ||
          refundError?.message ||
          "Refund initiation failed";
        await order.save();

        return res.status(400).json({
          message: order.returnRequest.refundFailureReason,
        });
      }

      order.returnRequest.refundStatus = mapRazorpayRefundStatus(refund.status);
      order.returnRequest.refundAmount = Number(refundAmount);
      order.returnRequest.refundCurrency = refund.currency || order.currency || "INR";
      order.returnRequest.refundInitiatedAt = refund.created_at
        ? new Date(refund.created_at * 1000)
        : new Date();
      order.returnRequest.refundPaidAt =
        refund.status === "processed"
          ? (refund.created_at ? new Date(refund.created_at * 1000) : new Date())
          : null;
      order.returnRequest.refundId = refund.id || "";
      order.returnRequest.refundReceipt = refund.receipt || receipt;
      order.returnRequest.refundReference = resolveRefundReference(refund.acquirer_data);
      order.returnRequest.refundFailureReason = "";
      await order.save();
    } else {
      if (!refundAmount) {
        return res.status(400).json({ message: "Refund amount is required" });
      }

      order.returnRequest.refundStatus = nextRefundStatus;
      order.returnRequest.refundAmount = refundAmount;
      order.returnRequest.refundCurrency = order.currency || "INR";
      order.returnRequest.refundInitiatedAt =
        nextRefundStatus === "NOT_PAID"
          ? null
          : order.returnRequest.refundInitiatedAt || new Date();
      order.returnRequest.refundPaidAt =
        nextRefundStatus === "PAID"
          ? new Date()
          : null;
      order.returnRequest.refundId = "";
      order.returnRequest.refundReceipt = "";
      order.returnRequest.refundReference =
        nextRefundStatus === "NOT_PAID"
          ? ""
          : refundReference || order.returnRequest.refundReference || "";
      order.returnRequest.refundFailureReason = "";
      await order.save();
    }

    if (order.returnRequest.refundStatus === "PAID") {
      try {
        await sendReturnRefundPaidEmail(order, order.user);
      } catch (emailError) {
        console.error(
          "adminUpdateReturnRefundStatus email error:",
          emailError.response?.body || emailError
        );
      }
    }

    const shaped = {
      ...order.toObject(),
      returnRequest: shapeReturnRequest(req, {
        ...(order.returnRequest?.toObject?.() || order.returnRequest || {}),
        deadlineAt: order.returnRequest?.deadlineAt || getReturnDeadline(order),
      }),
      returnEligible: false,
      returnDeadlineAt: order.returnRequest?.deadlineAt || getReturnDeadline(order) || null,
    };

    return res.status(200).json({
      message:
        order.returnRequest.refundStatus === "PROCESSING"
          ? "Refund initiated successfully and is being processed by Razorpay"
          : order.returnRequest.refundStatus === "PAID"
          ? "Refund marked as paid"
          : order.returnRequest.refundStatus === "FAILED"
          ? "Refund initiation failed"
          : `Refund status updated to ${order.returnRequest.refundStatus}`,
      order: shaped,
    });
  } catch (err) {
    console.error("adminUpdateReturnRefundStatus error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
