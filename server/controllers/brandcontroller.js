import Brand from "../models/Brand.js";

/* ===========================
   CREATE BRAND
=========================== */
export const createBrand = async (req, res) => {
  try {
    const { name, subCategory } = req.body;

    const brand = await Brand.create({
      name,
      subCategory,
    });

    res.status(201).json({ success: true, data: brand });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ===========================
   GET ALL BRANDS
=========================== */
export const getBrands = async (req, res) => {
  try {
    const brands = await Brand.find()
      .populate("subCategory", "name")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: brands });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ===========================
   GET BRANDS BY SUBCATEGORY
=========================== */
export const getBrandsBySubCategory = async (req, res) => {
  try {
    const { subCategoryId } = req.params;

    const brands = await Brand.find({ subCategory: subCategoryId });

    res.status(200).json({ success: true, data: brands });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ===========================
   UPDATE BRAND
=========================== */
export const updateBrand = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, subCategory } = req.body;

    const brand = await Brand.findById(id);

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found",
      });
    }

    if (name) brand.name = name;
    if (subCategory) brand.subCategory = subCategory;

    await brand.save();

    res.status(200).json({
      success: true,
      message: "Brand updated successfully",
      data: brand,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ===========================
   DELETE BRAND
=========================== */
export const deleteBrand = async (req, res) => {
  try {
    const { id } = req.params;

    const brand = await Brand.findById(id);

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found",
      });
    }

    await brand.deleteOne();

    res.status(200).json({
      success: true,
      message: "Brand deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
