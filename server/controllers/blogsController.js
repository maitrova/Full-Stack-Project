import fs from "fs";
import path from "path";
import { Blog } from "../models/Blog.js";

const ensureAdmin = (req, res) => {
  if (!req.user || (req.user.role !== "admin" && req.user.role !== "superuser")) {
    res.status(403).json({ message: "Admin only" });
    return false;
  }
  return true;
};

const slugify = (value = "") =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

const ensureUniqueSlug = async (baseSlug, excludeId = null) => {
  let slug = baseSlug || `blog-${Date.now()}`;
  let counter = 1;

  while (true) {
    const existing = await Blog.findOne({
      slug,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    }).select("_id");

    if (!existing) return slug;
    slug = `${baseSlug}-${counter++}`;
  }
};

const outputsDir = path.join(process.cwd(), "outputs");
const blogCoversRoot = path.join(outputsDir, "blog-covers");

const normalizeCoverImageUrl = (file) => {
  if (!file?.path) return "";

  const relativePath = path.relative(outputsDir, file.path).split(path.sep).join("/");
  return `outputs/${relativePath}`;
};

const normalizeUploadedImagePayload = (file) => ({
  url: normalizeCoverImageUrl(file),
  originalName: String(file?.originalname || "").trim(),
});

const removeLocalCoverImage = (imageUrl) => {
  const normalizedUrl = String(imageUrl || "").trim();
  if (!normalizedUrl.startsWith("outputs/blog-covers/")) return;

  const relativePath = normalizedUrl.replace(/^outputs\//, "");
  const absolutePath = path.join(outputsDir, relativePath);

  if (!absolutePath.startsWith(blogCoversRoot)) return;
  if (!fs.existsSync(absolutePath)) return;

  try {
    fs.unlinkSync(absolutePath);
  } catch (error) {
    console.warn("Failed to delete blog cover image:", absolutePath, error.message);
  }
};

const parseBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
};

const stripHtml = (value = "") =>
  String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const estimateReadTimeMinutes = (content = "") => {
  const wordCount = stripHtml(content).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 200));
};

const parseJsonArrayField = (value) => {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      throw new Error("Invalid JSON array payload");
    }
  }
  return [];
};

const normalizeBlogPayload = async (body = {}, excludeId = null) => {
  const title = String(body.title || "").trim();
  const excerpt = String(body.excerpt || "").trim();
  const content = String(body.content || "").trim();

  if (!title) throw new Error("Title is required");
  if (!excerpt) throw new Error("Excerpt is required");
  if (!content) throw new Error("Content is required");

  const baseSlug = slugify(body.slug || title);
  const slug = await ensureUniqueSlug(baseSlug, excludeId);
  const publishedAt = body.publishedAt ? new Date(body.publishedAt) : new Date();
  const faqItems = parseJsonArrayField(body.faqItems)
    .map((item) => ({
      question: String(item?.question || "").trim(),
      answer: String(item?.answer || "").trim(),
    }))
    .filter((item) => item.question && item.answer);
  const sectionImages = parseJsonArrayField(body.sectionImages)
    .map((item) => ({
      imageUrl: String(item?.imageUrl || "").trim(),
      altText: String(item?.altText || "").trim(),
      targetHeading: String(item?.targetHeading || "").trim(),
    }))
    .filter((item) => item.imageUrl && item.targetHeading);

  return {
    title,
    slug,
    category: String(body.category || "Insights").trim() || "Insights",
    authorName: String(body.authorName || "Maitrova Team").trim() || "Maitrova Team",
    excerpt,
    content,
    coverImage: String(body.coverImage || "").trim(),
    coverImageAlt: String(body.coverImageAlt || "").trim(),
    metaTitle: String(body.metaTitle || "").trim(),
    metaDescription: String(body.metaDescription || "").trim(),
    focusKeyword: String(body.focusKeyword || "").trim(),
    sectionImages,
    faqItems,
    readTimeMinutes: estimateReadTimeMinutes(content),
    isPublished: parseBoolean(body.isPublished, true),
    isFeatured: parseBoolean(body.isFeatured, false),
    publishedAt: Number.isNaN(publishedAt.getTime()) ? new Date() : publishedAt,
  };
};

export const listPublicBlogs = async (req, res) => {
  try {
    const limit = Math.min(12, Math.max(1, Number(req.query.limit || 3) || 3));
    const blogs = await Blog.find({ isPublished: true })
      .sort({ isFeatured: -1, publishedAt: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    return res.json({ blogs });
  } catch (error) {
    console.error("listPublicBlogs error:", error);
    return res.status(500).json({ message: "Failed to load blogs" });
  }
};

export const getPublicBlogBySlug = async (req, res) => {
  try {
    const blog = await Blog.findOne({
      slug: String(req.params.slug || "").trim().toLowerCase(),
      isPublished: true,
    }).lean();

    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    return res.json({ blog });
  } catch (error) {
    console.error("getPublicBlogBySlug error:", error);
    return res.status(500).json({ message: "Failed to load blog" });
  }
};

export const listAdminBlogs = async (req, res) => {
  if (!ensureAdmin(req, res)) return;

  try {
    const blogs = await Blog.find({})
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    return res.json({ blogs });
  } catch (error) {
    console.error("listAdminBlogs error:", error);
    return res.status(500).json({ message: "Failed to load blogs" });
  }
};

export const createBlog = async (req, res) => {
  if (!ensureAdmin(req, res)) return;

  try {
    const payload = await normalizeBlogPayload(req.body);
    if (req.file) {
      payload.coverImage = normalizeCoverImageUrl(req.file);
    }
    const blog = await Blog.create(payload);
    return res.status(201).json({ message: "Blog created successfully", blog });
  } catch (error) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {}
    }
    console.error("createBlog error:", error);
    return res.status(400).json({ message: error.message || "Failed to create blog" });
  }
};

export const updateBlog = async (req, res) => {
  if (!ensureAdmin(req, res)) return;

  try {
    const existing = await Blog.findById(req.params.id);
    if (!existing) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch {}
      }
      return res.status(404).json({ message: "Blog not found" });
    }

    const payload = await normalizeBlogPayload(req.body, existing._id);
    if (req.file) {
      payload.coverImage = normalizeCoverImageUrl(req.file);
    }

    const previousCoverImage = existing.coverImage || "";
    Object.assign(existing, payload);
    await existing.save();

    if (req.file && previousCoverImage && previousCoverImage !== existing.coverImage) {
      removeLocalCoverImage(previousCoverImage);
    }

    return res.json({ message: "Blog updated successfully", blog: existing });
  } catch (error) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {}
    }
    console.error("updateBlog error:", error);
    return res.status(400).json({ message: error.message || "Failed to update blog" });
  }
};

export const uploadBlogInlineImage = async (req, res) => {
  if (!ensureAdmin(req, res)) return;

  try {
    if (!req.file) {
      return res.status(400).json({ message: "Image file is required" });
    }

    return res.status(201).json({
      message: "Inline image uploaded successfully",
      image: normalizeUploadedImagePayload(req.file),
    });
  } catch (error) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {}
    }
    console.error("uploadBlogInlineImage error:", error);
    return res.status(400).json({ message: error.message || "Failed to upload image" });
  }
};

export const deleteBlog = async (req, res) => {
  if (!ensureAdmin(req, res)) return;

  try {
    const blog = await Blog.findByIdAndDelete(req.params.id);
    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    removeLocalCoverImage(blog.coverImage);

    return res.json({ message: "Blog deleted successfully" });
  } catch (error) {
    console.error("deleteBlog error:", error);
    return res.status(500).json({ message: "Failed to delete blog" });
  }
};
