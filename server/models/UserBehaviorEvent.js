import mongoose from "mongoose";

const userBehaviorEventSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    guestId: { type: String, default: "", index: true },
    eventType: {
      type: String,
      enum: [
        "PAGE_VIEW",
        "PRODUCT_VIEW",
        "PRODUCT_DWELL",
        "RECOMMENDATION_CLICK",
        "ADD_TO_CART_AI",
      ],
      required: true,
      index: true,
    },
    path: { type: String, default: "" },
    pageType: { type: String, default: "" },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "ReadymadeProduct", default: null },
    productName: { type: String, default: "" },
    category: { type: String, default: "" },
    subCategory: { type: String, default: "" },
    dwellMs: { type: Number, default: 0, min: 0 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

userBehaviorEventSchema.index({ user: 1, createdAt: -1 });
userBehaviorEventSchema.index({ guestId: 1, createdAt: -1 });

export default mongoose.model("UserBehaviorEvent", userBehaviorEventSchema);
