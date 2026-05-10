import Color from "../models/Color.js";

/* ===============================
   CREATE COLOR
================================= */
export const createColor = async (req, res) => {
  try {
    const { label, value } = req.body;

    if (!label || !value) {
      return res.status(400).json({
        success: false,
        message: "Label and value are required",
      });
    }

    const existing = await Color.findOne({ value });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Color already exists",
      });
    }

    const color = await Color.create({ label, value });

    res.status(201).json({
      success: true,
      message: "Color created successfully",
      data: color,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* ===============================
   GET ALL COLORS (Admin)
================================= */
export const getAllColors = async (req, res) => {
  try {
    const colors = await Color.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: colors,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* ===============================
   UPDATE COLOR
================================= */
export const updateColor = async (req, res) => {
  try {
    const { colorId } = req.params;
    const { label, value, isActive } = req.body;

    const color = await Color.findById(colorId);
    if (!color) {
      return res.status(404).json({
        success: false,
        message: "Color not found",
      });
    }

    if (label !== undefined) color.label = label;
    if (value !== undefined) color.value = value;
    if (isActive !== undefined) color.isActive = isActive;

    await color.save();

    res.status(200).json({
      success: true,
      message: "Color updated successfully",
      data: color,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* ===============================
   DELETE COLOR
================================= */
export const deleteColor = async (req, res) => {
  try {
    const { colorId } = req.params;

    const color = await Color.findByIdAndDelete(colorId);

    if (!color) {
      return res.status(404).json({
        success: false,
        message: "Color not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Color deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getActiveColors = async (req, res) => {
  try {
    const colors = await Color.find({ isActive: true })
      .select("label value")
      .sort({ label: 1 });

    res.status(200).json({
      success: true,
      data: colors,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

