import crypto from "crypto";
import { razorpay } from "../utils/razorpay.js";
import Order from "../models/Order.js";
import { Cart } from "../models/Cart.js";
import Address from "../models/address.js";
import { sendOrderStatusEmail } from "../services/orderEmailService.js";

const toPaise = (rupees) => Math.round(Number(rupees) * 100);

// ✅ Create Razorpay order from cart
export const createRazorpayOrderFromCart = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    // 1) cart
    const cart = await Cart.findOne({ user: userId, status: "ACTIVE" });
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    // 2) addresses (use your existing Address collection)
    const delivery = await Address.findOne({ user: userId, type: "delivery" });
    const billing = await Address.findOne({ user: userId, type: "billing" });
    if (!delivery) return res.status(400).json({ message: "Delivery address not found" });
    if (!billing) return res.status(400).json({ message: "Billing address not found" });

    // 3) totals from cart snapshot
    const subtotal = cart.items.reduce((sum, it) => sum + it.unitPrice * it.qty, 0);
    const shipping = 0;
    const discount = 0;
    const total = Math.max(0, subtotal + shipping - discount);

    // 4) create DB order first (PENDING)
    const orderDoc = await Order.create({
      user: userId,
      cart: cart._id,
      items: cart.items.map((it) => ({
        kind: it.kind,
        readymadeProduct: it.readymadeProduct,
        design: it.design,
        dropproduct: it.dropproduct,
        product: it.product,
        size: it.size,
        qty: it.qty,
        unitPrice: it.unitPrice,
        currency: it.currency || "INR",
        previewImage: it.previewImage,
        signature: it.signature,
      })),
      deliveryAddress: delivery._id, // ✅ reference
      billingAddress: billing._id,   // ✅ reference
      subtotal,
      total,
      currency: "INR",
      status: "PENDING_PAYMENT",
      payment: { status: "CREATED" },
    });

    // 5) create Razorpay order (paise)
    const rpOrder = await razorpay.orders.create({
      amount: toPaise(total),
      currency: "INR",
      receipt: `rcpt_${orderDoc._id}`,
      notes: { orderId: String(orderDoc._id), userId: String(userId) },
    });

    // 6) save rp order id
    orderDoc.payment.razorpayOrderId = rpOrder.id;
    await orderDoc.save();

    return res.status(201).json({
      message: "Razorpay order created",
      orderId: orderDoc._id,
      razorpayOrderId: rpOrder.id,
      amount: rpOrder.amount,
      currency: rpOrder.currency,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID, // ✅ safe to send
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

    const {
      orderId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (!orderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: "Missing payment fields" });
    }

    const orderDoc = await Order.findOne({ _id: orderId, user: userId });
    if (!orderDoc) return res.status(404).json({ message: "Order not found" });

    if (orderDoc.payment?.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ message: "Razorpay order mismatch" });
    }

    // 🔐 Verify signature
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

    // ✅ Mark order as PAID
    orderDoc.status = "PAID";
    orderDoc.payment.status = "PAID";
    orderDoc.orderStatus = "PROCESSING";
    orderDoc.payment.razorpayPaymentId = razorpay_payment_id;
    orderDoc.payment.razorpaySignature = razorpay_signature;

    await orderDoc.save();

    // 🔥🔥🔥 SEND CONFIRMATION EMAIL
    const populatedOrder = await Order.findById(orderDoc._id).populate("user");

    await sendOrderStatusEmail(populatedOrder, populatedOrder.user);

    // ✅ Close ACTIVE cart
    await Cart.findOneAndUpdate(
      { _id: orderDoc.cart, user: userId, status: "ACTIVE" },
      { $set: { status: "ORDERED" } },
      { new: true }
    );

    // ✅ Ensure new ACTIVE cart
    const newActiveCart = await Cart.findOneAndUpdate(
      { user: userId, status: "ACTIVE" },
      { $setOnInsert: { user: userId, status: "ACTIVE", items: [] } },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      message: "Payment verified",
      order: orderDoc,
      cart: newActiveCart,
    });

  } catch (err) {
    console.error("verifyRazorpayPayment error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};




