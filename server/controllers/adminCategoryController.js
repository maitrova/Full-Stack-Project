import Category from "../models/Category.js";
import SubCategory from "../models/SubCategory.js";
import fs from "fs";
import path from "path";

/* ===========================
   CATEGORY CONTROLLERS
=========================== */

// CREATE CATEGORY
export const createCategory = async (req, res) => {
  try {
    const { name, altText } = req.body;

    if (!name)
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });

    if (!req.file)
      return res.status(400).json({
        success: false,
        message: "Thumbnail is required",
      });

    if (!altText)
      return res.status(400).json({
        success: false,
        message: "Alt text is required",
      });

    const thumbnailPath = `/outputs/thumbnail/${req.file.filename}`;

    const category = await Category.create({
      name,
      thumbnail: thumbnailPath,
      altText, // ✅ save alt text
    });

    res.status(201).json({
      success: true,
      data: category,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// GET ALL CATEGORIES
export const getCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE CATEGORY
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Delete thumbnail from disk
    const filePath = path.join(process.cwd(), category.thumbnail);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete related subcategories
    await SubCategory.deleteMany({ category: id });

    await category.deleteOne();

    res.status(200).json({
      success: true,
      message: "Category and related subcategories deleted",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ===========================
   SUBCATEGORY CONTROLLERS
=========================== */

// CREATE SUBCATEGORY
export const createSubCategory = async (req, res) => {
  try {
    const { name, category, altText } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Thumbnail is required",
      });
    }

    if (!altText) {
      return res.status(400).json({
        success: false,
        message: "Alt text is required",
      });
    }

    const thumbnailPath = `/outputs/thumbnail/${req.file.filename}`;

    const subCategory = await SubCategory.create({
      name,
      category,
      thumbnail: thumbnailPath,
      altText: altText.trim(), // ✅ NEW
    });

    res.status(201).json({
      success: true,
      data: subCategory,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// GET ALL SUBCATEGORIES
export const getSubCategories = async (req, res) => {
  try {
    const subCategories = await SubCategory.find()
      .populate("category", "name")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: subCategories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE SUBCATEGORY
export const deleteSubCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const subCategory = await SubCategory.findById(id);
    if (!subCategory) {
      return res.status(404).json({
        success: false,
        message: "SubCategory not found",
      });
    }

    // Delete thumbnail from disk
    const filePath = path.join(process.cwd(), subCategory.thumbnail);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await subCategory.deleteOne();

    res.status(200).json({
      success: true,
      message: "SubCategory deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// UPDATE CATEGORY
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, altText } = req.body;

    const category = await Category.findById(id);

    if (!category)
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });

    if (name) category.name = name;
    if (altText) category.altText = altText;

    if (req.file) {
      // delete old thumbnail
      const oldPath = path.join(process.cwd(), category.thumbnail);

      if (fs.existsSync(oldPath))
        fs.unlinkSync(oldPath);

      category.thumbnail = `/outputs/thumbnail/${req.file.filename}`;
    }

    await category.save();

    res.json({
      success: true,
      data: category,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};



// UPDATE SUBCATEGORY
export const updateSubCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, altText } = req.body;

    const subCategory = await SubCategory.findById(id);

    if (!subCategory) {
      return res.status(404).json({
        success: false,
        message: "SubCategory not found",
      });
    }

    // update fields
    if (name) subCategory.name = name;
    if (category) subCategory.category = category;
    if (altText) subCategory.altText = altText.trim(); // ✅ NEW

    // update thumbnail if uploaded
    if (req.file) {

      // delete old thumbnail
      const oldFilePath = path.join(process.cwd(), subCategory.thumbnail);

      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }

      subCategory.thumbnail = `/outputs/thumbnail/${req.file.filename}`;
    }

    await subCategory.save();

    res.status(200).json({
      success: true,
      message: "SubCategory updated successfully",
      data: subCategory,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
