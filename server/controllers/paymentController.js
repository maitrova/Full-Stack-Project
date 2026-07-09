import crypto from "crypto";
import { razorpay } from "../utils/razorpay.js";
import Order from "../models/Order.js";
import { Cart } from "../models/Cart.js";
import Address from "../models/address.js";
import {
  sendAdminOrderNotification,
  sendOrderStatusEmail,
  sendReturnRefundPaidEmail,
} from "../services/orderEmailService.js";
import { applyInventoryForOrder } from "../services/inventoryService.js";
import {
  redeemCouponForOrder,
  validateCouponForCart,
} from "../services/couponService.js";
import { getReadymadePricing } from "../utils/readymadePricing.js";
import HeaderBannerSettings from "../models/HeaderBannerSettings.js";

const toPaise = (rupees) => Math.round(Number(rupees) * 100);
const getRefId = (value) => value?._id || value || null;

const refreshCartItemPricing = (item) => {
  if (item.kind !== "READYMADE") {
    return item;
  }

  const sourceProduct = item.dropproduct || item.readymadeProduct;
  if (!sourceProduct) return item;

  const selectedSize = String(item.size || "").trim().toUpperCase();
  const variant = Array.isArray(sourceProduct.variants)
    ? sourceProduct.variants.find(
        (entry) => String(entry.size).toUpperCase() === selectedSize
      )
    : null;
  const pricing = getReadymadePricing(sourceProduct, { variant });

  item.unitPrice = pricing.effectivePrice;
  item.basePrice = pricing.mrp;
  item.priceDetails = pricing;
  return item;
};

const getItemTitle = (item) =>
  item?.dropproduct?.name ||
  item?.readymadeProduct?.title ||
  item?.readymadeProduct?.name ||
  item?.product?.name ||
  item?.product?.title ||
  item?.design?.name ||
  "Item";

const cartHasCustomizationItems = (cart) =>
  Array.isArray(cart?.items) &&
  cart.items.some((item) => item?.kind === "DESIGN" || Boolean(item?.product));

const getAllowedPaymentOptions = (product) => {
  const options = Array.isArray(product?.paymentOptions)
    ? product.paymentOptions
    : ["COD", "ONLINE"];

  const normalized = options
    .map((option) => String(option || "").trim().toUpperCase())
    .filter(Boolean);

  return normalized.length ? normalized : ["COD", "ONLINE"];
};

const validateCartPaymentAvailability = (cart, paymentOption) => {
  const requestedOption = String(paymentOption || "").trim().toUpperCase();

  for (const item of cart?.items || []) {
    if (item?.kind !== "READYMADE") continue;

    const sourceProduct = item.dropproduct || item.readymadeProduct;
    if (!sourceProduct) continue;

    if (!getAllowedPaymentOptions(sourceProduct).includes(requestedOption)) {
      const methodLabel =
        requestedOption === "COD" ? "Cash on delivery" : "Online payment";
      const error = new Error(`${methodLabel} is not available for ${getItemTitle(item)}`);
      error.statusCode = 400;
      throw error;
    }
  }
};

const getCodMinimumOrderAmount = async () => {
  const settings = await HeaderBannerSettings.findOne({ key: "main" }).select(
    "codMinimumOrderAmount"
  );
  return Math.max(0, Number(settings?.codMinimumOrderAmount || 0));
};

const getCustomizationColorStock = (product, colorValue) => {
  if (!product || !colorValue) return null;

  const colors = Array.isArray(product.colors) ? product.colors : [];
  const matchedColor = colors.find(
    (entry) =>
      String(entry?.value || "").trim().toLowerCase() ===
      String(colorValue || "").trim().toLowerCase()
  );

  if (!matchedColor) return null;

  const rawStock = matchedColor.stock;
  if (rawStock === null || rawStock === undefined || String(rawStock).trim() === "") {
    return null;
  }

  const numericStock = Number(rawStock);
  return Number.isFinite(numericStock) ? numericStock : null;
};

