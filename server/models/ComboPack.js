import mongoose from "mongoose";

const comboPackItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReadymadeProduct",
      required: true,
      index: true,
    },
    sortOrder: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const comboPackSelectionGroupSchema = new mongoose.Schema(
  {
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    label: { type: String, default: "", trim: true },
    sortOrder: {
      type: Number,
      required: true,
      min: 0,
    },
    eligibleProducts: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "ReadymadeProduct",
        },
      ],
      validate: {
        validator(products) {
          return Array.isArray(products) && products.length > 0;
        },
        message: "Each combo category must include at least one eligible product",
      },
      default: [],
    },
  },
  { _id: true }
);

const comboPackImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    altText: { type: String, default: "" },
  },
  { _id: false }
);

const comboPackSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    shortDescription: { type: String, default: "", trim: true },
    fullDescription: { type: String, default: "" },
    comboPrice: { type: Number, required: true, min: 0 },
    discountPercentage: { type: Number, default: 0, min: 0, max: 100 },
    originalPriceOverride: { type: Number, default: null, min: 0 },
    currency: { type: String, default: "INR" },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "REVIEW"],
      default: "INACTIVE",
      index: true,
    },
    seoTitle: { type: String, default: "", trim: true },
    seoDescription: { type: String, default: "", trim: true },
    allowDuplicateProducts: { type: Boolean, default: false },
    imageMode: {
      type: String,
      enum: ["PRODUCT_IMAGES", "CUSTOM_IMAGES"],
      default: "PRODUCT_IMAGES",
    },
    featuredImage: { type: String, default: null },
    galleryImages: { type: [comboPackImageSchema], default: [] },
    bannerImage: { type: String, default: null },
    items: {
      type: [comboPackItemSchema],
      validate: {
        validator(items) {
          return Array.isArray(items);
        },
        message: "A combo pack must include at least two products or category selections",
      },
      default: [],
    },
    selectionGroups: {
      type: [comboPackSelectionGroupSchema],
      default: [],
    },
    reviewIssues: { type: [String], default: [] },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

comboPackSchema.index({ status: 1, createdAt: -1 });
comboPackSchema.index({ name: "text", slug: "text", shortDescription: "text" });

comboPackSchema.pre("validate", function (next) {
  const hasLegacyItems = Array.isArray(this.items) && this.items.length >= 2;
  const hasSelectionGroups = Array.isArray(this.selectionGroups) && this.selectionGroups.length >= 2;
  if (!hasLegacyItems && !hasSelectionGroups) {
    this.invalidate("selectionGroups", "A combo pack must include at least two products or category selections");
  }
  next();
});

export default mongoose.model("ComboPack", comboPackSchema);
