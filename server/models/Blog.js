import mongoose from "mongoose";

const faqItemSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      trim: true,
      maxlength: 220,
      default: "",
    },
    answer: {
      type: String,
      trim: true,
      maxlength: 1200,
      default: "",
    },
  },
  { _id: false }
);

const sectionImageSchema = new mongoose.Schema(
  {
    imageUrl: {
      type: String,
      trim: true,
      default: "",
    },
    altText: {
      type: String,
      trim: true,
      maxlength: 240,
      default: "",
    },
    targetHeading: {
      type: String,
      trim: true,
      maxlength: 220,
      default: "",
    },
  },
  { _id: false }
);

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    category: {
      type: String,
      trim: true,
      default: "Insights",
      maxlength: 80,
    },
    authorName: {
      type: String,
      trim: true,
      default: "Maitrova Team",
      maxlength: 100,
    },
    excerpt: {
      type: String,
      required: true,
      trim: true,
      maxlength: 320,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    coverImage: {
      type: String,
      trim: true,
      default: "",
    },
    coverImageAlt: {
      type: String,
      trim: true,
      maxlength: 240,
      default: "",
    },
    metaTitle: {
      type: String,
      trim: true,
      maxlength: 180,
      default: "",
    },
    metaDescription: {
      type: String,
      trim: true,
      maxlength: 320,
      default: "",
    },
    focusKeyword: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },
    sectionImages: {
      type: [sectionImageSchema],
      default: [],
    },
    faqItems: {
      type: [faqItemSchema],
      default: [],
    },
    readTimeMinutes: {
      type: Number,
      min: 1,
      max: 60,
      default: 5,
    },
    isPublished: {
      type: Boolean,
      default: true,
      index: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    publishedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

export const Blog = mongoose.models.Blog || mongoose.model("Blog", blogSchema);