const validateCartInventory = (cart) => {
  for (const item of cart?.items || []) {
    if (item?.kind === "DESIGN") {
      const qty = Number(item.qty || 0);
      const colorStock = getCustomizationColorStock(
        item.product,
        item.design?.productColor
      );

      if (colorStock !== null && colorStock < qty) {
        const error = new Error(
          `${getItemTitle(item)} is out of stock for color ${
            item.design?.productColorName || item.design?.productColor
          }`
        );
        error.statusCode = 409;
        throw error;
      }

      continue;
    }

    if (item?.kind !== "READYMADE") continue;

    const sourceProduct = item.dropproduct || item.readymadeProduct;
    if (!sourceProduct) {
      const error = new Error(`${getItemTitle(item)} is no longer available`);
      error.statusCode = 404;
      throw error;
    }

    const selectedSize = String(item.size || "").trim().toUpperCase();
    const qty = Number(item.qty || 0);
    const variants = Array.isArray(sourceProduct.variants) ? sourceProduct.variants : [];

    if (variants.length > 0) {
      const variant = variants.find(
        (entry) => String(entry.size || "").trim().toUpperCase() === selectedSize
      );

      if (!variant) {
        const error = new Error(`${getItemTitle(item)} size ${selectedSize || "selected"} is unavailable`);
        error.statusCode = 400;
        throw error;
      }

      if (Number(variant.stock || 0) < qty) {
        const error = new Error(`${getItemTitle(item)} is out of stock for size ${selectedSize}`);
        error.statusCode = 409;
        throw error;
      }

      continue;
    }

    const stock = Number(sourceProduct.stock ?? sourceProduct.totalStock ?? 0);
    if (stock < qty) {
      const error = new Error(`${getItemTitle(item)} is out of stock`);
      error.statusCode = 409;
      throw error;
    }
  }
};

const getActiveCartWithPricing = async (userId) => {
  const cart = await Cart.findOne({ user: userId, status: "ACTIVE" })
    .populate("items.readymadeProduct")
    .populate("items.dropproduct")
    .populate("items.design")
    .populate("items.product")
    .populate({
      path: "items.readymadeProduct",
      populate: [
        { path: "category", select: "name" },
        { path: "subCategory", select: "name category" },
      ],
    });

  if (!cart || cart.items.length === 0) {
    const error = new Error("Cart is empty");
    error.statusCode = 400;
    throw error;
  }

  cart.items = cart.items.map((item) => refreshCartItemPricing(item));
  validateCartInventory(cart);
  return cart;
};

const getCheckoutAddresses = async (userId) => {
  const [delivery, billing] = await Promise.all([
    Address.findOne({ user: userId, type: "delivery" }),
    Address.findOne({ user: userId, type: "billing" }),
  ]);

  if (!delivery) {
    const error = new Error("Delivery address not found");
    error.statusCode = 400;
    throw error;
  }
  if (!billing) {
    const error = new Error("Billing address not found");
    error.statusCode = 400;
    throw error;
  }

  return { delivery, billing };
};

const getCartTotals = async ({ cart, userId, couponCode }) => {
  const subtotal = cart.items.reduce(
    (sum, item) => sum + Number(item.unitPrice || 0) * Number(item.qty || 0),
    0
  );
  const shipping = 0;
  let discount = 0;
  let couponSnapshot = null;

  if (couponCode) {
    const couponResult = await validateCouponForCart({ couponCode, cart, userId });
    if (!couponResult.valid) {
      const error = new Error(couponResult.reason);
      error.statusCode = 400;
      throw error;
    }

    discount = couponResult.discount;
    couponSnapshot = couponResult.couponSnapshot;
  }

  const total = Math.max(0, subtotal + shipping - discount);
  return { subtotal, shipping, discount, total, couponSnapshot };
};

