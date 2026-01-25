import { Design } from "../models/Design.js";
import { Product } from "../models/Product.js";

// Function to get price for a specific product design
export const getProductPrice = async (req, res) => {
  const { designId, selectedSize } = req.params;

  try {
    // Fetch the design document
    const design = await Design.findById(designId);
    console.log("Fetched Design:", design.priceBreakdown);
    
    if (!design) {
      return res.status(404).json({ message: "Design not found" });
    }

    // Fetch the associated product
    const product = await Product.findById(design.product);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Get the base price for the selected size
    const sizePricing = product.sizePricing.find(
      (size) => size.size === selectedSize
    );

    if (!sizePricing) {
      return res.status(400).json({ message: "Invalid size selected" });
    }

    const basePrice = sizePricing.price;
    
    // Convert priceBreakdown Map to object
    let priceBreakdown;
    if (design.priceBreakdown instanceof Map) {
      // Convert Map to plain object
      priceBreakdown = Object.fromEntries(design.priceBreakdown);
    } else {
      priceBreakdown = design.priceBreakdown || {};
    }

    console.log("Converted priceBreakdown:", priceBreakdown);

    // Initialize additional charges
    let additionalCharges = 0;

    // Add charges for design layers
    if (priceBreakdown.designLayers && Array.isArray(priceBreakdown.designLayers)) {
      priceBreakdown.designLayers.forEach(layer => {
        additionalCharges += Number(layer.price) || 0;
      });
    }

    // Add charges for text layers
    if (priceBreakdown.textLayers && Array.isArray(priceBreakdown.textLayers)) {
      priceBreakdown.textLayers.forEach(textLayer => {
        additionalCharges += Number(textLayer.price) || 0;
      });
    }

    // Add minimum design charges
    if (priceBreakdown.minimumDesignCharges) {
      additionalCharges += Number(priceBreakdown.minimumDesignCharges) || 0;
    }

    // Total calculated price
    const calculatedPrice = basePrice + additionalCharges;

    // Return the price details
    res.status(200).json({
      basePrice,
      additionalCharges,
      calculatedPrice,
      size: selectedSize,
      currency: product.currency,
      priceBreakdown: {
        designLayers: priceBreakdown.designLayers || [],
        textLayers: priceBreakdown.textLayers || [],
        minimumDesignCharges: priceBreakdown.minimumDesignCharges || 0,
        totalCustomization: additionalCharges
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};


