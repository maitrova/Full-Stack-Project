import mongoose from "mongoose";

const PRINT_ZONES = [
  "front-full",
  "front-chest",
  "front-left-chest",
  "front-pocket",   // ✅ add this
  "pocket",         // ✅ add this (optional but recommended since frontend sends it)
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
    zone: {
      type: String,
      enum: PRINT_ZONES,
      default: null,
    },
    fontSize: Number,
    color: String,
    fontFamily: String,
    rotation: Number,
    scale: Number,
    scaleX: Number,
    scaleY: Number,
    // New fields for pricing
    widthInches: Number,
    heightInches: Number,
    areaInches: Number,
    renderedWidthPx: Number,
    renderedHeightPx: Number,
    renderedWidthInches: Number,
    renderedHeightInches: Number,
    printableAreaWidthInches: Number,
    printableAreaHeightInches: Number,
  },
  { _id: false }
);

const designLayerSchema = new mongoose.Schema(
  {
    id: String,
    imageUrl: String,
    filename: String,
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
    rawPrintWidthInches: Number,
    rawPrintHeightInches: Number,
    rawPrintAreaInches: Number,
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

    productColorName: {
      type: String,
      default: "White",
    },

    previewImage: {
      type: String,
      default: null,
    },
    
    // Pricing fields
    selectedSize: { type: String, default: null }, 
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

    // New fields
    category: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Category",
          
          index: true,
        },
    
        subCategory: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "SubCategory",
          index: true,
        },
    
        brand: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Brand",
          
        },     // Sub-category of the product
    newArrivals: { type: Boolean, default: false },  // If the product is new arrival
    bestSellers: { type: Boolean, default: false },  // If the product is a best seller
    stock: { type: Number, default: 0 },             // Number of items in stock

    tryOn: {
      status: { type: String, default: null },
      provider: { type: String, default: null },
      mode: { type: String, default: null },
      providerJobId: { type: String, default: null },
      previewImage: { type: String, default: null },
      userImage: { type: String, default: null },
      garmentImage: { type: String, default: null },
      warning: { type: String, default: null },
      generatedAt: { type: Date, default: null },
      metadata: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {},
      },
    },

    views: [designViewSchema],
  },
  { timestamps: true }
);

export const Design = mongoose.model("Design", designSchema);
