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
    sku: { type: String, default: "" },
  },
  { _id: false }
);

// NEW: image schema with altText per image
const imageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
    },
    altText: {
      type: String,
      required: true,
      default: "",
    },
  },
  { _id: false }
);

const readymadeProductSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },

    price: { type: Number, required: true, min: 0 },
    salePrice: { type: Number, default: null, min: 0 },
    saleStartAt: { type: Date, default: null },
    saleEndAt: { type: Date, default: null },
    currency: { type: String, default: "INR" },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
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
      required: true,
      index: true,
    },

    stock: { type: Number, default: 0, min: 0 },

    variants: {
      type: [variantSchema],
      required: true,
      validate: {
        validator: function (arr) {
          if (!arr || !arr.length) return false;
          const sizes = arr.map((v) => v.size);
          return new Set(sizes).size === sizes.length;
        },
        message: "Variants must be present and sizes must be unique",
      },
      default: [],
    },

    isActive: { type: Boolean, default: true },
    bestSeller: { type: Boolean, default: false },
    newArrival: { type: Boolean, default: false },
    paymentOptions: {
      type: [String],
      enum: ["COD", "ONLINE"],
      default: () => ["COD", "ONLINE"],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "At least one payment option is required",
      },
    },
    topOrder: { type: Boolean, default: false, index: true },
    topOrderTag: { type: String, default: "", trim: true },
    topOrderAt: { type: Date, default: null },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    ratingBreakdown: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }),
    },

    // ✅ FIXED: images with altText per image
    images: {
      type: [imageSchema],
      validate: {
        validator: (arr) => arr.length <= 6,
        message: "Maximum 6 images allowed",
      },
      default: [],
    },

    thumbnail: {
      type: String,
      default: null,
    },

    video: { type: String, default: null },
    
    
    sizeChart: {
    type: String,
    default: null,
    },

  },
  { timestamps: true }
);

readymadeProductSchema.pre("validate", function (next) {
  if (!(Number(this.price) > 0)) {
    this.invalidate("price", "MRP price must be greater than 0");
  }

  const hasSalePrice =
    this.salePrice !== null &&
    this.salePrice !== undefined &&
    this.salePrice !== "";

  if (hasSalePrice) {
    if (!(Number(this.salePrice) > 0)) {
      this.invalidate("salePrice", "Offer price must be greater than 0");
    }

    if (!(Number(this.salePrice) < Number(this.price))) {
      this.invalidate("salePrice", "Offer price must be lower than MRP price");
    }
  }

  if (this.saleStartAt && this.saleEndAt && this.saleStartAt >= this.saleEndAt) {
    this.invalidate("saleEndAt", "Offer end date must be after start date");
  }

  next();
});

export default mongoose.model("ReadymadeProduct", readymadeProductSchema);