const createOrderDocFromCart = async ({
  userId,
  cart,
  delivery,
  billing,
  totals,
  paymentMethod,
  paymentStatus,
  orderStatus = "PROCESSING",
}) => {
  return Order.create({
    user: userId,
    cart: cart._id,
    items: cart.items.map((item) => ({
      kind: item.kind,
      readymadeProduct: getRefId(item.readymadeProduct),
      design: getRefId(item.design),
      dropproduct: getRefId(item.dropproduct),
      product: getRefId(item.product),
      size: item.size,
      qty: item.qty,
      unitPrice: item.unitPrice,
      basePrice: item.basePrice,
      currency: item.currency || "INR",
      previewImage: item.previewImage,
      signature: item.signature,
    })),
    deliveryAddress: delivery._id,
    billingAddress: billing._id,
    subtotal: totals.subtotal,
    shipping: totals.shipping,
    discount: totals.discount,
    total: totals.total,
    currency: "INR",
    coupon: totals.couponSnapshot,
    status: paymentStatus,
    orderStatus,
    payment: {
      method: paymentMethod,
      status: paymentMethod === "COD" ? "COD_PENDING" : "CREATED",
    },
  });
};

const finalizePostOrderFlow = async ({ orderDoc, userId }) => {
  if (!orderDoc.inventoryAdjustedAt) {
    await applyInventoryForOrder(orderDoc);
    orderDoc.inventoryAdjustedAt = new Date();
    await orderDoc.save();
  }

  await redeemCouponForOrder({
    couponSnapshot: orderDoc.coupon,
    userId,
    orderId: orderDoc._id,
  });

  const populatedOrder = await Order.findById(orderDoc._id).populate("user");
  await Promise.all([
    sendOrderStatusEmail(populatedOrder, populatedOrder.user),
    sendAdminOrderNotification(populatedOrder, populatedOrder.user),
  ]);

  await Cart.findOneAndUpdate(
    { _id: orderDoc.cart, user: userId, status: "ACTIVE" },
    { $set: { status: "ORDERED" } },
    { new: true }
  );

  return Cart.findOneAndUpdate(
    { user: userId, status: "ACTIVE" },
    { $setOnInsert: { user: userId, status: "ACTIVE", items: [] } },
    { upsert: true, new: true }
  );
};

const getRazorpayWebhookSecret = () =>
  process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;

const verifyRazorpayWebhookSignature = (rawBody, signature) => {
  const webhookSecret = getRazorpayWebhookSecret();
  if (!webhookSecret) {
    const error = new Error("Razorpay webhook secret is not configured");
    error.statusCode = 500;
    throw error;
  }

  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  return expectedSignature === signature;
};

const mapWebhookRefundStatus = (status = "") => {
  switch (String(status).toLowerCase()) {
    case "processed":
      return "PAID";
    case "pending":
      return "PROCESSING";
    case "failed":
      return "FAILED";
    default:
      return "PROCESSING";
  }
};

const getWebhookRefundFailureReason = (event = {}) =>
  event?.payload?.payment?.entity?.error_description ||
  event?.payload?.payment?.entity?.error_reason ||
  event?.payload?.refund?.entity?.notes?.failure_reason ||
  event?.payload?.refund?.entity?.notes?.reason ||
  "";

export const createRazorpayOrderFromCart = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { couponCode } = req.body;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const cart = await getActiveCartWithPricing(userId);
    validateCartPaymentAvailability(cart, "ONLINE");
    const { delivery, billing } = await getCheckoutAddresses(userId);
    const totals = await getCartTotals({ cart, userId, couponCode });
    const orderDoc = await createOrderDocFromCart({
      userId,
      cart,
      delivery,
      billing,
      totals,
      paymentMethod: "RAZORPAY",
      paymentStatus: "PENDING_PAYMENT",
      orderStatus: "PROCESSING",
    });

    const rpOrder = await razorpay.orders.create({
      amount: toPaise(totals.total),
      currency: "INR",
      receipt: `rcpt_${orderDoc._id}`,
      notes: {
        orderId: String(orderDoc._id),
        userId: String(userId),
        couponCode: totals.couponSnapshot?.code || "",
      },
    });

    orderDoc.payment.razorpayOrderId = rpOrder.id;
    await orderDoc.save();

    return res.status(201).json({
      message: "Razorpay order created",
      orderId: orderDoc._id,
      razorpayOrderId: rpOrder.id,
      amount: rpOrder.amount,
      currency: rpOrder.currency,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      pricing: {
        subtotal: totals.subtotal,
        shipping: totals.shipping,
        discount: totals.discount,
        total: totals.total,
        coupon: totals.couponSnapshot,
      },
    });
  } catch (err) {
    console.error("createRazorpayOrderFromCart error:", err);
    return res.status(err.statusCode || 500).json({ message: err.message || "Server error" });
  }
};

