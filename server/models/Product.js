// server/models/Product.js
import mongoose from "mongoose";

const productViewSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
    },
    label: {
      type: String,
      required: true,
    },
    mockupUrl: {
      type: String,
      required: true,
    },
    maskUrl: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
    },
    category: {
      type: String,
      default: "apparel",
    },
    subCategory: { 
      type: String, 
      default: "" 
    },
    views: {
      type: [productViewSchema],
      default: [],
    },
    basePrice: {
      type: Number,
      default: 600,
    },
    pricingMode: {
      type: String,
      enum: ['normal', 'unlimited'],
      default: 'normal'
    },
    unlimitedPricing: {
      enabled: {
        type: Boolean,
        default: false
      },
      flatCharge: {
        type: Number,
        default: 200
      },
      label: {
        type: String,
        default: "Unlimited Design"
      },
      description: {
        type: String,
        default: "Design as much as you want at a fixed price"
      }
    },
    normalPricing: {
      fixedSizeInches: {
        type: Number,
        default: 4
      },
      pricePerSqInch: {
        type: Number,
        default: 6
      },
      sleevePrice: {
        type: Number,
        default: 30
      }
    },
    currency: {
      type: String,
      default: "INR",
    },
  },
  { timestamps: true }
);


export const Product = mongoose.model("Product", productSchema);