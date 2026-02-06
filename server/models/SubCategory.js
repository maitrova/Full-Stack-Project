import mongoose from "mongoose";

const subCategorySchema = new mongoose.Schema(
  {
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },

    thumbnail: {
      url: { type: String, required: true },
      filename: { type: String, required: true },
    },

    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

subCategorySchema.index({ category: 1, slug: 1 }, { unique: true });

export default mongoose.model("SubCategory", subCategorySchema);
