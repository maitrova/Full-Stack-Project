import express from "express";
import mongoose from "mongoose";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { protect } from "../middleware/authMiddleware.js";
import User from "../models/authmodel.js";
import Order from "../models/Order.js";
import { addToCart } from "../controllers/cartController.js";
import ReadymadeProduct from "../models/readymadeproducts.js";
import { getReadymadePricing } from "../utils/readymadePricing.js";

const router = express.Router();
const hash = (value) => createHash("sha256").update(value).digest("hex");
const links = () => mongoose.connection.db.collection("whatsapp_account_links");
const linkRequests = () => mongoose.connection.db.collection("whatsapp_link_requests");
const subscriptions = () => mongoose.connection.db.collection("whatsapp_order_subscriptions");
const rateLimits = () => mongoose.connection.db.collection("whatsapp_commerce_rate_limits");

const isRateLimited = async (scope, subject, limit, windowMs) => {
  const now = Date.now();
  const bucket = Math.floor(now / windowMs);
  const id = hash(`${scope}:${subject}:${bucket}`);
  const result = await rateLimits().findOneAndUpdate(
    { _id: id },
    {
      $inc: { count: 1 },
      $setOnInsert: { expiresAt: new Date(now + windowMs * 2), scope },
    },
    { upsert: true, returnDocument: "after" }
  );
  const record = result?.value || result;
  return Number(record?.count || 0) > limit;
};

router.delete("/link", protect, async (req, res) => {
  if (!req.user?._id) return res.sendStatus(401);
  await links().deleteMany({ user: req.user._id });
  await subscriptions().updateMany(
    { user: req.user._id },
    { $set: { active: false, opted_out_at: new Date(), updatedAt: new Date() } }
  );
  res.json({ message: "WhatsApp access revoked" });
});

router.post("/link/complete", protect, async (req, res) => {
  const token = String(req.body?.token || "").trim();
  if (!req.user?._id) return res.sendStatus(401);
  if (await isRateLimited("link-complete", req.user._id, 20, 15 * 60 * 1000)) {
    return res.status(429).json({ message: "Too many link attempts. Please wait and try again." });
  }
  if (!/^[A-Za-z0-9_-]{40,128}$/.test(token)) {
    return res.status(400).json({ message: "This checkout link is invalid" });
  }

  const now = new Date();
  const tokenId = hash(token);
  const userId = String(req.user._id);
  const result = await linkRequests().findOneAndUpdate(
    {
      _id: tokenId,
      expiresAt: { $gt: now },
      $or: [
        { consumed_by: { $exists: false } },
        { consumed_by: userId },
      ],
    },
    { $set: { consumed_by: userId, consumed_at: now } },
    { returnDocument: "after" }
  );
  const request = result?.value || result;
  if (!request?.account || !/^[a-f0-9]{64}$/.test(request.account)) {
    return res.status(400).json({ code: "CHECKOUT_LINK_UNAVAILABLE", message: "This checkout link is unavailable on this store, expired, or was already used. Request a new link in WhatsApp. If a new link also fails immediately, the store team must check the agent's API configuration." });
  }

  await links().updateOne(
    { _id: request.account },
    { $set: { user: req.user._id, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } },
    { upsert: true }
  );
  if (request.recipient) {
    await subscriptions().updateOne(
      { _id: request.account },
      {
        $set: {
          account: request.account,
          user: req.user._id,
          recipient: String(request.recipient),
          active: true,
          opted_in_at: now,
          customer_window_expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          updatedAt: now,
        },
      },
      { upsert: true }
    );
  }

  const returnPath = ["/orders", "/cart", "/checkout"].includes(request.return_path)
    ? request.return_path
    : "/checkout";
  if (!request.purchase) {
    return res.json({ message: "WhatsApp account connected", redirectTo: returnPath });
  }

  req.body = request.purchase;
  req.whatsappReturnPath = returnPath;
  return addLinkedCartItem(req, res);
});

router.use((req, res, next) => {
  const expected = process.env.WHATSAPP_COMMERCE_KEY || "";
  const received = String(req.headers["x-commerce-key"] || "");
  if (!expected || Buffer.byteLength(received) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(received), Buffer.from(expected))) return res.sendStatus(401);
  next();
});

// Issue tokens on the same backend/database that will complete them. This must
// precede linked-account middleware because the customer is not linked yet.
router.post("/link/request", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const account = String(req.headers["x-whatsapp-account"] || "");
  const { recipient, purchase, return_path: returnPath } = req.body || {};
  if (!/^[a-f0-9]{64}$/.test(account) || !/^\d{7,15}$/.test(String(recipient || ""))) {
    return res.status(400).json({ message: "Invalid WhatsApp account or recipient" });
  }
  if (purchase && (
    !mongoose.isValidObjectId(purchase.product_id) ||
    !["XS", "S", "M", "L", "XL", "XXL"].includes(purchase.size) ||
    !Number.isInteger(purchase.quantity) || purchase.quantity < 1 || purchase.quantity > 20 ||
    !Number.isFinite(purchase.expected_price) || purchase.expected_price < 0 ||
    !/^[a-f0-9]{32,64}$/.test(purchase.operation_id || "")
  )) {
    return res.status(400).json({ message: "Invalid confirmed purchase" });
  }
  let origin;
  try {
    const configured = new URL(process.env.ECOMMERCE_STOREFRONT_URL || process.env.FRONTEND_URL || "");
    if (configured.protocol !== "https:" || configured.username || configured.password) throw new Error();
    origin = configured.origin;
  } catch {
    return res.status(503).json({ message: "Secure checkout requires the public HTTPS storefront URL on the commerce backend." });
  }
  if (await isRateLimited("link-request", account, 10, 60 * 60 * 1000)) {
    return res.status(429).json({ message: "Too many secure links were requested. Please wait and try again later." });
  }
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);
  await linkRequests().createIndex("expiresAt", { expireAfterSeconds: 0 });
  await linkRequests().insertOne({
    _id: hash(token), account, recipient: String(recipient),
    purchase: purchase ? {
      product_id: purchase.product_id, size: purchase.size, quantity: purchase.quantity,
      expected_price: purchase.expected_price, operation_id: purchase.operation_id,
    } : null,
    return_path: ["/checkout", "/cart", "/orders"].includes(returnPath) ? returnPath : "/checkout",
    created_at: now, expiresAt,
  });
  // Do not delete earlier links: another message/retry must not invalidate a
  // customer's in-progress login. Cart operation IDs keep refreshes idempotent.
  return res.status(201).json({ checkout_url: `${origin}/whatsapp-connect?token=${token}`, expiresAt });
});

