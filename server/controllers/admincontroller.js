// server/controllers/productPricingController.js
import { Product } from "../models/Product.js";

// Update product pricing configuration
export const updateProductPricing = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }

    const { id } = req.params;
    const { 
      basePrice,
      pricingMode,
      unlimitedPricing,
      normalPricing 
    } = req.body;

    // Find the product
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Update fields if provided
    if (basePrice !== undefined) {
      product.basePrice = basePrice;
    }

    if (pricingMode !== undefined) {
      if (!['normal', 'unlimited'].includes(pricingMode)) {
        return res.status(400).json({ error: "Invalid pricing mode. Must be 'normal' or 'unlimited'" });
      }
      product.pricingMode = pricingMode;
    }

    // Update unlimited pricing configuration
    if (unlimitedPricing !== undefined) {
      product.unlimitedPricing = {
        ...product.unlimitedPricing,
        ...unlimitedPricing
      };
      
      // If enabling unlimited mode, ensure pricingMode is set to 'unlimited'
      if (unlimitedPricing.enabled === true) {
        product.pricingMode = 'unlimited';
      }
      
      // If disabling unlimited mode, ensure pricingMode is set to 'normal'
      if (unlimitedPricing.enabled === false) {
        product.pricingMode = 'normal';
      }
    }

    // Update normal pricing configuration
    if (normalPricing !== undefined) {
      product.normalPricing = {
        ...product.normalPricing,
        ...normalPricing
      };
    }

    const updatedProduct = await product.save();

    res.status(200).json({
      success: true,
      message: 'Product pricing updated successfully',
      data: {
        _id: updatedProduct._id,
        name: updatedProduct.name,
        slug: updatedProduct.slug,
        basePrice: updatedProduct.basePrice,
        pricingMode: updatedProduct.pricingMode,
        unlimitedPricing: updatedProduct.unlimitedPricing,
        normalPricing: updatedProduct.normalPricing,
        currency: updatedProduct.currency
      }
    });

  } catch (error) {
    console.error('Update product pricing error:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: error.message
      });
    }
    
    if (error.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while updating product pricing',
      error: error.message
    });
  }
};

// Get product pricing configuration
export const getProductPricing = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id).select('name slug basePrice pricingMode unlimitedPricing normalPricing currency');
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product pricing retrieved successfully',
      data: {
        _id: product._id,
        name: product.name,
        slug: product.slug,
        basePrice: product.basePrice,
        pricingMode: product.pricingMode,
        unlimitedPricing: product.unlimitedPricing,
        normalPricing: product.normalPricing,
        currency: product.currency
      }
    });

  } catch (error) {
    console.error('Get product pricing error:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while retrieving product pricing',
      error: error.message
    });
  }
};

// Toggle unlimited pricing on/off
export const toggleUnlimitedPricing = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }

    const { id } = req.params;
    const { enabled, flatCharge, label, description } = req.body;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Ensure defaults (important for old docs)
    const currentUnlimited = product.unlimitedPricing || {
      enabled: false,
      flatCharge: 0,
      label: "",
      description: "",
    };

    const nextEnabled =
      enabled !== undefined ? Boolean(enabled) : !Boolean(currentUnlimited.enabled);

    product.unlimitedPricing = {
      ...currentUnlimited,
      enabled: nextEnabled,
      flatCharge: flatCharge ?? currentUnlimited.flatCharge,
      label: label ?? currentUnlimited.label,
      description: description ?? currentUnlimited.description,
    };

    product.pricingMode = nextEnabled ? "unlimited" : "normal";

    const updatedProduct = await product.save();

    return res.status(200).json({
      success: true,
      message: nextEnabled
        ? "Unlimited pricing enabled"
        : "Unlimited pricing disabled",
      data: {
        _id: updatedProduct._id,
        name: updatedProduct.name,
        pricingMode: updatedProduct.pricingMode,
        unlimitedPricing: updatedProduct.unlimitedPricing,
      },
    });
  } catch (error) {
    console.error("Toggle unlimited pricing error:", error);

    if (error?.kind === "ObjectId") {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error while toggling unlimited pricing",
      error: error.message,
    });
  }
};


// Update normal pricing parameters
export const updateNormalPricing = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }

    const { id } = req.params;
    const { fixedSizeInches, pricePerSqInch, sleevePrice } = req.body;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Validate inputs
    if (fixedSizeInches !== undefined && fixedSizeInches <= 0) {
      return res.status(400).json({ error: "Fixed size must be greater than 0" });
    }
    
    if (pricePerSqInch !== undefined && pricePerSqInch < 0) {
      return res.status(400).json({ error: "Price per sq.inch cannot be negative" });
    }
    
    if (sleevePrice !== undefined && sleevePrice < 0) {
      return res.status(400).json({ error: "Sleeve price cannot be negative" });
    }

    // Update normal pricing
    product.normalPricing = {
      ...product.normalPricing,
      fixedSizeInches: fixedSizeInches || product.normalPricing.fixedSizeInches,
      pricePerSqInch: pricePerSqInch || product.normalPricing.pricePerSqInch,
      sleevePrice: sleevePrice || product.normalPricing.sleevePrice
    };

    // Ensure pricing mode is set to normal
    product.pricingMode = 'normal';

    const updatedProduct = await product.save();

    res.status(200).json({
      success: true,
      message: 'Normal pricing updated successfully',
      data: {
        _id: updatedProduct._id,
        name: updatedProduct.name,
        pricingMode: updatedProduct.pricingMode,
        normalPricing: updatedProduct.normalPricing
      }
    });

  } catch (error) {
    console.error('Update normal pricing error:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while updating normal pricing',
      error: error.message
    });
  }
};

// Update base price only
export const updateBasePrice = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }

    const { id } = req.params;
    const { basePrice } = req.body;

    if (!basePrice && basePrice !== 0) {
      return res.status(400).json({ error: "Base price is required" });
    }

    if (basePrice < 0) {
      return res.status(400).json({ error: "Base price cannot be negative" });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    product.basePrice = basePrice;
    const updatedProduct = await product.save();

    res.status(200).json({
      success: true,
      message: 'Base price updated successfully',
      data: {
        _id: updatedProduct._id,
        name: updatedProduct.name,
        basePrice: updatedProduct.basePrice,
        pricingMode: updatedProduct.pricingMode
      }
    });

  } catch (error) {
    console.error('Update base price error:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while updating base price',
      error: error.message
    });
  }
};