export const createCashOnDeliveryOrderFromCart = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { couponCode } = req.body;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const cart = await getActiveCartWithPricing(userId);
    validateCartPaymentAvailability(cart, "COD");
    const { delivery, billing } = await getCheckoutAddresses(userId);
    const totals = await getCartTotals({ cart, userId, couponCode });

    if (cartHasCustomizationItems(cart)) {
      return res.status(400).json({
        message: "Cash on delivery is not available for customization products",
      });
    }

    const codMinimumOrderAmount = await getCodMinimumOrderAmount();
    if (totals.total < codMinimumOrderAmount) {
      return res.status(400).json({
        message: `Cash on delivery is available only for orders of Rs. ${codMinimumOrderAmount.toFixed(2)} or more`,
        codMinimumOrderAmount,
      });
    }

    const orderDoc = await createOrderDocFromCart({
      userId,
      cart,
      delivery,
      billing,
      totals,
      paymentMethod: "COD",
      paymentStatus: "PENDING_PAYMENT",
      orderStatus: "PROCESSING",
    });

    const newActiveCart = await finalizePostOrderFlow({ orderDoc, userId });

    return res.status(201).json({
      message: "Cash on delivery order created",
      order: orderDoc,
      cart: newActiveCart,
      pricing: {
        subtotal: totals.subtotal,
        shipping: totals.shipping,
        discount: totals.discount,
        total: totals.total,
        coupon: totals.couponSnapshot,
      },
    });
  } catch (err) {
    console.error("createCashOnDeliveryOrderFromCart error:", err);
    return res.status(err.statusCode || 500).json({ message: err.message || "Server error" });
  }
};

