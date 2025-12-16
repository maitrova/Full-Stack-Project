import mongoose from "mongoose";

const PRINT_ZONES = [
  "front-full",
  "front-chest",
  "front-left-chest",
  "back-full",
  "back-upper",
  "sleeve-left",
  "sleeve-right",
];

const textLayerSchema = new mongoose.Schema(
  {
    id: String,
    text: String,
    x: Number,
    y: Number,
    fontSize: Number,
    color: String,
    fontFamily: String,
    rotation: Number,
    // New fields for pricing
    widthInches: Number,
    heightInches: Number,
    areaInches: Number,
  },
  { _id: false }
);

const designLayerSchema = new mongoose.Schema(
  {
    id: String,
    imageUrl: String,
    hasBgRemoved: { type: Boolean, default: false },

    x: Number,
    y: Number,
    scale: Number,
    rotation: Number,

    zone: {
      type: String,
      enum: PRINT_ZONES,
      default: null,
    },

    insideSafeArea: {
      type: Boolean,
      default: true,
    },

    originalWidthPx: Number,
    originalHeightPx: Number,
    renderedWidthPx: Number,
    renderedHeightPx: Number,
    
    // New fields for pricing
    widthInches: Number,
    heightInches: Number,
    areaInches: Number,
  },
  { _id: false }
);

const designViewSchema = new mongoose.Schema(
  {
    code: String,
    textLayers: [textLayerSchema],
    designLayers: [designLayerSchema],
    previewImage: {
      type: String,
      default: null,
    },
  },
  { _id: false }
);

const designSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    productSlug: {
      type: String,
      required: true,
    },
    productName: {
      type: String,
      required: true,
    },

    productColor: {
      type: String,
      default: "#FFFFFF",
    },

    previewImage: {
      type: String,
      default: null,
    },
    
    // Pricing fields
    basePrice: { type: Number, default: 600 },
    calculatedPrice: { type: Number, default: 0 },
    priceBreakdown: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    
    // Catalogue fields
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },
    title: { type: String, default: "" },
    description: { type: String, default: "" },
    salePrice: { type: Number, default: 0 },

    views: [designViewSchema],
  },
  { timestamps: true }
);

export const Design = mongoose.model("Design", designSchema);