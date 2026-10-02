import express from "express";
import mongoose from "mongoose";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { protect } from "../middleware/authMiddleware.js";
import User from "../models/authmodel.js";
import Order from "../models/Order.js";
import { addToCart, removeCartItem, updateCartItemQty } from "../controllers/cartController.js";
import { Cart } from "../models/Cart.js";
import ReadymadeProduct from "../models/readymadeproducts.js";
import { getReadymadePricing } from "../utils/readymadePricing.js";

const router = express.Router();
const hash = (value) => createHash("sha256").update(value).digest("hex");
const links = () => mongoose.connection.db.collection("whatsapp_account_links");
const linkRequests = () => mongoose.connection.db.collection("whatsapp_link_requests");
const subscriptions = () => mongoose.connection.db.collection("whatsapp_order_subscriptions");
const rateLimits = () => mongoose.connection.db.collection("whatsapp_commerce_rate_limits");
const actionAudit = () => mongoose.connection.db.collection("ai_action_audit");
const isValidSizeValue = (value) => (
  typeof value === "string"
  && value.length >= 1
  && value.length <= 32
  && value.trim() === value
  && !/[\u0000-\u001f\u007f]/.test(value)
);
const isValidConfirmedPurchase = (purchase) => (
  purchase
  && mongoose.isValidObjectId(purchase.product_id)
  && isValidSizeValue(purchase.size)
  && Number.isInteger(purchase.quantity) && purchase.quantity >= 1 && purchase.quantity <= 20
  && Number.isFinite(purchase.expected_price) && purchase.expected_price >= 0
  && /^[a-f0-9]{32,64}$/.test(purchase.operation_id || "")
);
const confirmedPurchaseItems = (purchase) => (
  Array.isArray(purchase?.items) ? purchase.items : purchase ? [purchase] : []
);

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

  const purchaseItems = confirmedPurchaseItems(request.purchase);
  if (purchaseItems.length < 1 || purchaseItems.length > 5 || purchaseItems.some((item) => !isValidConfirmedPurchase(item))) {
    return res.status(400).json({ message: "The confirmed WhatsApp cart selection is invalid or expired." });
  }
  req.whatsappAccountRef = request.account;
  if (Array.isArray(request.purchase.items)) {
    return addLinkedCartItems(req, res, purchaseItems, returnPath);
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
  const purchaseItems = confirmedPurchaseItems(purchase);
  if (purchase && (
    purchaseItems.length < 1 || purchaseItems.length > 5
    || purchaseItems.some((item) => !isValidConfirmedPurchase(item))
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
    purchase: purchase
      ? (Array.isArray(purchase.items)
        ? { items: purchaseItems.map((item) => ({
          product_id: item.product_id, size: item.size, quantity: item.quantity,
          expected_price: item.expected_price, operation_id: item.operation_id,
        })) }
        : {
          product_id: purchase.product_id, size: purchase.size, quantity: purchase.quantity,
          expected_price: purchase.expected_price, operation_id: purchase.operation_id,
        })
      : null,
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

const activeCart = (userId) => Cart.findOne({ user: userId, status: "ACTIVE" })
  .populate("items.readymadeProduct", "title name variants")
  .populate("items.dropproduct", "name title variants")
  .populate("items.design", "name title")
  .populate("items.comboPack", "name title");

const cartRows = (cart) => (cart?.items || []).map((item, index) => {
  const source = item.readymadeProduct || item.dropproduct || item.design || item.comboPack || {};
  return {
    item_id: String(item._id),
    option: index + 1,
    name: source.title || source.name || item.comboName || "Cart item",
    size: item.size || null,
    quantity: Number(item.qty || 0),
    unit_price: Number(item.unitPrice || 0),
    currency: item.currency || "INR",
  };
});

router.get("/cart", async (req, res) => {
  if (await isRateLimited("cart-read", req.whatsappAccountRef, 60, 60 * 1000)) {
    return res.status(429).json({ message: "Too many cart requests. Please wait a minute." });
  }
  const cart = await activeCart(req.user._id);
  res.set("Cache-Control", "no-store");
  return res.json({ items: cartRows(cart) });
});

const captureController = async (controller, req) => {
  let statusCode = 200;
  let result;
  const response = {
    status(code) { statusCode = code; return this; },
    json(body) { result = body; return this; },
    cookie() { return this; },
    clearCookie() { return this; },
  };
  await controller(req, response);
  return { statusCode, result };
};

router.patch("/cart/items/:itemId", async (req, res) => {
  const quantity = Number(req.body?.quantity);
  const operationId = String(req.body?.operation_id || "");
  if (!mongoose.isValidObjectId(req.params.itemId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 20 || !/^[a-f0-9]{32,64}$/.test(operationId)) {
    return res.status(400).json({ message: "Choose a valid cart item and quantity (1–20)." });
  }
  if (await isRateLimited("cart-edit", req.whatsappAccountRef, 30, 60 * 1000)) {
    return res.status(429).json({ message: "Too many cart requests. Please wait a minute." });
  }
  req.body = { qty: quantity };
  const { statusCode, result } = await captureController(updateCartItemQty, req);
  await actionAudit().insertOne({
    business_action: "cart_quantity_update", channel: "whatsapp", account: req.whatsappAccountRef,
    actor_user_id: req.user._id, target_id: req.params.itemId, arguments: { quantity }, operation_id: operationId,
    outcome: statusCode < 400 ? "success" : "rejected", http_status: statusCode, created_at: new Date(),
  });
  return res.status(statusCode).json({ message: result?.message || "Cart update failed", items: cartRows(result?.cart) });
});

router.delete("/cart/items/:itemId", async (req, res) => {
  const operationId = String(req.body?.operation_id || "");
  if (!mongoose.isValidObjectId(req.params.itemId) || !/^[a-f0-9]{32,64}$/.test(operationId)) {
    return res.status(400).json({ message: "Choose a valid cart item." });
  }
  if (await isRateLimited("cart-remove", req.whatsappAccountRef, 30, 60 * 1000)) {
    return res.status(429).json({ message: "Too many cart requests. Please wait a minute." });
  }
  const { statusCode, result } = await captureController(removeCartItem, req);
  await actionAudit().insertOne({
    business_action: "cart_item_remove", channel: "whatsapp", account: req.whatsappAccountRef,
    actor_user_id: req.user._id, target_id: req.params.itemId, arguments: {}, operation_id: operationId,
    outcome: statusCode < 400 ? "success" : "rejected", http_status: statusCode, created_at: new Date(),
  });
  return res.status(statusCode).json({ message: result?.message || "Cart removal failed", items: cartRows(result?.cart) });
});

const addLinkedCartItem = async (req, res) => {
  if (await isRateLimited("cart", req.whatsappAccountRef || req.user?._id, 30, 60 * 1000)) {
    return res.status(429).json({ message: "Too many cart requests. Please wait a minute." });
  }
  const { product_id: productId, size, quantity, operation_id: operationId } = req.body || {};
  if (!mongoose.isValidObjectId(productId) || !isValidSizeValue(size) || !Number.isInteger(quantity) || quantity < 1 || quantity > 20 || !/^[a-f0-9]{32,64}$/.test(operationId || "")) {
    return res.status(400).json({ message: "Choose a valid product, size and quantity (1-20)" });
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
  await actionAudit().insertOne({
    business_action: "cart_item_add", channel: "whatsapp", account: req.whatsappAccountRef,
    actor_user_id: req.user._id, target_id: productId, arguments: { size, quantity }, operation_id: operationId,
    outcome: statusCode < 400 ? "success" : "rejected", http_status: statusCode, created_at: new Date(),
  });
  res.status(statusCode).json({ ...response, redirectTo: req.whatsappReturnPath || undefined });
};

const addLinkedCartItems = async (req, res, items, returnPath = "/cart") => {
  if (!Array.isArray(items) || items.length < 1 || items.length > 5 || items.some((item) => !isValidConfirmedPurchase(item))) {
    return res.status(400).json({ message: "Choose valid products, sizes and quantities." });
  }
  if (await isRateLimited("cart-batch", req.whatsappAccountRef || req.user?._id, 20, 60 * 1000)) {
    return res.status(429).json({ message: "Too many cart requests. Please wait a minute." });
  }

  const normalized = [];
  for (const item of items) {
    const key = `${item.product_id}:${item.size}`;
    const existing = normalized.find((entry) => entry.key === key);
    if (existing) {
      if (Math.abs(existing.expected_price - item.expected_price) > 0.005) {
        return res.status(409).json({ message: "The same size has conflicting prices. Request a new quote." });
      }
      existing.quantity += item.quantity;
      existing.operation_ids.push(item.operation_id);
    } else {
      normalized.push({ ...item, key, operation_ids: [item.operation_id] });
    }
  }
  if (normalized.some((item) => item.quantity > 20)) {
    return res.status(400).json({ message: "A maximum of 20 units is allowed per product and size." });
  }

  const batchOperationId = hash(normalized.flatMap((item) => item.operation_ids).sort().join(":"));
  const receiptId = `${req.user._id}:batch:${batchOperationId}`;
  const requestHash = hash(JSON.stringify(normalized.map(({ key, operation_ids, ...item }) => item)));
  const receipts = mongoose.connection.db.collection("whatsapp_cart_operations");
  const replay = async () => {
    const previous = await receipts.findOne({ _id: receiptId });
    if (!previous || previous.requestHash !== requestHash) {
      return res.status(409).json({ message: "Batch operation does not match the original request." });
    }
    if (previous.status === "complete") return res.status(previous.httpStatus).json(previous.response);
    return res.status(409).json({ message: "Cart update is still being checked." });
  };
  const existingReceipt = await receipts.findOne({ _id: receiptId });
  if (existingReceipt) {
    const pendingAgeMs = Date.now() - new Date(existingReceipt.createdAt || 0).getTime();
    if (existingReceipt.status === "pending" && pendingAgeMs > 2 * 60 * 1000) {
      await receipts.deleteOne({ _id: receiptId, status: "pending" });
      if (await receipts.findOne({ _id: receiptId })) return replay();
    } else {
      return replay();
    }
  }

  let responseBody;
  try {
    await receipts.insertOne({
      _id: receiptId,
      requestHash,
      status: "pending",
      createdAt: new Date(),
    });

    const productIds = [...new Set(normalized.map((item) => item.product_id))];
    const products = await ReadymadeProduct.find({
      _id: { $in: productIds },
      isActive: true,
    }).lean();
    const productsById = new Map(products.map((product) => [String(product._id), product]));
    const validated = normalized.map((item) => {
      const product = productsById.get(String(item.product_id));
      const variant = product?.variants?.find((entry) => entry.size === item.size);
      if (!variant || Number(variant.stock || 0) < item.quantity) {
        const error = new Error(`Size ${item.size} or the requested quantity is no longer available.`);
        error.statusCode = 409;
        throw error;
      }
      const unitPrice = getReadymadePricing(product, { variant }).effectivePrice;
      if (Math.abs(unitPrice - item.expected_price) > 0.005) {
        const error = new Error("A price changed. Request a new quote in WhatsApp.");
        error.statusCode = 409;
        throw error;
      }
      return { item, product, variant, unitPrice };
    });

    responseBody = {
      message: "Confirmed items added to cart",
      redirectTo: returnPath,
      addedItems: validated.map(({ item }) => ({
        product_id: item.product_id,
        size: item.size,
        quantity: item.quantity,
      })),
    };

    // Every selected size lives in one cart document. A single document write is
    // atomic in MongoDB and works on both standalone servers and replica sets.
    // The operation marker makes retries idempotent even if receipt persistence
    // is interrupted after the cart write succeeds.
    const carts = mongoose.connection.db.collection(Cart.collection.name);
    const cartFilter = { user: req.user._id, status: "ACTIVE" };
    let committed = false;
    for (let attempt = 0; attempt < 5 && !committed; attempt += 1) {
      const cart = await carts.findOne(cartFilter);
      if (cart?.whatsappOperationIds?.includes(batchOperationId)) {
        committed = true;
        break;
      }

      const now = new Date();
      const cartItems = [...(cart?.items || [])];
      for (const { item, product, variant, unitPrice } of validated) {
        const normalizedSize = String(item.size).trim().toUpperCase();
        const signature = `READYMADE:${String(product._id)}:SIZE:${normalizedSize}`;
        const existing = cartItems.find((entry) => entry.signature === signature);
        const nextQuantity = Number(existing?.qty || 0) + item.quantity;
        if (nextQuantity > Number(variant.stock || 0)) {
          const error = new Error(`Only ${variant.stock || 0} are available in size ${item.size}.`);
          error.statusCode = 409;
          throw error;
        }
        if (existing) {
          existing.qty = nextQuantity;
          existing.unitPrice = unitPrice;
          existing.updatedAt = now;
        } else {
          cartItems.push({
            _id: new mongoose.Types.ObjectId(),
            kind: "READYMADE",
            readymadeProduct: product._id,
            design: null,
            dropproduct: null,
            comboPack: null,
            product: null,
            size: normalizedSize,
            qty: item.quantity,
            unitPrice,
            basePrice: Number(variant.price ?? product.price ?? unitPrice),
            priceDetails: null,
            currency: product.currency || "INR",
            previewImage: product.thumbnail || product.images?.[0]?.url || null,
            signature,
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      const operationIds = [...(cart?.whatsappOperationIds || []), batchOperationId].slice(-100);
      if (cart) {
        const result = await carts.updateOne(
          {
            _id: cart._id,
            status: "ACTIVE",
            updatedAt: cart.updatedAt,
            whatsappOperationIds: { $ne: batchOperationId },
          },
          { $set: { items: cartItems, whatsappOperationIds: operationIds, updatedAt: now } }
        );
        committed = Number(result?.matchedCount || 0) === 1;
      } else {
        try {
          await carts.insertOne({
            user: req.user._id,
            guestId: null,
            items: cartItems,
            whatsappOperationIds: operationIds,
            status: "ACTIVE",
            createdAt: now,
            updatedAt: now,
          });
          committed = true;
        } catch (error) {
          if (error?.code !== 11000) throw error;
        }
      }
    }
    if (!committed) {
      const error = new Error("Your cart changed at the same time. Please confirm once more.");
      error.statusCode = 409;
      throw error;
    }

    await receipts.updateOne(
      { _id: receiptId },
      { $set: { status: "complete", httpStatus: 200, response: responseBody, completedAt: new Date() } }
    );
  } catch (error) {
    if (error?.code === 11000) return replay();
    const statusCode = Number(error?.statusCode) || 503;
    const message = statusCode === 503
      ? "Atomic cart update is temporarily unavailable. Nothing was added."
      : `${error.message} Nothing was added.`;
    console.error("WhatsApp batch cart update failed:", {
      message: error?.message,
      code: error?.code,
      statusCode,
      itemCount: normalized.length,
    });
    if (statusCode < 500) {
      await receipts.updateOne(
        { _id: receiptId },
        { $set: { status: "complete", httpStatus: statusCode, response: { message }, completedAt: new Date() } }
      );
    } else {
      await receipts.deleteOne({ _id: receiptId }).catch(() => {});
    }
    return res.status(statusCode).json({ message });
  }

  await actionAudit().insertOne({
    business_action: "cart_batch_add",
    channel: "whatsapp",
    account: req.whatsappAccountRef,
    actor_user_id: req.user._id,
    arguments: { items: responseBody.addedItems },
    operation_id: batchOperationId,
    outcome: "success",
    http_status: 200,
    created_at: new Date(),
  });
  return res.status(200).json(responseBody);
};

router.post("/cart", addLinkedCartItem);
router.post("/cart/batch", (req, res) => addLinkedCartItems(req, res, req.body?.items, "/cart"));

export default router;
