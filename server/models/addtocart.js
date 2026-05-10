import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema(
  {
    // Always required
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    // Optional → present only when added from saved design
    design: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Design",
      default: null,
    },

    // Variants (optional)
    size: {
      type: String,
      default: "M", // "S", "M", "L", etc.
    },

    

    qty: {
      type: Number,
      default: 1,
      min: 1,
    },

    // Snapshot pricing (important for price consistency)
    unitPrice: {
      type: Number,
      required: true,
    },

    currency: {
      type: String,
      default: "INR",
    },
  },
  { timestamps: true }
);

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // one cart per user
    },

    items: {
      type: [cartItemSchema],
      default: [],
    },
  },
  { timestamps: true }
);

export const Cart = mongoose.model("Cart", cartSchema);
