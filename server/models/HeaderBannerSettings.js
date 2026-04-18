import mongoose from "mongoose";

const headerBannerSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "main",
      unique: true,
      trim: true,
    },
    messages: {
      type: [String],
      default: [
        "Free Shipping Nationwide",
        "Custom Designs in 48 Hours",
        "Premium Quality Guaranteed",
      ],
    },
    couponCode: {
      type: String,
      default: "",
      trim: true,
    },
    codMinimumOrderAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.model("HeaderBannerSettings", headerBannerSettingsSchema);
