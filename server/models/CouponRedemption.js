import mongoose from "mongoose";

const couponRedemptionSchema = new mongoose.Schema(
  {
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    discountApplied: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["CONSUMED"],
      default: "CONSUMED",
    },
  },
  { timestamps: true }
);

couponRedemptionSchema.index({ coupon: 1, user: 1, createdAt: -1 });

export default mongoose.model("CouponRedemption", couponRedemptionSchema);
