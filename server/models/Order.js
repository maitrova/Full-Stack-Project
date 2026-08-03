import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    kind: { 
  type: String, 
  enum: ["READYMADE", "DESIGN", "DROPPRODUCT", "COMBO"], 
  required: true 
},

    readymadeProduct: { type: mongoose.Schema.Types.ObjectId, ref: "ReadymadeProduct" },
    design: { type: mongoose.Schema.Types.ObjectId, ref: "Design" },
    dropproduct: { type: mongoose.Schema.Types.ObjectId, ref: "Dropproduct" },
    comboPack: { type: mongoose.Schema.Types.ObjectId, ref: "ComboPack" },
    comboSelections: { type: [mongoose.Schema.Types.Mixed], default: [] },
    comboName: { type: String, default: "" },
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
    deliveredAt: { type: Date, default: null },

    returnRequest: {
      status: {
        type: String,
        enum: ["NONE", "PROCESSING", "APPROVED", "REJECTED"],
        default: "NONE",
      },
      requestedAt: { type: Date, default: null },
      decidedAt: { type: Date, default: null },
      refundPaidAt: { type: Date, default: null },
      refundInitiatedAt: { type: Date, default: null },
      deadlineAt: { type: Date, default: null },
      reason: { type: String, default: "" },
      imageUrls: { type: [String], default: [] },
      adminDecisionNote: { type: String, default: "" },
      refundStatus: {
        type: String,
        enum: ["NOT_PAID", "PROCESSING", "PAID", "FAILED"],
        default: "NOT_PAID",
      },
      refundAmount: { type: Number, default: 0 },
      refundCurrency: { type: String, default: "INR" },
      refundId: { type: String, default: "" },
      refundReceipt: { type: String, default: "" },
      refundReference: { type: String, default: "" },
      refundFailureReason: { type: String, default: "" },
      selectedItemIndexes: { type: [Number], default: [] },
      selectedItems: { type: [mongoose.Schema.Types.Mixed], default: [] },
      bankDetails: {
        method: {
          type: String,
          enum: ["BANK", "UPI", ""],
          default: "",
        },
        accountHolderName: { type: String, default: "" },
        accountNumber: { type: String, default: "" },
        ifscCode: { type: String, default: "" },
        bankName: { type: String, default: "" },
        branchName: { type: String, default: "" },
        upiId: { type: String, default: "" },
      },
    },

    payment: {
      method: {
        type: String,
        enum: ["", "RAZORPAY", "COD"],
        default: "",
      },
      razorpayOrderId: String,
      razorpayPaymentId: String,
      razorpaySignature: String,
      status: { type: String, default: "CREATED" },
      refundStatus: {
        type: String,
        enum: ["NOT_REQUIRED", "PROCESSING", "PAID", "FAILED"],
        default: "NOT_REQUIRED",
      },
      refundAmount: { type: Number, default: 0 },
      refundCurrency: { type: String, default: "INR" },
      refundId: { type: String, default: "" },
      refundReceipt: { type: String, default: "" },
      refundReference: { type: String, default: "" },
      refundFailureReason: { type: String, default: "" },
      refundInitiatedAt: { type: Date, default: null },
      refundPaidAt: { type: Date, default: null },
      refundReason: { type: String, default: "" },
    },

    cancelledAt: { type: Date, default: null },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    cancelledByRole: {
      type: String,
      enum: ["CUSTOMER", "ADMIN", ""],
      default: "",
    },
    cancellationReason: { type: String, default: "" },

    invoiceNumber: { type: String, unique: false },
    invoiceDate: Date,
    invoicePdfUrl: String,
    inventoryAdjustedAt: { type: Date, default: null },

      },
  { timestamps: true }
);

export default mongoose.model("Order", orderSchema);
