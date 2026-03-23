import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    kind: { 
  type: String, 
  enum: ["READYMADE", "DESIGN", "DROPPRODUCT"], 
  required: true 
},

    readymadeProduct: { type: mongoose.Schema.Types.ObjectId, ref: "ReadymadeProduct" },
    design: { type: mongoose.Schema.Types.ObjectId, ref: "Design" },
    dropproduct: { type: mongoose.Schema.Types.ObjectId, ref: "Dropproduct" },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },

    size: String,
    qty: Number,
    unitPrice: Number,
    basePrice: Number,
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
    shipping: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    total: Number,
    currency: { type: String, default: "INR" },
    coupon: {
      couponId: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon", default: null },
      code: { type: String, default: null },
      description: { type: String, default: "" },
      discountType: {
        type: String,
        enum: ["PERCENTAGE", "FIXED_AMOUNT", null],
        default: null,
      },
      discountValue: { type: Number, default: 0 },
      maximumDiscountAmount: { type: Number, default: null },
      discountApplied: { type: Number, default: 0 },
      campaignTag: { type: String, default: "" },
    },

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

    invoiceNumber: { type: String, unique: false },
    invoiceDate: Date,
    invoicePdfUrl: String,
    inventoryAdjustedAt: { type: Date, default: null },

      },
  { timestamps: true }
);

export default mongoose.model("Order", orderSchema);
