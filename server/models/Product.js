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
    stock: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const productColorSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
    },
    value: {
      type: String,
      required: true,
      trim: true,
    },
    stock: {
      type: Number,
      default: null,
      min: 0,
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

const imagePriceRuleSchema = new mongoose.Schema(
  {
    maxSideInches: {
      type: Number,
      default: null,
      min: 0,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
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

    colors: {
      type: [productColorSchema],
      default: [
        { value: "#FFFFFF", label: "White" },
        { value: "#000000", label: "Black" },
        { value: "#FF6B6B", label: "Coral" },
        { value: "#4ECDC4", label: "Mint" },
        { value: "#45B7D1", label: "Sky" },
        { value: "#96CEB4", label: "Seafoam" },
        { value: "#FECA57", label: "Sunshine" },
        { value: "#FF9FF3", label: "Pink" },
        { value: "#54A0FF", label: "Azure" },
        { value: "#5F27CD", label: "Violet" },
        { value: "#00D2D3", label: "Teal" },
        { value: "#FF9F43", label: "Orange" },
      ],
    },

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
      imagePriceRules: {
        type: [imagePriceRuleSchema],
        default: [
          { maxSideInches: 4, price: 40 },
          { maxSideInches: null, price: 100 },
        ],
      },
      textPriceRules: {
        type: [imagePriceRuleSchema],
        default: [
          { maxSideInches: 4, price: 40 },
          { maxSideInches: null, price: 100 },
        ],
      },
    },

    currency: { type: String, default: "INR" },
  },
  { timestamps: true }
);

export const Product = mongoose.model("Product", productSchema);
