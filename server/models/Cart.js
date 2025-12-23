import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ["READYMADE", "DESIGN"],
      required: true,
      index: true,
    },

    // READYMADE item
    readymadeProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReadymadeProduct",
      default: null,
    },

    // DESIGN item
    design: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Design",
      default: null,
    },

    // Optional but useful (Design.product)
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },

    qty: { type: Number, required: true, min: 1, default: 1 },

    // Price snapshot at time of add
    unitPrice: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },

    previewImage: { type: String, default: null },

    // Used to merge items
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
      unique: true,
      index: true,
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

export const Cart = mongoose.model("Cart", cartSchema);
