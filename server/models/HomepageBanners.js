import mongoose from "mongoose";

// One photo + alt text per homepage banner slot.
const bannerSlotSchema = new mongoose.Schema(
  {
    image: { type: String, default: "", trim: true },
    alt: { type: String, default: "", trim: true, maxlength: 160 },
  },
  { _id: false }
);

const homepageBannersSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "main",
      unique: true,
      trim: true,
    },
    hero: { type: bannerSlotSchema, default: () => ({}) },
    makeItYours: { type: bannerSlotSchema, default: () => ({}) },
    betterTogether: { type: bannerSlotSchema, default: () => ({}) },
  },
  { timestamps: true }
);

export default mongoose.model("HomepageBanners", homepageBannersSchema);
