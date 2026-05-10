import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
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
    },
    kind: {
      type: String,
      enum: ["READYMADE", "DROPPRODUCT"],
      required: true,
      index: true,
    },
    readymadeProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReadymadeProduct",
      default: null,
      index: true,
    },
    dropproduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dropproduct",
      default: null,
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    title: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    comment: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1500,
    },
    verifiedPurchase: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "HIDDEN"],
      default: "ACTIVE",
      index: true,
    },
  },
  { timestamps: true }
);

reviewSchema.index(
  { user: 1, kind: 1, readymadeProduct: 1 },
  {
    unique: true,
    partialFilterExpression: {
      kind: "READYMADE",
      readymadeProduct: { $exists: true, $type: "objectId" },
    },
  }
);

reviewSchema.index(
  { user: 1, kind: 1, dropproduct: 1 },
  {
    unique: true,
    partialFilterExpression: {
      kind: "DROPPRODUCT",
      dropproduct: { $exists: true, $type: "objectId" },
    },
  }
);

export default mongoose.model("Review", reviewSchema);
