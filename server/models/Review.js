import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    reviewerName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    reviewerEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      maxlength: 180,
    },
    source: {
      type: String,
      enum: ["CUSTOMER", "ADMIN"],
      default: "CUSTOMER",
      index: true,
    },
    createdByAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
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
      user: { $exists: true, $type: "objectId" },
      kind: "READYMADE",
      readymadeProduct: { $exists: true, $type: "objectId" },
      source: "CUSTOMER",
    },
  }
);

reviewSchema.index(
  { user: 1, kind: 1, dropproduct: 1 },
  {
    unique: true,
    partialFilterExpression: {
      user: { $exists: true, $type: "objectId" },
      kind: "DROPPRODUCT",
      dropproduct: { $exists: true, $type: "objectId" },
      source: "CUSTOMER",
    },
  }
);

export default mongoose.model("Review", reviewSchema);
