import mongoose from "mongoose";
import Order from "../models/Order.js";
import Review from "../models/Review.js";
import {
  sendOrderCancelledEmail,
  sendOrderStatusEmail,
  sendReturnDecisionEmail,
  sendReturnRefundPaidEmail,
  sendReturnRequestSubmittedEmail,
} from "../services/orderEmailService.js";
import { rollbackInventoryForOrder } from "../services/inventoryService.js";
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
const isPaidOrCodOrder = (order) =>
  order?.status === "PAID" || order?.payment?.method === "COD";

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

const shapeReturnRequest = (req, returnRequest = {}) => {
  const status = RETURN_STATUSES.includes(returnRequest.status)
    ? returnRequest.status
    : "NONE";

  return {
    status,
    requestedAt: returnRequest.requestedAt || null,
    decidedAt: returnRequest.decidedAt || null,
    refundPaidAt: returnRequest.refundPaidAt || null,
    deadlineAt: returnRequest.deadlineAt || null,
    reason: returnRequest.reason || "",
    imageUrls: Array.isArray(returnRequest.imageUrls)
      ? returnRequest.imageUrls.map((url) => resolveOrderAssetUrl(req, url))
      : [],
    adminDecisionNote: returnRequest.adminDecisionNote || "",
    refundStatus: returnRequest.refundStatus || "NOT_PAID",
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
    const hasCustomDesignItem = Array.isArray(order.items)
      ? order.items.some((item) => item?.kind === "DESIGN")
      : false;
    const deadlineAt =
      order.returnRequest?.deadlineAt ||
      getReturnDeadline(order);
    const returnStatus = order.returnRequest?.status || "NONE";
    const returnEligible =
      isPaidOrCodOrder(order) &&
      order.orderStatus === "DELIVERED" &&
      !hasCustomDesignItem &&
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
      returnRestrictedReason: hasCustomDesignItem
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

    if (Array.isArray(order.items) && order.items.some((item) => item?.kind === "DESIGN")) {
      return res.status(400).json({
        message: "Customized products are not eligible for return. Please contact the support team.",
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
      deadlineAt,
      reason,
      imageUrls,
      adminDecisionNote: "",
      refundStatus: "NOT_PAID",
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
    order.returnRequest.refundPaidAt = null;

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
    if (!["NOT_PAID", "PAID"].includes(nextRefundStatus)) {
      return res.status(400).json({ message: "Refund status must be NOT_PAID or PAID" });
    }

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

    order.returnRequest.refundStatus = nextRefundStatus;
    order.returnRequest.refundPaidAt = nextRefundStatus === "PAID" ? new Date() : null;
    await order.save();

    if (nextRefundStatus === "PAID") {
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
      message: `Refund status updated to ${nextRefundStatus}`,
      order: shaped,
    });
  } catch (err) {
    console.error("adminUpdateReturnRefundStatus error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
