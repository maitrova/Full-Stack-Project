import mongoose from "mongoose";

const colorSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
    },
    value: {
      type: String,
      required: true,
      unique: true, // hex should be unique
      match: /^#([0-9A-Fa-f]{6})$/, // validate hex color
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Color", colorSchema);
