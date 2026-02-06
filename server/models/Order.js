import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["READYMADE", "DESIGN"], required: true },
    readymadeProduct: { type: mongoose.Schema.Types.ObjectId, ref: "ReadymadeProduct" },
    design: { type: mongoose.Schema.Types.ObjectId, ref: "Design" },
    dropproduct: { type: mongoose.Schema.Types.ObjectId, ref: "Dropproduct" },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },

    size: String,
    qty: Number,
    unitPrice: Number,
    currency: { type: String, default: "INR" },
    previewImage: String,
    signature: String,
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    cart: { type: mongoose.Schema.Types.ObjectId, ref: "Cart" },

    items: [orderItemSchema],

    // ✅ reference existing addresses
    deliveryAddress: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Address",
      required: true,
    },

    billingAddress: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Address",
      required: true,
    },

    subtotal: Number,
    total: Number,
    currency: { type: String, default: "INR" },

    status: {
      type: String,
      enum: ["PENDING_PAYMENT", "PAID", "FAILED", "CANCELLED"],
      default: "PENDING_PAYMENT",
    },
    
    orderStatus: {
    type: String,
    enum: ["PROCESSING", "READY", "SHIPPED", "DELIVERED"],
    default: "PROCESSING",
    index: true,
  },

    payment: {
      razorpayOrderId: String,
      razorpayPaymentId: String,
      razorpaySignature: String,
      status: { type: String, default: "CREATED" },
    },
  },
  { timestamps: true }
);

export default mongoose.model("Order", orderSchema);
