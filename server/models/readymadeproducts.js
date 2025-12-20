import mongoose from "mongoose";

const readymadeProductSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },

    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },

    category: { type: String, default: "" },
    brand: { type: String, default: "" },

    stock: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },

    images: {
      type: [String], // saved file paths
      validate: {
        validator: (arr) => arr.length <= 4,
        message: "Maximum 4 images allowed",
      },
      default: [],
    },

    video: { type: String, default: null },

    // createdBy: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "User",
    //   required: true,
    // },
  },
  { timestamps: true }
);

export default mongoose.model("ReadymadeProduct", readymadeProductSchema);
