// server/models/Product.js
import mongoose from "mongoose";

/* ---------- Size Pricing Schema ---------- */
const sizePricingSchema = new mongoose.Schema(
  {
    size: {
      type: String,
      enum: ["XS", "S", "M", "L", "XL", "XXL"],
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

/* ---------- Product View Schema ---------- */
const productViewSchema = new mongoose.Schema(
  {
    code: String,
    label: String,
    mockupUrl: String,
    maskUrl: String,
  },
  { _id: false }
);

/* ---------- Product Schema ---------- */
const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    slug: { type: String, required: true, unique: true },

    category: { type: String, default: "apparel" },

    subCategory: { type: String, default: "" },

    views: { type: [productViewSchema], default: [] },

    /* 🔥 Size-based pricing */
    sizePricing: {
      type: [sizePricingSchema],
      default: [
        { size: "S", price: 900 },
        { size: "M", price: 1000 },
        { size: "L", price: 1100 },
        { size: "XL", price: 1200 },
      ],
    },

    basePrice: { type: Number, default: 600 },

    pricingMode: {
      type: String,
      enum: ["normal", "unlimited"],
      default: "normal",
    },

    unlimitedPricing: {
      enabled: { type: Boolean, default: false },
      flatCharge: { type: Number, default: 200 },
      label: { type: String, default: "Unlimited Design" },
      description: {
        type: String,
        default: "Design as much as you want at a fixed price",
      },
    },

    normalPricing: {
      fixedSizeInches: { type: Number, default: 4 },
      pricePerSqInch: { type: Number, default: 6 },
      sleevePrice: { type: Number, default: 30 },
    },

    currency: { type: String, default: "INR" },
  },
  { timestamps: true }
);

export const Product = mongoose.model("Product", productSchema);
