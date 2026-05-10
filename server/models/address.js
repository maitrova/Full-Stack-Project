import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: ["delivery", "billing"],
      required: true,
      index: true,
    },

    // ✅ user enters these
    fullName: { type: String, required: true, trim: true },
    mobileNumber: { type: String, required: true, trim: true },

    completeAddress: { type: String, required: true, trim: true },
    landmark: { type: String, default: "", trim: true },
    pincode: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },

    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Optional: ensure one default per type per user
addressSchema.index(
  { user: 1, type: 1, isDefault: 1 },
  { partialFilterExpression: { isDefault: true } }
);

export default mongoose.model("Address", addressSchema);
