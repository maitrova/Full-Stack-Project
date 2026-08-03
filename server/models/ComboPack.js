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
          return Array.isArray(items) && items.length >= 2;
        },
        message: "A combo pack must include at least two products",
      },
      default: [],
    },
    reviewIssues: { type: [String], default: [] },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

comboPackSchema.index({ status: 1, createdAt: -1 });
comboPackSchema.index({ name: "text", slug: "text", shortDescription: "text" });

export default mongoose.model("ComboPack", comboPackSchema);