export const verifyRazorpayPayment = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!orderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: "Missing payment fields" });
    }

    const orderDoc = await Order.findOne({ _id: orderId, user: userId });
    if (!orderDoc) return res.status(404).json({ message: "Order not found" });

    const alreadyVerified =
      orderDoc.status === "PAID" && orderDoc.payment?.status === "PAID";

    if (orderDoc.payment?.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ message: "Razorpay order mismatch" });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expected !== razorpay_signature) {
      orderDoc.status = "FAILED";
      orderDoc.payment.status = "FAILED";
      orderDoc.payment.razorpayPaymentId = razorpay_payment_id;
      orderDoc.payment.razorpaySignature = razorpay_signature;
      await orderDoc.save();

      return res.status(400).json({ message: "Payment verification failed" });
    }

    orderDoc.payment.razorpayPaymentId = razorpay_payment_id;
    orderDoc.payment.razorpaySignature = razorpay_signature;

    if (!alreadyVerified) {
      orderDoc.status = "PAID";
      orderDoc.payment.status = "PAID";
    }

    await orderDoc.save();

    let shouldSendConfirmationEmail = false;

    if (!orderDoc.inventoryAdjustedAt) {
      try {
        await applyInventoryForOrder(orderDoc);
      } catch (inventoryError) {
        console.error("Inventory adjustment failed:", inventoryError);
        return res.status(inventoryError.statusCode || 409).json({
          message:
            inventoryError.code === "INSUFFICIENT_STOCK"
              ? "Payment verified, but one or more items are out of stock. Please contact support."
              : "Payment verified, but inventory update failed.",
        });
      }

      orderDoc.orderStatus = "PROCESSING";
      orderDoc.inventoryAdjustedAt = new Date();
      await orderDoc.save();
      shouldSendConfirmationEmail = true;
    }

    await redeemCouponForOrder({
      couponSnapshot: orderDoc.coupon,
      userId,
      orderId: orderDoc._id,
    });

    if (shouldSendConfirmationEmail) {
      const populatedOrder = await Order.findById(orderDoc._id).populate("user");
      await Promise.all([
        sendOrderStatusEmail(populatedOrder, populatedOrder.user),
        sendAdminOrderNotification(populatedOrder, populatedOrder.user),
      ]);
    }

    const newActiveCart = await finalizePostOrderFlow({ orderDoc, userId });

    return res.status(200).json({
      message: alreadyVerified ? "Payment already verified" : "Payment verified",
      order: orderDoc,
      cart: newActiveCart,
    });
  } catch (err) {
    console.error("verifyRazorpayPayment error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const handleRazorpayWebhook = async (req, res) => {
  try {
    const signature = req.get("X-Razorpay-Signature") || req.get("x-razorpay-signature");
    if (!signature) {
      return res.status(400).json({ message: "Missing Razorpay signature" });
    }

    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
    if (!rawBody) {
      return res.status(400).json({ message: "Missing webhook body" });
    }

    if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
      return res.status(401).json({ message: "Invalid webhook signature" });
    }

    let event;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return res.status(400).json({ message: "Invalid webhook JSON" });
    }

    const eventName = String(event?.event || "").toLowerCase();
    if (!["refund.created", "refund.processed", "refund.failed"].includes(eventName)) {
      return res.status(200).json({ message: "Webhook ignored" });
    }

    const refund = event?.payload?.refund?.entity || {};
    const payment = event?.payload?.payment?.entity || {};
    const paymentId = refund.payment_id || payment.id;

    if (!paymentId) {
      return res.status(200).json({ message: "Webhook missing payment reference" });
    }

    const order = await Order.findOne({ "payment.razorpayPaymentId": paymentId }).populate("user");
    if (!order) {
      console.warn("[razorpay-webhook] Order not found for payment:", paymentId);
      return res.status(200).json({ message: "Order not found" });
    }

    order.returnRequest = order.returnRequest || {};
    const nextRefundStatus = mapWebhookRefundStatus(refund.status || (eventName === "refund.failed" ? "failed" : "pending"));
    const currentRefundStatus = order.returnRequest.refundStatus || "NOT_PAID";
    const nextRefundAmount = Number(refund.amount || 0) > 0 ? Number(refund.amount) / 100 : Number(order.returnRequest.refundAmount || order.total || 0);
    const nextRefundReference =
      refund?.acquirer_data?.arn ||
      refund?.acquirer_data?.rrn ||
      refund?.acquirer_data?.utr ||
      refund?.acquirer_data?.reference_number ||
      "";
    const previousRefundStatus = currentRefundStatus;

    order.returnRequest.refundId = refund.id || order.returnRequest.refundId || "";
    order.returnRequest.refundAmount = nextRefundAmount;
    order.returnRequest.refundCurrency = refund.currency || order.currency || "INR";
    order.returnRequest.refundInitiatedAt = refund.created_at
      ? new Date(refund.created_at * 1000)
      : order.returnRequest.refundInitiatedAt || new Date();
    order.returnRequest.refundReference = nextRefundReference || order.returnRequest.refundReference || "";
    order.returnRequest.refundStatus = nextRefundStatus;

    if (nextRefundStatus === "PAID") {
      order.returnRequest.refundPaidAt = refund.created_at
        ? new Date(refund.created_at * 1000)
        : new Date();
      order.returnRequest.refundFailureReason = "";
    } else if (nextRefundStatus === "FAILED") {
      order.returnRequest.refundFailureReason = getWebhookRefundFailureReason(event) || "Refund failed in Razorpay";
      order.returnRequest.refundPaidAt = null;
    } else {
      order.returnRequest.refundPaidAt = null;
      order.returnRequest.refundFailureReason = "";
    }

    await order.save();

    if (previousRefundStatus !== "PAID" && nextRefundStatus === "PAID") {
      try {
        await sendReturnRefundPaidEmail(order, order.user);
      } catch (emailError) {
        console.error(
          "handleRazorpayWebhook email error:",
          emailError.response?.body || emailError
        );
      }
    }

    return res.status(200).json({ message: "Webhook processed" });
  } catch (err) {
    console.error("handleRazorpayWebhook error:", err);
    return res.status(err.statusCode || 500).json({ message: err.message || "Server error" });
  }
};
