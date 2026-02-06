import Category from "../models/Category.js";
import SubCategory from "../models/SubCategory.js";


export const slugify = (text = "") =>
  text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");


const makeThumb = (req) => {
  if (!req.file) return null;
  const filename = req.file.filename;
  return {
    filename,
    url: `/outputs/thumbnail/${filename}`, // served by express.static
  };
};

// ✅ CREATE CATEGORY
export const adminCreateCategory = async (req, res) => {
  try {
    const { name, sortOrder = 0, isActive = true } = req.body;

    if (!name) return res.status(400).json({ success: false, message: "Category name is required" });

    const thumb = makeThumb(req);
    if (!thumb) return res.status(400).json({ success: false, message: "Thumbnail is required" });

    const slug = slugify(name);

    const exists = await Category.findOne({ $or: [{ name }, { slug }] });
    if (exists) return res.status(409).json({ success: false, message: "Category already exists" });

    const category = await Category.create({
      name,
      slug,
      thumbnail: thumb,
      sortOrder: Number(sortOrder),
      isActive: String(isActive) === "true" || isActive === true,
    });

    res.status(201).json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ CREATE SUBCATEGORY
export const adminCreateSubCategory = async (req, res) => {
  try {
    const { categoryId, name, sortOrder = 0, isActive = true } = req.body;

    if (!categoryId) return res.status(400).json({ success: false, message: "categoryId is required" });
    if (!name) return res.status(400).json({ success: false, message: "SubCategory name is required" });

    const cat = await Category.findById(categoryId);
    if (!cat) return res.status(404).json({ success: false, message: "Category not found" });

    const thumb = makeThumb(req);
    if (!thumb) return res.status(400).json({ success: false, message: "Thumbnail is required" });

    const slug = slugify(name);

    const exists = await SubCategory.findOne({ category: categoryId, slug });
    if (exists) return res.status(409).json({ success: false, message: "SubCategory already exists in this category" });

    const subCategory = await SubCategory.create({
      category: categoryId,
      name,
      slug,
      thumbnail: thumb,
      sortOrder: Number(sortOrder),
      isActive: String(isActive) === "true" || isActive === true,
    });

    res.status(201).json({ success: true, data: subCategory });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ LIST CATEGORIES (for admin dropdown)
export const adminListCategories = async (req, res) => {
  try {
    const data = await Category.find().sort({ sortOrder: 1, createdAt: -1 });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ LIST SUBCATEGORIES BY CATEGORY
export const adminListSubCategories = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const data = await SubCategory.find({ category: categoryId }).sort({ sortOrder: 1, createdAt: -1 });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
