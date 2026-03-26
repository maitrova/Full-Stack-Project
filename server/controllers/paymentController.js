import crypto from "crypto";
import { razorpay } from "../utils/razorpay.js";
import Order from "../models/Order.js";
import { Cart } from "../models/Cart.js";
import Address from "../models/address.js";
import {
  sendAdminOrderNotification,
  sendOrderStatusEmail,
} from "../services/orderEmailService.js";
import { applyInventoryForOrder } from "../services/inventoryService.js";
import {
  redeemCouponForOrder,
  validateCouponForCart,
} from "../services/couponService.js";
import { getReadymadePricing } from "../utils/readymadePricing.js";

const toPaise = (rupees) => Math.round(Number(rupees) * 100);
const getRefId = (value) => value?._id || value || null;

const refreshCartItemPricing = (item) => {
  if (item.kind !== "READYMADE" || !item.readymadeProduct) {
    return item;
  }

  const selectedSize = String(item.size || "").trim().toUpperCase();
  const variant = Array.isArray(item.readymadeProduct.variants)
    ? item.readymadeProduct.variants.find(
        (entry) => String(entry.size).toUpperCase() === selectedSize
      )
    : null;
  const pricing = getReadymadePricing(item.readymadeProduct, { variant });

  item.unitPrice = pricing.effectivePrice;
  item.basePrice = pricing.mrp;
  item.priceDetails = pricing;
  return item;
};

export const createRazorpayOrderFromCart = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { couponCode } = req.body;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

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

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    cart.items = cart.items.map((item) => refreshCartItemPricing(item));

    const delivery = await Address.findOne({ user: userId, type: "delivery" });
    const billing = await Address.findOne({ user: userId, type: "billing" });

    if (!delivery) return res.status(400).json({ message: "Delivery address not found" });
    if (!billing) return res.status(400).json({ message: "Billing address not found" });

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
        return res.status(400).json({ message: couponResult.reason });
      }

      discount = couponResult.discount;
      couponSnapshot = couponResult.couponSnapshot;
    }

    const total = Math.max(0, subtotal + shipping - discount);

    const orderDoc = await Order.create({
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
      subtotal,
      shipping,
      discount,
      total,
      currency: "INR",
      coupon: couponSnapshot,
      status: "PENDING_PAYMENT",
      payment: { status: "CREATED" },
    });

    const rpOrder = await razorpay.orders.create({
      amount: toPaise(total),
      currency: "INR",
      receipt: `rcpt_${orderDoc._id}`,
      notes: {
        orderId: String(orderDoc._id),
        userId: String(userId),
        couponCode: couponSnapshot?.code || "",
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
        subtotal,
        shipping,
        discount,
        total,
        coupon: couponSnapshot,
      },
    });
  } catch (err) {
    console.error("createRazorpayOrderFromCart error:", err);
    return res.status(500).json({ message: "Server error" });
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

    await Cart.findOneAndUpdate(
      { _id: orderDoc.cart, user: userId, status: "ACTIVE" },
      { $set: { status: "ORDERED" } },
      { new: true }
    );

    const newActiveCart = await Cart.findOneAndUpdate(
      { user: userId, status: "ACTIVE" },
      { $setOnInsert: { user: userId, status: "ACTIVE", items: [] } },
      { upsert: true, new: true }
    );

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
