// models/HomepageSelection.js
import mongoose from "mongoose";

const selectedItemSchema = new mongoose.Schema(
  {
    itemType: {
      type: String,
      enum: ["design", "readymade"],
      required: true,
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
  },
  { _id: false }
);

const homepageSelectionSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      enum: ["new_arrivals"],
      unique: true,
      required: true,
      default: "new_arrivals",
    },

    // 2 to 6 selected products
    items: {
      type: [selectedItemSchema],
      validate: {
        validator: (arr) => arr.length >= 2 && arr.length <= 6,
        message: "You must select between 2 and 6 items",
      },
      default: [],
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("HomepageSelection", homepageSelectionSchema);
