// models/ReadymadeProduct.js
import mongoose from "mongoose";

const variantSchema = new mongoose.Schema(
  {
    size: {
      type: String,
      required: true,
      enum: ["XS", "S", "M", "L", "XL", "XXL"],
    },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    sku: { type: String, default: "" }, // optional
  },
  { _id: false }
);

const readymadeProductSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },

    // Keep price/stock for filtering/sorting (optional)
    // We'll auto-fill these from variants in controller.
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },

    category: { type: String, default: "" },
    subCategory: { type: String, default: "" },
    brand: { type: String, default: "" },

    stock: { type: Number, default: 0, min: 0 },

    // NEW: size-wise price/stock
    variants: {
      type: [variantSchema],
      required: true,
      validate: {
        validator: function (arr) {
          if (!arr || !arr.length) return false;
          const sizes = arr.map((v) => v.size);
          return new Set(sizes).size === sizes.length; // no duplicates
        },
        message: "Variants must be present and sizes must be unique",
      },
      default: [],
    },

    isActive: { type: Boolean, default: true },

    bestSeller: { type: Boolean, default: false },
    newArrival: { type: Boolean, default: false },

    images: {
      type: [String],
      validate: {
        validator: (arr) => arr.length <= 4,
        message: "Maximum 4 images allowed",
      },
      default: [],
    },

    video: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("ReadymadeProduct", readymadeProductSchema);
