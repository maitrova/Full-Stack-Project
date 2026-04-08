import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "PAUSED", "DELETED"],
      default: "ACTIVE",
      index: true,
    },
    discountType: {
      type: String,
      enum: ["PERCENTAGE", "FIXED_AMOUNT"],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    minimumCartAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    totalUsageLimit: {
      type: Number,
      required: true,
      min: 1,
    },
    perUserUsageLimit: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    maximumDiscountAmount: {
      type: Number,
      min: 0,
      default: null,
    },
    newCustomersOnly: {
      type: Boolean,
      default: false,
    },
    allowOnSaleProducts: {
      type: Boolean,
      default: false,
    },
    allowedCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    allowedSubCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SubCategory",
      },
    ],
    excludedProducts: {
      type: [mongoose.Schema.Types.ObjectId],
      default: [],
    },
    stackable: {
      type: Boolean,
      default: false,
    },
    autoApply: {
      type: Boolean,
      default: false,
    },
    firstOrderOnly: {
      type: Boolean,
      default: false,
    },
    dailyUsageLimit: {
      type: Number,
      min: 1,
      default: null,
    },
    campaignTag: {
      type: String,
      default: "",
      trim: true,
    },
    totalUsedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

couponSchema.pre("validate", function (next) {
  if (this.code) {
    this.code = this.code.trim().toUpperCase();
  }

  if (this.endDate && this.startDate && this.endDate < this.startDate) {
    this.invalidate("endDate", "End date must be after start date");
  }

  if (
    this.discountType === "PERCENTAGE" &&
    (this.discountValue <= 0 || this.discountValue > 100)
  ) {
    this.invalidate(
      "discountValue",
      "Percentage discountValue must be greater than 0 and at most 100"
    );
  }

  if (this.discountType === "FIXED_AMOUNT" && this.discountValue <= 0) {
    this.invalidate("discountValue", "Fixed amount discountValue must be greater than 0");
  }

  next();
});

export default mongoose.model("Coupon", couponSchema);
