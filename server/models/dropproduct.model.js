import mongoose from "mongoose";

const dropproductVariantSchema = new mongoose.Schema(
  {
    size: {
      type: String,
      required: true,
      trim: true,
      // change allowed sizes as you need
      enum: ["XS", "S", "M", "L", "XL", "XXL"],
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
    },
    sku: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { _id: false }
);

const dropproductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // ✅ remove single price (because price depends on size)
    // price: { type: Number, required: true },

    description: String,

    salePrice: {
      type: Number,
      default: null,
      min: 0,
    },
    saleStartAt: {
      type: Date,
      default: null,
    },
    saleEndAt: {
      type: Date,
      default: null,
    },
    
     category: {
      type: String,
      required: true,
      trim: true,
    },
    
    subCategory: {
      type: String,
      required: true,
      trim: true,
    },
    images: {
      type: [String],
      required: true,
      validate: {
        validator: (v) => v.length >= 1 && v.length <= 6,
        message: "Images must be between 1 and 6",
      },
    },
    thumbnail: {
      type: String,
      default: null,
    },

    sizeChart: {
      type: String,
      default: null,
    },

    // ✅ size-wise price & stock
    variants: {
      type: [dropproductVariantSchema],
      required: true,
      validate: {
        validator: function (v) {
          if (!Array.isArray(v) || v.length < 1) return false;

          // no duplicate sizes
          const sizes = v.map((x) => x.size);
          return new Set(sizes).size === sizes.length;
        },
        message: "At least 1 variant required and sizes must be unique",
      },
    },

    // ✅ optional: quick computed totals / ranges (not required)
    totalStock: { type: Number, default: 0 },
    minPrice: { type: Number, default: 0 },
    maxPrice: { type: Number, default: 0 },

    isActive: {
      type: Boolean,
      default: true,
    },
    bestSeller: {
      type: Boolean,
      default: false,
    },
    newArrival: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

dropproductSchema.pre("validate", function (next) {
  const prices = (this.variants || []).map((v) => Number(v.price));
  const minVariantPrice = prices.length ? Math.min(...prices) : 0;

  const hasSalePrice =
    this.salePrice !== null &&
    this.salePrice !== undefined &&
    this.salePrice !== "";

  if (hasSalePrice) {
    if (!(Number(this.salePrice) > 0)) {
      this.invalidate("salePrice", "Offer price must be greater than 0");
    }

    if (minVariantPrice > 0 && !(Number(this.salePrice) < minVariantPrice)) {
      this.invalidate("salePrice", "Offer price must be lower than MRP price");
    }
  }

  if (this.saleStartAt && this.saleEndAt && this.saleStartAt >= this.saleEndAt) {
    this.invalidate("saleEndAt", "Offer end date must be after start date");
  }

  next();
});

// keep totals updated automatically
dropproductSchema.pre("save", function (next) {
  const prices = (this.variants || []).map((v) => v.price);
  const stocks = (this.variants || []).map((v) => v.stock);

  this.totalStock = stocks.reduce((a, b) => a + b, 0);
  this.minPrice = prices.length ? Math.min(...prices) : 0;
  this.maxPrice = prices.length ? Math.max(...prices) : 0;

  next();
});

export default mongoose.model("Dropproduct", dropproductSchema);
