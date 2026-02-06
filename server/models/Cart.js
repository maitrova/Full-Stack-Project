import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ["READYMADE", "DESIGN"],
      required: true,
      index: true,
    },

    readymadeProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReadymadeProduct",
      default: null,
    },

    design: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Design",
      default: null,
    },

    dropproduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dropproduct",
      default: null,
    },

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },

    size: { type: String, default: "M" },
    qty: { type: Number, required: true, min: 1, default: 1 },

    unitPrice: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },

    previewImage: { type: String, default: null },

    signature: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // ✅ keep index, remove unique
    },

    items: [cartItemSchema],

    status: {
      type: String,
      enum: ["ACTIVE", "ORDERED"],
      default: "ACTIVE",
      index: true,
    },
  },
  { timestamps: true }
);

// ✅ Only ONE ACTIVE cart per user, but multiple ORDERED carts allowed
cartSchema.index(
  { user: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "ACTIVE" } }
);

export const Cart = mongoose.model("Cart", cartSchema);
