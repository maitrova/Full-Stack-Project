// server/models/Product.js
import mongoose from "mongoose";

const productViewSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true, // 'front', 'back', 'right', 'left'
    },
    label: {
      type: String,
      required: true, // 'Front', 'Back', 'Right Sleeve', ...
    },
    mockupUrl: {
      type: String,
      required: true, // e.g. "/mockups/hoodie/front.png"
    },
    maskUrl: {
      type: String,
      required: true, // e.g. "/masks/hoodie/front_mask.png"
    },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true, // "Hoodie"
    },
    slug: {
      type: String,
      required: true,
      unique: true, // "hoodie"
    },
    category: {
      type: String,
      default: "apparel", // you can group later: 'hoodie', 'tshirt', 'womens', etc.
    },
    views: {
      type: [productViewSchema],
      default: [],
    },
    // optional: base price, description, etc.
    basePrice: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: "INR",
    },
  },
  { timestamps: true }
);

export const Product = mongoose.model("Product", productSchema);
