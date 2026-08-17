import mongoose from "mongoose";

const userPreferenceProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    preferredSizes: { type: [String], default: [] },
    preferredCategories: { type: [String], default: [] },
    preferredSubCategories: { type: [String], default: [] },
    preferredColors: { type: [String], default: [] },
    likedProductNames: { type: [String], default: [] },
    longViewedProducts: { type: [String], default: [] },
    averagePrice: { type: Number, default: null },
    orderCount: { type: Number, default: 0 },
    cartItemCount: { type: Number, default: 0 },
    behaviorEventCount: { type: Number, default: 0 },
    lastComputedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("UserPreferenceProfile", userPreferenceProfileSchema);
