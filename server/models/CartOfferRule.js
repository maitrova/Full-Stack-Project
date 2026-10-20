import mongoose from "mongoose";

// One step of a "spend X, get Y off" rule, e.g. spend Rs.1999 -> 10% off.
const cartOfferTierSchema = new mongoose.Schema(
  {
    minCartAmount: { type: Number, required: true, min: 1 },
    discountType: {
      type: String,
      enum: ["PERCENTAGE", "FIXED_AMOUNT"],
      required: true,
    },
    discountValue: { type: Number, required: true, min: 0 },
    maximumDiscountAmount: { type: Number, default: null, min: 0 },
  },
  { _id: false }
);

const cartOfferRuleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["ACTIVE", "PAUSED"],
      default: "ACTIVE",
      index: true,
    },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    // Higher priority wins when two rules give the same discount.
    priority: { type: Number, default: 0 },
    tiers: {
      type: [cartOfferTierSchema],
      validate: {
        validator(tiers) {
          return Array.isArray(tiers) && tiers.length > 0;
        },
        message: "At least one cart value tier is required",
      },
      default: [],
    },
    // Empty means every category counts towards the cart value.
    allowedCategories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
    excludedProducts: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    includeComboPacks: { type: Boolean, default: false },
    includeSaleItems: { type: Boolean, default: true },
    stackWithCoupons: { type: Boolean, default: true },
  },
  { timestamps: true }
);

cartOfferRuleSchema.index({ status: 1, priority: -1 });

export default mongoose.model("CartOfferRule", cartOfferRuleSchema);