router.use(async (req, res, next) => {
  const ref = String(req.headers["x-whatsapp-account"] || "");
  if (!/^[a-f0-9]{64}$/.test(ref)) return res.sendStatus(401);
  const link = await links().findOne({ _id: ref, expiresAt: { $gt: new Date() } });
  if (!link) return res.status(401).json({ message: "Link your store account first" });
  req.user = await User.findById(link.user).select("_id");
  if (!req.user) return res.sendStatus(401);
  req.whatsappAccountRef = ref;
  next();
});

router.get("/orders", async (req, res) => {
  if (await isRateLimited("orders", req.whatsappAccountRef, 60, 60 * 1000)) {
    return res.status(429).json({ message: "Too many order requests. Please wait a minute." });
  }
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(5)
    .select("_id status orderStatus total currency createdAt returnRequest.status").lean();
  res.set("Cache-Control", "no-store");
  res.json({ orders });
});

router.get("/orders/:orderId", async (req, res) => {
  if (await isRateLimited("orders", req.whatsappAccountRef, 60, 60 * 1000)) {
    return res.status(429).json({ message: "Too many order requests. Please wait a minute." });
  }
  if (!mongoose.isValidObjectId(req.params.orderId)) {
    return res.status(400).json({ message: "Invalid order ID" });
  }
  const order = await Order.findOne({ _id: req.params.orderId, user: req.user._id })
    .select("_id status orderStatus total currency createdAt returnRequest.status payment.status")
    .lean();
  if (!order) return res.status(404).json({ message: "Order not found" });
  res.set("Cache-Control", "no-store");
  return res.json({ order });
});

const addLinkedCartItem = async (req, res) => {
  if (await isRateLimited("cart", req.whatsappAccountRef || req.user?._id, 30, 60 * 1000)) {
    return res.status(429).json({ message: "Too many cart requests. Please wait a minute." });
  }
  const { product_id: productId, size, quantity, operation_id: operationId } = req.body || {};
  if (!mongoose.isValidObjectId(productId) || !["XS", "S", "M", "L", "XL", "XXL"].includes(size) || !Number.isInteger(quantity) || quantity < 1 || quantity > 20 || !/^[a-f0-9]{32,64}$/.test(operationId || "")) {
    return res.status(400).json({ message: "Choose a valid product, size and quantity (1–20)" });
  }
  const receipts = mongoose.connection.db.collection("whatsapp_cart_operations");
  const id = `${req.user._id}:${operationId}`;
  const requestHash = hash(JSON.stringify([productId, size, quantity]));
  const replay = (previous) => {
    if (!previous || previous.requestHash !== requestHash) return res.status(409).json({ message: "Operation does not match original request" });
    if (previous.status === "complete") return res.status(previous.httpStatus).json(previous.response);
    return res.status(409).json({ message: "Cart update needs checking. Open your cart before trying again." });
  };
  const existing = await receipts.findOne({ _id: id });
  if (existing) return replay(existing);
  const product = await ReadymadeProduct.findOne({ _id: productId, isActive: true }).lean();
  const variant = product?.variants?.find((item) => item.size === size);
  if (!variant || variant.stock < quantity) return res.status(409).json({ message: "That size/quantity is no longer available." });
  const price = getReadymadePricing(product, { variant }).effectivePrice;
  if (typeof req.body.expected_price !== "number" || Math.abs(price - req.body.expected_price) > 0.005) return res.status(409).json({ message: "The price changed. Please ask for a new quote before confirming." });
  try {
    await receipts.insertOne({ _id: id, requestHash, status: "pending", createdAt: new Date() });
  } catch (error) {
    if (error.code !== 11000) throw error;
    const previous = await receipts.findOne({ _id: id });
    return replay(previous);
  }
  // The existing controller validates live inventory and calculates prices.
  // If it crashes after saving, keep the operation pending rather than adding twice.
  req.body = { kind: "READYMADE", readymadeProductId: productId, size, qty: quantity };
  let statusCode = 200;
  let result;
  const capturedResponse = {
    status(code) { statusCode = code; return this; },
    json(body) { result = body; return this; },
    cookie() { return this; }, clearCookie() { return this; },
  };
  await addToCart(req, capturedResponse);
  const response = { message: result?.message || "Cart update needs checking" };
  if (statusCode < 500) await receipts.updateOne({ _id: id }, { $set: { status: "complete", httpStatus: statusCode, response } });
  res.status(statusCode).json({ ...response, redirectTo: req.whatsappReturnPath || undefined });
};

router.post("/cart", addLinkedCartItem);

export default router;
